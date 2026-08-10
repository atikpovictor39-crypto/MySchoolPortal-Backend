const { Resend } = require('resend');
const env = require('../../config/env');

// Mirrors push.service.js's isConfigured pattern: without an API key this
// logs instead of sending, so signup/cron flows never fail just because
// email hasn't been set up yet in a given environment.
const isConfigured = Boolean(env.email.apiKey);
const resend = isConfigured ? new Resend(env.email.apiKey) : null;

async function sendEmail({ to, subject, html }) {
  if (!isConfigured) {
    console.log(`[email] (not configured) would send "${subject}" to ${to}`);
    return;
  }
  try {
    await resend.emails.send({ from: env.email.from, to, subject, html });
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.message);
  }
}

function layout(heading, bodyHtml) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #6366f1, #4338ca); margin-bottom: 20px;"></div>
      <h1 style="font-size: 18px; color: #0f172a; margin: 0 0 12px;">${heading}</h1>
      <div style="font-size: 14px; color: #334155; line-height: 1.6;">${bodyHtml}</div>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">MySchoolPortal</p>
    </div>
  `;
}

async function sendWelcomeEmail(adminEmail, adminName, schoolName) {
  await sendEmail({
    to: adminEmail,
    subject: `Welcome to MySchoolPortal, ${schoolName}!`,
    html: layout(
      `Welcome, ${adminName}!`,
      `<p>${schoolName}'s account is ready. You're on a free trial for the first month —
       no payment needed yet.</p>
       <p>Sign in any time to add classes, students, and teachers, and start tracking
       attendance, fees, and results.</p>`
    ),
  });
}

async function sendVerificationEmail(adminEmail, adminName, code) {
  await sendEmail({
    to: adminEmail,
    subject: `Your MySchoolPortal verification code: ${code}`,
    html: layout(
      'Verify your email',
      `<p>Hi ${adminName}, enter this code to verify your email address:</p>
       <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #1E40AF; margin: 20px 0;">${code}</p>
       <p>This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>`
    ),
  });
}

async function sendPasswordResetEmail(email, name, resetLink) {
  await sendEmail({
    to: email,
    subject: 'Reset your MySchoolPortal password',
    html: layout(
      'Reset your password',
      `<p>Hi ${name}, we got a request to reset your password. Click below to choose a new one:</p>
       <p style="margin: 20px 0;">
         <a href="${resetLink}" style="background: #2563EB; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Reset password</a>
       </p>
       <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change.</p>`
    ),
  });
}

async function sendReminderEmail(adminEmail, adminName, schoolName, periodEndDate) {
  await sendEmail({
    to: adminEmail,
    subject: `${schoolName}'s subscription renews soon`,
    html: layout(
      'Your subscription renews soon',
      `<p>Hi ${adminName}, ${schoolName}'s current billing period ends on
       <strong>${periodEndDate}</strong>. Please arrange payment before then to avoid
       any interruption.</p>`
    ),
  });
}

async function sendOverdueEmail(adminEmail, adminName, schoolName) {
  await sendEmail({
    to: adminEmail,
    subject: `Payment needed for ${schoolName}`,
    html: layout(
      'Payment is now overdue',
      `<p>Hi ${adminName}, ${schoolName}'s subscription period has ended without payment.
       You have <strong>7 days</strong> to make payment before the account is locked.</p>`
    ),
  });
}

async function sendExpiredEmail(adminEmail, adminName, schoolName) {
  await sendEmail({
    to: adminEmail,
    subject: `${schoolName}'s account has been locked`,
    html: layout(
      'Account locked — payment overdue',
      `<p>Hi ${adminName}, ${schoolName}'s account is now locked because payment was not
       received within the grace period. Sign-in is disabled until payment is made —
       contact your platform administrator to restore access.</p>`
    ),
  });
}

module.exports = {
  isConfigured,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendReminderEmail,
  sendOverdueEmail,
  sendExpiredEmail,
};
