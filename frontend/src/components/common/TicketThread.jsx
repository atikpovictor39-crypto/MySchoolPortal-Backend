import { useState } from 'react';

const PRIORITY_STYLE = {
  low: 'bg-slate-50 text-slate-600 border-slate-200',
  normal: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  urgent: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_STYLE = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-slate-50 text-slate-600 border-slate-200',
};

function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// Shared between the school-side and SuperAdmin-side ticket pages —
// statusControl is only ever passed on the SuperAdmin side.
export default function TicketThread({ ticket, onReply, statusControl }) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSending(true);
    try {
      await onReply(message);
      setMessage('');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-base font-semibold text-slate-900">{ticket.subject}</h3>
        <div className="flex gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_STYLE[ticket.priority] || ''}`}>
            {ticket.priority}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[ticket.status] || ''}`}>
            {ticket.status.replace('_', ' ')}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        {ticket.school_name ? `${ticket.school_name} · ` : ''}
        {ticket.created_by_name} · {formatWhen(ticket.created_at)}
      </p>

      {statusControl}

      <div className="space-y-3 mt-4">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{ticket.message}</p>
        </div>
        {ticket.replies.map((r) => (
          <div key={r.id} className={`rounded-lg p-3 ${r.author_role === 'SUPERADMIN' ? 'bg-blue-50' : 'bg-slate-50'}`}>
            <p className="text-xs font-medium text-slate-600 mb-1">
              {r.author_name} {r.author_role === 'SUPERADMIN' && <span className="text-blue-600">(Support)</span>} ·{' '}
              <span className="text-slate-400">{formatWhen(r.created_at)}</span>
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.message}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a reply…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={isSending || !message.trim()}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSending ? 'Sending…' : 'Reply'}
        </button>
      </form>
    </div>
  );
}
