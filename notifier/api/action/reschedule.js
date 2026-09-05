const { getAssignmentToken, isExpired, noteEntry, appendNote, logActivity } = require('../../lib/board');
const { htmlPage, htmlForm, esc } = require('../../lib/render');

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fields() {
  return [
    { name: 'newDate', label: 'New follow-up date', type: 'date', required: true, min: todayISO() },
    { name: 'reason', label: 'Reason', type: 'textarea', required: true },
  ];
}

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
        title: 'Reschedule follow-up',
        intro: `Pick a new follow-up date for ${data.lead.companyName || 'this lead'}, and say why.`,
        token,
        fields: fields(),
        submitLabel: 'Submit reschedule',
      })
    );
  }

  // POST
  if (data.used) return res.status(200).send(htmlPage('Already responded', `You already responded to this assignment (<b>${esc(data.action)}</b>). No further action is needed.`));
  if (isExpired(data)) return res.status(410).send(htmlPage('Link expired', 'This link has expired (30 days). Ask your admin to reassign the lead.'));

  const newDate = ((req.body || {}).newDate || '').trim();
  const reason = ((req.body || {}).reason || '').trim();
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(newDate);
  if (!validDate || !reason) {
    return res.status(200).send(
      htmlForm({
        title: 'Reschedule follow-up',
        intro: `Pick a new follow-up date for ${data.lead.companyName || 'this lead'}, and say why.`,
        token,
        fields: fields(),
        submitLabel: 'Submit reschedule',
        error: !validDate ? 'Please choose a valid date.' : 'Please enter a reason.',
      })
    );
  }

  await ref.update({ used: true, action: 'reschedule', reason, rescheduleDate: newDate, respondedAt: new Date() });

  // Mirrors addNoteEntry() in index.html: a dated note PLUS the lead's own Next
  // Follow-up Date field, kept in sync -- that field is what the app's Follow-Up
  // Activity tab (Overdue / Due-Soon) actually reads from.
  const entry = noteEntry(`🕒 ${data.assignedToName} rescheduled the follow-up to ${newDate}. Reason: ${reason}`, data.assignedToName, newDate);
  await appendNote(data.srNo, entry, { [`edits.${data.srNo}.Next Follow-up Date`]: newDate });
  await logActivity('assignment-reschedule', `${data.assignedToName} rescheduled the follow-up for ${data.lead.companyName || `Lead #${data.srNo}`} to ${newDate}: ${reason}`, {
    by: data.assignedToName, byEmail: data.assignedToEmail, srno: data.srNo,
  });

  return res.status(200).send(htmlPage('Rescheduled', `Done — follow-up for <b>${esc(data.lead.companyName || 'this lead')}</b> is now set to <b>${esc(newDate)}</b>. Added to the lead's notes.`));
};
