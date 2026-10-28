import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import api from '../services/api';
import { ACADEMIC_CLASSES } from '../constants/academicClasses';
import { useLanguage } from '../context/LanguageContext';

const emptyCourse = { name: '', code: '', class: '', teacherId: '', description: '', fee: '' };

const CourseManagementPage = () => {
  const { t } = useLanguage();
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(emptyCourse);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [courseResponse, teacherResponse] = await Promise.all([
        api.get('/admin/courses'),
        api.get('/admin/users?role=teacher')
      ]);
      setCourses(courseResponse.data?.courses || []);
      setTeachers(teacherResponse.data?.users || []);
    } catch (error) {
      toast.error(t(error.response?.data?.message || 'Could not load courses'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveCourse = async (event) => {
    event.preventDefault();
    const payload = { ...form, fee: Number(form.fee) || 0, teacherId: form.teacherId || undefined };
    try {
      if (editingId) await api.put(`/admin/courses/${editingId}`, payload);
      else await api.post('/admin/courses', payload);
      toast.success(t(editingId ? 'Course updated' : 'Course created'));
      setForm(emptyCourse);
      setEditingId('');
      loadData();
    } catch (error) {
      toast.error(t(error.response?.data?.message || 'Could not save course'));
    }
  };

  const editCourse = (course) => {
    setEditingId(course._id);
    setForm({
      name: course.name,
      code: course.code,
      class: course.class,
      teacherId: course.teacherId || '',
      description: course.description || '',
      fee: course.fee ?? 0
    });
  };

  const removeCourse = async (course) => {
    if (!window.confirm(t('Delete {{name}} from the course directory?', { name: course.name }))) return;
    try {
      await api.delete(`/admin/courses/${course._id}`);
      toast.success(t('Course deleted'));
      if (editingId === course._id) {
        setEditingId('');
        setForm(emptyCourse);
      }
      loadData();
    } catch (error) {
      toast.error(t(error.response?.data?.message || 'Could not delete course'));
    }
  };

  return (
    <Layout>
      <section className="mx-auto max-w-6xl space-y-6">
        <header>
          <h2 className="text-2xl font-bold text-white">{t('Course Directory')}</h2>
          <p className="mt-1 text-sm text-slate-400">{t('Manage the course information visible on the public home page.')}</p>
        </header>
        <form onSubmit={saveCourse} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-2">
          <h3 className="text-sm font-bold text-white md:col-span-2">{editingId ? t('Edit course') : t('Add a course')}</h3>
          <input required maxLength={120} placeholder={t('Course name')} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
          <input required maxLength={40} placeholder={t('Course code')} value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
          <select required value={form.class} onChange={event => setForm({ ...form, class: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white">
            <option value="">{t('Select grade')}</option>
            {ACADEMIC_CLASSES.map(grade => <option key={grade} value={grade}>Class {grade}</option>)}
          </select>
          <select value={form.teacherId} onChange={event => setForm({ ...form, teacherId: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white">
            <option value="">{t('No teacher assigned')}</option>
            {teachers.filter(teacher => teacher.assignedClasses?.includes(form.class.trim())).map(teacher => (
              <option key={teacher._id} value={teacher._id}>{teacher.name} — {teacher.subject || 'Faculty'}</option>
            ))}
          </select>
          <input type="number" min="0" placeholder={t('Course Fee / Cost (₹)')} value={form.fee} onChange={event => setForm({ ...form, fee: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
          <textarea maxLength={2000} rows={3} placeholder={t('Public course description')} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white md:col-span-2" />
          <div className="flex gap-2 md:col-span-2">
            <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {editingId ? t('Save changes') : t('Create course')}</button>
            {editingId && <button type="button" onClick={() => { setEditingId(''); setForm(emptyCourse); }} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">{t('Cancel')}</button>}
          </div>
        </form>
        <div className="space-y-3">
          {loading ? <p className="text-sm text-slate-400">{t('Loading courses…')}</p> : courses.length ? courses.map(course => (
            <article key={course._id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-1 h-5 w-5 text-indigo-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{course.name} <span className="text-xs font-normal text-indigo-300">{course.code}</span></h3>
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                      ₹{(Number(course.fee) || 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{t('Class')} {course.class} · {course.teacherName || t('No teacher assigned')}</p>
                  {course.description && <p className="mt-2 text-sm text-slate-500">{course.description}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => editCourse(course)} aria-label={t('Edit {{name}}', { name: course.name })} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => removeCourse(course)} aria-label={t('Delete {{name}}', { name: course.name })} className="rounded-lg border border-rose-500/30 p-2 text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </article>
          )) : <p className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">{t('No courses are configured.')}</p>}
        </div>
      </section>
    </Layout>
  );
};

export default CourseManagementPage;
