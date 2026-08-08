import { useEffect, useState } from 'react';
import { useParent } from '../../context/ParentContext';
import ChildTabs from '../../components/parent/ChildTabs';
import { getChildFees, getPaymentDetails } from '../../features/parent/api';
import { formatMoney as money } from '../../utils/money';

const STATUS_STYLE = {
  paid: 'bg-green-50 text-green-700 border-green-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  unpaid: 'bg-red-50 text-red-700 border-red-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  waived: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function ParentFeesPage() {
  const { childList, selectedChildId, isLoading: isLoadingChildren, error: childrenError } = useParent();

  const [fees, setFees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [payoutDetails, setPayoutDetails] = useState(null);

  useEffect(() => {
    if (!selectedChildId) return;
    setIsLoading(true);
    setError('');
    getChildFees(selectedChildId)
      .then(setFees)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load fees'))
      .finally(() => setIsLoading(false));
  }, [selectedChildId]);

  useEffect(() => {
    getPaymentDetails()
      .then(setPayoutDetails)
      .catch(() => {});
  }, []);

  const hasMomo = payoutDetails?.momo_number;
  const hasBank = payoutDetails?.bank_account_number;

  if (isLoadingChildren) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Fees &amp; Payments</h1>

      {(childrenError || error) && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {childrenError || error}
        </p>
      )}

      {childList.length === 0 ? (
        <p className="text-sm text-slate-500">No children linked to your account yet.</p>
      ) : (
        <>
          <ChildTabs />

          {(hasMomo || hasBank) && (
            <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-indigo-900 mb-3">How to pay</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {hasMomo && (
                  <div>
                    <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide mb-1">Mobile Money</p>
                    <p className="text-sm text-slate-800">{payoutDetails.momo_provider}</p>
                    <p className="text-sm text-slate-800 font-medium">{payoutDetails.momo_number}</p>
                    {payoutDetails.momo_account_name && (
                      <p className="text-xs text-slate-500">{payoutDetails.momo_account_name}</p>
                    )}
                  </div>
                )}
                {hasBank && (
                  <div>
                    <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide mb-1">Bank transfer</p>
                    <p className="text-sm text-slate-800">{payoutDetails.bank_name}</p>
                    <p className="text-sm text-slate-800 font-medium">{payoutDetails.bank_account_number}</p>
                    {payoutDetails.bank_account_name && (
                      <p className="text-xs text-slate-500">{payoutDetails.bank_account_name}</p>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-indigo-700/70 mt-3">
                After paying, please allow the school a short while to record it against your invoice below.
              </p>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : fees.length === 0 ? (
            <p className="text-sm text-slate-500">No fee invoices yet.</p>
          ) : (
            <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Fee</th>
                  <th className="px-4 py-2">Due</th>
                  <th className="px-4 py-2">Paid</th>
                  <th className="px-4 py-2">Due date</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((f) => (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{f.fee_name}</td>
                    <td className="px-4 py-2">{money(f.amount_due_cents)}</td>
                    <td className="px-4 py-2">{money(f.amount_paid_cents)}</td>
                    <td className="px-4 py-2">{f.due_date ? f.due_date.slice(0, 10) : '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[f.status]}`}>
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
