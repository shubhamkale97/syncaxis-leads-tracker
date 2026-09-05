// Resend (https://resend.com) — plain fetch call, no SDK dependency needed for
// something this small. Requires RESEND_API_KEY, and EMAIL_FROM to be an address on
// a domain you've verified in Resend (their dashboard walks you through the DNS
// records), or mail will be rejected or land in spam.
async function sendEmail({ to, subject, html }) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Syncaxis Leads <leads@syncaxis.com>',
      to,
      subject,
      html,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Resend error ${resp.status}: ${text}`);
  }
  return resp.json();
}

module.exports = { sendEmail };
