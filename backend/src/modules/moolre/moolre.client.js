const env = require('../../config/env');

const BASE_URL = 'https://api.moolre.com';

// Mirrors email.service.js's isConfigured pattern — without credentials,
// callers get a clear "not configured" error instead of the whole checkout
// endpoint crashing, so local dev and any environment without a MoolRe
// account still boots fine.
const isConfigured = Boolean(env.moolre.apiUser && env.moolre.apiPubkey && env.moolre.accountNumber);

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-API-USER': env.moolre.apiUser,
    'X-API-PUBKEY': env.moolre.apiPubkey,
  };
}

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return json;
}

// price_cents is stored as an integer everywhere else in this app; MoolRe
// wants a decimal-string amount ("49.00"), so the conversion happens right
// at this boundary rather than leaking cents-vs-decimal ambiguity upward.
function centsToAmountString(cents) {
  return (cents / 100).toFixed(2);
}

// Generates a hosted checkout page (card + Mobile Money) a school admin is
// redirected to — same shape as Paystack/Flutterwave's "initialize
// transaction" pattern. reusable: '0' since each externalref is a specific,
// one-off subscription payment, not a repeat-charge link.
async function generatePaymentLink({ amountCents, email, externalRef, callbackUrl, redirectUrl, metadata }) {
  const json = await post('/embed/link', {
    type: 1,
    amount: centsToAmountString(amountCents),
    email,
    externalref: externalRef,
    reusable: '0',
    currency: 'GHS',
    accountnumber: env.moolre.accountNumber,
    callback: callbackUrl,
    redirect: redirectUrl,
    metadata,
  });

  if (Number(json.status) !== 1 || !json.data?.authorization_url) {
    const err = new Error(json.message || 'MoolRe did not return a checkout link');
    err.moolreResponse = json;
    throw err;
  }

  return { authorizationUrl: json.data.authorization_url, reference: json.data.reference };
}

// The webhook payload itself is unsigned (MoolRe's docs don't document any
// signature/HMAC verification), so it's only ever used as a hint to re-check
// — never trusted directly. This is the one call that's actually trusted:
// it asks MoolRe, with our own credentials, what really happened for a given
// externalref. idtype 1 = look up by externalref (the id we generated),
// not MoolRe's own internal transaction id.
async function checkPaymentStatus(externalRef) {
  const json = await post('/open/transact/status', {
    type: 1,
    idtype: 1,
    id: externalRef,
    accountnumber: env.moolre.accountNumber,
  });

  // txstatus 1 = successful, per MoolRe's docs; anything else (including a
  // still-pending or failed payment) is not a success.
  const succeeded = Number(json.status) === 1 && Number(json.data?.txstatus) === 1;
  return { succeeded, raw: json };
}

module.exports = { isConfigured, generatePaymentLink, checkPaymentStatus, centsToAmountString };
