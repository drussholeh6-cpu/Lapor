const { randomInt } = require('node:crypto');
const { realtimeDatabase } = require('../config/firebaseAdmin');

const COMPLAINTS_PATH = 'complaints';

function publicComplaint(complaint) {
  return {
    code: complaint.code,
    cat: complaint.cat,
    loc: complaint.loc,
    text: complaint.text,
    at: complaint.at,
    priority: complaint.priority,
    unit: complaint.unit,
    coordinates: complaint.coordinates || null,
    waitingForInfo: Boolean(complaint.waitingForInfo),
    infoPrompt: complaint.waitingForInfo ? complaint.infoPrompt : '',
    infoRequestedAt: complaint.waitingForInfo ? complaint.infoRequestedAt : null,
    infoResponse: complaint.infoResponse || null,
    rating: complaint.rating || null,
    log: (complaint.log || []).filter((entry) => entry.visibility !== 'internal'),
  };
}

function isClosed(complaint) {
  const latestStatus = complaint.log?.[complaint.log.length - 1]?.s;
  return latestStatus === 3 || latestStatus === -1;
}

function addAudit(complaint, kind, by, note) {
  complaint.audit = Array.isArray(complaint.audit) ? complaint.audit : [];
  complaint.audit.push({ kind, at: new Date().toISOString(), by, note });
}

async function listComplaints() {
  const snapshot = await realtimeDatabase().ref(COMPLAINTS_PATH).get();
  const complaints = snapshot.val() || {};
  return Object.values(complaints).sort((a, b) => b.at.localeCompare(a.at));
}

async function findComplaintByCode(code) {
  const snapshot = await realtimeDatabase().ref(`${COMPLAINTS_PATH}/${code}`).get();
  return snapshot.exists() ? snapshot.val() : null;
}

async function createComplaint(input) {
  const now = new Date().toISOString();
  const date = new Date();
  const prefix = `ADU-${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const complaint = {
    cat: input.cat,
    loc: input.loc.trim(),
    text: input.text.trim(),
    name: String(input.name || '').trim(),
    at: now,
    priority: input.priority,
    unit: input.unit,
    coordinates: input.coordinates || null,
    evidence: input.evidence || null,
    waitingForInfo: false,
    infoPrompt: '',
    infoRequestedAt: null,
    infoResponse: null,
    rating: null,
    log: [{
      s: 0,
      at: now,
      by: 'Sistem',
      note: 'Aduan diterima. Target waktu mengikuti jenis aduan.',
      visibility: 'public',
    }],
    audit: [],
  };
  addAudit(complaint, 'created', 'Sistem', 'Aduan baru diterima.');

  for (;;) {
    complaint.code = `${prefix}-${String(randomInt(0, 1000000)).padStart(6, '0')}`;
    const reference = realtimeDatabase().ref(`${COMPLAINTS_PATH}/${complaint.code}`);
    const result = await reference.transaction((current) => current ? undefined : complaint);
    if (result.committed) return result.snapshot.val();
  }
}

async function applyStaffAction(code, input, user) {
  const reference = realtimeDatabase().ref(`${COMPLAINTS_PATH}/${code}`);
  const result = await reference.transaction((current) => {
    if (!current || (user.role !== 'admin' && current.unit !== user.unit) || isClosed(current)) return;

    const complaint = {
      ...current,
      log: Array.isArray(current.log) ? [...current.log] : [],
      audit: Array.isArray(current.audit) ? [...current.audit] : [],
    };
    const now = new Date().toISOString();
    const operation = input.operation === 'request-info' ? 'request-info' : 'update';
    const note = String(input.note || '').trim();
    const visibility = input.visibility;
    if (note.length < 10 || note.length > 2000) return;
    if (!['public', 'internal'].includes(visibility)) return;
    if (operation === 'request-info' && visibility !== 'public') return;

    if (['normal', 'high', 'urgent'].includes(input.priority) && input.priority !== current.priority) {
      complaint.priority = input.priority;
      addAudit(complaint, 'priority', user.name, `Prioritas diubah menjadi ${input.priority}.`);
    }
    if (user.role === 'admin' && typeof input.unit === 'string' && input.unit.trim() && input.unit !== current.unit) {
      complaint.unit = input.unit.trim();
      addAudit(complaint, 'assignment', user.name, `Aduan diteruskan ke ${complaint.unit}.`);
    }

    if (operation === 'request-info') {
      complaint.waitingForInfo = true;
      complaint.infoPrompt = note;
      complaint.infoRequestedAt = now;
      addAudit(complaint, 'request-info', user.name, 'Petugas meminta informasi tambahan dari warga.');
    } else {
      const currentStatus = complaint.log[complaint.log.length - 1]?.s ?? 0;
      const nextStatus = Number(input.status);
      if (!Number.isInteger(nextStatus) || (nextStatus !== -1 && nextStatus !== currentStatus + 1)) return;
      complaint.log.push({ s: nextStatus, at: now, by: user.name, note, visibility });
      complaint.waitingForInfo = false;
      if (typeof input.evidence === 'string' && input.evidence.startsWith('data:image/jpeg;base64,') && input.evidence.length <= 2800000) {
        complaint.evidence = input.evidence;
      }
      const statusName = nextStatus === -1 ? 'Ditolak' : ['Diterima', 'Diverifikasi', 'Diproses', 'Selesai'][nextStatus];
      addAudit(complaint, 'status', user.name, `Status diubah menjadi ${statusName}.`);
    }
    return complaint;
  });

  return result.committed ? result.snapshot.val() : null;
}

async function addResidentReply(code, note) {
  const reference = realtimeDatabase().ref(`${COMPLAINTS_PATH}/${code}`);
  const result = await reference.transaction((current) => {
    if (!current || !current.waitingForInfo || note.length < 5 || note.length > 2000) return;
    const complaint = {
      ...current,
      audit: Array.isArray(current.audit) ? [...current.audit] : [],
      waitingForInfo: false,
    };
    complaint.infoResponse = { note, at: new Date().toISOString() };
    addAudit(complaint, 'citizen-response', 'Warga', 'Balasan atas permintaan informasi diterima.');
    return complaint;
  });
  return result.committed ? result.snapshot.val() : null;
}

async function addRating(code, score, comment) {
  const reference = realtimeDatabase().ref(`${COMPLAINTS_PATH}/${code}`);
  const result = await reference.transaction((current) => {
    if (!current || !isClosed(current) || current.rating || !Number.isInteger(score) || score < 1 || score > 5) return;
    const complaint = {
      ...current,
      audit: Array.isArray(current.audit) ? [...current.audit] : [],
    };
    complaint.rating = { score, comment: comment.slice(0, 300), at: new Date().toISOString() };
    addAudit(complaint, 'rating', 'Warga', `Penilaian layanan ${score}/5 diterima.`);
    return complaint;
  });
  return result.committed ? result.snapshot.val() : null;
}

async function deleteComplaints(codes) {
  const updates = {};
  codes.forEach((code) => { updates[code] = null; });
  await realtimeDatabase().ref(COMPLAINTS_PATH).update(updates);
}

module.exports = {
  addRating,
  addResidentReply,
  applyStaffAction,
  createComplaint,
  deleteComplaints,
  findComplaintByCode,
  listComplaints,
  publicComplaint,
};
