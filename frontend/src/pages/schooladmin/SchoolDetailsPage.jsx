import { useEffect, useState } from 'react';
import { getMyProfile, updateMyProfile } from '../../features/schools/api';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  logoUrl: '',
  headmasterSignature: '',
  showGradesOnReportCard: true,
};

export default function SchoolDetailsPage() {
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getMyProfile()
      .then((profile) =>
        setForm({
          name: profile.name || '',
          email: profile.email || '',
          phone: profile.phone || '',
          address: profile.address || '',
          logoUrl: profile.logo_url || '',
          headmasterSignature: profile.headmaster_signature || '',
          showGradesOnReportCard: profile.show_grades_on_report_card !== false,
        })
      )
      .catch((err) => setError(err.response?.data?.message || 'Failed to load school details'))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setIsSaving(true);
    try {
      await updateMyProfile(form);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save school details');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">School Details</h1>
      <p className="text-sm text-slate-500 mb-6">Your school's profile, shown across the portal.</p>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-4">
          {form.logoUrl ? (
            <img src={form.logoUrl} alt="School logo" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-blue-50 border border-slate-200" />
          )}
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Logo URL</label>
            <input
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">School name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+233 24 000 0000"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Headmaster's signature</label>
          <input
            value={form.headmasterSignature}
            onChange={(e) => setForm({ ...form, headmasterSignature: e.target.value })}
            placeholder="Typed name to print as the signature on report cards"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">
            Set once here — it's printed automatically on every student's report card.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.showGradesOnReportCard}
            onChange={(e) => setForm({ ...form, showGradesOnReportCard: e.target.checked })}
          />
          Show letter grades (A–F) on report cards
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {saved && !error && <p className="text-sm text-green-600">Saved.</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
