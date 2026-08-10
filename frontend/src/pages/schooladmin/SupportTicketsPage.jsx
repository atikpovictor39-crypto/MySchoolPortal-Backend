import { useEffect, useState } from 'react';
import { listMyTickets, getMyTicket, createTicket, replyToMyTicket } from '../../features/tickets/api';
import TicketThread from '../../components/common/TicketThread';

const emptyForm = { subject: '', message: '', priority: 'normal' };

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openTicket, setOpenTicket] = useState(null);

  async function refresh() {
    setIsLoading(true);
    try {
      setTickets(await listMyTickets());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await createTicket(form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit ticket');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openThread(ticket) {
    setError('');
    try {
      setOpenTicket(await getMyTicket(ticket.id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load ticket');
    }
  }

  async function handleReply(message) {
    await replyToMyTicket(openTicket.id, message);
    setOpenTicket(await getMyTicket(openTicket.id));
    await refresh();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Support</h1>
      <p className="text-sm text-slate-500 mb-6">Run into a problem? Let us know and we'll take a look.</p>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {openTicket ? (
        <div>
          <button onClick={() => setOpenTicket(null)} className="text-sm text-blue-600 hover:underline mb-3">
            ← Back to all tickets
          </button>
          <TicketThread ticket={openTicket} onReply={handleReply} />
        </div>
      ) : (
        <>
          <form
            onSubmit={handleCreate}
            className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
              <input
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">What's going on?</label>
              <textarea
                required
                rows={3}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting…' : 'Submit ticket'}
              </button>
            </div>
          </form>

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-slate-500">No tickets yet.</p>
          ) : (
            <div className="space-y-2">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openThread(t)}
                  className="w-full text-left bg-white border border-slate-200 rounded-xl shadow-sm p-4 hover:border-blue-300"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{t.subject}</p>
                    <span className="text-xs text-slate-400 capitalize">{t.status.replace('_', ' ')}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
