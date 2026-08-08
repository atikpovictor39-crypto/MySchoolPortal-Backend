import { useEffect, useState } from 'react';
import { listSchools, createSchool } from '../../features/schools/api';

const emptyForm = { name: '', adminName: '', adminEmail: '', adminPassword: '' };

const STATUS_STYLE = {
  active: 'bg-green-50 text-green-700 border-green-200',
  trialing: 'bg-amber-50 text-amber-700 border-amber-200',
  past_due: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-50 text-slate-600 border-slate-200',
  expired: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function SchoolsPage() {
  const [schools, setSchools] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refresh() {
    setIsLoading(true);
    try {
      setSchools(await listSchools());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load schools');
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
      await createSchool(form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create school');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Schools</h1>
      <p className="text-sm text-slate-500 mb-6">Onboard a new school and its first admin account.</p>

      <form
        onSubmit={handleSubmit}
        className="mb-8 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-end"
      >
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">School name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Admin name</label>
          <input
            required
            value={form.adminName}
            onChange={(e) => setForm({ ...form, adminName: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Admin email</label>
          <input
            required
            type="email"
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Admin password</label>
          <input
            required
            type="password"
            value={form.adminPassword}
            onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating…' : 'Create school'}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : schools.length === 0 ? (
        <p className="text-sm text-slate-500">No schools yet.</p>
      ) : (
        <table className="w-full text-sm bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Admin Email</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Subscription</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2">{s.email}</td>
                <td className="px-4 py-2 capitalize">{s.status}</td>
                <td className="px-4 py-2">
                  {s.subscription_status ? (
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[s.subscription_status] || ''}`}
                    >
                      {s.subscription_status}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2">{s.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
