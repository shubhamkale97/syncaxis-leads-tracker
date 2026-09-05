const crypto = require('crypto');
const { db, admin } = require('../lib/firebaseAdmin');
const { sendEmail } = require('../lib/email');
const { createAssignmentToken } = require('../lib/board');
const { esc } = require('../lib/render');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://inquiry.syncaxis.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function row(label, value) {
  if (!value) return '';
  return `<tr><td style="padding:4px 14px 4px 0;color:#8993a4;font-size:12px;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:4px 0;color:#171b23;font-size:13px;">${esc(value)}</td></tr>`;
}

function renderAssignmentEmail({ lead, assignedByName, acceptUrl, declineUrl, rescheduleUrl }) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">
    <h2 style="color:#171b23;margin-bottom:4px;">You've been assigned a lead</h2>
    <p style="color:#4d5768;font-size:14px;">${esc(assignedByName)} assigned you the following enquiry in the Syncaxis Leads Tracker:</p>
    <table style="border-collapse:collapse;margin:18px 0;width:100%;">
      ${row('Enquiry No', lead.enquiryNumber)}
      ${row('Company', lead.companyName)}
      ${row('Contact Person', lead.contactPerson)}
      ${row('Phone', lead.phone)}
      ${row('Email', lead.email)}
      ${row('Application', lead.applicationCategory)}
      ${row('Application Detail', lead.applicationDetail)}
      ${row('Lead Value (₹)', lead.leadValue)}
      ${row('Location', [lead.city, lead.state].filter(Boolean).join(', '))}
      ${row('Status', lead.status)}
      ${row('Priority', lead.priority)}
      ${row('Latest Note', lead.latestNote)}
    </table>
    <p style="color:#4d5768;font-size:14px;">Please respond so the team knows where this stands:</p>
    <div style="margin:22px 0;">
      <a href="${acceptUrl}" style="display:inline-block;background:#1a8f5a;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;margin:0 8px 8px 0;font-weight:bold;font-size:14px;">✓ Accept</a>
      <a href="${declineUrl}" style="display:inline-block;background:#c23d3d;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;margin:0 8px 8px 0;font-weight:bold;font-size:14px;">✕ Decline</a>
      <a href="${rescheduleUrl}" style="display:inline-block;background:#b8730f;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;margin:0 8px 8px 0;font-weight:bold;font-size:14px;">🕒 Reschedule</a>
    </div>
    <p style="color:#8993a4;font-size:11px;">This link is unique to you and this assignment — please don't forward this email. It expires in 30 days.</p>
  </div>`;
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'Missing auth token' });
    const decoded = await admin.auth().verifyIdToken(idToken);

    const body = req.body || {};
    const { srNo, assignedToName, assignedByName, lead } = body;
    if (!srNo || !assignedToName || !lead) return res.status(400).json({ error: 'Missing srNo, assignedToName, or lead details' });

    // Server-side lookup only -- this is exactly the record a regular teammate isn't
    // allowed to read for anyone but themselves under the app's own Firestore rules,
    // but the Admin SDK here runs as a trusted server, not as that teammate's client.
    const usersSnap = await db().collection('users').where('displayName', '==', assignedToName).limit(1).get();
    if (usersSnap.empty) {
      return res.status(404).json({ error: `No registered account found for "${assignedToName}" — they need a real login before they can be emailed.` });
    }
    const assigneeEmail = usersSnap.docs[0].data().email;
    if (!assigneeEmail) return res.status(404).json({ error: `"${assignedToName}"'s account has no email on file.` });

    const token = crypto.randomBytes(24).toString('base64url');
    await createAssignmentToken(token, {
      srNo: String(srNo),
      lead,
      assignedToName,
      assignedToEmail: assigneeEmail,
      assignedByName: assignedByName || decoded.email || 'A teammate',
      assignedByUid: decoded.uid,
    });

    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    if (!base) return res.status(500).json({ error: 'PUBLIC_BASE_URL is not configured on the server' });
    const acceptUrl = `${base}/a?token=${token}`;
    const declineUrl = `${base}/d?token=${token}`;
    const rescheduleUrl = `${base}/r?token=${token}`;

    await sendEmail({
      to: assigneeEmail,
      subject: `New lead assigned: ${lead.companyName || lead.enquiryNumber || 'Enquiry'}`,
      html: renderAssignmentEmail({ lead, assignedByName: assignedByName || decoded.email, acceptUrl, declineUrl, rescheduleUrl }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
