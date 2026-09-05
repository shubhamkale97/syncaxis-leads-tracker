const { db, admin } = require('./firebaseAdmin');

const BOARD_COLLECTION = 'exhibitionDashboards';
const BOARD_DOC = 'sharedLeadBoard';
const ACTIVITY_LOG_COLLECTION = 'activityLog';
const ASSIGNMENT_ACTIONS_COLLECTION = 'assignmentActions';
const TOKEN_TTL_DAYS = 30;

function boardRef() {
  return db().collection(BOARD_COLLECTION).doc(BOARD_DOC);
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Same shape as this app's own noteLogs entries (see addNoteEntry in index.html) so
// it renders identically in the Notes column and the Follow-Up tab — this is a
// system-authored note, not a special case the UI needs to know about.
function noteEntry(text, by, nextFollowUp) {
  return {
    id: newId('assign'),
    date: new Date().toISOString().slice(0, 10),
    text,
    by,
    at: Date.now(),
    nextFollowUp: nextFollowUp || '',
  };
}

async function appendNote(srNo, entry, extraFields) {
  const patch = {
    [`noteLogs.${srNo}`]: admin.firestore.FieldValue.arrayUnion(entry),
    [`editMeta.${srNo}`]: { by: entry.by, at: admin.firestore.FieldValue.serverTimestamp() },
  };
  Object.assign(patch, extraFields || {});
  await boardRef().update(patch);
}

// Same document shape as this app's own logActivity() in index.html. uid is left
// blank -- these actions come from an email link, not a signed-in app session, so
// there's no Firebase Auth uid to attribute it to (the token itself is what proves
// who this was sent to).
async function logActivity(action, label, extra) {
  const entry = Object.assign(
    {
      at: admin.firestore.FieldValue.serverTimestamp(),
      by: '', byEmail: '', uid: '',
      action, label,
      ip: '', location: '', geoSource: '',
    },
    extra || {}
  );
  await db().collection(ACTIVITY_LOG_COLLECTION).doc(newId('log')).set(entry);
}

async function getAssignmentToken(token) {
  const ref = db().collection(ASSIGNMENT_ACTIONS_COLLECTION).doc(token);
  const snap = await ref.get();
  return { ref, snap, data: snap.exists ? snap.data() : null };
}

async function createAssignmentToken(token, fields) {
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db()
    .collection(ASSIGNMENT_ACTIONS_COLLECTION)
    .doc(token)
    .set(Object.assign({ createdAt: now, expiresAt, used: false, action: null, reason: null, rescheduleDate: null, respondedAt: null }, fields));
}

function isExpired(data) {
  return !!(data.expiresAt && data.expiresAt.toMillis() < Date.now());
}

module.exports = {
  BOARD_COLLECTION, BOARD_DOC, ASSIGNMENT_ACTIONS_COLLECTION,
  boardRef, noteEntry, appendNote, logActivity,
  getAssignmentToken, createAssignmentToken, isExpired,
};
