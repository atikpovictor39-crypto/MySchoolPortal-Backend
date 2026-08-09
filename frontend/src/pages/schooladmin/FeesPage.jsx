import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listAcademicYears } from '../../features/academicYears/api';
import { listClasses } from '../../features/classes/api';
import {
  listFeeStructures,
  createFeeStructure,
  generateInvoices,
  listInvoices,
  getInvoice,
  recordPayment,
  listDebtors,
  listClaims,
  confirmClaim,
  rejectClaim,
} from '../../features/fees/api';
import { getPaymentDetails, updatePaymentDetails } from '../../features/schools/api';
import { formatMoney as money } from '../../utils/money';

const TABS = [
  { key: 'structures', label: 'Fee Structures' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'debtors', label: 'Debtors' },
  { key: 'claims', label: 'Payment Claims' },
  { key: 'payment-details', label: 'Payment Details' },
];

const CLAIM_STATUSES = ['pending', 'confirmed', 'rejected'];

const MOMO_PROVIDERS = ['MTN Mobile Money', 'Telecel Cash', 'AirtelTigo Money'];

const EMPTY_PAYMENT_FORM = {
  momoProvider: '',
  momoNumber: '',
  momoAccountName: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
};

const INVOICE_STATUSES = ['unpaid', 'partial', 'paid', 'overdue', 'waived'];
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'mobile_money', 'other'];

function toCents(amountString) {
  return Math.round(parseFloat(amountString) * 100);
}

export default function FeesPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'SCHOOL_ADMIN';

  const [tab, setTab] = useState('structures');
  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');

  const [structures, setStructures] = useState([]);
  const [structureForm, setStructureForm] = useState({ academicYearId: '', classId: '', name: '', amount: '', dueDate: '' });
  const [isSubmittingStructure, setIsSubmittingStructure] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);

  const [invoices, setInvoices] = useState([]);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMethod: 'cash', paymentRef: '' });
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  const [debtors, setDebtors] = useState([]);

  const [claims, setClaims] = useState([]);
  const [claimStatusFilter, setClaimStatusFilter] = useState('pending');
  const [claimActionId, setClaimActionId] = useState(null);

  const [payoutForm, setPayoutForm] = useState(EMPTY_PAYMENT_FORM);
  const [isLoadingPayoutDetails, setIsLoadingPayoutDetails] = useState(true);
  const [isSavingPayoutDetails, setIsSavingPayoutDetails] = useState(false);
  const [payoutDetailsSaved, setPayoutDetailsSaved] = useState(false);

  async function refreshLookups() {
    const [yearList, classList] = await Promise.all([listAcademicYears(), listClasses()]);
    setYears(yearList);
    setClasses(classList);
  }

  async function refreshStructures() {
    setStructures(await listFeeStructures());
  }

  async function refreshInvoices() {
    setInvoices(await listInvoices(invoiceStatusFilter ? { status: invoiceStatusFilter } : {}));
  }

  async function refreshDebtors() {
    setDebtors(await listDebtors());
  }

  async function refreshClaims() {
    setClaims(await listClaims(claimStatusFilter ? { status: claimStatusFilter } : {}));
  }

  useEffect(() => {
    refreshLookups().catch((err) => setError(err.response?.data?.message || 'Failed to load classes/years'));
    refreshStructures().catch((err) => setError(err.response?.data?.message || 'Failed to load fee structures'));

    if (isAdmin) {
      getPaymentDetails()
        .then((details) =>
          setPayoutForm({
            momoProvider: details.momo_provider || '',
            momoNumber: details.momo_number || '',
            momoAccountName: details.momo_account_name || '',
            bankName: details.bank_name || '',
            bankAccountNumber: details.bank_account_number || '',
            bankAccountName: details.bank_account_name || '',
          })
        )
        .catch((err) => setError(err.response?.data?.message || 'Failed to load payment details'))
        .finally(() => setIsLoadingPayoutDetails(false));
    }
  }, []);

  useEffect(() => {
    if (tab === 'invoices') {
      refreshInvoices().catch((err) => setError(err.response?.data?.message || 'Failed to load invoices'));
    }
    if (tab === 'debtors') {
      refreshDebtors().catch((err) => setError(err.response?.data?.message || 'Failed to load debtors'));
    }
    if (tab === 'claims') {
      refreshClaims().catch((err) => setError(err.response?.data?.message || 'Failed to load payment claims'));
    }
  }, [tab, invoiceStatusFilter, claimStatusFilter]);

  const yearNameById = Object.fromEntries(years.map((y) => [y.id, y.name]));
  const classNameById = Object.fromEntries(classes.map((c) => [c.id, `${c.name}${c.section ? ` ${c.section}` : ''}`]));

  async function handleCreateStructure(e) {
    e.preventDefault();
    setError('');
    setIsSubmittingStructure(true);
    try {
      await createFeeStructure({
        academicYearId: structureForm.academicYearId,
        classId: structureForm.classId || undefined,
        name: structureForm.name,
        amountCents: toCents(structureForm.amount),
        dueDate: structureForm.dueDate || undefined,
      });
      setStructureForm({ academicYearId: '', classId: '', name: '', amount: '', dueDate: '' });
      await refreshStructures();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create fee structure');
    } finally {
      setIsSubmittingStructure(false);
    }
  }

  async function handleGenerate(structureId) {
    setError('');
    setGeneratingId(structureId);
    try {
      const result = await generateInvoices(structureId);
      alert(`${result.invoicesCreated} invoice(s) created (${result.alreadyInvoiced} already existed).`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate invoices');
    } finally {
      setGeneratingId(null);
    }
  }

  async function openInvoice(id) {
    setError('');
    setPaymentForm({ amount: '', paymentMethod: 'cash', paymentRef: '' });
    try {
      setSelectedInvoice(await getInvoice(id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load invoice');
    }
  }

  async function handleRecordPayment(e) {
    e.preventDefault();
    setError('');
    setIsRecordingPayment(true);
    try {
      const updated = await recordPayment(selectedInvoice.id, {
        amountCents: toCents(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        paymentRef: paymentForm.paymentRef || undefined,
      });
      setSelectedInvoice(updated);
      setPaymentForm({ amount: '', paymentMethod: 'cash', paymentRef: '' });
      await refreshInvoices();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsRecordingPayment(false);
    }
  }

  async function handleConfirmClaim(claimId) {
    setError('');
    setClaimActionId(claimId);
    try {
      await confirmClaim(claimId);
      await refreshClaims();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to confirm payment claim');
    } finally {
      setClaimActionId(null);
    }
  }

  async function handleRejectClaim(claimId) {
    const reason = window.prompt('Reason for rejecting (optional):');
    if (reason === null) return; // admin cancelled the dialog
    setError('');
    setClaimActionId(claimId);
    try {
      await rejectClaim(claimId, reason || undefined);
      await refreshClaims();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject payment claim');
    } finally {
      setClaimActionId(null);
    }
  }

  async function handleSavePayoutDetails(e) {
    e.preventDefault();
    setError('');
    setPayoutDetailsSaved(false);
    setIsSavingPayoutDetails(true);
    try {
      await updatePaymentDetails(payoutForm);
      setPayoutDetailsSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save payment details');
    } finally {
      setIsSavingPayoutDetails(false);
    }
  }

  const remainingCents = selectedInvoice ? selectedInvoice.amount_due_cents - selectedInvoice.amount_paid_cents : 0;
  const canPay = selectedInvoice && !['paid', 'waived'].includes(selectedInvoice.status);

  return (
    <>
      <div className="max-w-5xl print:hidden">
        <h1 className="text-xl font-semibold text-slate-900 mb-6">Fees &amp; Accounts</h1>

        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 mb-4">
            {error}
          </p>
        )}

        {tab === 'structures' && (
          <div>
            {isAdmin && (
              <form
                onSubmit={handleCreateStructure}
                className="mb-8 bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-end"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Academic year</label>
                  <select
                    required
                    value={structureForm.academicYearId}
                    onChange={(e) => setStructureForm({ ...structureForm, academicYearId: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Class (optional)</label>
                  <select
                    value={structureForm.classId}
                    onChange={(e) => setStructureForm({ ...structureForm, classId: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">All classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.section ? ` ${c.section}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                  <input
                    required
                    value={structureForm.name}
                    onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                    placeholder="Term 1 Tuition"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={structureForm.amount}
                    onChange={(e) => setStructureForm({ ...structureForm, amount: e.target.value })}
                    placeholder="500.00"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-28"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Due date</label>
                  <input
                    type="date"
                    value={structureForm.dueDate}
                    onChange={(e) => setStructureForm({ ...structureForm, dueDate: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingStructure}
                  className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmittingStructure ? 'Adding…' : 'Add fee'}
                </button>
              </form>
            )}

            {structures.length === 0 ? (
              <p className="text-sm text-slate-500">No fee structures yet.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Applies to</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Due</th>
                    {isAdmin && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {structures.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">{s.name}</td>
                      <td className="px-4 py-2">{s.class_id ? classNameById[s.class_id] || s.class_id : 'All classes'}</td>
                      <td className="px-4 py-2">{money(s.amount_cents)}</td>
                      <td className="px-4 py-2">{s.due_date ? s.due_date.slice(0, 10) : '—'}</td>
                      {isAdmin && (
                        <td className="px-4 py-2">
                          <button
                            onClick={() => handleGenerate(s.id)}
                            disabled={generatingId === s.id}
                            className="text-indigo-600 text-xs font-medium disabled:opacity-50"
                          >
                            {generatingId === s.id ? 'Generating…' : 'Generate invoices'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {tab === 'invoices' && (
          <div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Filter by status</label>
              <select
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                {INVOICE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {invoices.length === 0 ? (
              <p className="text-sm text-slate-500">No invoices yet — generate some from Fee Structures.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Student</th>
                    <th className="px-4 py-2">Fee</th>
                    <th className="px-4 py-2">Due</th>
                    <th className="px-4 py-2">Paid</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        {inv.first_name} {inv.last_name}{' '}
                        <span className="text-slate-400">({inv.admission_no})</span>
                      </td>
                      <td className="px-4 py-2">{inv.fee_name}</td>
                      <td className="px-4 py-2">{money(inv.amount_due_cents)}</td>
                      <td className="px-4 py-2">{money(inv.amount_paid_cents)}</td>
                      <td className="px-4 py-2 capitalize">{inv.status}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => openInvoice(inv.id)} className="text-indigo-600 text-xs font-medium">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {tab === 'debtors' && (
          <div>
            {debtors.length === 0 ? (
              <p className="text-sm text-slate-500">No outstanding balances. 🎉</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Student</th>
                    <th className="px-4 py-2">Class</th>
                    <th className="px-4 py-2">Total due</th>
                    <th className="px-4 py-2">Total paid</th>
                    <th className="px-4 py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {debtors.map((d) => (
                    <tr key={d.student_id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        {d.first_name} {d.last_name}{' '}
                        <span className="text-slate-400">({d.admission_no})</span>
                      </td>
                      <td className="px-4 py-2">{classNameById[d.class_id] || d.class_id}</td>
                      <td className="px-4 py-2">{money(d.total_due_cents)}</td>
                      <td className="px-4 py-2">{money(d.total_paid_cents)}</td>
                      <td className="px-4 py-2 font-medium text-red-600">{money(d.balance_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {tab === 'claims' && (
          <div>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Filter by status</label>
                <select
                  value={claimStatusFilter}
                  onChange={(e) => setClaimStatusFilter(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  <option value="">All</option>
                  {CLAIM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500 max-w-sm text-right">
                Parents can tell us they've sent money for an invoice. Check it landed in your MoMo/bank account,
                then confirm it here — that's what actually marks the invoice paid.
              </p>
            </div>

            {claims.length === 0 ? (
              <p className="text-sm text-slate-500">No payment claims{claimStatusFilter ? ` with status "${claimStatusFilter}"` : ''}.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Student</th>
                    <th className="px-4 py-2">Fee</th>
                    <th className="px-4 py-2">Claimed by</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Method</th>
                    <th className="px-4 py-2">Date paid</th>
                    <th className="px-4 py-2">Reference</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        {c.first_name} {c.last_name} <span className="text-slate-400">({c.admission_no})</span>
                      </td>
                      <td className="px-4 py-2">{c.fee_name}</td>
                      <td className="px-4 py-2">{c.parent_name}</td>
                      <td className="px-4 py-2">{money(c.amount_cents)}</td>
                      <td className="px-4 py-2 capitalize">{c.payment_method.replace('_', ' ')}</td>
                      <td className="px-4 py-2">{c.paid_at.slice(0, 10)}</td>
                      <td className="px-4 py-2">{c.reference || '—'}</td>
                      <td className="px-4 py-2 capitalize">{c.status}</td>
                      <td className="px-4 py-2">
                        {c.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleConfirmClaim(c.id)}
                              disabled={claimActionId === c.id}
                              className="text-green-700 text-xs font-medium disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleRejectClaim(c.id)}
                              disabled={claimActionId === c.id}
                              className="text-red-600 text-xs font-medium disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {tab === 'payment-details' && (
          <div className="max-w-2xl">
            <p className="text-sm text-slate-500 mb-4">
              These are shown to parents on their Fees page as where to send money. There's no automated payment
              gateway yet — payments made this way still need to be recorded manually under Invoices once you see
              them land.
            </p>

            {isLoadingPayoutDetails ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <form
                onSubmit={handleSavePayoutDetails}
                className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-6"
              >
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 mb-3">Mobile Money</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
                      <select
                        value={payoutForm.momoProvider}
                        onChange={(e) => setPayoutForm({ ...payoutForm, momoProvider: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      >
                        <option value="">Select…</option>
                        {MOMO_PROVIDERS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Number</label>
                      <input
                        value={payoutForm.momoNumber}
                        onChange={(e) => setPayoutForm({ ...payoutForm, momoNumber: e.target.value })}
                        placeholder="024 000 0000"
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Account name</label>
                      <input
                        value={payoutForm.momoAccountName}
                        onChange={(e) => setPayoutForm({ ...payoutForm, momoAccountName: e.target.value })}
                        placeholder="School name"
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-slate-900 mb-3">Bank account</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Bank name</label>
                      <input
                        value={payoutForm.bankName}
                        onChange={(e) => setPayoutForm({ ...payoutForm, bankName: e.target.value })}
                        placeholder="GCB Bank"
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Account number</label>
                      <input
                        value={payoutForm.bankAccountNumber}
                        onChange={(e) => setPayoutForm({ ...payoutForm, bankAccountNumber: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Account name</label>
                      <input
                        value={payoutForm.bankAccountName}
                        onChange={(e) => setPayoutForm({ ...payoutForm, bankAccountName: e.target.value })}
                        placeholder="School name"
                        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="submit"
                    disabled={isSavingPayoutDetails}
                    className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSavingPayoutDetails ? 'Saving…' : 'Save payment details'}
                  </button>
                  {payoutDetailsSaved && <span className="text-sm text-green-600">Saved.</span>}
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 print:static print:bg-transparent print:p-0">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 print:shadow-none print:max-w-none">
            <div className="flex justify-between items-start mb-4 print:hidden">
              <h2 className="text-base font-semibold text-slate-900">Invoice #{selectedInvoice.id}</h2>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-600 text-sm">
                Close
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-slate-900">
                {selectedInvoice.first_name} {selectedInvoice.last_name} ({selectedInvoice.admission_no})
              </p>
              <p className="text-sm text-slate-600">{selectedInvoice.fee_name}</p>
              <p className="text-xs text-slate-500 mt-1">
                Due: {selectedInvoice.due_date ? selectedInvoice.due_date.slice(0, 10) : '—'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm mb-4 border-y border-slate-200 py-3">
              <div>
                <p className="text-xs text-slate-500">Amount due</p>
                <p className="font-medium">{money(selectedInvoice.amount_due_cents)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Paid</p>
                <p className="font-medium">{money(selectedInvoice.amount_paid_cents)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Balance</p>
                <p className="font-medium">{money(remainingCents)}</p>
              </div>
            </div>

            {selectedInvoice.payments.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-600 mb-1">Payment history</p>
                <ul className="text-sm space-y-1">
                  {selectedInvoice.payments.map((p) => (
                    <li key={p.id} className="flex justify-between text-slate-700">
                      <span>
                        {p.paid_at.slice(0, 10)} · {p.payment_method}
                        {p.payment_ref ? ` (${p.payment_ref})` : ''}
                      </span>
                      <span>{money(p.amount_cents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isAdmin && canPay && (
              <form onSubmit={handleRecordPayment} className="print:hidden flex flex-wrap gap-2 items-end border-t border-slate-200 pt-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-24"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Reference</label>
                  <input
                    value={paymentForm.paymentRef}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentRef: e.target.value })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-28"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isRecordingPayment}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isRecordingPayment ? 'Saving…' : 'Record payment'}
                </button>
              </form>
            )}

            <button
              onClick={() => window.print()}
              className="print:hidden mt-4 text-sm text-indigo-600 underline"
            >
              Print receipt
            </button>
          </div>
        </div>
      )}
    </>
  );
}
