import mongoose from 'mongoose';
import Course from '../models/Course.js';
import User from '../models/User.js';

const validateCourseInput = async (body = {}) => {
  const { name, code, class: className, description = '', teacherId, fee, cost } = body;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 ||
      typeof code !== 'string' || !code.trim() || code.trim().length > 40 ||
      typeof className !== 'string' || !className.trim() || className.trim().length > 60 ||
      typeof description !== 'string' || description.length > 2000) {
    return { error: 'Course name, code, class, and a valid description are required' };
  }
  const courseFee = Number(fee !== undefined ? fee : (cost !== undefined ? cost : 0));
  if (Number.isNaN(courseFee) || courseFee < 0) {
    return { error: 'Course fee must be a valid non-negative number' };
  }
  let teacher;
  if (teacherId) {
    if (!mongoose.isValidObjectId(teacherId)) return { error: 'A valid teacher account is required' };
    teacher = await User.findOne({ _id: teacherId, role: 'teacher', isActive: true }).select('name assignedClasses');
    if (!teacher || !teacher.assignedClasses?.includes(className.trim())) {
      return { error: 'The selected teacher must be active and assigned to this class' };
    }
  }
  return {
    value: {
      name: name.trim(),
      code: code.trim(),
      class: className.trim(),
      description: description.trim(),
      fee: courseFee,
      teacherId: teacher?._id || null,
      teacherName: teacher?.name || ''
    }
  };
};

export const getCourses = async (req, res, next) => {
  try {
    const courses = await Course.find().sort({ class: 1, name: 1 }).limit(500);
    res.status(200).json({ success: true, courses });
  } catch (error) {
    next(error);
  }
};

export const createCourse = async (req, res, next) => {
  try {
    const { value, error } = await validateCourseInput(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const duplicate = await Course.exists({ name: value.name, class: value.class });
    if (duplicate) return res.status(409).json({ success: false, message: 'A course with this name already exists for the class' });
    const course = await Course.create(value);
    res.status(201).json({ success: true, course });
  } catch (error) {
    next(error);
  }
};

export const updateCourse = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Course not found' });
    const { value, error } = await validateCourseInput(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const duplicate = await Course.exists({ _id: { $ne: req.params.id }, name: value.name, class: value.class });
    if (duplicate) return res.status(409).json({ success: false, message: 'A course with this name already exists for the class' });
    const course = await Course.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    res.status(200).json({ success: true, course });
  } catch (error) {
    next(error);
  }
};

export const deleteCourse = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Course not found' });
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    res.status(200).json({ success: true, message: 'Course deleted' });
  } catch (error) {
    next(error);
  }
};
