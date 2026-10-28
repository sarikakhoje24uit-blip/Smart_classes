import express from 'express';
import {
  getChildren,
  getChildAttendance,
  getChildFees,
  getChildReports,
  getChildTests,
  getChildHomework,
  getChildTimetable,
  getChildAnnouncements,
  getChildCourses
} from '../controllers/parentController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';
import { getChildCheckIns } from '../controllers/checkInController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('parent', 'admin'));

router.get('/children', getChildren);
router.get('/children/:id/attendance', getChildAttendance);
router.get('/children/:id/fees', getChildFees);
router.get('/children/:id/reports', getChildReports);
router.get('/children/:id/tests', getChildTests);
router.get('/children/:id/homework', getChildHomework);
router.get('/children/:id/timetable', getChildTimetable);
router.get('/children/:id/announcements', getChildAnnouncements);
router.get('/children/:id/check-ins', getChildCheckIns);
router.get('/children/:id/courses', getChildCourses);
export default router;
