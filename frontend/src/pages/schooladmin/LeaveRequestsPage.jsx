import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  listLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
} from '../../features/teacherClockIn/leaveApi';

const emptyForm = { startDate: '', endDate: '', reason: '' };
const STATUS_STYLE = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

function formatDate(d) {
  return d ? d.slice(0, 10) : '—';
}

export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const isTeacher = user.role === 'TEACHER';
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    setIsLoading(true);
    try {
      setRequests(await listLeaveRequests(statusFilter ? { status: statusFilter } : {}));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load leave requests');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await createLeaveRequest(form);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApprove(id) {
    setError('');
    setBusyId(id);
    try {
      await approveLeaveRequest(id);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve request');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id) {
    setError('');
    setBusyId(id);
    try {
      await rejectLeaveRequest(id);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Leave Requests</h1>

      {isTeacher && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start date</label>
            <input
              required
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">End date</label>
            <input
              required
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
            <input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-56"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting…' : 'Request leave'}
          </button>
        </form>
      )}

      {isAdmin && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">Filter by status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      <h2 className="text-sm font-semibold text-slate-900 mb-2">{isTeacher ? 'My requests' : 'Requests'}</h2>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-500">No leave requests yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              {isAdmin && <th className="px-4 py-2">Teacher</th>}
              <th className="px-4 py-2">Dates</th>
              <th className="px-4 py-2">Reason</th>
              <th className="px-4 py-2">Status</th>
              {isAdmin && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                {isAdmin && <td className="px-4 py-2">{r.teacher_name}</td>}
                <td className="px-4 py-2">
                  {formatDate(r.start_date)} – {formatDate(r.end_date)}
                </td>
                <td className="px-4 py-2">{r.reason || '—'}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-2">
                    {r.status === 'pending' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(r.id)}
                          disabled={busyId === r.id}
                          className="text-green-600 text-xs font-medium disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(r.id)}
                          disabled={busyId === r.id}
                          className="text-red-600 text-xs font-medium disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
