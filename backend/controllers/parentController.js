import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import Homework from '../models/Homework.js';
import Fee from '../models/Fee.js';
import Report from '../models/Report.js';
import Test from '../models/Test.js';
import Timetable from '../models/Timetable.js';
import Announcement from '../models/Announcement.js';
import Course from '../models/Course.js';
import { verifyParentChildAccess } from '../utils/parentAuth.js';

// @desc    Get parent's linked children
// @route   GET /api/parent/children
export const getChildren = async (req, res, next) => {
  try {
    const childIds = (req.user.children || []).map(child => child.studentId).filter(Boolean);
    const children = await User.find({ _id: { $in: childIds }, role: 'student' })
      .select('name uniqueId class rollNumber profilePicture');
    res.status(200).json({ success: true, count: children.length, children });
  } catch (error) {
    next(error);
  }
};

// @desc    Get child attendance
// @route   GET /api/parent/children/:id/attendance
export const getChildAttendance = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    // Strict IDOR Verification
    const isAuthorized = await verifyParentChildAccess(req.user, studentId);
    if (!isAuthorized && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to access records for this student.'
      });
    }

    const records = await Attendance.find({ studentId }).sort({ date: -1 });
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

    res.status(200).json({ success: true, percentage, count: total, records });
  } catch (error) {
    next(error);
  }
};

// @desc    Get child fees
// @route   GET /api/parent/children/:id/fees
export const getChildFees = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    // Strict IDOR Verification
    const isAuthorized = await verifyParentChildAccess(req.user, studentId);
    if (!isAuthorized && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view fee records for this student.'
      });
    }

    const fees = await Fee.find({ studentId }).sort({ dueDate: -1 });

    res.status(200).json({ success: true, count: fees.length, fees });
  } catch (error) {
    next(error);
  }
};

// @desc    Get child academic reports
// @route   GET /api/parent/children/:id/reports
export const getChildReports = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    // Strict IDOR Verification
    const isAuthorized = await verifyParentChildAccess(req.user, studentId);
    if (!isAuthorized && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view academic reports for this student.'
      });
    }

    const reports = await Report.find({ studentId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: reports.length, reports });
  } catch (error) {
    next(error);
  }
};

// @desc    Get child test codes and marks (online and offline) for coaching classes
// @route   GET /api/parent/children/:id/tests
export const getChildTests = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    // Strict IDOR Verification
    const isAuthorized = await verifyParentChildAccess(req.user, studentId);
    if (!isAuthorized && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view test records for this student.'
      });
    }

    const student = await User.findById(studentId).select('class name');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Find tests for this student's class
    const tests = await Test.find({ class: student.class }).sort({ testDate: -1, createdAt: -1 });

    const results = tests.map(test => {
      const attempt = test.attempts?.find(a => a.studentId?.toString() === studentId.toString());
      return {
        _id: test._id,
        testCode: test.testCode,
        title: test.title,
        subject: test.subject,
        class: test.class,
        mode: test.mode || 'online',
        totalMarks: test.totalMarks,
        passingMarks: test.passingMarks,
        testDate: test.testDate || test.createdAt,
        status: test.status,
        attempted: Boolean(attempt),
        score: attempt ? attempt.score : null,
        percentage: attempt ? attempt.percentage : null,
        attemptMode: attempt ? (attempt.mode || test.mode) : null,
        remarks: attempt?.remarks || '',
        submittedAt: attempt?.submittedAt || null
      };
    });

    res.status(200).json({ success: true, count: results.length, tests: results });
  } catch (error) {
    next(error);
  }
};

export const getChildHomework = async (req, res, next) => {
  try {
    const student = await User.findById(req.params.id).select('class');
    if (!student || (req.user.role !== 'admin' && !verifyParentChildAccess(req.user, student._id))) {
      return res.status(404).json({ success: false, message: 'Linked student not found' });
    }

    const assignments = await Homework.find({ class: student.class }).sort({ dueDate: 1 });
    const homework = assignments.map((assignment) => {
      const data = assignment.toObject();
      const ownSubmission = data.submissions?.find(
        submission => submission.studentId?.toString() === student._id.toString()
      );
      data.submitted = Boolean(ownSubmission);
      data.studentSubmission = ownSubmission || null;
      delete data.submissions;
      return data;
    });
    res.status(200).json({ success: true, homework });
  } catch (error) {
    next(error);
  }
};

export const getChildTimetable = async (req, res, next) => {
  try {
    const student = await User.findById(req.params.id).select('class');
    if (!student || (req.user.role !== 'admin' && !verifyParentChildAccess(req.user, student._id))) {
      return res.status(404).json({ success: false, message: 'Linked student not found' });
    }

    const timetable = await Timetable.find({ class: student.class }).sort({ day: 1, startTime: 1 });
    res.status(200).json({ success: true, timetable });
  } catch (error) {
    next(error);
  }
};

export const getChildAnnouncements = async (req, res, next) => {
  try {
    const student = await User.findById(req.params.id).select('class');
    if (!student || (req.user.role !== 'admin' && !verifyParentChildAccess(req.user, student._id))) {
      return res.status(404).json({ success: false, message: 'Linked student not found' });
    }

    const announcements = await Announcement.find({
      isPublished: true,
      $or: [
        { targetRoles: { $in: ['parent', 'student'] } },
        { targetRoles: { $size: 0 } },
        { targetClasses: student.class }
      ]
    }).sort({ createdAt: -1 }).limit(10);
    res.status(200).json({ success: true, announcements });
  } catch (error) {
    next(error);
  }
};

// @desc    Get child enrolled courses and subject fee breakdown
// @route   GET /api/parent/children/:id/courses
export const getChildCourses = async (req, res, next) => {
  try {
    const studentId = req.params.id;
    const isAuthorized = await verifyParentChildAccess(req.user, studentId);
    if (!isAuthorized && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view course records for this student.'
      });
    }

    const student = await User.findById(studentId).populate('enrolledCourses');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found' });
    }

    let enrolled = student.enrolledCourses || [];
    if (enrolled.length === 0) {
      const classCourses = await Course.find({ class: student.class }).sort({ name: 1 });
      if (classCourses.length > 0) {
        enrolled = classCourses;
      }
    }

    const totalFee = enrolled.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);

    res.status(200).json({
      success: true,
      studentName: student.name,
      class: student.class,
      enrolledCourses: enrolled,
      totalFee
    });
  } catch (error) {
    next(error);
  }
};
