import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listTeachers, createTeacher } from '../../features/teachers/api';
import PasswordInput from '../../components/common/PasswordInput';

const emptyForm = { name: '', email: '', password: '', employeeNo: '' };

export default function TeachersPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refresh() {
    setIsLoading(true);
    try {
      setTeachers(await listTeachers());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load teachers');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await createTeacher(form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add teacher');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Teachers</h1>

      {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <PasswordInput
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Employee No.</label>
            <input
              value={form.employeeNo}
              onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-28"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Addingâ€¦' : 'Add teacher'}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loadingâ€¦</p>
      ) : teachers.length === 0 ? (
        <p className="text-sm text-slate-500">No teachers yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Employee No.</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{t.name}</td>
                <td className="px-4 py-2">{t.email}</td>
                <td className="px-4 py-2">{t.employee_no || 'â€”'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
