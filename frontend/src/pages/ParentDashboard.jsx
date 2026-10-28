import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';
import {
  CalendarCheck,
  DollarSign,
  FileText,
  UserCheck,
  CheckCircle2,
  Clock,
  Printer,
  ShieldCheck,
  Download,
  Megaphone,
  AlertTriangle,
  CreditCard,
  Building,
  BookOpen
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';

const loadRazorpayCheckout = () => new Promise((resolve, reject) => {
  if (window.Razorpay) {
    resolve(true);
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = () => window.Razorpay ? resolve(true) : reject(new Error('Razorpay Checkout did not initialize'));
  script.onerror = () => reject(new Error('Could not load Razorpay Checkout'));
  document.body.appendChild(script);
});

export const ParentDashboard = () => {
  const { language, t } = useLanguage();
  const location = useLocation();
  const path = location.pathname;

  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [fees, setFees] = useState([]);
  const [reports, setReports] = useState([]);
  const [homework, setHomework] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [coursesData, setCoursesData] = useState(null);
  const [childDataLoading, setChildDataLoading] = useState(false);
  const [childDataRefresh, setChildDataRefresh] = useState(0);
  const [loading, setLoading] = useState(true);

  // Pay Now Modal State (Bugs E1-E7 & Dual Payment Modes)
  const [payingFee, setPayingFee] = useState(null);
  const [paymentMode, setPaymentMode] = useState('online'); // 'online' | 'offline'
  const [offlineMethod, setOfflineMethod] = useState('Cash at Institute Center');
  const [offlineRemarks, setOfflineRemarks] = useState('');
  const [paymentStep, setPaymentStep] = useState('checkout');
  const [generatedReceipt, setGeneratedReceipt] = useState(null);
  const [paymentError, setPaymentError] = useState('');

  const fetchChildren = async () => {
    setLoading(true);
    try {
      const res = await api.get('/parent/children');
      const kids = res.data?.children || [];
      setChildren(kids);
      if (kids.length > 0) {
        setSelectedChild(kids[0]);
      }
    } catch (err) {
      toast.error(t('Failed to load linked student profiles'));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    let active = true;
    const loadChildData = async () => {
      if (!selectedChild) {
        setAttendance(null);
        setFees([]);
        setReports([]);
        setHomework([]);
        setTimetable([]);
        setAnnouncements([]);
        setCheckIns([]);
        setCoursesData(null);
        return;
      }

      setChildDataLoading(true);
      try {
        const childId = selectedChild._id;
        const [attRes, feeRes, repRes, homeworkRes, timetableRes, announcementRes, checkInRes, courseRes] = await Promise.all([
          api.get(`/parent/children/${childId}/attendance`),
          api.get(`/parent/children/${childId}/fees`),
          api.get(`/parent/children/${childId}/reports`),
          api.get(`/parent/children/${childId}/homework`),
          api.get(`/parent/children/${childId}/timetable`),
          api.get(`/parent/children/${childId}/announcements`),
          api.get(`/parent/children/${childId}/check-ins`),
          api.get(`/parent/children/${childId}/courses`).catch(() => ({ data: null }))
        ]);
        if (!active) return;
        setAttendance(attRes.data);
        setFees(feeRes.data?.fees || []);
        setReports(repRes.data?.reports || []);
        setHomework(homeworkRes.data?.homework || []);
        setTimetable(timetableRes.data?.timetable || []);
        setAnnouncements(announcementRes.data?.announcements || []);
        setCheckIns(checkInRes.data?.checkIns || []);
        setCoursesData(courseRes.data || null);
      } catch (err) {
        if (active) {
          toast.error(err.response?.data?.message || t('Failed to load the selected child’s details'));
          setAttendance(null);
          setFees([]);
          setReports([]);
          setHomework([]);
          setTimetable([]);
          setAnnouncements([]);
          setCheckIns([]);
          setCoursesData(null);
        }
      } finally {
        if (active) setChildDataLoading(false);
      }
    };
    loadChildData();
    return () => {
      active = false;
    };
  }, [selectedChild?._id, childDataRefresh, t]);

  // Initiate Payment Flow
  const handleOpenPayModal = (fee) => {
    setPayingFee(fee);
    setPaymentMode('online');
    setOfflineMethod('Cash at Institute Center');
    setOfflineRemarks('');
    setPaymentStep('checkout');
    setGeneratedReceipt(null);
    setPaymentError('');
  };

  const handleProcessOfflinePayment = async () => {
    if (!payingFee) return;
    setPaymentStep('processing');
    try {
      const res = await api.post(`/fees/${payingFee._id}/offline`, {
        paymentMethod: offlineMethod,
        remarks: offlineRemarks || `Paid via ${offlineMethod}`
      });
      if (!res.data?.success) throw new Error(res.data?.message || 'Could not record offline payment');
      setGeneratedReceipt(res.data.receipt);
      setPaymentStep('receipt');
      toast.success(t('Offline payment recorded and official receipt generated!'));
      setChildDataRefresh((version) => version + 1);
    } catch (err) {
      setPaymentStep('failed');
      setPaymentError(err.response?.data?.message || err.message || t('Offline payment failed'));
    }
  };

  // Start Razorpay Checkout; the backend verifies and captures the payment.
  const handleProcessPayment = async () => {
    if (!payingFee) return;
    try {
      await loadRazorpayCheckout();
      const orderResponse = await api.post(`/fees/${payingFee._id}/order`);
      const { order, parent } = orderResponse.data;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Kashvi SmartClass',
        description: `${order.month} fee for ${order.studentName}`,
        order_id: order.orderId,
        prefill: parent ? { name: parent.name, email: parent.email } : {},
        notes: { feeId: order.feeId },
        theme: { color: '#3B82F6' },
        modal: { ondismiss: () => setPaymentStep('checkout') },
        handler: async (paymentResult) => {
          setPaymentStep('processing');
          try {
            const verified = await api.post(`/fees/${payingFee._id}/pay`, paymentResult);
            if (!verified.data?.success) throw new Error('Payment verification did not succeed');
            setGeneratedReceipt(verified.data.receipt);
            setPaymentStep('receipt');
            toast.success(t('Payment captured and verified by Razorpay'));
            setChildDataRefresh((version) => version + 1);
          } catch (err) {
            const message = err.response?.data?.message || err.message || 'Payment verification failed';
            setPaymentError(`${message}. Do not retry this payment until you check the invoice status or contact the institute.`);
            setPaymentStep('failed');
            toast.error(t('Payment verification failed. Check the invoice status before trying again.'));
          }
        }
      });
      checkout.on('payment.failed', (failure) => {
        toast.error(failure.error?.description || t('Razorpay could not complete this payment'));
        setPaymentStep('checkout');
      });
      checkout.open();
    } catch (err) {
      toast.error(err.response?.data?.message || t('Payment processing failed'));
      setPaymentStep('checkout');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Top Header & Ward Switcher */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-black text-white">
              {path.includes('/attendance')
                ? t('Ward Attendance Monitor')
                : path.includes('/fees')
                ? t('Fee Invoices & Online Payments')
                : path.includes('/reports')
                ? t('Term Academic Report Cards')
                : path.includes('/homework')
                ? t('Child Homework')
                : path.includes('/timetable')
                ? t('Child Timetable')
                : path.includes('/check-ins')
                ? t('Arrival & Departure Records')
                : t('Parent Oversight Hub')}
            </h2>
            <p className="text-xs text-slate-400">{t('Guardian Portal for Real-Time Academic Tracking')}</p>
          </div>

          {/* Child Ward Selector Switcher */}
          {children.length > 0 && (
            <div className="flex items-center gap-2 rounded-2xl bg-slate-900/80 p-1.5 border border-slate-800">
              <span className="pl-2 text-[11px] font-semibold text-slate-400">{t('Ward')}:</span>
              <div className="flex flex-wrap gap-1">
                {children.map((child) => (
                  <button
                    key={child._id}
                    onClick={() => setSelectedChild(child)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                      selectedChild?._id === child._id
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {child.name} ({t('Class')} {child.class})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 1. OVERVIEW VIEW */}
        {(path === '/dashboard/parent' || path === '/dashboard/parent/') && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t('Enrolled Student')}</span>
                  <UserCheck className="h-5 w-5 text-indigo-400" />
                </div>
                <h3 className="mt-3 text-xl font-black text-white">{selectedChild?.name || t('No linked student')}</h3>
                <p className="mt-1 text-[11px] text-indigo-400">
                  {selectedChild ? `${t('Class')} ${selectedChild.class} · ${t('Roll')} ${selectedChild.rollNumber || '—'}` : t('Ask the institute administrator to link a student')}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t('Attendance Percentage')}</span>
                  <CalendarCheck className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="mt-3 text-2xl font-black text-emerald-400">
                  {attendance ? `${attendance.percentage}%` : '—'}
                </h3>
                <p className="mt-1 text-[11px] text-slate-400">{t('Consistent Classroom Attendance')}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t('Pending Dues')}</span>
                  <DollarSign className="h-5 w-5 text-amber-400" />
                </div>
                <h3 className="mt-3 text-2xl font-black text-white">
                  ₹{fees.filter(f => f.status !== 'paid').reduce((acc, f) => acc + (f.amount || 0), 0)?.toLocaleString() || '0'}
                </h3>
                <p className="mt-1 text-[11px] text-amber-400">
                  {t('{{count}} invoices pending', { count: fees.filter(f => f.status !== 'paid').length })}
                </p>
              </div>
            </div>

            {/* Quick Actions & Recent Attendance */}
            {childDataLoading ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
                {t('Loading the selected child’s information…')}
              </div>
            ) : selectedChild && (
            <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl">
                <h3 className="mb-4 text-sm font-bold text-white">{t('Recent Daily Attendance')}</h3>
                <div className="space-y-2.5">
                  {attendance?.records?.slice(0, 5).map((rec) => (
                    <div key={rec._id} className="rounded-xl bg-slate-950 p-3 flex items-center justify-between border border-slate-800">
                      <div>
                        <span className="text-xs font-bold text-white">{new Date(rec.date).toLocaleDateString(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN')}</span>
                        <p className="text-[11px] text-slate-400">{rec.subject || t('Class Session')}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          rec.status === 'present'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {t(rec.status)}
                      </span>
                    </div>
                  ))}
                  {!attendance?.records?.length && <p className="text-xs text-slate-500">{t('No attendance records yet.')}</p>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl">
                <h3 className="mb-4 text-sm font-bold text-white">{t('Tuition Fee Invoices')}</h3>
                <div className="space-y-3">
                  {fees.slice(0, 4).map((f) => (
                    <div key={f._id} className="rounded-xl bg-slate-950 p-3.5 flex items-center justify-between border border-slate-800">
                      <div>
                        <p className="text-xs font-bold text-white">{f.month} Tuition Fee</p>
                        <p className="text-[11px] text-slate-400">{t('Amount')}: ₹{f.amount?.toLocaleString()}</p>
                      </div>
                      {f.status === 'paid' ? (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                          {t('Paid')}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleOpenPayModal(f)}
                          className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500"
                        >
                          {t('Pay Now')} →
                        </button>
                      )}
                    </div>
                  ))}
                  {!fees.length && <p className="text-xs text-slate-500">{t('No fee invoices found.')}</p>}
                </div>
              </div>
            </div>

            {/* Enrolled Coaching Subjects & Fee Structure for Ward */}
            {coursesData && coursesData.enrolledCourses?.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-indigo-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">{t('Enrolled Coaching Subjects & Tuition Fee')}</h3>
                      <p className="text-[11px] text-slate-400">{t('Subject-wise fee breakdown for')} {selectedChild?.name}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-right">
                    <span className="text-[10px] uppercase font-semibold text-emerald-400 block">{t('Total Subject Fee')}</span>
                    <span className="text-base font-black text-white">₹{(coursesData.totalFee || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                  {coursesData.enrolledCourses.map((c) => (
                    <div key={c._id || c.name} className="flex items-center justify-between rounded-xl bg-slate-950 p-3 border border-slate-800">
                      <div>
                        <p className="text-xs font-bold text-white">{c.name}</p>
                        <p className="text-[10px] text-slate-400">{c.code} · {c.teacherName || t('Faculty')}</p>
                      </div>
                      <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400">
                        ₹{(Number(c.fee) || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">{t('Weekly Timetable')}</h3>
                </div>
                <div className="space-y-2">
                  {timetable.slice(0, 6).map((entry) => (
                    <div key={entry._id} className="flex items-center justify-between rounded-xl bg-slate-950 p-3">
                      <div>
                        <p className="text-xs font-semibold text-white">{entry.subject}</p>
                        <p className="text-[11px] text-slate-400">{entry.day} · {entry.teacherName}</p>
                      </div>
                      <p className="text-[11px] text-slate-300">{entry.startTime}–{entry.endTime}</p>
                    </div>
                  ))}
                  {!timetable.length && <p className="text-xs text-slate-500">{t('No timetable entries available.')}</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">{t('Upcoming Homework')}</h3>
                </div>
                <div className="space-y-2">
                  {homework.filter((item) => !item.submitted).slice(0, 6).map((item) => (
                    <div key={item._id} className="rounded-xl bg-slate-950 p-3">
                      <p className="text-xs font-semibold text-white">{item.title}</p>
                      <p className="text-[11px] text-slate-400">{item.subject} · Due {new Date(item.dueDate).toLocaleDateString()}</p>
                    </div>
                  ))}
                  {!homework.some((item) => !item.submitted) && <p className="text-xs text-slate-500">{t('No pending homework.')}</p>}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">{t('Institute Announcements')}</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {announcements.map((announcement) => (
                  <div key={announcement._id} className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs font-bold text-white">{announcement.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{announcement.content}</p>
                    <p className="mt-2 text-[10px] text-slate-500">{new Date(announcement.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
                {!announcements.length && <p className="text-xs text-slate-500">{t('No announcements at this time.')}</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">{t('Recent Arrival & Departure')}</h3>
              </div>
              <div className="space-y-2">
                {checkIns.slice(0, 5).map((entry) => (
                  <div key={entry._id} className="flex items-center justify-between rounded-xl bg-slate-950 p-3">
                    <span className="text-xs font-semibold capitalize text-white">{entry.eventType}</span>
                    <span className="text-[11px] text-slate-400">{new Date(entry.recordedAt).toLocaleString(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN')}</span>
                  </div>
                ))}
                {!checkIns.length && <p className="text-xs text-slate-500">{t('No check-in events recorded.')}</p>}
              </div>
            </div>
            </div>
            )}
          </div>
        )}

        {path.includes('/homework') && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="mb-4 text-sm font-bold text-white">
              {t('Assignments for {{name}}', { name: selectedChild?.name || t('the selected student') })}
            </h3>
            {!selectedChild ? (
              <p className="text-xs text-slate-400">{t('No linked student is available.')}</p>
            ) : childDataLoading ? (
              <p className="text-xs text-slate-400">{t('Loading homework…')}</p>
            ) : homework.length ? (
              <div className="space-y-3">
                {homework.map((item) => (
                  <article key={item._id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-white">{item.title}</h4>
                        <p className="mt-1 text-[11px] text-slate-400">{item.subject} · {t('Due')} {new Date(item.dueDate).toLocaleDateString(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN')}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.submitted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300'}`}>
                        {item.submitted ? t('Submitted') : t('Not submitted')}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-slate-300">{item.description}</p>
                    {item.studentSubmission?.submittedAt && (
                      <p className="mt-2 text-[10px] text-slate-500">
                        {t('Submitted')} {new Date(item.studentSubmission.submittedAt).toLocaleString(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN')}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">{t('No homework has been assigned to this class.')}</p>
            )}
          </div>
        )}

        {path.includes('/timetable') && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="mb-4 text-sm font-bold text-white">
              {t('Weekly Schedule for {{name}}', { name: selectedChild?.name || t('the selected student') })}
            </h3>
            {!selectedChild ? (
              <p className="text-xs text-slate-400">{t('No linked student is available.')}</p>
            ) : childDataLoading ? (
              <p className="text-xs text-slate-400">{t('Loading timetable…')}</p>
            ) : timetable.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-semibold">{t('Day')}</th>
                      <th className="pb-3 font-semibold">{t('Time')}</th>
                      <th className="pb-3 font-semibold">{t('Subject')}</th>
                      <th className="pb-3 font-semibold">{t('Teacher')}</th>
                      <th className="pb-3 font-semibold">{t('Room')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {timetable.map((entry) => (
                      <tr key={entry._id}>
                        <td className="py-3 font-bold text-white">{entry.day}</td>
                        <td className="py-3 text-slate-300">{entry.startTime}–{entry.endTime}</td>
                        <td className="py-3 text-slate-300">{entry.subject}</td>
                        <td className="py-3 text-slate-300">{entry.teacherName}</td>
                        <td className="py-3 text-slate-400">{entry.room}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400">{t('No timetable entries are available for this class.')}</p>
            )}

            {path.includes('/check-ins') && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <h3 className="mb-4 text-sm font-bold text-white">
                  {t('Institute Check-in Log')}: {selectedChild?.name || t('the selected student')}
                </h3>
                {!selectedChild ? (
                  <p className="text-xs text-slate-400">{t('No linked student is available.')}</p>
                ) : childDataLoading ? (
                  <p className="text-xs text-slate-400">{t('Loading check-in records…')}</p>
                ) : checkIns.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="pb-3 font-semibold">{t('Date')}</th>
                          <th className="pb-3 font-semibold">{t('Event')}</th>
                          <th className="pb-3 font-semibold">{t('Recorded time')}</th>
                          <th className="pb-3 font-semibold">{t('Method')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {checkIns.map((entry) => (
                          <tr key={entry._id}>
                            <td className="py-3 text-white">{new Date(entry.eventDate).toLocaleDateString(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN')}</td>
                            <td className="py-3 capitalize text-slate-300">{entry.eventType}</td>
                            <td className="py-3 text-slate-300">{new Date(entry.recordedAt).toLocaleTimeString(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN')}</td>
                            <td className="py-3 text-slate-400">{entry.recordingMethod.replace('-', ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">{t('No arrival or departure events have been recorded.')}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. ATTENDANCE MONITOR (Bugs B12, A2, A3) */}
        {path.includes('/attendance') && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white">{t('Attendance Log: {{name}}', { name: selectedChild?.name || '' })}</h3>
                <p className="text-xs text-slate-400">{t('Daily verification status')}</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                {attendance ? `${attendance.percentage}%` : '—'} {t('Cumulative')}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">{t('Date')}</th>
                    <th className="pb-3 font-semibold">{t('Subject / Session')}</th>
                    <th className="pb-3 font-semibold">{t('Class')}</th>
                    <th className="pb-3 text-right font-semibold">{t('Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {attendance?.records?.map((rec) => (
                    <tr key={rec._id} className="hover:bg-slate-800/30">
                      <td className="py-3 font-bold text-white">{new Date(rec.date).toLocaleDateString(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN')}</td>
                      <td className="py-3 text-slate-300">{rec.subject || t('Regular Session')}</td>
                      <td className="py-3 text-slate-400">{t('Class')} {selectedChild?.class || '10'}</td>
                      <td className="py-3 text-right">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                            rec.status === 'present'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {t(rec.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {attendance?.records?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        {t('No attendance has been recorded for {{name}} yet.', { name: selectedChild?.name || '' })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. FEE RECEIPTS & PAYMENTS (Bugs B13, E1-E7, A6) */}
        {path.includes('/fees') && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white">{t('Fee Statements')}: {selectedChild?.name}</h3>
                <p className="text-xs text-slate-400">{t('Track paid receipts and settle outstanding invoices')}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">{t('Billing Month')}</th>
                    <th className="pb-3 font-semibold">{t('Due Date')}</th>
                    <th className="pb-3 font-semibold">{t('Amount')}</th>
                    <th className="pb-3 font-semibold">{t('Status')}</th>
                    <th className="pb-3 font-semibold">{t('Receipt Number')}</th>
                    <th className="pb-3 text-right font-semibold">{t('Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {fees.map((f) => (
                    <tr key={f._id} className="hover:bg-slate-800/30">
                      <td className="py-3 font-bold text-white">{f.month} {f.year || 2024}</td>
                      <td className="py-3 text-slate-400">{new Date(f.dueDate).toLocaleDateString(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN')}</td>
                      <td className="py-3 font-bold text-white">₹{f.amount?.toLocaleString()}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                            f.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {t(f.status)}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-slate-400">{f.receiptNumber || '—'}</td>
                      <td className="py-3 text-right">
                        {f.status === 'paid' && f.razorpayPaymentId && f.receiptNumber && f.transactionId ? (
                          <button
                            onClick={() => {
                              setGeneratedReceipt({
                                receiptNumber: f.receiptNumber,
                                transactionId: f.transactionId,
                                studentName: f.studentName,
                                class: f.class,
                                month: f.month,
                                amount: f.amount,
                                paidDate: f.paidDate
                              });
                              setPaymentStep('receipt');
                              setPayingFee(f);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700"
                          >
                            <Download className="h-3 w-3" />
                            {t('Receipt')}
                          </button>
                        ) : f.status === 'paid' ? (
                          <span className="text-[10px] text-emerald-400">{t('Paid · no verified online receipt')}</span>
                        ) : (
                          <button
                            onClick={() => handleOpenPayModal(f)}
                            className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 shadow-md"
                          >
                            {t('Pay Now')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. REPORT CARDS (Bug B14) */}
        {path.includes('/reports') && (
          <div className="space-y-6">
            {reports.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
                {t('No report cards are available for {{name}} yet.', { name: selectedChild?.name || t('the selected student') })}
              </div>
            ) : (
              reports.map((r) => (
                <div key={r._id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">{r.term} {t('Report')}: {r.studentName}</h3>
                      <p className="text-xs text-slate-400">{t('Academic Year')} {r.academicYear}</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                      {r.percentage}% ({r.overallGrade})
                    </span>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="pb-2 font-semibold">{t('Subject')}</th>
                          <th className="pb-2 font-semibold">{t('Marks')}</th>
                          <th className="pb-2 font-semibold">{t('Grade')}</th>
                          <th className="pb-2 font-semibold">{t('Remarks')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {r.subjects?.map((s, idx) => (
                          <tr key={idx}>
                            <td className="py-2 font-bold text-white">{s.name}</td>
                            <td className="py-2 text-emerald-400">{s.marks}/{s.maxMarks}</td>
                            <td className="py-2 text-indigo-400 font-bold">{s.grade}</td>
                            <td className="py-2 text-slate-400">{s.remarks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* PAY NOW & INSTANT RECEIPT MODAL (Bugs E1-E7, A6) */}
        {payingFee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              {paymentStep === 'checkout' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-base font-bold text-white">{t('Settle Tuition Fee Invoice')}</h3>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      ₹{payingFee.amount?.toLocaleString()}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 text-xs space-y-1">
                    <p className="text-slate-300">
                      <span className="text-slate-500">{t('Student')}:</span> {payingFee.studentName} ({payingFee.class})
                    </p>
                    <p className="text-slate-300">
                      <span className="text-slate-500">{t('Billing')}:</span> {payingFee.month} {t('Term Tuition')}
                    </p>
                  </div>

                  {/* Dual Mode Switcher: Online vs Offline */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('online')}
                      className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                        paymentMode === 'online'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>{t('Online Payment')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('offline')}
                      className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                        paymentMode === 'offline'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Building className="h-4 w-4" />
                      <span>{t('Offline Payment')}</span>
                    </button>
                  </div>

                  {paymentMode === 'online' ? (
                    <div className="rounded-xl border border-indigo-500/20 bg-slate-950 p-4 text-xs text-slate-300 space-y-1">
                      <p className="font-semibold text-white">{t('Online Instant Gateway')}</p>
                      <p>{t('Payment is securely processed via Razorpay. Supports UPI, NetBanking, Debit/Credit Cards.')}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-500/20 bg-slate-950 p-4 text-xs space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          {t('Offline Payment Method')}
                        </label>
                        <select
                          value={offlineMethod}
                          onChange={(e) => setOfflineMethod(e.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                        >
                          <option value="Cash at Institute Center">{t('Cash at Institute Center')}</option>
                          <option value="Cheque / Demand Draft">{t('Cheque / Demand Draft')}</option>
                          <option value="Direct Bank Transfer (NEFT/RTGS)">{t('Direct Bank Transfer (NEFT/RTGS)')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          {t('Receipt / Reference Note (Optional)')}
                        </label>
                        <input
                          type="text"
                          placeholder={t('e.g. Cash handed to desk / Cheque #123456')}
                          value={offlineRemarks}
                          onChange={(e) => setOfflineRemarks(e.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {t('An official institute receipt (RCP-OFF-...) will be generated and logged to the student’s ledger immediately.')}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPayingFee(null)}
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-800/60 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                    >
                      {t('Cancel')}
                    </button>
                    {paymentMode === 'online' ? (
                      <button
                        type="button"
                        onClick={handleProcessPayment}
                        className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500"
                      >
                        {t('Continue to Razorpay')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleProcessOfflinePayment}
                        className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-500"
                      >
                        {t('Record Offline Payment')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {paymentStep === 'processing' && (
                <div className="py-8 text-center space-y-3">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                  <p className="text-sm font-bold text-white">{t('Verifying Transaction with Gateway...')}</p>
                  <p className="text-xs text-slate-400">{t('Checking banking signature & updating MongoDB ledger')}</p>
                </div>
              )}

              {paymentStep === 'failed' && (
                <div className="space-y-4 text-center">
                  <AlertTriangle className="mx-auto h-9 w-9 text-amber-400" />
                  <h3 className="text-base font-bold text-white">{t('Payment needs verification')}</h3>
                  <p className="text-xs text-slate-400">{paymentError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPayingFee(null);
                      setPaymentError('');
                      setChildDataRefresh((version) => version + 1);
                    }}
                    className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"
                  >
                    {t('Close and refresh invoice status')}
                  </button>
                </div>
              )}

              {paymentStep === 'receipt' && generatedReceipt && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-bold text-white">{t('Payment Successful!')}</h3>
                    <p className="text-xs text-slate-400">{t('Official Institutional Receipt Generated')}</p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('Receipt No')}:</span>
                      <span className="font-mono font-bold text-indigo-400">{generatedReceipt.receiptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('Student')}:</span>
                      <span className="font-bold text-white">{generatedReceipt.studentName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('Class / Month')}:</span>
                      <span className="text-slate-300">{generatedReceipt.class} • {generatedReceipt.month}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('Amount Paid')}:</span>
                      <span className="font-black text-emerald-400">₹{generatedReceipt.amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('Date & Txn')}:</span>
                      <span className="font-mono text-[10px] text-slate-400">{generatedReceipt.transactionId}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-800/80 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 flex items-center justify-center gap-1.5"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {t('Print Receipt')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPayingFee(null);
                        setGeneratedReceipt(null);
                      }}
                      className="flex-1 rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500"
                    >
                      {t('Close')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ParentDashboard;
