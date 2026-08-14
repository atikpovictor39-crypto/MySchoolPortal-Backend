import { useEffect, useState } from 'react';
import { useParent } from '../../context/ParentContext';
import ChildTabs from '../../components/parent/ChildTabs';
import { getChildFees, getChildInvoice, getPaymentDetails, getSchoolInfo, submitPaymentClaim } from '../../features/parent/api';
import { formatMoney as money } from '../../utils/money';

const STATUS_STYLE = {
  paid: 'bg-green-50 text-green-700 border-green-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  unpaid: 'bg-red-50 text-red-700 border-red-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  waived: 'bg-slate-50 text-slate-600 border-slate-200',
};

const CLAIM_STYLE = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const CLAIM_LABEL = {
  pending: 'Pending review',
  confirmed: 'Confirmed',
  rejected: 'Not found — try again',
};

const EMPTY_CLAIM_FORM = { amount: '', paymentMethod: 'mobile_money', paidAt: '', reference: '' };

function toCents(amountString) {
  return Math.round(parseFloat(amountString) * 100);
}

export default function ParentFeesPage() {
  const { childList, selectedChildId, isLoading: isLoadingChildren, error: childrenError } = useParent();

  const [fees, setFees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [payoutDetails, setPayoutDetails] = useState(null);

  const [claimInvoice, setClaimInvoice] = useState(null);
  const [claimForm, setClaimForm] = useState(EMPTY_CLAIM_FORM);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimError, setClaimError] = useState('');

  const [schoolProfile, setSchoolProfile] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [receiptPayment, setReceiptPayment] = useState(null);

  function refreshFees() {
    return getChildFees(selectedChildId).then(setFees);
  }

  useEffect(() => {
    if (!selectedChildId) return;
    setIsLoading(true);
    setError('');
    refreshFees()
      .catch((err) => setError(err.response?.data?.message || 'Failed to load fees'))
      .finally(() => setIsLoading(false));
  }, [selectedChildId]);

  useEffect(() => {
    getPaymentDetails()
      .then(setPayoutDetails)
      .catch(() => {});
    getSchoolInfo()
      .then(setSchoolProfile)
      .catch(() => {});
  }, []);

  async function openInvoice(invoiceId) {
    setError('');
    setReceiptPayment(null);
    try {
      setViewInvoice(await getChildInvoice(selectedChildId, invoiceId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load payment history');
    }
  }

  const hasMomo = payoutDetails?.momo_number;
  const hasBank = payoutDetails?.bank_account_number;

  function openClaimForm(invoice) {
    setClaimError('');
    setClaimForm({
      amount: ((invoice.amount_due_cents - invoice.amount_paid_cents) / 100).toFixed(2),
      paymentMethod: 'mobile_money',
      paidAt: new Date().toISOString().slice(0, 10),
      reference: '',
    });
    setClaimInvoice(invoice);
  }

  async function handleSubmitClaim(e) {
    e.preventDefault();
    setClaimError('');
    setIsSubmittingClaim(true);
    try {
      await submitPaymentClaim(selectedChildId, claimInvoice.id, {
        amountCents: toCents(claimForm.amount),
        paymentMethod: claimForm.paymentMethod,
        paidAt: claimForm.paidAt,
        reference: claimForm.reference || undefined,
      });
      setClaimInvoice(null);
      await refreshFees();
    } catch (err) {
      setClaimError(err.response?.data?.message || 'Failed to submit payment claim');
    } finally {
      setIsSubmittingClaim(false);
    }
  }

  if (isLoadingChildren) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <>
    <div className="max-w-2xl print:hidden">
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
            <div className="mb-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-900 mb-3">How to pay</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {hasMomo && (
                  <div>
                    <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Mobile Money</p>
                    <p className="text-sm text-slate-800">{payoutDetails.momo_provider}</p>
                    <p className="text-sm text-slate-800 font-medium">{payoutDetails.momo_number}</p>
                    {payoutDetails.momo_account_name && (
                      <p className="text-xs text-slate-500">{payoutDetails.momo_account_name}</p>
                    )}
                  </div>
                )}
                {hasBank && (
                  <div>
                    <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Bank transfer</p>
                    <p className="text-sm text-slate-800">{payoutDetails.bank_name}</p>
                    <p className="text-sm text-slate-800 font-medium">{payoutDetails.bank_account_number}</p>
                    {payoutDetails.bank_account_name && (
                      <p className="text-xs text-slate-500">{payoutDetails.bank_account_name}</p>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-blue-700/70 mt-3">
                After paying, tell us below so the school knows to look out for it — they still have to confirm it
                landed before it shows as paid.
              </p>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : fees.length === 0 ? (
            <p className="text-sm text-slate-500">No fee invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Fee</th>
                  <th className="px-4 py-2">Due</th>
                  <th className="px-4 py-2">Paid</th>
                  <th className="px-4 py-2">Due date</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {fees.map((f) => {
                  const canClaim = !['paid', 'waived'].includes(f.status) && f.latest_claim_status !== 'pending';
                  return (
                    <tr key={f.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{f.fee_name}</td>
                      <td className="px-4 py-2">{money(f.amount_due_cents)}</td>
                      <td className="px-4 py-2">{money(f.amount_paid_cents)}</td>
                      <td className="px-4 py-2">{f.due_date ? f.due_date.slice(0, 10) : '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[f.status]}`}>
                          {f.status}
                        </span>
                        {f.latest_claim_status && (
                          <span
                            className={`ml-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${CLAIM_STYLE[f.latest_claim_status]}`}
                          >
                            {CLAIM_LABEL[f.latest_claim_status]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col items-start gap-1">
                          {canClaim && (
                            <button
                              onClick={() => openClaimForm(f)}
                              className="text-blue-600 text-xs font-medium whitespace-nowrap"
                            >
                              I've made this payment
                            </button>
                          )}
                          {f.amount_paid_cents > 0 && (
                            <button
                              onClick={() => openInvoice(f.id)}
                              className="text-slate-600 text-xs font-medium whitespace-nowrap underline"
                            >
                              View receipts
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </>
      )}
    </div>

      {viewInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 print:static print:bg-transparent print:p-0">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 print:shadow-none print:max-w-none">
            {receiptPayment ? (
              <>
                <div className="flex justify-between items-start mb-4 print:hidden">
                  <h2 className="text-base font-semibold text-slate-900">Receipt</h2>
                  <div className="flex gap-3">
                    <button onClick={() => window.print()} className="text-blue-600 text-sm font-medium">
                      Print
                    </button>
                    <button onClick={() => setReceiptPayment(null)} className="text-slate-400 hover:text-slate-600 text-sm">
                      Back
                    </button>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    {schoolProfile?.logo_url && (
                      <img src={schoolProfile.logo_url} alt="" className="w-14 h-14 object-contain shrink-0" />
                    )}
                    <div>
                      <p className="text-lg font-bold text-slate-900 leading-tight">{schoolProfile?.name || 'School'}</p>
                      {schoolProfile?.address && <p className="text-xs text-slate-600">{schoolProfile.address}</p>}
                      <p className="text-xs text-slate-600">
                        {[schoolProfile?.phone, schoolProfile?.email].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-center text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">
                  Payment Receipt
                </p>

                <div className="flex justify-between text-xs text-slate-500 mb-4">
                  <span>Receipt No. {receiptPayment.id}</span>
                  <span>Date: {receiptPayment.paid_at.slice(0, 10)}</span>
                </div>

                <div className="text-sm mb-4 space-y-1">
                  <p>
                    <span className="text-slate-500">Received from:</span> {viewInvoice.first_name} {viewInvoice.last_name}{' '}
                    ({viewInvoice.admission_no})
                  </p>
                  <p>
                    <span className="text-slate-500">For:</span> {viewInvoice.fee_name}
                  </p>
                  <p>
                    <span className="text-slate-500">Payment method:</span>{' '}
                    <span className="capitalize">{receiptPayment.payment_method.replace('_', ' ')}</span>
                  </p>
                  {receiptPayment.payment_ref && (
                    <p>
                      <span className="text-slate-500">Reference:</span> {receiptPayment.payment_ref}
                    </p>
                  )}
                </div>

                <div className="border-y border-slate-200 py-3 mb-4">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Amount paid</span>
                    <span>{money(receiptPayment.amount_cents)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 mb-8">
                  <div>
                    <p>Invoice total</p>
                    <p className="font-medium text-slate-900">{money(viewInvoice.amount_due_cents)}</p>
                  </div>
                  <div>
                    <p>Paid to date</p>
                    <p className="font-medium text-slate-900">{money(viewInvoice.amount_paid_cents)}</p>
                  </div>
                  <div>
                    <p>Balance</p>
                    <p className="font-medium text-slate-900">
                      {money(viewInvoice.amount_due_cents - viewInvoice.amount_paid_cents)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-10 border-t border-slate-300 pt-1 w-48">Authorized Signature</p>
              </>
            ) : (
              <>
                <div className="flex justify-between items-start mb-4 print:hidden">
                  <h2 className="text-base font-semibold text-slate-900">{viewInvoice.fee_name}</h2>
                  <button
                    onClick={() => {
                      setViewInvoice(null);
                      setReceiptPayment(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 text-sm"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm mb-4 border-y border-slate-200 py-3">
                  <div>
                    <p className="text-xs text-slate-500">Amount due</p>
                    <p className="font-medium">{money(viewInvoice.amount_due_cents)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Paid</p>
                    <p className="font-medium">{money(viewInvoice.amount_paid_cents)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Balance</p>
                    <p className="font-medium">{money(viewInvoice.amount_due_cents - viewInvoice.amount_paid_cents)}</p>
                  </div>
                </div>

                <p className="text-xs font-medium text-slate-600 mb-1">Payment history</p>
                <ul className="text-sm space-y-1">
                  {viewInvoice.payments.map((p) => (
                    <li key={p.id} className="flex justify-between items-center text-slate-700">
                      <span>
                        {p.paid_at.slice(0, 10)} · {p.payment_method.replace('_', ' ')}
                        {p.payment_ref ? ` (${p.payment_ref})` : ''}
                      </span>
                      <span className="flex items-center gap-2">
                        {money(p.amount_cents)}
                        <button
                          type="button"
                          onClick={() => setReceiptPayment(p)}
                          className="text-xs text-blue-600 underline"
                        >
                          Receipt
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {claimInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-base font-semibold text-slate-900">Tell us about your payment</h2>
              <button onClick={() => setClaimInvoice(null)} className="text-slate-400 hover:text-slate-600 text-sm">
                Close
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              For {claimInvoice.fee_name}. This doesn't record the payment automatically — the school still confirms
              it against their own MoMo/bank statement.
            </p>

            <form onSubmit={handleSubmitClaim} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount you paid</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={claimForm.amount}
                  onChange={(e) => setClaimForm({ ...claimForm, amount: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">How did you pay?</label>
                <select
                  value={claimForm.paymentMethod}
                  onChange={(e) => setClaimForm({ ...claimForm, paymentMethod: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date paid</label>
                <input
                  required
                  type="date"
                  value={claimForm.paidAt}
                  onChange={(e) => setClaimForm({ ...claimForm, paidAt: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Transaction reference <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  value={claimForm.reference}
                  onChange={(e) => setClaimForm({ ...claimForm, reference: e.target.value })}
                  placeholder="e.g. the MoMo transaction ID"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>

              {claimError && (
                <p role="alert" className="text-sm text-red-600">
                  {claimError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmittingClaim}
                className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmittingClaim ? 'Submitting…' : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
