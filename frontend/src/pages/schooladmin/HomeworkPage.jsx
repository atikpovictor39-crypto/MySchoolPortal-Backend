import { useEffect, useState } from 'react';
import { listHomework, createHomework, updateHomework, deleteHomework } from '../../features/homework/api';
import { listClasses } from '../../features/classes/api';
import { listSubjects } from '../../features/subjects/api';

const emptyForm = { classId: '', subjectId: '', title: '', description: '', dueDate: '' };

export default function HomeworkPage() {
  const [homework, setHomework] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  async function refresh() {
    setIsLoading(true);
    try {
      const [homeworkList, classList, subjectList] = await Promise.all([listHomework(), listClasses(), listSubjects()]);
      setHomework(homeworkList);
      setClasses(classList);
      setSubjects(subjectList);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load homework');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const classNameById = Object.fromEntries(classes.map((c) => [c.id, `${c.name}${c.section ? ` ${c.section}` : ''}`]));

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await createHomework(form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post homework');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(hw) {
    setEditingId(hw.id);
    setEditForm({
      classId: hw.class_id,
      subjectId: hw.subject_id,
      title: hw.title,
      description: hw.description || '',
      dueDate: hw.due_date.slice(0, 10),
    });
  }

  async function saveEdit(id) {
    setError('');
    try {
      await updateHomework(id, editForm);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update homework');
    }
  }

  async function handleDelete(id) {
    setError('');
    try {
      await deleteHomework(id);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete homework');
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Homework</h1>

      <form onSubmit={handleCreate} className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
            <select
              required
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="" disabled>
                Select…
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.section ? ` ${c.section}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
            <select
              required
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="" disabled>
                Select…
              </option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Due date</label>
            <input
              required
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Posting…' : 'Post homework'}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : homework.length === 0 ? (
        <p className="text-sm text-slate-500">No homework posted yet.</p>
      ) : (
        <div className="space-y-3">
          {homework.map((hw) =>
            editingId === hw.id ? (
              <div key={hw.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-2">
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium"
                />
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <div className="flex flex-wrap gap-3 items-end">
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <button onClick={() => saveEdit(hw.id)} className="text-blue-600 text-xs font-medium">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-slate-500 text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={hw.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-sm font-semibold text-slate-900">{hw.title}</h3>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => startEdit(hw)} className="text-blue-600 text-xs font-medium">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(hw.id)} className="text-red-600 text-xs font-medium">
                      Delete
                    </button>
                  </div>
                </div>
                {hw.description && <p className="text-sm text-slate-600 mt-1">{hw.description}</p>}
                <p className="text-xs text-slate-400 mt-2">
                  {classNameById[hw.class_id] || hw.class_id} · {hw.subject_name} · due {hw.due_date.slice(0, 10)} · by{' '}
                  {hw.created_by_name}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
