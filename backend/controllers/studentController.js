import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import Homework from '../models/Homework.js';
import Test from '../models/Test.js';
import Report from '../models/Report.js';
import Announcement from '../models/Announcement.js';
import Course from '../models/Course.js';
import { evaluateStudentAnswers, toStudentTest } from '../utils/studentTest.js';

// @desc    Get student dashboard summary
// @route   GET /api/student/dashboard
export const getStudentDashboard = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const userClass = req.user.class;

    const [attendanceRecords, activeHomework, availableTests, announcements] = await Promise.all([
      Attendance.find({ studentId }),
      Homework.find({ class: userClass, status: { $ne: 'expired' } }),
      Test.find({ class: userClass, status: 'published' }),
      Announcement.find({
        $or: [
          { targetRoles: 'student' },
          { targetRoles: { $size: 0 } },
          { targetClasses: userClass }
        ]
      }).sort({ createdAt: -1 }).limit(5)
    ]);

    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
    const attendancePercentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : 0;

    res.status(200).json({
      success: true,
      stats: {
        attendancePercentage,
        totalAttendanceDays: totalDays,
        pendingHomeworkCount: activeHomework.length,
        availableTestsCount: availableTests.length,
        studentName: req.user.name,
        class: req.user.class,
        rollNumber: req.user.rollNumber,
        announcements
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student attendance history
// @route   GET /api/student/attendance
export const getStudentAttendance = async (req, res, next) => {
  try {
    const attendance = await Attendance.find({ studentId: req.user._id }).sort({ date: -1 });
    res.status(200).json({ success: true, count: attendance.length, attendance });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student homework list
// @route   GET /api/student/homework
export const getStudentHomework = async (req, res, next) => {
  try {
    const homework = await Homework.find({ class: req.user.class }).sort({ dueDate: 1 });
    res.status(200).json({ success: true, count: homework.length, homework });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit homework with duplicate prevention / update
// @route   POST /api/student/homework/:id/submit
export const submitHomework = async (req, res, next) => {
  try {
    const { fileUrl } = req.body;
    if (typeof fileUrl !== 'string' || fileUrl.length > 2048) {
      return res.status(400).json({ success: false, message: 'Provide a valid HTTPS link to your submission' });
    }
    let submissionUrl;
    try {
      submissionUrl = new URL(fileUrl);
    } catch {
      return res.status(400).json({ success: false, message: 'Provide a valid HTTPS link to your submission' });
    }
    if (submissionUrl.protocol !== 'https:' || submissionUrl.username || submissionUrl.password) {
      return res.status(400).json({ success: false, message: 'Submission links must use HTTPS and cannot contain credentials' });
    }
    const homework = await Homework.findById(req.params.id);

    if (!homework) {
      return res.status(404).json({ success: false, message: 'Homework task not found' });
    }

    if (homework.class !== req.user.class) {
      return res.status(403).json({ success: false, message: 'This homework is not assigned to your class' });
    }

    // Check if student has already submitted
    const existingIndex = homework.submissions.findIndex(
      s => s.studentId && s.studentId.toString() === req.user._id.toString()
    );

    if (existingIndex > -1) {
      // Update existing submission (Controlled resubmission update)
      homework.submissions[existingIndex].fileUrl = submissionUrl.href;
      homework.submissions[existingIndex].submittedAt = new Date();
      homework.submissions[existingIndex].feedback = 'Resubmitted / Updated';
      await homework.save();

      return res.status(200).json({
        success: true,
        message: 'Homework submission updated successfully!',
        submission: homework.submissions[existingIndex]
      });
    }

    // New submission
    const newSubmission = {
      studentId: req.user._id,
      studentName: req.user.name,
      fileUrl: submissionUrl.href,
      submittedAt: new Date()
    };

    homework.submissions.push(newSubmission);
    await homework.save();

    res.status(200).json({
      success: true,
      message: 'Homework submitted successfully!',
      submission: newSubmission
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available tests
// @route   GET /api/student/tests
export const getStudentTests = async (req, res, next) => {
  try {
    const tests = await Test.find({ class: req.user.class, status: 'published' });
    const safeTests = tests.map(test => toStudentTest(test, req.user._id));
    res.status(200).json({ success: true, count: safeTests.length, tests: safeTests });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit test attempt and calculate dynamic auto-graded score
// @route   POST /api/student/tests/:id/submit
export const submitTestAttempt = async (req, res, next) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Only students can submit test attempts' });
    }
    const test = await Test.findById(req.params.id);

    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    if (test.status !== 'published' || test.class !== req.user.class) {
      return res.status(404).json({ success: false, message: 'Test is not available to this student' });
    }

    const alreadySubmitted = test.attempts.some(
      attempt => attempt.studentId?.toString() === req.user._id.toString()
    );
    if (alreadySubmitted) {
      return res.status(409).json({ success: false, message: 'You have already submitted this test' });
    }

    const evaluation = evaluateStudentAnswers(test.questions, req.body.answers);
    if (evaluation.error) {
      return res.status(400).json({ success: false, message: evaluation.error });
    }
    const score = evaluation.score;
    const totalQuestions = test.questions.length;
    const totalMarks = test.totalMarks || (totalQuestions * 1);
    const percentage = totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(1)) : 0;
    const isPassed = score >= (test.passingMarks || Math.ceil(totalMarks * 0.4));

    const attemptData = {
      studentId: req.user._id,
      studentName: req.user.name,
      score,
      percentage,
      submittedAt: new Date()
    };

    const update = await Test.updateOne(
      {
        _id: test._id,
        status: 'published',
        class: req.user.class,
        'attempts.studentId': { $ne: req.user._id }
      },
      { $push: { attempts: attemptData } }
    );
    if (update.modifiedCount !== 1) {
      return res.status(409).json({ success: false, message: 'This test attempt was already submitted or the test is no longer available' });
    }

    res.status(200).json({
      success: true,
      message: 'Test evaluated successfully!',
      result: {
        score,
        totalMarks,
        totalQuestions,
        percentage,
        isPassed
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dynamic student leaderboard based on real academic scores
// @route   GET /api/student/leaderboard
export const getLeaderboard = async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student' }).select('name uniqueId class');
    const studentIds = students.map(s => s._id);

    // Fetch real test attempts and report card scores
    const [allTests, allReports, allAttendance] = await Promise.all([
      Test.find({ 'attempts.studentId': { $in: studentIds } }),
      Report.find({ studentId: { $in: studentIds } }),
      Attendance.find({ studentId: { $in: studentIds } })
    ]);

    // Aggregate performance per student
    const studentMetrics = students.map(student => {
      let totalTestScore = 0;
      let testsAttempted = 0;

      allTests.forEach(test => {
        const attempt = test.attempts.find(a => a.studentId && a.studentId.toString() === student._id.toString());
        if (attempt) {
          totalTestScore += Number(attempt.score || 0);
          testsAttempted++;
        }
      });

      let reportScore = 0;
      const studentReports = allReports.filter(r => r.studentId && r.studentId.toString() === student._id.toString());
      studentReports.forEach(r => {
        reportScore += Number(r.totalMarks || 0);
      });

      const studentAttendance = allAttendance.filter(a => a.studentId && a.studentId.toString() === student._id.toString());
      const presentCount = studentAttendance.filter(a => a.status === 'present').length;
      const attendancePoints = presentCount * 5; // 5 pts per present day

      // Total dynamic points formula
      const totalPoints = (totalTestScore * 10) + reportScore + attendancePoints;

      return {
        id: student.uniqueId || student._id,
        name: student.name,
        class: student.class || '10',
        points: totalPoints,
        testsCompleted: testsAttempted,
        presentDays: presentCount
      };
    });

    // Sort by points descending
    studentMetrics.sort((a, b) => b.points - a.points);

    // Assign dynamic ranks (handling ties)
    let currentRank = 1;
    const rankedLeaderboard = studentMetrics.map((item, index) => {
      if (index > 0 && item.points < studentMetrics[index - 1].points) {
        currentRank = index + 1;
      }
      return {
        rank: currentRank,
        ...item
      };
    });

    res.status(200).json({ success: true, count: rankedLeaderboard.length, leaderboard: rankedLeaderboard });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student enrolled courses and subject fee breakdown
// @route   GET /api/student/courses
export const getStudentCourses = async (req, res, next) => {
  try {
    const student = await User.findById(req.user._id).populate('enrolledCourses');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found' });
    }

    const availableCourses = await Course.find({ class: student.class }).sort({ name: 1 });
    
    // If student has no enrolledCourses yet, default to all courses of their class
    let enrolled = student.enrolledCourses || [];
    if (enrolled.length === 0 && availableCourses.length > 0) {
      enrolled = availableCourses;
      student.enrolledCourses = availableCourses.map(c => c._id);
      await student.save();
    }

    const totalFee = enrolled.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);

    res.status(200).json({
      success: true,
      availableCourses,
      enrolledCourses: enrolled,
      totalFee
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Enroll / update student's selected courses and recalculate fee
// @route   POST /api/student/courses
export const updateStudentCourses = async (req, res, next) => {
  try {
    const { courseIds } = req.body;
    if (!Array.isArray(courseIds)) {
      return res.status(400).json({ success: false, message: 'courseIds must be an array of course IDs' });
    }

    const student = await User.findById(req.user._id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found' });
    }

    // Verify all courses exist and belong to the student's class
    const validCourses = await Course.find({ _id: { $in: courseIds }, class: student.class });
    student.enrolledCourses = validCourses.map(c => c._id);
    await student.save();

    const totalFee = validCourses.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);

    res.status(200).json({
      success: true,
      message: 'Enrolled courses updated successfully',
      enrolledCourses: validCourses,
      totalFee
    });
  } catch (error) {
    next(error);
  }
};
