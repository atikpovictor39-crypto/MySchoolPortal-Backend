import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listActivePlans, getMySubscription, startCheckout, getCheckoutStatus } from '../../features/subscriptions/api';
import { formatMoney as money } from '../../utils/money';

const STATUS_STYLE = {
  trialing: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-green-50 text-green-700 border-green-200',
  past_due: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-50 text-slate-600 border-slate-200',
};

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 16; // ~40s, generous for a Mobile Money prompt round-trip

export default function SubscriptionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const externalRef = searchParams.get('ref');

  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingPlanId, setPayingPlanId] = useState(null);
  const [checkoutState, setCheckoutState] = useState(externalRef ? 'confirming' : null); // 'confirming' | 'success' | 'failed' | null
  const pollAttempts = useRef(0);

  async function refresh() {
    setIsLoading(true);
    try {
      const [sub, planList] = await Promise.all([getMySubscription(), listActivePlans()]);
      setSubscription(sub);
      setPlans(planList);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subscription');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After MoolRe redirects back with ?ref=..., poll until the webhook (or
  // this poll itself) has resolved the payment — see subscription.service.js's
  // checkCheckoutStatus, which actively re-checks with MoolRe rather than
  // just reading a possibly-stale row.
  useEffect(() => {
    if (!externalRef) return;
    let cancelled = false;

    async function poll() {
      try {
        const { status } = await getCheckoutStatus(externalRef);
        if (cancelled) return;
        if (status === 'success') {
          setCheckoutState('success');
          await refresh();
          return;
        }
        if (status === 'failed') {
          setCheckoutState('failed');
          return;
        }
        pollAttempts.current += 1;
        if (pollAttempts.current >= POLL_MAX_ATTEMPTS) {
          setCheckoutState('failed');
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setCheckoutState('failed');
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalRef]);

  function dismissCheckoutBanner() {
    setCheckoutState(null);
    searchParams.delete('ref');
    setSearchParams(searchParams, { replace: true });
  }

  async function handlePay(planId) {
    setError('');
    setPayingPlanId(planId);
    try {
      const { authorizationUrl } = await startCheckout(planId);
      window.location.href = authorizationUrl;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start checkout');
      setPayingPlanId(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Subscription</h1>
      <p className="text-sm text-slate-500 mb-6">Manage your school's plan and billing.</p>

      {checkoutState === 'confirming' && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
          <p className="text-sm text-blue-800">Confirming your payment — this can take a moment if you paid by Mobile Money…</p>
        </div>
      )}
      {checkoutState === 'success' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-green-800">Payment received — your subscription is active.</p>
          <button onClick={dismissCheckoutBanner} className="text-xs font-medium text-green-700 hover:underline shrink-0">
            Dismiss
          </button>
        </div>
      )}
      {checkoutState === 'failed' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-800">
            We couldn't confirm this payment yet. If Mobile Money debited you, it may still be processing — check back shortly.
          </p>
          <button onClick={dismissCheckoutBanner} className="text-xs font-medium text-red-700 hover:underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          {subscription && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">Current plan</p>
                  <p className="text-base font-semibold text-slate-900 mt-0.5">{subscription.plan_name}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {money(subscription.price_cents)} / {subscription.billing_cycle === 'yearly' ? 'year' : 'month'}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize shrink-0 ${
                    STATUS_STYLE[subscription.status] || ''
                  }`}
                >
                  {subscription.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                {subscription.status === 'trialing' ? 'Trial ends' : 'Current period ends'}{' '}
                {new Date(subscription.current_period_end).toLocaleDateString(undefined, {
                  dateStyle: 'medium',
                })}
              </p>
            </div>
          )}

          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            {subscription?.status === 'active' ? 'Change plan' : 'Choose a plan to pay for'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => (
              <div key={plan.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col">
                <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">
                  {money(plan.price_cents)}
                  <span className="text-xs font-normal text-slate-400"> / {plan.billing_cycle === 'yearly' ? 'yr' : 'mo'}</span>
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-3">
                  {plan.max_students ? `Up to ${plan.max_students} students` : 'Unlimited students'}
                </p>
                <button
                  onClick={() => handlePay(plan.id)}
                  disabled={payingPlanId === plan.id}
                  className="mt-auto rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {payingPlanId === plan.id
                    ? 'Redirecting…'
                    : subscription?.plan_id === plan.id
                    ? 'Renew'
                    : 'Pay with Mobile Money / Card'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
