// api/notify.js — internal helper, called by collect.js
// Sends a real-time email notification to the collector owner when a new subscriber comes in
// Only fires if the collector has notify_email set (Pro feature)
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

async function sendNewSubscriberNotification({ collectorId, newEmail, notifyEmail, headline }) {
  if (!resend || !notifyEmail) return;

  try {
    await resend.emails.send({
      from: 'DropCollect <hello@dropcollect.io>',
      to: notifyEmail,
      subject: `New subscriber on "${headline || collectorId}"`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#07070f;color:#e2e2ef;border-radius:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;">
            <span style="font-size:20px;font-weight:800;color:#e2e2ef;">Drop<span style="color:#4dffcc;">Collect</span></span>
          </div>
          <div style="background:#0e0e1c;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:20px;margin-bottom:24px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b6b99;margin-bottom:6px;">New Subscriber</div>
            <div style="font-size:20px;font-family:monospace;color:#4dffcc;">${newEmail}</div>
          </div>
          <div style="font-size:13px;color:#6b6b99;margin-bottom:20px;">
            Collected on <strong style="color:#e2e2ef;">${headline || collectorId}</strong>
          </div>
          <a href="https://dropcollect.io/dashboard.html?id=${collectorId}"
             style="display:inline-block;padding:11px 22px;background:#4dffcc;color:#07070f;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;">
            View Dashboard →
          </a>
          <p style="color:#6b6b99;font-size:11px;margin-top:28px;">
            You're getting this because you have email notifications on for collector ${collectorId}.<br>
            To turn off notifications, visit your <a href="https://dropcollect.io/dashboard.html?id=${collectorId}" style="color:#4dffcc;">dashboard</a>.
          </p>
        </div>
      `,
    });
  } catch (err) {
    // Never let notification failure break the collection flow
    console.error('Notification email failed:', err.message);
  }
}

module.exports = { sendNewSubscriberNotification };
