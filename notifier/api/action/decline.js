const { getAssignmentToken, isExpired, noteEntry, appendNote, logActivity } = require('../../lib/board');
const { htmlPage, htmlForm, esc } = require('../../lib/render');

const DECLINE_FIELDS = [{ name: 'reason', label: 'Reason', type: 'textarea', required: true }];

module.exports = async (req, res) => {
  const token = req.method === 'GET' ? req.query.token : (req.body || {}).token;
  if (!token) return res.status(400).send(htmlPage('Missing link', 'This link is missing its token.'));

  const { ref, data } = await getAssignmentToken(token);
  if (!data) return res.status(404).send(htmlPage('Link not found', 'This link is invalid, or the assignment it refers to no longer exists.'));

  if (req.method === 'GET') {
    if (data.used) return res.status(200).send(htmlPage('Already responded', `You already responded to this assignment (<b>${esc(data.action)}</b>). No further action is needed.`));
    if (isExpired(data)) return res.status(410).send(htmlPage('Link expired', 'This link has expired (30 days). Ask your admin to reassign the lead.'));
    return res.status(200).send(
      htmlForm({
        title: 'Decline assignment',
        intro: `Let the team know why you're declining ${data.lead.companyName || 'this lead'}.`,
        token,
        fields: DECLINE_FIELDS,
        submitLabel: 'Submit decline',
      })
    );
  }

  // POST
  if (data.used) return res.status(200).send(htmlPage('Already responded', `You already responded to this assignment (<b>${esc(data.action)}</b>). No further action is needed.`));
  if (isExpired(data)) return res.status(410).send(htmlPage('Link expired', 'This link has expired (30 days). Ask your admin to reassign the lead.'));

  const reason = ((req.body || {}).reason || '').trim();
  if (!reason) {
    return res.status(200).send(
      htmlForm({
        title: 'Decline assignment',
        intro: `Let the team know why you're declining ${data.lead.companyName || 'this lead'}.`,
        token,
        fields: DECLINE_FIELDS,
        submitLabel: 'Submit decline',
        error: 'Please enter a reason.',
      })
    );
  }

  await ref.update({ used: true, action: 'decline', reason, respondedAt: new Date() });

  const entry = noteEntry(`❌ ${data.assignedToName} declined this assignment. Reason: ${reason}`, data.assignedToName);
  await appendNote(data.srNo, entry);
  await logActivity('assignment-decline', `${data.assignedToName} declined the assignment for ${data.lead.companyName || `Lead #${data.srNo}`}: ${reason}`, {
    by: data.assignedToName, byEmail: data.assignedToEmail, srno: data.srNo,
  });

  return res.status(200).send(htmlPage('Declined', `Recorded — thanks for letting the team know. This has been added to the lead's notes.`));
};
