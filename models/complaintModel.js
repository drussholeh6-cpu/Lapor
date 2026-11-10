const { randomInt } = require('node:crypto');
const { realtimeDatabase } = require('../config/supabase');

const EVIDENCE_BUCKET = 'complaint-evidence';

async function storeEvidence(code, evidence, suffix = 'reporter') {
  if (typeof evidence !== 'string' || !evidence.startsWith('data:image/jpeg;base64,')) return evidence || null;
  const base64 = evidence.slice('data:image/jpeg;base64,'.length);
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('Bukti foto tidak valid atau melebihi 2 MB.');
  const path = `${code}/${suffix}-${randomInt(0, 1000000000)}.jpg`;
  const { data, error } = await realtimeDatabase().storage.from(EVIDENCE_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return realtimeDatabase().storage.from(EVIDENCE_BUCKET).getPublicUrl(data.path).data.publicUrl;
}

const COMPLAINTS_TABLE = 'complaints';
const VALID_PRIORITIES = ['normal', 'high', 'urgent'];
const VALID_VISIBILITY = ['public', 'internal'];
const STATUS_LABELS = ['Diterima', 'Diverifikasi', 'Diproses', 'Selesai'];

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
    log: (complaint.log || [])
      .filter((entry) => entry.visibility !== 'internal')
      .map((item) => {
        const entry = { ...item };
        delete entry.evidence;
        return entry;
      }),
  };
}

function publicComplaintDetail(complaint) {
  if (!complaint) return null;

  const attachments = [];
  const seenEvidence = new Set();
  const addAttachment = (evidence, source, at) => {
    if (typeof evidence !== 'string' || seenEvidence.has(evidence)) return;
    seenEvidence.add(evidence);
    attachments.push({ evidence, source, at });
  };
  if (typeof complaint.evidence === 'string') {
    addAttachment(complaint.evidence, 'Bukti aduan', complaint.at);
  }
  (complaint.attachments || []).forEach((attachment) => {
    if (attachment.visibility === 'internal' || typeof attachment.evidence !== 'string') return;
    addAttachment(attachment.evidence, attachment.source || 'Bukti penanganan', attachment.at);
  });
  (complaint.log || []).forEach((entry) => {
    if (entry.visibility === 'internal' || typeof entry.evidence !== 'string') return;
    addAttachment(entry.evidence, `Petugas · ${entry.by || 'Unit penanganan'}`, entry.at);
  });

  return {
    ...publicComplaint(complaint),
    attachments,
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

function normalizeComplaint(row) {
  if (!row) return null;
  const data = row.data ? row.data : row;
  return { ...data, code: data.code || row.code };
}

function cloneComplaintData(complaint) {
  return {
    ...complaint,
    log: Array.isArray(complaint.log) ? [...complaint.log] : [],
    audit: Array.isArray(complaint.audit) ? [...complaint.audit] : [],
    attachments: Array.isArray(complaint.attachments) ? [...complaint.attachments] : [],
  };
}

function hasValidLength(value, minLength, maxLength) {
  const text = String(value || '').trim();
  return text.length >= minLength && text.length <= maxLength;
}

async function saveComplaintUpdate(code, complaint) {
  const { data, error } = await realtimeDatabase()
    .from(COMPLAINTS_TABLE)
    .update({ data: complaint })
    .eq('code', code)
    .select()
    .single();

  if (error) throw error;
  return normalizeComplaint(data);
}

async function listComplaints() {
  const { data, error } = await realtimeDatabase()
    .from(COMPLAINTS_TABLE)
    .select('code,data,created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || [])
    .map(normalizeComplaint)
    .filter(Boolean)
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}

async function findComplaintByCode(code) {
  const { data, error } = await realtimeDatabase()
    .from(COMPLAINTS_TABLE)
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return normalizeComplaint(data);
}

async function createComplaint(input) {
  const now = new Date().toISOString();
  const date = new Date();
  const prefix = `ADU-${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}`;

  const complaint = {
    cat: input.cat,
    loc: String(input.loc || '').trim(),
    text: String(input.text || '').trim(),
    name: String(input.name || '').trim(),
    email: String(input.email || '').trim().toLowerCase(),
    at: now,
    priority: input.priority,
    unit: input.unit,
    coordinates: input.coordinates || null,
    evidence: null,
    attachments: [],
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
    if (input.evidence) {
      complaint.evidence = await storeEvidence(complaint.code, input.evidence);
      complaint.attachments = [{ evidence: complaint.evidence, source: 'Pelapor', at: now, visibility: 'public' }];
    }
    const { data, error } = await realtimeDatabase()
      .from(COMPLAINTS_TABLE)
      .insert({ code: complaint.code, data: complaint })
      .select()
      .single();

    if (!error) return normalizeComplaint(data);
    if (error.code !== '23505') throw error;
  }
}

async function applyStaffAction(code, input, user) {
  const existing = await findComplaintByCode(code);
  if (!existing || (user.role !== 'admin' && existing.unit !== user.unit) || isClosed(existing)) return null;

  const complaint = cloneComplaintData(existing);
  const now = new Date().toISOString();
  const operation = input.operation === 'request-info' ? 'request-info' : 'update';
  const rejecting = operation === 'update' && Number(input.status) === -1;
  const rejectionReason = String(input.rejectionReason ?? (rejecting ? input.note : '')).trim();
  const note = rejecting ? rejectionReason : String(input.note || '').trim();
  const visibility = input.visibility;

  if (!note || note.length > 2000 || !VALID_VISIBILITY.includes(visibility)) return null;
  if (operation === 'request-info' && visibility !== 'public') return null;
  if (rejecting && visibility !== 'public') return null;

  if (VALID_PRIORITIES.includes(input.priority) && input.priority !== existing.priority) {
    complaint.priority = input.priority;
    addAudit(complaint, 'priority', user.name, `Prioritas diubah menjadi ${input.priority}.`);
  }

  if (user.role === 'admin' && typeof input.unit === 'string' && input.unit.trim() && input.unit !== existing.unit) {
    complaint.unit = input.unit.trim();
    addAudit(complaint, 'assignment', user.name, `Aduan diteruskan ke ${complaint.unit}.`);
  }

  if (operation === 'request-info') {
    const storedEvidence = input.evidence ? await storeEvidence(code, input.evidence, `staff-${Date.now()}`) : null;
    complaint.waitingForInfo = true;
    complaint.infoPrompt = note;
    complaint.infoRequestedAt = now;
    if (storedEvidence) {
      complaint.attachments.push({
        evidence: storedEvidence,
        source: `${user.role === 'admin' ? 'Admin' : 'Petugas'} · ${user.name || 'Petugas'}`,
        at: now,
        visibility,
      });
    }
    addAudit(complaint, 'request-info', user.name, 'Petugas meminta informasi tambahan dari warga.');
    return saveComplaintUpdate(code, complaint);
  }

  const currentStatus = complaint.log[complaint.log.length - 1]?.s ?? 0;
  const nextStatus = Number(input.status);
  if (!Number.isInteger(nextStatus) || (nextStatus !== -1 && nextStatus !== currentStatus + 1)) return null;
  const storedEvidence = input.evidence ? await storeEvidence(code, input.evidence, `staff-${Date.now()}`) : null;
  if (storedEvidence) {
    complaint.attachments.push({
      evidence: storedEvidence,
      source: `${user.role === 'admin' ? 'Admin' : 'Petugas'} · ${user.name || 'Petugas'}`,
      at: now,
      visibility,
    });
  }
  complaint.log.push({ s: nextStatus, at: now, by: user.name, note, visibility });
  complaint.waitingForInfo = false;

  const statusName = nextStatus === -1 ? 'Ditolak' : STATUS_LABELS[nextStatus];
  const auditNote = nextStatus === -1
    ? `Status diubah menjadi ${statusName}. Alasan: ${rejectionReason}`
    : `Status diubah menjadi ${statusName}.`;
  addAudit(complaint, 'status', user.name, auditNote);

  return saveComplaintUpdate(code, complaint);
}

async function addResidentReply(code, note) {
  const current = await findComplaintByCode(code);
  if (!current || !current.waitingForInfo || !hasValidLength(note, 5, 2000)) return null;

  const complaint = cloneComplaintData(current);
  complaint.waitingForInfo = false;
  complaint.infoResponse = { note, at: new Date().toISOString() };
  addAudit(complaint, 'citizen-response', 'Warga', 'Balasan atas permintaan informasi diterima.');

  return saveComplaintUpdate(code, complaint);
}

async function addRating(code, score, comment) {
  const current = await findComplaintByCode(code);
  if (!current || !isClosed(current) || current.rating || !Number.isInteger(score) || score < 1 || score > 5) return null;

  const complaint = cloneComplaintData(current);
  complaint.rating = { score, comment: String(comment || '').slice(0, 300), at: new Date().toISOString() };
  addAudit(complaint, 'rating', 'Warga', `Penilaian layanan ${score}/5 diterima.`);

  return saveComplaintUpdate(code, complaint);
}

async function deleteComplaints(codes) {
  if (!codes.length) return [];
  const { data, error } = await realtimeDatabase()
    .from(COMPLAINTS_TABLE)
    .delete()
    .in('code', codes)
    .select('code');

  if (error) throw error;
  return (data || []).map((row) => row.code);
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
  publicComplaintDetail,
};
