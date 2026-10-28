import express from 'express';
import {
  getStudentDashboard,
  getStudentAttendance,
  getStudentHomework,
  submitHomework,
  getStudentTests,
  submitTestAttempt,
  getLeaderboard,
  getStudentCourses,
  updateStudentCourses
} from '../controllers/studentController.js';
import { generateAIStudyPlan, getLatestStudyPlan } from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';

const router = express.Router();

router.use(protect);
router.use(authorize('student', 'admin'));

router.get('/dashboard', getStudentDashboard);
router.get('/attendance', getStudentAttendance);
router.get('/homework', getStudentHomework);
router.post('/homework/:id/submit', submitHomework);
router.get('/tests', getStudentTests);
router.post('/tests/:id/submit', submitTestAttempt);
router.get('/leaderboard', getLeaderboard);
router.get('/study-plan', getLatestStudyPlan);
router.post('/study-plan', generateAIStudyPlan);
router.get('/courses', getStudentCourses);
router.post('/courses', updateStudentCourses);

export default router;
