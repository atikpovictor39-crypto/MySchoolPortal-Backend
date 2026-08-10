import { useEffect, useState } from 'react';
import { listAllTickets, getTicket, replyToTicket, updateTicketStatus } from '../../features/tickets/api';
import TicketThread from '../../components/common/TicketThread';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [openTicket, setOpenTicket] = useState(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  async function refresh() {
    setIsLoading(true);
    try {
      setTickets(await listAllTickets(statusFilter || undefined));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function openThread(ticket) {
    setError('');
    try {
      setOpenTicket(await getTicket(ticket.id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load ticket');
    }
  }

  async function handleReply(message) {
    await replyToTicket(openTicket.id, message);
    setOpenTicket(await getTicket(openTicket.id));
    await refresh();
  }

  async function handleStatusChange(status) {
    setIsChangingStatus(true);
    try {
      await updateTicketStatus(openTicket.id, status);
      setOpenTicket(await getTicket(openTicket.id));
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setIsChangingStatus(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Support Tickets</h1>
      <p className="text-sm text-slate-500 mb-6">Every issue raised by every school, in one place.</p>

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {openTicket ? (
        <div>
          <button
            onClick={() => setOpenTicket(null)}
            className="text-sm text-blue-600 hover:underline mb-3"
          >
            ← Back to all tickets
          </button>
          <TicketThread
            ticket={openTicket}
            onReply={handleReply}
            statusControl={
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs font-medium text-slate-600">Status:</label>
                <select
                  value={openTicket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isChangingStatus}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            {['', ...STATUSES].map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${
                  statusFilter === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {s ? s.replace('_', ' ') : 'All'}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-slate-500">No tickets.</p>
          ) : (
            <div className="space-y-2">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openThread(t)}
                  className="w-full text-left bg-white border border-slate-200 rounded-xl shadow-sm p-4 hover:border-blue-300"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t.subject}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{t.school_name}</p>
                    </div>
                    <span className="text-xs text-slate-400 capitalize shrink-0">{t.status.replace('_', ' ')}</span>
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
