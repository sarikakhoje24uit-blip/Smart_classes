import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';
import {
  Users,
  GraduationCap,
  DollarSign,
  Bell,
  UserPlus,
  Trash2,
  Shield,
  Search,
  CalendarCheck,
  BookOpen,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ACADEMIC_CLASSES } from '../constants/academicClasses';
import { useLanguage } from '../context/LanguageContext';

const ACADEMIC_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const AdminDashboard = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const path = location.pathname;

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [fees, setFees] = useState([]);
  const [timetables, setTimetables] = useState([]);
  const [notes, setNotes] = useState([]);
  const [admissionEnquiries, setAdmissionEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('10');

  // Add User Modal State (Bug A4)
  const [showAddModal, setShowAddModal] = useState(false);
  const [parentToLink, setParentToLink] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [teacherToLink, setTeacherToLink] = useState(null);
  const [selectedTeacherStudentId, setSelectedTeacherStudentId] = useState('');
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'student',
    class: '10',
    assignedClasses: [],
    subject: 'Mathematics',
    password: '',
    confirmPassword: ''
  });

  // Timetable Modal State (Bug F3)
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [newSlot, setNewSlot] = useState({
    class: '10',
    subject: 'Mathematics',
    teacher: '',
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    room: 'Room 101'
  });

  // Fee Modal State
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeMonthFilter, setFeeMonthFilter] = useState('all');
  const [feeYearFilter, setFeeYearFilter] = useState('all');
  const [newFee, setNewFee] = useState({
    studentId: '',
    month: 'September',
    amount: 3500,
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const fetchFeeStats = async (month = feeMonthFilter, year = feeYearFilter) => {
    try {
      const [statsRes, feesRes] = await Promise.all([
        api.get('/admin/dashboard-stats', { params: { month, year } }),
        api.get('/fees', { params: { month, year } })
      ]);
      if (statsRes.data?.stats) {
        setStats(prev => ({ ...prev, ...statsRes.data.stats }));
      }
      if (feesRes.data?.fees) {
        setFees(feesRes.data.fees);
      }
    } catch (err) {
      console.error('Failed to filter fee telemetry:', err);
    }
  };

  const handleFeeFilterChange = (month, year) => {
    setFeeMonthFilter(month);
    setFeeYearFilter(year);
    fetchFeeStats(month, year);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, feesRes, ttRes, notesRes, enquiriesRes] = await Promise.all([
        api.get('/admin/dashboard-stats', { params: { month: feeMonthFilter, year: feeYearFilter } }),
        api.get('/admin/users'),
        api.get('/fees', { params: { month: feeMonthFilter, year: feeYearFilter } }),
        api.get('/timetable'),
        api.get('/notes'),
        api.get('/admission-enquiries')
      ]);
      setStats(statsRes.data?.stats || null);
      setUsers(usersRes.data?.users || []);
      setFees(feesRes.data?.fees || []);
      setTimetables(ttRes.data?.timetable || []);
      setNotes(notesRes.data?.materials || []);
      setAdmissionEnquiries(enquiriesRes.data?.enquiries || []);
    } catch (err) {
      toast.error('Failed to load telemetry data');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [path]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.password || newUser.password.length < 6) {
      return toast.error('Password must be at least 6 characters long');
    }
    if (newUser.password !== newUser.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    try {
      const res = await api.post('/admin/users', {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        class: newUser.role === 'student' ? newUser.class : '',
        assignedClasses: newUser.role === 'teacher' ? newUser.assignedClasses : [],
        subject: newUser.subject,
        password: newUser.password
      });

      if (res.data?.success) {
        toast.success(`User ${newUser.name} created with ID: ${res.data.user?.uniqueId}`);
        setShowAddModal(false);
        setNewUser({
          name: '',
          email: '',
          role: 'student',
          class: '10',
          assignedClasses: [],
          subject: 'Mathematics',
          password: '',
          confirmPassword: ''
        });
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error creating user');
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Are you sure you want to deactivate and remove this user?')) {
      try {
        await api.delete(`/admin/users/${id}`);
        toast.success('User deleted successfully');
        fetchData();
      } catch (err) {
        toast.error('Error deleting user');
      }
    }
  };

  const handleLinkStudent = async (e) => {
    e.preventDefault();
    if (!parentToLink || !selectedStudentId) return;
    try {
      await api.post(`/admin/parents/${parentToLink._id}/children`, {
        studentId: selectedStudentId,
        relationship: 'Parent'
      });
      toast.success('Student linked to parent after institute verification');
      setParentToLink(null);
      setSelectedStudentId('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to link student');
    }
  };

  const handleUnlinkStudent = async (parent, studentId) => {
    if (!window.confirm('Remove this verified parent-child link?')) return;
    try {
      await api.delete(`/admin/parents/${parent._id}/children/${studentId}`);
      toast.success('Parent-child link removed');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove parent-child link');
    }
  };

  const handleLinkStudentToTeacher = async (e) => {
    e.preventDefault();
    if (!teacherToLink || !selectedTeacherStudentId) return;
    try {
      await api.post(`/admin/teachers/${teacherToLink._id}/students`, { studentId: selectedTeacherStudentId });
      toast.success('Student linked to teacher');
      setTeacherToLink(null);
      setSelectedTeacherStudentId('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to link student to teacher');
    }
  };

  const handleUnlinkStudentFromTeacher = async (teacher, studentId) => {
    if (!window.confirm('Remove this teacher–student link?')) return;
    try {
      await api.delete(`/admin/teachers/${teacher._id}/students/${studentId}`);
      toast.success('Teacher–student link removed');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove teacher–student link');
    }
  };

  const handleAdmissionStatusChange = async (enquiryId, status) => {
    try {
      const response = await api.put(`/admission-enquiries/${enquiryId}`, { status });
      setAdmissionEnquiries(current => current.map(enquiry => enquiry._id === enquiryId ? response.data.enquiry : enquiry));
      toast.success('Admission enquiry status updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update enquiry status');
    }
  };

  const handleCreateTimetableSlot = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/timetable', newSlot);
      if (res.data?.success) {
        toast.success('Timetable slot added successfully');
        setShowTimetableModal(false);
        fetchData();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to add timetable slot';
      toast.error(msg, { duration: 5000 });
    }
  };

  const handleCreateFeeInvoice = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/fees', newFee);
      if (res.data?.success) {
        toast.success('Fee invoice issued successfully');
        setShowFeeModal(false);
        setNewFee({
          studentId: '',
          month: 'September',
          amount: 3500,
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create fee invoice');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesSearch =
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.uniqueId?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const teachersList = users.filter((u) => u.role === 'teacher');

  return (
    <Layout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-black text-white">
              {path.includes('/users')
                ? t('User Directory')
                : path.includes('/timetable')
                ? t('Academic Timetable')
                : path.includes('/fees')
                ? t('Fee Invoices & Revenue')
                : path.includes('/notes')
                ? t('Institutional Study Notes')
                : path.includes('/admissions')
                ? t('Admission Enquiries')
                : t('Administrator Overview')}
            </h2>
            <p className="text-xs text-slate-400">
              {t('Kashvi SmartClass Central Control & Governance Engine')}
            </p>
          </div>
          <div className="flex gap-2">
            {path.includes('/timetable') && (
              <button
                onClick={() => setShowTimetableModal(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500"
              >
                <Plus className="h-4 w-4" />
                <span>{t('Add Timetable Slot')}</span>
              </button>
            )}
            {path.includes('/fees') && (
              <button
                onClick={() => setShowFeeModal(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" />
                <span>{t('Create Fee Invoice')}</span>
              </button>
            )}
            {!path.includes('/admissions') && <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500"
            >
              <UserPlus className="h-4 w-4" />
              <span>{t('Add New User')}</span>
            </button>}
          </div>
        </div>

        {/* 1. OVERVIEW VIEW */}
        {(path === '/dashboard/admin' || path === '/dashboard/admin/') && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t('Total Enrolled')}</span>
                  <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-white">{stats?.totalStudents || users.filter(u=>u.role==='student').length || 18}</h3>
                  <p className="mt-1 text-[11px] text-emerald-400">{t('Grades 7–10')}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t('Faculty Members')}</span>
                  <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-white">{stats?.totalTeachers || users.filter(u=>u.role==='teacher').length || 8}</h3>
                  <p className="mt-1 text-[11px] text-indigo-400">{t('Active Faculty')}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t('Total Fee Collections')}</span>
                  <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <select
                    value={feeMonthFilter}
                    onChange={(e) => handleFeeFilterChange(e.target.value, feeYearFilter)}
                    className="w-1/2 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] font-medium text-slate-200 outline-none focus:border-indigo-500"
                    title={t('Filter by Month')}
                  >
                    <option value="all">{t('All Months')}</option>
                    {ACADEMIC_MONTHS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={feeYearFilter}
                    onChange={(e) => handleFeeFilterChange(feeMonthFilter, e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] font-medium text-slate-200 outline-none focus:border-indigo-500"
                    title={t('Filter by Year')}
                  >
                    <option value="all">{t('All Years')}</option>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-white">
                    ₹{(stats?.totalCollectedFees ?? stats?.totalCollected ?? 0).toLocaleString()}
                  </h3>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400">{t('Verified Collections')}</span>
                    {Number(stats?.pendingFee) > 0 && (
                      <span className="text-amber-400 font-semibold">{t('Pending')}: ₹{Number(stats.pendingFee).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{t('System Security')}</span>
                  <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
                    <Shield className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-emerald-400">{t('Operational')}</h3>
                  <p className="mt-1 text-[11px] text-slate-400">{t('JWT / RBAC Active')}</p>
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Users */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">{t('Recent Registered Accounts')}</h3>
                  <span className="text-xs text-indigo-400">{users.length} {t('Total Registered')}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">{t('Unique ID')}</th>
                        <th className="pb-3 font-semibold">{t('Name')}</th>
                        <th className="pb-3 font-semibold">{t('Role')}</th>
                        <th className="pb-3 font-semibold">{t('Email')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {users.slice(0, 6).map((u) => (
                        <tr key={u._id} className="hover:bg-slate-800/30">
                          <td className="py-3 font-mono font-bold text-indigo-400">{u.uniqueId || 'ID-N/A'}</td>
                          <td className="py-3 font-semibold text-white">{u.name}</td>
                          <td className="py-3">
                            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-400">
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 text-slate-400">{u.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Institution System Notice & Admissions quick preview */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white">Admission Enquiries</h3>
                    <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
                      {admissionEnquiries.filter(e => e.status === 'new').length} New
                    </span>
                  </div>
                  {admissionEnquiries.length > 0 ? (
                    <div className="space-y-2">
                      {admissionEnquiries.slice(0, 2).map((e) => (
                        <div key={e._id} className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs">
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>{e.name}</span>
                            <span className="text-[10px] text-indigo-400">Class {e.desiredClass}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{e.email}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No new enquiries</p>
                  )}
                </div>

                <div className="border-t border-slate-800/80 pt-3">
                  <h3 className="mb-2 text-xs font-bold text-white">System Broadcasts</h3>
                  <div className="space-y-2">
                    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-2.5">
                      <p className="text-xs font-bold text-indigo-300">Quarterly Schedule</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">Timetable slots active for classes 7 to 10.</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                      <p className="text-xs font-bold text-emerald-300">Fee Invoices</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">UPI payment receipts tracking enabled.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. USER DIRECTORY VIEW (Bug B1) */}
        {path.includes('/users') && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl">
            {/* Search & Filter Bar */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, ID, or email..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto rounded-xl bg-slate-950 p-1 border border-slate-800">
                {['all', 'admin', 'teacher', 'student', 'parent'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                      roleFilter === r
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">User Details</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Class / Subject</th>
                    <th className="pb-3 font-semibold">Unique ID</th>
                    <th className="pb-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-800/30">
                      <td className="py-3">
                        <div className="font-bold text-white">{u.name}</div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-3">
                        <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-indigo-400">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300">
                        {u.class || u.subject || 'Institution Wide'}
                        {u.role === 'teacher' && (
                          <div className="mt-1 text-[10px] text-slate-500">
                            Linked students: {(u.linkedStudents || []).map(id => users.find(student => student._id === id)?.name).filter(Boolean).join(', ') || 'None'}
                          </div>
                        )}
                        {u.role === 'student' && (
                          <div className="mt-1 text-[10px] text-slate-500">
                            Parents: {(u.parents || []).map(id => users.find(parent => parent._id === id)?.name).filter(Boolean).join(', ') || 'Not linked'}
                          </div>
                        )}
                        {u.role === 'parent' && (
                          <div className="mt-1 text-[10px] text-slate-500">
                            Students: {(u.children || []).map(child => child.studentName || users.find(student => student._id === child.studentId)?.name).filter(Boolean).join(', ') || 'None'}
                          </div>
                        )}
                      </td>
                      <td className="py-3 font-mono font-bold text-indigo-400">
                        {u.uniqueId || 'N/A'}
                      </td>
                      <td className="py-3 text-right">
                        {u.role === 'parent' && (
                          <button
                            onClick={() => setParentToLink(u)}
                            className="mr-2 rounded-lg px-2 py-1 text-[10px] font-semibold text-indigo-300 hover:bg-indigo-500/10"
                          >
                            Link student
                          </button>
                        )}
                        {u.role === 'teacher' && (
                          <button
                            onClick={() => setTeacherToLink(u)}
                            className="mr-2 rounded-lg px-2 py-1 text-[10px] font-semibold text-indigo-300 hover:bg-indigo-500/10"
                          >
                            Link students
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteUser(u._id)}
                          className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                          title="Delete User"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. TIMETABLE VIEW (Bug B2 & F3) */}
        {path.includes('/timetable') && (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-5 w-5 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-300">Filter Schedule by Class:</span>
              </div>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
              >
                {ACADEMIC_CLASSES.map((c) => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => {
                const daySlots = timetables.filter(
                  (t) => t.day === day && (selectedClass === 'all' || t.class === selectedClass)
                );
                return (
                  <div key={day} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                    <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
                      {day}
                    </h4>
                    {daySlots.length === 0 ? (
                      <p className="py-4 text-center text-[11px] text-slate-500">No scheduled periods</p>
                    ) : (
                      <div className="space-y-2">
                        {daySlots.map((slot) => (
                          <div key={slot._id} className="rounded-xl bg-slate-950/80 p-3 border border-slate-800/80">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">{slot.subject}</span>
                              <span className="font-mono text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                                {slot.startTime} - {slot.endTime}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                              <span>{slot.teacherName || 'Faculty'}</span>
                              <span className="text-slate-500">{slot.room || 'Room 101'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. FEE INVOICES VIEW (Bug B3) */}
        {path.includes('/fees') && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">{t('Tuition & Fee Collection Ledger')}</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t('Filtered Total Collection')}: <span className="font-bold text-emerald-400">₹{(stats?.totalCollectedFees ?? stats?.totalCollected ?? 0).toLocaleString()}</span>
                  {Number(stats?.pendingFee) > 0 && (
                    <span className="ml-3 font-semibold text-amber-400">({t('Pending')}: ₹{Number(stats.pendingFee).toLocaleString()})</span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={feeMonthFilter}
                  onChange={(e) => handleFeeFilterChange(e.target.value, feeYearFilter)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="all">{t('All Months')}</option>
                  {ACADEMIC_MONTHS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  value={feeYearFilter}
                  onChange={(e) => handleFeeFilterChange(feeMonthFilter, e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="all">{t('All Years')}</option>
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
                <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
                  {fees.length} {t('Records')}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Student Name</th>
                    <th className="pb-3 font-semibold">Class</th>
                    <th className="pb-3 font-semibold">Billing Month</th>
                    <th className="pb-3 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Receipt #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {fees.map((f) => (
                    <tr key={f._id} className="hover:bg-slate-800/30">
                      <td className="py-3 font-bold text-white">{f.studentName}</td>
                      <td className="py-3 text-slate-300">{f.class}</td>
                      <td className="py-3 text-slate-400">{f.month} {f.year || 2024}</td>
                      <td className="py-3 font-bold text-white">₹{f.amount?.toLocaleString()}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                            f.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {f.status}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-slate-400">{f.receiptNumber || 'Pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. STUDY NOTES VIEW (Bug B4) */}
        {path.includes('/notes') && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notes.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center backdrop-blur-xl">
                <BookOpen className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                <p className="text-xs text-slate-400">No study notes uploaded yet.</p>
              </div>
            ) : (
              notes.map((n) => (
                <div key={n._id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400 uppercase">
                      Class {n.class} • {n.subject}
                    </span>
                    <span className="text-[10px] text-slate-500">{n.fileSize || '1.2 MB'}</span>
                  </div>
                  <h4 className="mt-3 text-sm font-bold text-white">{n.title}</h4>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">{n.description}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-[11px]">
                    <span className="text-slate-500">By {n.uploaderName || 'Faculty'}</span>
                    <a
                      href={n.fileUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-indigo-400 hover:text-indigo-300"
                    >
                      Download PDF →
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 6. ADMISSIONS ENQUIRIES VIEW */}
        {path.includes('/admissions') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {t('Total Enquiries')}: <strong className="text-indigo-400 font-bold">{admissionEnquiries.length}</strong>
              </p>
              <button
                type="button"
                onClick={fetchData}
                className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                ↻ Refresh List
              </button>
            </div>
            <div className="space-y-3">
              {admissionEnquiries.length ? admissionEnquiries.map(enquiry => (
                <article key={enquiry._id} className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{enquiry.name}</h3>
                      <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-indigo-400 border border-indigo-500/20">Class {enquiry.desiredClass}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        enquiry.status === 'enrolled' ? 'bg-emerald-500/10 text-emerald-400' :
                        enquiry.status === 'contacted' ? 'bg-indigo-500/10 text-indigo-400' :
                        enquiry.status === 'closed' ? 'bg-slate-700/50 text-slate-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        {enquiry.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">
                      📧 {enquiry.email} &nbsp;·&nbsp; 📞 {enquiry.phone}
                    </p>
                    {enquiry.message && <p className="mt-3 whitespace-pre-wrap text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">{enquiry.message}</p>}
                    <time className="mt-3 block text-[10px] text-slate-500">{new Date(enquiry.createdAt).toLocaleString()}</time>
                  </div>
                  <div className="flex flex-col justify-center">
                    <label className="text-xs font-semibold text-slate-400">
                      Update Status
                      <select
                        value={enquiry.status}
                        onChange={event => handleAdmissionStatusChange(enquiry._id, event.target.value)}
                        className="mt-1 block rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                      >
                        {['new', 'contacted', 'enrolled', 'closed'].map(status => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </label>
                  </div>
                </article>
              )) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center backdrop-blur-xl">
                  <p className="text-sm text-slate-400">No admission enquiries submitted yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADD USER MODAL WITH PASSWORD (Bug A4) */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Create New Institutional User</h3>
              <p className="mt-0.5 text-xs text-slate-400">Generate credentials with encrypted password</p>

              <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    placeholder="e.g. Aarav Sharma"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    placeholder="name@kashvi.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="parent">Parent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {newUser.role === 'student' && <div>
                    <label className="block text-[11px] font-semibold text-slate-300">Class Batch</label>
                    <select
                      value={newUser.class}
                      onChange={(e) => setNewUser({ ...newUser, class: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      {ACADEMIC_CLASSES.map(grade => <option key={grade} value={grade}>Class {grade}</option>)}
                    </select>
                  </div>}
                  {newUser.role === 'teacher' && <label className="block text-[11px] font-semibold text-slate-300">
                    Assigned grades
                    <select
                      multiple
                      required
                      value={newUser.assignedClasses}
                      onChange={event => setNewUser({
                        ...newUser,
                        assignedClasses: Array.from(event.target.selectedOptions, option => option.value)
                      })}
                      className="mt-1 min-h-24 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                    >
                      {ACADEMIC_CLASSES.map(grade => <option key={grade} value={grade}>Class {grade}</option>)}
                    </select>
                    <span className="mt-1 block font-normal text-slate-500">Hold Ctrl to select multiple grades.</span>
                  </label>}
                </div>

                {/* Password & Confirm Password (Bug A4) */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">Password</label>
                    <input
                      type="password"
                      required
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">Confirm Password</label>
                    <input
                      type="password"
                      required
                      value={newUser.confirmPassword}
                      onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="mt-5 flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-800/60 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500"
                  >
                    Save & Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {parentToLink && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Verify Parent–Student Link</h3>
              <p className="mt-1 text-xs text-slate-400">
                Choose the student after checking the relationship with the institute.
              </p>
              {parentToLink.children?.length > 0 && (
                <div className="mt-4 space-y-2">
                  {parentToLink.children.map((child) => (
                    <div key={child.studentId} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2">
                      <span className="text-xs text-slate-200">{child.studentName || child.studentId}</span>
                      <button
                        onClick={() => handleUnlinkStudent(parentToLink, child.studentId)}
                        className="text-[10px] font-semibold text-rose-400 hover:text-rose-300"
                      >
                        Unlink
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleLinkStudent} className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Student
                  <select
                    required
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">Select a student</option>
                    {users.filter((user) => user.role === 'student' &&
                      !parentToLink.children?.some((child) => child.studentId === user._id))
                      .map((student) => (
                        <option key={student._id} value={student._id}>
                          {student.name} · {student.uniqueId} · Class {student.class}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setParentToLink(null); setSelectedStudentId(''); }}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-800/60 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"
                  >
                    Verify & Link
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {teacherToLink && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Link Teacher to Students</h3>
              <p className="mt-1 text-xs text-slate-400">
                {teacherToLink.name} can manage linked student records and contact their parents.
                Assigned grades continue to control class-wide teaching.
              </p>
              {teacherToLink.linkedStudents?.length > 0 && (
                <div className="mt-4 space-y-2">
                  {teacherToLink.linkedStudents.map(studentId => {
                    const student = users.find(user => user._id === studentId);
                    return (
                      <div key={studentId} className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2">
                        <span className="text-xs text-slate-200">{student?.name || studentId}</span>
                        <button
                          type="button"
                          onClick={() => handleUnlinkStudentFromTeacher(teacherToLink, studentId)}
                          className="text-[10px] font-semibold text-rose-400 hover:text-rose-300"
                        >
                          Unlink
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <form onSubmit={handleLinkStudentToTeacher} className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Student
                  <select
                    required
                    value={selectedTeacherStudentId}
                    onChange={event => setSelectedTeacherStudentId(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">Select a student</option>
                    {users.filter(user =>
                      user.role === 'student' &&
                      teacherToLink.assignedClasses?.includes(user.class) &&
                      !teacherToLink.linkedStudents?.includes(user._id)
                    ).map(student => (
                      <option key={student._id} value={student._id}>
                        {student.name} · {student.uniqueId} · Class {student.class}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setTeacherToLink(null); setSelectedTeacherStudentId(''); }}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-800/60 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={!users.some(user =>
                      user.role === 'student' &&
                      teacherToLink.assignedClasses?.includes(user.class) &&
                      !teacherToLink.linkedStudents?.includes(user._id)
                    )}
                    className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Link Student
                  </button>
                </div>
              </form>
              {!users.some(user =>
                user.role === 'student' &&
                teacherToLink.assignedClasses?.includes(user.class) &&
                !teacherToLink.linkedStudents?.includes(user._id)
              ) && (
                <p className="mt-3 text-xs text-amber-300">
                  No unlinked students are in this teacher’s assigned grades. Update the teacher’s assigned grades or create a student in one of those grades first.
                </p>
              )}
            </div>
          </div>
        )}

        {/* TIMETABLE CONFLICT CHECK MODAL (Bug F3) */}
        {showTimetableModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Add Timetable Slot</h3>
              <p className="mt-0.5 text-xs text-slate-400">Backend collision check will automatically detect clashes</p>

              <form onSubmit={handleCreateTimetableSlot} className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">Class</label>
                    <select
                      value={newSlot.class}
                      onChange={(e) => setNewSlot({ ...newSlot, class: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      {ACADEMIC_CLASSES.map(grade => <option key={grade} value={grade}>{grade}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">Subject</label>
                    <input
                      type="text"
                      required
                      value={newSlot.subject}
                      onChange={(e) => setNewSlot({ ...newSlot, subject: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">Assign Teacher</label>
                  <select
                    required
                    value={newSlot.teacher}
                    onChange={(e) => setNewSlot({ ...newSlot, teacher: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Faculty Member</option>
                    {teachersList.map((t) => (
                      <option key={t._id} value={t._id}>{t.name} ({t.subject || 'Faculty'})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">Day</label>
                    <select
                      value={newSlot.day}
                      onChange={(e) => setNewSlot({ ...newSlot, day: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">Start Time</label>
                    <input
                      type="time"
                      value={newSlot.startTime}
                      onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">End Time</label>
                    <input
                      type="time"
                      value={newSlot.endTime}
                      onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="mt-5 flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTimetableModal(false)}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-800/60 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500"
                  >
                    Assign & Verify Clash
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* FEE MODAL */}
        {showFeeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Create Fee Invoice</h3>
              <p className="mt-0.5 text-xs text-slate-400">Issue fee record for student tuition</p>

              <form onSubmit={handleCreateFeeInvoice} className="mt-4 space-y-3">
                <label className="block text-[11px] font-semibold text-slate-300">
                  Student
                  <select
                    required
                    value={newFee.studentId}
                    onChange={(e) => setNewFee({ ...newFee, studentId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">Select a student</option>
                    {users.filter((user) => user.role === 'student').map((student) => (
                      <option key={student._id} value={student._id}>
                        {student.name} · {student.uniqueId} · Class {student.class}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-300">Class</p>
                    <p className="mt-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
                      {users.find((user) => user._id === newFee.studentId)?.class || 'Selected student class'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300">Billing Month</label>
                    <input
                      type="text"
                      required
                      value={newFee.month}
                      onChange={(e) => setNewFee({ ...newFee, month: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                      placeholder="e.g. September"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">Amount (INR)</label>
                  <input
                    type="number"
                    required
                    value={newFee.amount}
                    onChange={(e) => setNewFee({ ...newFee, amount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    min="0.01"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300">Due Date</label>
                  <input
                    type="date"
                    required
                    value={newFee.dueDate}
                    onChange={(e) => setNewFee({ ...newFee, dueDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="mt-5 flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFeeModal(false)}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-800/60 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-500"
                  >
                    Issue Invoice
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

export default AdminDashboard;
