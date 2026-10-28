import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import Homework from '../models/Homework.js';
import Test from '../models/Test.js';
import Fee from '../models/Fee.js';
import Announcement from '../models/Announcement.js';
import { notifyUsers } from '../utils/userNotifications.js';
import Report from '../models/Report.js';
import { generateUniqueId } from '../utils/generateId.js';
import AuditLog from '../models/AuditLog.js';
import { recordAuditEvent } from '../utils/auditLog.js';

// @desc    Get all users with optional role & search filtering
// @route   GET /api/admin/users
export const getAllUsers = async (req, res, next) => {
  try {
    const { role, search, class: className } = req.query;
    let query = {};

    if (role && role !== 'all') {
      query.role = role;
    }
    if (className) {
      query.class = className;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { uniqueId: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user
// @route   POST /api/admin/users
export const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, subject, assignedClasses, rollNumber, class: className, parentEmail, phone, address } = req.body;

    if (role === 'teacher' && (!Array.isArray(assignedClasses) || assignedClasses.length === 0)) {
      return res.status(400).json({ success: false, message: 'Assign at least one grade to the teacher' });
    }
    if (role === 'student' && !className) {
      return res.status(400).json({ success: false, message: 'Select a grade from 7 to 10 for the student' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const uniqueId = generateUniqueId(role);
    const user = await User.create({
      uniqueId,
      name,
      email: email.toLowerCase(),
      password: password || 'Kashvi@123',
      role: role || 'student',
      subject,
      assignedClasses,
      rollNumber,
      class: className,
      parentEmail,
      phone,
      address
    });

    await recordAuditEvent(req, {
      action: 'user.create',
      targetType: 'user',
      targetId: user._id,
      summary: `Created ${user.role} account`
    });
    res.status(201).json({ success: true, message: 'User created successfully', user });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
export const updateUser = async (req, res, next) => {
  try {
    const { password, ...updateData } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await recordAuditEvent(req, {
      action: 'user.update',
      targetType: 'user',
      targetId: user._id,
      summary: `Updated ${user.role} account`
    });
    res.status(200).json({ success: true, message: 'User updated successfully', user });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    await recordAuditEvent(req, {
      action: 'user.delete',
      targetType: 'user',
      targetId: user._id,
      summary: `Deleted ${user.role} account`
    });
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user status (Active/Inactive)
// @route   PUT /api/admin/users/:id/toggle-status
export const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    await recordAuditEvent(req, {
      action: 'user.status',
      targetType: 'user',
      targetId: user._id,
      summary: `${user.isActive ? 'Activated' : 'Deactivated'} ${user.role} account`
    });

    res.status(200).json({ success: true, message: `User status changed to ${user.isActive ? 'Active' : 'Inactive'}`, isActive: user.isActive });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset user password by admin
// @route   POST /api/admin/users/:id/reset-password
export const resetUserPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword || 'Kashvi@123';
    user.passwordChangedAt = new Date();
    await user.save();
    await recordAuditEvent(req, {
      action: 'user.password_reset',
      targetType: 'user',
      targetId: user._id,
      summary: `Reset password for ${user.role} account`
    });

    res.status(200).json({ success: true, message: 'Password reset successfully for user' });
  } catch (error) {
    next(error);
  }
};

export const linkStudentToParent = async (req, res, next) => {
  try {
    const { studentId, relationship = 'Parent' } = req.body;
    const [parent, student] = await Promise.all([
      User.findOne({ _id: req.params.parentId, role: 'parent' }),
      User.findOne({ _id: studentId, role: 'student' })
    ]);
    if (!parent || !student) {
      return res.status(404).json({ success: false, message: 'Parent or student account was not found' });
    }

    const alreadyLinked = parent.children.some(child => child.studentId?.toString() === student._id.toString());
    if (!alreadyLinked) {
      parent.children.push({
        studentId: student._id,
        studentName: student.name,
        relationship: relationship.trim() || 'Parent'
      });
    }
    if (!student.parents.some(parentId => parentId.toString() === parent._id.toString())) {
      student.parents.push(parent._id);
    }
    if (!student.parentEmail) student.parentEmail = parent.email;
    await Promise.all([parent.save(), student.save()]);
    await recordAuditEvent(req, {
      action: alreadyLinked ? 'parent_student.sync' : 'parent_student.link',
      targetType: 'parent_student',
      targetId: student._id,
      summary: `${alreadyLinked ? 'Synchronized' : 'Linked'} a student and parent account`
    });
    res.status(alreadyLinked ? 200 : 201).json({
      success: true,
      message: alreadyLinked ? 'Parent-student link is synchronized' : 'Student linked to parent',
      child: { id: student._id, name: student.name }
    });
  } catch (error) {
    next(error);
  }
};

export const unlinkStudentFromParent = async (req, res, next) => {
  try {
    const parent = await User.findOne({ _id: req.params.parentId, role: 'parent' });
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent account was not found' });
    }
    const beforeCount = parent.children.length;
    parent.children = parent.children.filter(
      child => child.studentId?.toString() !== req.params.studentId
    );
    if (parent.children.length === beforeCount) {
      return res.status(404).json({ success: false, message: 'Student is not linked to this parent' });
    }
    const student = await User.findOne({ _id: req.params.studentId, role: 'student' });
    if (student) {
      student.parents = student.parents.filter(parentId => parentId.toString() !== parent._id.toString());
      if (student.parentEmail === parent.email) {
        const remainingParent = student.parents.length
          ? await User.findOne({ _id: { $in: student.parents }, role: 'parent' }).select('email')
          : null;
        student.parentEmail = remainingParent?.email || '';
      }
      await Promise.all([parent.save(), student.save()]);
    } else {
      await parent.save();
    }
    await recordAuditEvent(req, {
      action: 'parent_student.unlink',
      targetType: 'parent_student',
      targetId: req.params.studentId,
      summary: 'Unlinked a student and parent account'
    });
    res.status(200).json({ success: true, message: 'Student unlinked from parent' });
  } catch (error) {
    next(error);
  }
};

export const linkStudentToTeacher = async (req, res, next) => {
  try {
    const [teacher, student] = await Promise.all([
      User.findOne({ _id: req.params.teacherId, role: 'teacher' }),
      User.findOne({ _id: req.body.studentId, role: 'student' })
    ]);
    if (!teacher || !student) {
      return res.status(404).json({ success: false, message: 'Teacher or student account was not found' });
    }
    if (!teacher.assignedClasses.includes(student.class)) {
      return res.status(400).json({ success: false, message: 'The teacher must be assigned to the student’s grade first' });
    }
    if (teacher.linkedStudents.some(studentId => studentId.toString() === student._id.toString())) {
      return res.status(409).json({ success: false, message: 'Student is already linked to this teacher' });
    }

    teacher.linkedStudents.push(student._id);
    await teacher.save();
    await recordAuditEvent(req, {
      action: 'teacher_student.link',
      targetType: 'teacher_student',
      targetId: student._id,
      summary: 'Linked a student to a teacher'
    });
    res.status(201).json({ success: true, message: 'Student linked to teacher', student: { id: student._id, name: student.name } });
  } catch (error) {
    next(error);
  }
};

export const unlinkStudentFromTeacher = async (req, res, next) => {
  try {
    const teacher = await User.findOne({ _id: req.params.teacherId, role: 'teacher' });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher account was not found' });
    }
    const beforeCount = teacher.linkedStudents.length;
    teacher.linkedStudents = teacher.linkedStudents.filter(
      studentId => studentId.toString() !== req.params.studentId
    );
    if (teacher.linkedStudents.length === beforeCount) {
      return res.status(404).json({ success: false, message: 'Student is not linked to this teacher' });
    }
    await teacher.save();
    await recordAuditEvent(req, {
      action: 'teacher_student.unlink',
      targetType: 'teacher_student',
      targetId: req.params.studentId,
      summary: 'Unlinked a student from a teacher'
    });
    res.status(200).json({ success: true, message: 'Student unlinked from teacher' });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req, res, next) => {
  try {
    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(requestedPage) ? Math.max(requestedPage, 1) : 1;
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
    const [logs, total] = await Promise.all([
      AuditLog.find().sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
      AuditLog.countDocuments()
    ]);
    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      logs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get complete admin dashboard analytics & KPI cards
// @route   GET /api/admin/dashboard-stats
export const getDashboardStats = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const feeMatch = {};
    if (month && month !== 'all') {
      feeMatch.month = month;
    }
    if (year && year !== 'all') {
      const numericYear = Number(year);
      feeMatch.year = Number.isNaN(numericYear) ? year : numericYear;
    }

    const [totalStudents, totalTeachers, totalParents, totalAnnouncements, recentFees, recentAttendance] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'parent' }),
      Announcement.countDocuments({ isPublished: true }),
      Fee.find(feeMatch).sort({ createdAt: -1 }).limit(5),
      Attendance.find().sort({ date: -1 }).limit(10)
    ]);

    const pipeline = [];
    if (Object.keys(feeMatch).length > 0) {
      pipeline.push({ $match: feeMatch });
    }
    pipeline.push({
      $group: {
        _id: '$status',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    });

    const feeAgg = await Fee.aggregate(pipeline);

    let totalCollected = 0;
    let pendingFee = 0;
    feeAgg.forEach(f => {
      if (f._id === 'paid') totalCollected = f.totalAmount;
      if (f._id === 'pending' || f._id === 'overdue') pendingFee += f.totalAmount;
    });

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalTeachers,
        totalParents,
        totalAnnouncements,
        totalCollected,
        totalCollectedFees: totalCollected,
        pendingFee,
        selectedMonth: month || 'all',
        selectedYear: year || 'all',
        recentFees,
        recentAttendance
      }
    });
  } catch (error) {
    next(error);
  }
};

// Announcements CRUD for Admin
export const createAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.create(req.body);
    if (announcement.isPublished) {
      const targetRoles = announcement.targetRoles?.length
        ? announcement.targetRoles
        : ['admin', 'teacher', 'student', 'parent'];
      let recipients;
      if (!announcement.targetClasses?.length) {
        recipients = await User.find({ role: { $in: targetRoles } }).select('_id');
      } else {
        const classStudents = await User.find({
          role: 'student',
          class: { $in: announcement.targetClasses }
        }).select('_id');
        const queries = [];
        const nonParentRoles = targetRoles.filter(role => role !== 'parent');
        if (nonParentRoles.length) {
          queries.push(User.find({
            role: { $in: nonParentRoles },
            $or: [
              { class: { $in: announcement.targetClasses } },
              { assignedClasses: { $in: announcement.targetClasses } }
            ]
          }).select('_id'));
        }
        if (targetRoles.includes('parent')) {
          queries.push(User.find({
            role: 'parent',
            'children.studentId': { $in: classStudents.map(student => student._id) }
          }).select('_id'));
        }
        recipients = (await Promise.all(queries)).flat();
      }
      await notifyUsers(recipients.map(user => user._id), {
        type: 'announcement',
        title: announcement.title,
        message: announcement.content,
        dedupeKey: `announcement:${announcement._id}`
      });
    }
    res.status(201).json({ success: true, announcement });
  } catch (error) {
    next(error);
  }
};

export const getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: announcements.length, announcements });
  } catch (error) {
    next(error);
  }
};

export const deleteAnnouncement = async (req, res, next) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    next(error);
  }
};
