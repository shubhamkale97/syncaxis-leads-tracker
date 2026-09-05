const { getAssignmentToken, isExpired, noteEntry, appendNote, logActivity } = require('../../lib/board');
const { htmlPage, esc } = require('../../lib/render');

module.exports = async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send(htmlPage('Missing link', 'This link is missing its token.'));

  const { ref, data } = await getAssignmentToken(token);
  if (!data) return res.status(404).send(htmlPage('Link not found', 'This link is invalid, or the assignment it refers to no longer exists.'));
  if (data.used) return res.status(200).send(htmlPage('Already responded', `You already responded to this assignment (<b>${esc(data.action)}</b>). No further action is needed.`));
  if (isExpired(data)) return res.status(410).send(htmlPage('Link expired', 'This link has expired (30 days). Ask your admin to reassign the lead if it still needs a response.'));

  await ref.update({ used: true, action: 'accept', respondedAt: new Date() });

  const entry = noteEntry(`✅ ${data.assignedToName} accepted this assignment.`, data.assignedToName);
  await appendNote(data.srNo, entry);
  await logActivity('assignment-accept', `${data.assignedToName} accepted the assignment for ${data.lead.companyName || `Lead #${data.srNo}`}`, {
    by: data.assignedToName, byEmail: data.assignedToEmail, srno: data.srNo,
  });

  return res.status(200).send(htmlPage('Assignment accepted', `Thanks — you've accepted the assignment for <b>${esc(data.lead.companyName || 'this lead')}</b>. The team has been notified in the app's activity log.`));
};
