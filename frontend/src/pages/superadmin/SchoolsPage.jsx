import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listSchools, createSchool, updateSchoolStatus } from '../../features/schools/api';
import { listPlans, createPlan, updatePlan } from '../../features/subscriptions/api';
import { listSuperAdmins, createSuperAdmin, updateSuperAdminStatus } from '../../features/superadmins/api';
import PasswordInput from '../../components/common/PasswordInput';
import Tabs from '../../components/common/Tabs';
import { formatMoney as money } from '../../utils/money';

const ALL_TABS = [
  { key: 'schools', label: 'Schools', scopes: ['developer', 'billing'] },
  { key: 'plans', label: 'Plans', scopes: ['billing'] },
  { key: 'accounts', label: 'Accounts', scopes: [] }, // full-scope only
];

const SCOPES = [
  { value: 'full', label: 'Full access' },
  { value: 'support', label: 'Support' },
  { value: 'billing', label: 'Billing' },
  { value: 'developer', label: 'Developer' },
];

const emptySchoolForm = { name: '', adminName: '', adminEmail: '', adminPassword: '', planId: '' };
const emptyPlanForm = { name: '', price: '', billingCycle: 'monthly', maxStudents: '' };
const emptyAdminForm = { name: '', email: '', password: '', scope: 'full' };

const STATUS_STYLE = {
  active: 'bg-green-50 text-green-700 border-green-200',
  trialing: 'bg-amber-50 text-amber-700 border-amber-200',
  past_due: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-50 text-slate-600 border-slate-200',
  expired: 'bg-slate-50 text-slate-600 border-slate-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  archived: 'bg-slate-50 text-slate-600 border-slate-200',
};

function toCents(amountString) {
  return Math.round(parseFloat(amountString) * 100);
}

export default function SchoolsPage() {
  const { user } = useAuth();
  const isFull = !user.superadmin_scope || user.superadmin_scope === 'full';
  const TABS = isFull ? ALL_TABS : ALL_TABS.filter((t) => t.scopes.includes(user.superadmin_scope));
  const [tab, setTab] = useState(TABS[0]?.key || 'schools');
  const [error, setError] = useState('');

  const [schools, setSchools] = useState([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(true);
  const [schoolForm, setSchoolForm] = useState(emptySchoolForm);
  const [isSubmittingSchool, setIsSubmittingSchool] = useState(false);
  const [statusActionId, setStatusActionId] = useState(null);

  const [plans, setPlans] = useState([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planToggleId, setPlanToggleId] = useState(null);

  const [admins, setAdmins] = useState([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);
  const [adminToggleId, setAdminToggleId] = useState(null);

  async function refreshSchools() {
    setIsLoadingSchools(true);
    try {
      setSchools(await listSchools());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load schools');
    } finally {
      setIsLoadingSchools(false);
    }
  }

  async function refreshPlans() {
    setIsLoadingPlans(true);
    try {
      setPlans(await listPlans());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load plans');
    } finally {
      setIsLoadingPlans(false);
    }
  }

  async function refreshAdmins() {
    setIsLoadingAdmins(true);
    try {
      setAdmins(await listSuperAdmins());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load accounts');
    } finally {
      setIsLoadingAdmins(false);
    }
  }

  // Only fetch what this scope is actually allowed to see — a billing or
  // developer sub-admin would otherwise get a 403 from GET /superadmins
  // (full-scope only) the moment this page mounts.
  useEffect(() => {
    if (isFull || user.superadmin_scope === 'developer' || user.superadmin_scope === 'billing') refreshSchools();
    if (isFull || user.superadmin_scope === 'billing') refreshPlans();
    if (isFull) refreshAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateAdmin(e) {
    e.preventDefault();
    setError('');
    setIsSubmittingAdmin(true);
    try {
      await createSuperAdmin(adminForm);
      setAdminForm(emptyAdminForm);
      await refreshAdmins();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account');
    } finally {
      setIsSubmittingAdmin(false);
    }
  }

  async function handleToggleAdminStatus(admin) {
    const nextStatus = admin.status === 'suspended' ? 'active' : 'suspended';
    if (nextStatus === 'suspended' && !window.confirm(`Suspend ${admin.name}? They won't be able to log in until reactivated.`)) {
      return;
    }
    setError('');
    setAdminToggleId(admin.id);
    try {
      await updateSuperAdminStatus(admin.id, nextStatus);
      await refreshAdmins();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update account status');
    } finally {
      setAdminToggleId(null);
    }
  }

  const activePlans = plans.filter((p) => p.is_active);

  async function handleCreateSchool(e) {
    e.preventDefault();
    setError('');
    setIsSubmittingSchool(true);
    try {
      await createSchool({ ...schoolForm, planId: schoolForm.planId || undefined });
      setSchoolForm(emptySchoolForm);
      await refreshSchools();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create school');
    } finally {
      setIsSubmittingSchool(false);
    }
  }

  async function handleToggleSchoolStatus(school) {
    const nextStatus = school.status === 'suspended' ? 'active' : 'suspended';
    if (nextStatus === 'suspended' && !window.confirm(`Suspend ${school.name}? Its staff and parents won't be able to log in until reactivated.`)) {
      return;
    }
    setError('');
    setStatusActionId(school.id);
    try {
      await updateSchoolStatus(school.id, nextStatus);
      await refreshSchools();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update school status');
    } finally {
      setStatusActionId(null);
    }
  }

  async function handleCreatePlan(e) {
    e.preventDefault();
    setError('');
    setIsSubmittingPlan(true);
    try {
      await createPlan({
        name: planForm.name,
        priceCents: toCents(planForm.price),
        billingCycle: planForm.billingCycle,
        maxStudents: planForm.maxStudents ? parseInt(planForm.maxStudents, 10) : null,
      });
      setPlanForm(emptyPlanForm);
      await refreshPlans();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create plan');
    } finally {
      setIsSubmittingPlan(false);
    }
  }

  function openEditPlan(plan) {
    setError('');
    setEditingPlan({
      id: plan.id,
      name: plan.name,
      price: (plan.price_cents / 100).toFixed(2),
      billingCycle: plan.billing_cycle,
      maxStudents: plan.max_students ?? '',
    });
  }

  async function handleSaveEditedPlan(e) {
    e.preventDefault();
    setError('');
    setIsSubmittingPlan(true);
    try {
      await updatePlan(editingPlan.id, {
        name: editingPlan.name,
        priceCents: toCents(editingPlan.price),
        billingCycle: editingPlan.billingCycle,
        maxStudents: editingPlan.maxStudents ? parseInt(editingPlan.maxStudents, 10) : null,
      });
      setEditingPlan(null);
      await refreshPlans();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save plan');
    } finally {
      setIsSubmittingPlan(false);
    }
  }

  async function handleTogglePlanActive(plan) {
    setError('');
    setPlanToggleId(plan.id);
    try {
      await updatePlan(plan.id, { isActive: !plan.is_active });
      await refreshPlans();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update plan');
    } finally {
      setPlanToggleId(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Platform Admin</h1>
      <p className="text-sm text-slate-500 mb-6">Onboard schools and manage what subscription plans they can be on.</p>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {tab === 'schools' && (
        <div>
          <form
            onSubmit={handleCreateSchool}
            className="mb-8 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">School name</label>
              <input
                required
                value={schoolForm.name}
                onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Admin name</label>
              <input
                required
                value={schoolForm.adminName}
                onChange={(e) => setSchoolForm({ ...schoolForm, adminName: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Admin email</label>
              <input
                required
                type="email"
                value={schoolForm.adminEmail}
                onChange={(e) => setSchoolForm({ ...schoolForm, adminEmail: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Admin password</label>
              <PasswordInput
                required
                value={schoolForm.adminPassword}
                onChange={(e) => setSchoolForm({ ...schoolForm, adminPassword: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
              <select
                value={schoolForm.planId}
                onChange={(e) => setSchoolForm({ ...schoolForm, planId: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="">Cheapest active plan</option>
                {activePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({money(p.price_cents)}/{p.billing_cycle === 'yearly' ? 'yr' : 'mo'})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isSubmittingSchool}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmittingSchool ? 'Creating…' : 'Create school'}
            </button>
          </form>

          {isLoadingSchools ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : schools.length === 0 ? (
            <p className="text-sm text-slate-500">No schools yet.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Admin Email</th>
                  <th className="px-4 py-2">Plan</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Subscription</th>
                  <th className="px-4 py-2">Created</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2">{s.email}</td>
                    <td className="px-4 py-2">{s.plan_name || '—'}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[s.status] || ''}`}
                      >
                        {s.status}
                      </span>
                    </td>
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
                    <td className="px-4 py-2">
                      {s.status !== 'archived' && (
                        <button
                          onClick={() => handleToggleSchoolStatus(s)}
                          disabled={statusActionId === s.id}
                          className={`text-xs font-medium disabled:opacity-50 ${
                            s.status === 'suspended' ? 'text-green-700' : 'text-red-600'
                          }`}
                        >
                          {statusActionId === s.id ? 'Saving…' : s.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                        </button>
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

      {tab === 'plans' && (
        <div>
          <form
            onSubmit={handleCreatePlan}
            className="mb-8 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plan name</label>
              <input
                required
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                placeholder="Standard"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-32"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Price</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={planForm.price}
                onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                placeholder="49.00"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-24"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Billing cycle</label>
              <select
                value={planForm.billingCycle}
                onChange={(e) => setPlanForm({ ...planForm, billingCycle: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max students</label>
              <input
                type="number"
                min="1"
                value={planForm.maxStudents}
                onChange={(e) => setPlanForm({ ...planForm, maxStudents: e.target.value })}
                placeholder="Unlimited"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-28"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmittingPlan}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmittingPlan ? 'Adding…' : 'Add plan'}
            </button>
          </form>

          {isLoadingPlans ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Max students</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2">
                      {money(p.price_cents)}/{p.billing_cycle === 'yearly' ? 'yr' : 'mo'}
                    </td>
                    <td className="px-4 py-2">{p.max_students ?? 'Unlimited'}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                          p.is_active ? STATUS_STYLE.active : STATUS_STYLE.cancelled
                        }`}
                      >
                        {p.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => openEditPlan(p)} className="text-blue-600 text-xs font-medium">
                          Edit
                        </button>
                        <button
                          onClick={() => handleTogglePlanActive(p)}
                          disabled={planToggleId === p.id}
                          className="text-slate-500 text-xs font-medium disabled:opacity-50"
                        >
                          {planToggleId === p.id ? 'Saving…' : p.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {tab === 'accounts' && (
        <div>
          <p className="text-sm text-slate-500 mb-4">
            Give your own staff their own login — Support, Billing, and Developer each only see the parts of the
            platform their job needs. "Full access" is the same unrestricted access as your own account, so only
            add people you'd trust with that.
          </p>
          <form
            onSubmit={handleCreateAdmin}
            className="mb-8 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                required
                value={adminForm.name}
                onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                required
                type="email"
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Temporary password</label>
              <PasswordInput
                required
                value={adminForm.password}
                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Access</label>
              <select
                value={adminForm.scope}
                onChange={(e) => setAdminForm({ ...adminForm, scope: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                {SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isSubmittingAdmin}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmittingAdmin ? 'Creating…' : 'Create account'}
            </button>
          </form>
          <p className="text-xs text-slate-400 mb-6 -mt-4">
            They'll be forced to set their own password the first time they log in.
          </p>

          {isLoadingAdmins ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Access</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Created</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        {a.name}
                        {a.id === user.id && <span className="text-slate-400"> (you)</span>}
                      </td>
                      <td className="px-4 py-2">{a.email}</td>
                      <td className="px-4 py-2 capitalize">{a.superadmin_scope || 'Full access'}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_STYLE[a.status] || ''}`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">{a.created_at.slice(0, 10)}</td>
                      <td className="px-4 py-2">
                        {a.id !== user.id && (
                          <button
                            onClick={() => handleToggleAdminStatus(a)}
                            disabled={adminToggleId === a.id}
                            className={`text-xs font-medium disabled:opacity-50 ${
                              a.status === 'suspended' ? 'text-green-700' : 'text-red-600'
                            }`}
                          >
                            {adminToggleId === a.id ? 'Saving…' : a.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
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

      {editingPlan && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-base font-semibold text-slate-900">Edit plan</h2>
              <button onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-slate-600 text-sm">
                Close
              </button>
            </div>
            <form onSubmit={handleSaveEditedPlan} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Plan name</label>
                <input
                  required
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Price</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingPlan.price}
                  onChange={(e) => setEditingPlan({ ...editingPlan, price: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Billing cycle</label>
                <select
                  value={editingPlan.billingCycle}
                  onChange={(e) => setEditingPlan({ ...editingPlan, billingCycle: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Max students</label>
                <input
                  type="number"
                  min="1"
                  value={editingPlan.maxStudents}
                  onChange={(e) => setEditingPlan({ ...editingPlan, maxStudents: e.target.value })}
                  placeholder="Unlimited"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingPlan}
                className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmittingPlan ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
