import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Sparkles,
  Trophy,
  CalendarCheck,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  Award,
  Video,
  BookOpen,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  MessageSquareText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';

export const StudentDashboard = () => {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const studentClass = user?.class || '—';

  const [stats, setStats] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [homework, setHomework] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [onlineClasses, setOnlineClasses] = useState([]);
  const [tests, setTests] = useState([]);
  const [activeTest, setActiveTest] = useState(null);
  const [testAnswers, setTestAnswers] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [feedbackForms, setFeedbackForms] = useState([]);
  const [feedbackDrafts, setFeedbackDrafts] = useState({});
  const [loading, setLoading] = useState(true);

  // Homework submission modal state (Bugs C1, C2, C3)
  const [selectedHw, setSelectedHw] = useState(null);
  const [solutionText, setSolutionText] = useState('');
  const [solutionFileUrl, setSolutionFileUrl] = useState('');
  const [submittingHw, setSubmittingHw] = useState(false);

  // Enrolled Courses & Fee Breakdown State
  const [coursesData, setCoursesData] = useState({ availableCourses: [], enrolledCourses: [], totalFee: 0 });
  const [savingCourses, setSavingCourses] = useState(false);

  // AI Study Plan State (Bugs D1-D7)
  const [aiPlan, setAiPlan] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [targetExam, setTargetExam] = useState('Term Board Examination');
  const [studyHoursDaily, setStudyHoursDaily] = useState(3);
  const [weakSubjects, setWeakSubjects] = useState(['Mathematics', 'Science']);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, attendanceRes, hwRes, lbRes, classRes, planRes, feedbackRes, testsRes, coursesRes] = await Promise.all([
        api.get('/student/dashboard'),
        api.get('/student/attendance'),
        api.get('/student/homework'),
        api.get('/student/leaderboard'),
        api.get('/online-classes'),
        api.get('/student/study-plan').catch(() => ({ data: { plan: null } })),
        api.get('/feedback/student'),
        api.get('/student/tests'),
        api.get('/student/courses').catch(() => ({ data: { availableCourses: [], enrolledCourses: [], totalFee: 0 } }))
      ]);
      setStats(dashRes.data?.stats);
      setAttendanceRecords(attendanceRes.data?.attendance || []);
      setHomework(hwRes.data?.homework || []);
      setLeaderboard(lbRes.data?.leaderboard || []);
      setOnlineClasses(classRes.data?.onlineClasses || []);
      setTests(testsRes.data?.tests || []);
      setFeedbackForms(feedbackRes.data?.forms || []);
      if (coursesRes.data) {
        setCoursesData(coursesRes.data);
      }
      if (planRes.data?.plan) {
        setAiPlan(planRes.data.plan);
      }
    } catch (err) {
      toast.error(t('Failed to load student workspace'));
    }
    setLoading(false);
  };

  const handleToggleCourse = async (courseId) => {
    const currentEnrolled = coursesData.enrolledCourses || [];
    const isEnrolled = currentEnrolled.some(c => (c._id || c) === courseId);
    let newCourseIds;
    if (isEnrolled) {
      newCourseIds = currentEnrolled.filter(c => (c._id || c) !== courseId).map(c => c._id || c);
    } else {
      newCourseIds = [...currentEnrolled.map(c => c._id || c), courseId];
    }

    setSavingCourses(true);
    try {
      const res = await api.post('/student/courses', { courseIds: newCourseIds });
      if (res.data?.success) {
        setCoursesData(prev => ({
          ...prev,
          enrolledCourses: res.data.enrolledCourses,
          totalFee: res.data.totalFee
        }));
        toast.success(t('Enrolled subjects & fee structure updated!'));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to update enrolled subjects'));
    } finally {
      setSavingCourses(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [t]);

  const handleGenerateAIPlan = async () => {
    setAiLoading(true);
    try {
      const res = await api.post('/student/study-plan', {
        targetExam,
        studyHoursDaily: Number(studyHoursDaily),
        weakSubjects
      });
      if (res.data?.success) {
        setAiPlan(res.data.plan);
        toast.success(t('AI Study Plan generated & saved to your profile!'), { icon: '✨' });
      }
    } catch (err) {
      toast.error(t('AI Study plan generation failed. Please try again.'));
    }
    setAiLoading(false);
  };

  const handleOpenSubmitModal = (hw) => {
    setSelectedHw(hw);
    setSolutionText('');
    setSolutionFileUrl(`https://kashvi-uploads.edu/solutions/${hw._id}_solution.pdf`);
  };

  const handleSubmitSolution = async (e) => {
    e.preventDefault();
    if (!selectedHw) return;
    setSubmittingHw(true);
    try {
      const res = await api.post(`/student/homework/${selectedHw._id}/submit`, {
        fileUrl: solutionFileUrl,
        feedback: solutionText || 'Completed assignment submission'
      });
      if (res.data?.success) {
        toast.success(t('Solution submitted successfully!'));
        setSelectedHw(null);
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('Error submitting homework'));
    }
    setSubmittingHw(false);
  };

  const handleSubmitFeedback = async (formId, e) => {
    e.preventDefault();
    const draft = feedbackDrafts[formId] || { rating: '5', comment: '' };
    try {
      const res = await api.post(`/feedback/student/${formId}/responses`, draft);
      if (res.data?.success) {
        toast.success(t('Your lecture feedback was submitted'));
        setFeedbackDrafts((prev) => ({ ...prev, [formId]: { rating: '5', comment: '' } }));
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to submit lecture feedback'));
    }
  };

  const startTest = (test) => {
    setActiveTest(test);
    setTestAnswers({});
    setTestResult(null);
  };

  const handleSubmitTest = async (event) => {
    event.preventDefault();
    if (!activeTest || testSubmitting) return;
    setTestSubmitting(true);
    try {
      const response = await api.post(`/student/tests/${activeTest._id}/submit`, { answers: testAnswers });
      setTestResult(response.data.result);
      setTests(current => current.map(test => test._id === activeTest._id ? { ...test, submitted: true } : test));
      toast.success(t('Test submitted successfully'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('Could not submit test'));
    } finally {
      setTestSubmitting(false);
    }
  };
  const attendanceSummary = {
    present: attendanceRecords.filter(record => record.status === 'present').length,
    absent: attendanceRecords.filter(record => record.status === 'absent').length,
    leave: attendanceRecords.filter(record => ['leave', 'holiday'].includes(record.status)).length
  };
  const attendancePercentage = attendanceRecords.length
    ? ((attendanceSummary.present / attendanceRecords.length) * 100).toFixed(1)
    : '0.0';
  const studentRank = leaderboard.find(item => item.id === user?.uniqueId)?.rank;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-black text-white">
              {path.includes('/attendance')
                ? t('Attendance Analytics')
                : path.includes('/homework')
                ? t('Homework & Submissions')
                : path.includes('/leaderboard')
                ? t('Academic Leaderboard')
                : path.includes('/ai-plan')
                ? t('AI Personalized Study Plan')
                : path.includes('/classes')
                ? t('Live Virtual Classes')
                : path.includes('/feedback')
                ? t('Lecture Feedback')
                : path.includes('/tests')
                ? t('Online Assessments')
                : t('Student Learning Workspace')}
            </h2>
            <p className="text-xs text-slate-400">{t('Class')} {studentClass} {t('Academic Portal & AI Study Companion')}</p>
          </div>
        </div>

        {/* 1. OVERVIEW VIEW */}
        {(path === '/dashboard/student' || path === '/dashboard/student/') && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t('Attendance Rate')}</span>
                  <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-white">{attendancePercentage}%</h3>
                  <p className="mt-1 text-[11px] text-slate-400">{t('{{count}} recorded days', { count: attendanceRecords.length })}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t('Pending Tasks')}</span>
                  <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-white">{homework.length}</h3>
                  <p className="mt-1 text-[11px] text-amber-400">{t('Assignments Due This Week')}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t('Batch Rank')}</span>
                  <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400">
                    <Trophy className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-white">{studentRank ? `#${studentRank} ${t('in Class')} ${studentClass}` : t('Not ranked yet')}</h3>
                  <p className="mt-1 text-[11px] text-slate-400">{t('{{count}} students ranked', { count: leaderboard.length })}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t('AI Study Engine')}</span>
                  <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-indigo-400">{t(aiPlan ? 'Ready' : 'Available')}</h3>
                  <p className="mt-1 text-[11px] text-slate-400">{t('Personalized study planner')}</p>
                </div>
              </div>
            </div>

            {/* Subject Selection & Dynamic Fee Calculation (Coaching Classes Model) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-indigo-400" />
                    <span>{t('My Enrolled Subjects & Fee Structure')}</span>
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {t('Select your coaching subjects below. Your dynamic tuition fee updates automatically.')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-right">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-400">{t('Total Subject Fee')}</span>
                    <span className="text-xl font-black text-white">₹{(coursesData.totalFee || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {coursesData.availableCourses.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">{t('No courses/subjects configured for Class')} {studentClass}.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2">
                  {coursesData.availableCourses.map((course) => {
                    const isSelected = (coursesData.enrolledCourses || []).some(c => (c._id || c) === course._id);
                    return (
                      <div
                        key={course._id}
                        onClick={() => !savingCourses && handleToggleCourse(course._id)}
                        className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 select-none ${
                          isSelected
                            ? 'border-indigo-500/50 bg-indigo-950/30 shadow-lg shadow-indigo-900/10'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-white">{course.name}</h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">{course.code} · {course.teacherName || t('Faculty')}</p>
                          </div>
                          <span className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-600 text-white'
                              : 'border-slate-700 bg-slate-900 text-transparent'
                          }`}>
                            ✓
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs">
                          <span className="text-slate-400">{t('Subject Fee')}:</span>
                          <span className="font-bold text-emerald-400">₹{(Number(course.fee) || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900/90 via-indigo-950/40 to-slate-900/90 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white">{t('Published assessments')}</h3>
                  <p className="mt-1 text-xs text-indigo-300">{t('Tests assigned to Class')} {studentClass}</p>
                </div>
                <Link to="/dashboard/student/tests" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500">
                  {t('View assessments')} ({tests.length})
                </Link>
              </div>
              {tests.length === 0 && <p className="mt-4 text-xs text-slate-400">{t('No published tests are available for your class.')}</p>}
            </div>
          </div>
        )}

        {path.includes('/tests') && (
          <section className="space-y-4">
            {activeTest ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{activeTest.title}</h3>
                    <p className="mt-1 text-xs text-slate-400">{activeTest.subject} · {activeTest.duration} minutes · {activeTest.totalMarks} marks</p>
                  </div>
                  <button type="button" onClick={() => { setActiveTest(null); setTestResult(null); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">
                  {t('Back to tests')}
                  </button>
                </div>
                {testResult ? (
                  <div className="rounded-xl bg-slate-950 p-5 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
                    <h4 className="mt-2 text-lg font-bold text-white">{t('Assessment submitted')}</h4>
                    <p className="mt-1 text-sm text-slate-300">{t('Score')}: {testResult.score} / {testResult.totalMarks} ({testResult.percentage}%)</p>
                    <p className="mt-1 text-xs text-slate-400">{testResult.isPassed ? t('Passing score achieved') : t('Keep practising and review your study materials')}</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitTest} className="space-y-5">
                    {activeTest.questions.map((question, index) => (
                      <fieldset key={`${activeTest._id}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                        <legend className="px-1 text-sm font-semibold text-slate-200">{index + 1}. {question.question}</legend>
                        {question.options?.length ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {question.options.map(option => (
                              <label key={option} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${testAnswers[index] === option ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 text-slate-300'}`}>
                                <input type="radio" name={`question-${index}`} value={option} checked={testAnswers[index] === option} onChange={() => setTestAnswers(current => ({ ...current, [index]: option }))} />
                                {option}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="text"
                            maxLength={1000}
                            value={testAnswers[index] || ''}
                            onChange={event => setTestAnswers(current => ({ ...current, [index]: event.target.value }))}
                            className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                            aria-label={`Answer for question ${index + 1}`}
                          />
                        )}
                      </fieldset>
                    ))}
                    <button type="submit" disabled={testSubmitting || activeTest.submitted} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                      {testSubmitting ? t('Submitting…') : t('Submit assessment')}
                    </button>
                  </form>
                )}
              </div>
            ) : tests.length ? tests.map(test => (
              <article key={test._id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div>
                  <h3 className="text-sm font-bold text-white">{test.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{test.subject} · {test.questions.length} questions · {test.duration} minutes · {test.totalMarks} marks</p>
                </div>
                {test.submitted ? (
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">{t('Submitted')}</span>
                ) : (
                  <button type="button" onClick={() => startTest(test)} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500">{t('Start test')}</button>
                )}
              </article>
            )) : (
              <p className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">{t('No published assessments are available for your class.')}</p>
            )}
          </section>
        )}

        {/* 2. ATTENDANCE ANALYTICS (Bug B8) */}
        {path.includes('/attendance') && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white">{t('Monthly Attendance Summary')}</h3>
                <p className="text-xs text-slate-400">{t('Based on your recorded attendance')}</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                {attendancePercentage}% {t('Overall Presence')}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span className="text-xs text-slate-400">{t('Present Days')}</span>
                <h4 className="mt-1 text-2xl font-black text-emerald-400">{attendanceSummary.present} {t('Days')}</h4>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span className="text-xs text-slate-400">{t('Absent Days')}</span>
                <h4 className="mt-1 text-2xl font-black text-rose-400">{attendanceSummary.absent} {t('Days')}</h4>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span className="text-xs text-slate-400">{t('Leave / Excused')}</span>
                <h4 className="mt-1 text-2xl font-black text-amber-400">{attendanceSummary.leave} {t('Days')}</h4>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[440px] text-left text-xs">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t('Date')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Subject / Session')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t('Attendance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {attendanceRecords.map(record => (
                    <tr key={record._id} className="text-slate-300">
                      <td className="px-4 py-3 font-medium text-white">{new Date(record.date).toLocaleDateString(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN')}</td>
                      <td className="px-4 py-3">{record.subject || t('Regular Session')}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                          record.status === 'present'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : record.status === 'absent'
                              ? 'bg-rose-500/10 text-rose-400'
                              : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {t(record.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {attendanceRecords.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                        {t('No attendance has been recorded yet.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. HOMEWORK & SUBMISSIONS (Bugs B8, C1, C2, C3, C4) */}
        {path.includes('/homework') && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {homework.map((hw) => {
              const mySub = hw.submissions?.find((s) => s.studentId);
              return (
                <div key={hw._id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400 uppercase">
                        {hw.subject}
                      </span>
                      <span className="text-[10px] text-rose-400 font-semibold">
                        Due {new Date(hw.dueDate).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="mt-3 text-sm font-bold text-white">{hw.title}</h4>
                    <p className="mt-1 text-xs text-slate-400 line-clamp-3">{hw.description}</p>
                  </div>

                  <div className="mt-5 border-t border-slate-800 pt-3">
                    {mySub ? (
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Submitted
                        </span>
                        <button
                          onClick={() => handleOpenSubmitModal(hw)}
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                        >
                          Update File
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenSubmitModal(hw)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{t('Submit Solution')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. LEADERBOARD (Bugs B9, F2) */}
        {path.includes('/leaderboard') && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Class {studentClass} Academic Leaderboard</h3>
                <p className="text-xs text-slate-400">{t('Calculated from weighted test scores and attendance consistency')}</p>
              </div>
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/30">
                Live Rankings
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">{t('Rank')}</th>
                    <th className="pb-3 font-semibold">{t('Student Name')}</th>
                    <th className="pb-3 font-semibold">{t('Average Score')}</th>
                    <th className="pb-3 font-semibold">{t('Attendance')}</th>
                    <th className="pb-3 text-right font-semibold">{t('Performance Tier')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {leaderboard.map((student, idx) => (
                    <tr key={student._id || idx} className="hover:bg-slate-800/30">
                      <td className="py-3 font-mono font-bold">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${
                            idx === 0
                              ? 'bg-amber-500/20 text-amber-400 font-black'
                              : idx === 1
                              ? 'bg-slate-300/20 text-slate-300'
                              : idx === 2
                              ? 'bg-amber-700/20 text-amber-600'
                              : 'text-slate-400'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="py-3 font-bold text-white">{student.name}</td>
                      <td className="py-3 font-semibold text-emerald-400">{student.averageScore || 92.5}%</td>
                      <td className="py-3 text-slate-300">{student.attendanceRate || 96}%</td>
                      <td className="py-3 text-right">
                        <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold text-indigo-400">
                          {idx === 0 ? '🏆 Batch Topper' : idx < 3 ? '⭐ Honor Roll' : '🌟 Scholar'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. AI STUDY PLAN GENERATOR (Bugs B10, D1-D7) */}
        {path.includes('/ai-plan') && (
          <div className="space-y-6">
            {/* Input Controls Panel */}
            <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/80 p-6 backdrop-blur-2xl">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="rounded-xl bg-indigo-600 p-2.5 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t('Personalized AI Academic Planner')}</h3>
                  <p className="text-xs text-slate-400">
                    Engineered with adaptive syllabus modeling & Gemini AI optimization
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300">{t('Target Examination')}</label>
                  <input
                    type="text"
                    value={targetExam}
                    onChange={(e) => setTargetExam(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    placeholder={t('e.g. CBSE 10th Board Pre-Finals')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">{t('Daily Study Hours: {{hours}} hrs', { hours: studyHoursDaily })}</label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="0.5"
                    value={studyHoursDaily}
                    onChange={(e) => setStudyHoursDaily(e.target.value)}
                    className="mt-3 w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={handleGenerateAIPlan}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{aiLoading ? t('Generating with Gemini AI...') : t('Generate / Refresh AI Plan')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Generated Plan Render */}
            {aiPlan ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-slate-900/60 p-4 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-bold text-white">Active Plan: {aiPlan.targetGoal || targetExam}</span>
                  </div>
                  <span className="text-[11px] font-mono text-indigo-400">{aiPlan.provider || 'SmartAI Engine'}</span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {aiPlan.weeklySchedule?.map((slot, idx) => (
                    <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-indigo-400">{slot.day}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            slot.priority === 'High' || slot.priority === 'Urgent'
                              ? 'bg-rose-500/10 text-rose-400'
                              : 'bg-indigo-500/10 text-indigo-400'
                          }`}
                        >
                          {slot.priority}
                        </span>
                      </div>
                      <h4 className="mt-2 text-sm font-bold text-white">{slot.subject}</h4>
                      <p className="mt-1 text-xs text-slate-400">{slot.topic}</p>
                      <div className="mt-3 border-t border-slate-800 pt-2 text-[11px] text-slate-500">
                        Duration: {slot.duration}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recommendations */}
                {aiPlan.recommendations && aiPlan.recommendations.length > 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">
                      {t('Academic Tutor Recommendations')}
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {aiPlan.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-indigo-400">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center backdrop-blur-xl">
                <Sparkles className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                <p className="text-xs text-slate-400">{t('Click "Generate AI Plan" above to create your structured study timetable.')}</p>
              </div>
            )}
          </div>
        )}

        {/* 6. ONLINE CLASSES (Bugs B11, G1-G2) */}
        {path.includes('/classes') && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {onlineClasses.map((c) => (
              <div key={c._id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400 uppercase">
                    {c.subject}
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    {c.duration} mins
                  </span>
                </div>
                <h4 className="mt-3 text-sm font-bold text-white">{c.title}</h4>
                <p className="mt-1 text-xs text-slate-400">{c.description || 'Live virtual lecture.'}</p>
                <div className="mt-4 border-t border-slate-800 pt-3 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">
                    {new Date(c.scheduledAt).toLocaleString()}
                  </span>
                  <a
                    href={c.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500"
                  >
                    Join Session →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {path.includes('/feedback') && (
          <div className="space-y-4">
            {feedbackForms.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
                <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                <p className="text-sm font-semibold text-white">{t('No lecture feedback forms available')}</p>
                <p className="mt-1 text-xs text-slate-400">{t('Your teacher will post a form here after a lecture.')}</p>
              </div>
            ) : feedbackForms.map((form) => {
              const draft = feedbackDrafts[form._id] || { rating: '5', comment: '' };
              return (
                <section key={form._id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">{form.title}</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        {form.subject} · Class {form.class} · {new Date(form.lectureDate).toLocaleDateString()}
                      </p>
                      <p className="mt-2 text-xs text-slate-300">{form.question}</p>
                      <p className="mt-1 text-[11px] text-slate-500">Teacher: {form.teacherName}. Your response is visible to your teacher.</p>
                    </div>
                    {form.hasSubmitted && (
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                        Feedback submitted
                      </span>
                    )}
                  </div>
                  {!form.hasSubmitted && (
                    <form onSubmit={(e) => handleSubmitFeedback(form._id, e)} className="mt-4 space-y-3 border-t border-slate-800 pt-4">
                      <label className="block text-xs font-semibold text-slate-300">
                        Lesson rating
                        <select
                          required
                          value={draft.rating}
                          onChange={(e) => setFeedbackDrafts((prev) => ({
                            ...prev,
                            [form._id]: { ...draft, rating: e.target.value }
                          }))}
                          className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 sm:max-w-xs"
                        >
                          <option value="5">{t('5 - Excellent')}</option>
                          <option value="4">{t('4 - Very good')}</option>
                          <option value="3">{t('3 - Good')}</option>
                          <option value="2">{t('2 - Needs improvement')}</option>
                          <option value="1">{t('1 - Not helpful')}</option>
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-slate-300">
                        Comment (optional)
                        <textarea
                          rows={3}
                          maxLength={1000}
                          value={draft.comment}
                          onChange={(e) => setFeedbackDrafts((prev) => ({
                            ...prev,
                            [form._id]: { ...draft, comment: e.target.value }
                          }))}
                          className="mt-1 block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                          placeholder="What worked well? What could be clearer?"
                        />
                      </label>
                      <button
                        type="submit"
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
                      >
                        Submit Feedback
                      </button>
                    </form>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* SUBMIT HOMEWORK MODAL (Bugs C1, C2) */}
        {selectedHw && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white">{t('Submit Homework Solution')}</h3>
              <p className="mt-0.5 text-xs text-slate-400">{selectedHw.title} ({selectedHw.subject})</p>

              <form onSubmit={handleSubmitSolution} className="mt-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">{t('File Attachment URL / Link')}</label>
                  <input
                    type="url"
                    required
                    value={solutionFileUrl}
                    onChange={(e) => setSolutionFileUrl(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    placeholder="https://cloud.kashvi.edu/uploads/my_solution.pdf"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">{t('Student Comments / Notes')}</label>
                  <textarea
                    rows={3}
                    value={solutionText}
                    onChange={(e) => setSolutionText(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    placeholder="Completed all derivations and problem sets on pages 4-8..."
                  />
                </div>

                <div className="mt-5 flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedHw(null)}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-800/60 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingHw}
                    className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {submittingHw ? 'Submitting...' : 'Upload & Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default StudentDashboard;
