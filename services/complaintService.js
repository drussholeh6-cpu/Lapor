const complaintModel = require('../models/complaintModel');
const { AppError } = require('../core/errors');
const {
  isValidComplaintCode,
  isValidCoordinates,
  isValidEmail,
  isValidImageEvidence,
  normalizeText,
} = require('../utils/validators');

const CATEGORY_UNITS = {
  'Jalan rusak': 'Seksi Pemeliharaan Jalan',
  Sampah: 'Dinas Kebersihan',
  'Lampu jalan': 'Seksi Sarana Umum',
  'Air dan drainase': 'Tim Drainase',
  'Layanan administrasi': 'Bagian Pelayanan Kelurahan',
  Lainnya: 'Koordinasi Lintas Instansi',
};

const VALID_UNITS = new Set(Object.values(CATEGORY_UNITS));

function validCode(code) {
  return isValidComplaintCode(code);
}

function publicComplaint(complaint) {
  return complaint ? complaintModel.publicComplaint(complaint) : null;
}

function staffComplaintSummary(complaint) {
  const summary = { ...complaint };
  delete summary.evidence;
  delete summary.attachments;
  delete summary.rating;
  summary.log = (complaint.log || []).map((item) => {
    const entry = { ...item };
    delete entry.evidence;
    return entry;
  });
  return summary;
}

function normalizeCoordinates(coordinates) {
  if (coordinates === null || coordinates === undefined) return null;
  if (!isValidCoordinates(coordinates)) return null;

  return [Number(Number(coordinates[0]).toFixed(3)), Number(Number(coordinates[1]).toFixed(3))];
}

function validEvidence(evidence) {
  return isValidImageEvidence(evidence, 2_800_000);
}

async function listComplaints() {
  const complaints = await complaintModel.listComplaints();
  return complaints.map(publicComplaint);
}

async function getComplaintByCode(code) {
  if (!validCode(code)) return null;
  const complaint = await complaintModel.findComplaintByCode(String(code).toUpperCase());
  return complaintModel.publicComplaintDetail(complaint);
}

async function getComplaintReceipt(code, email) {
  if (!validCode(code) || !isValidEmail(email)) return null;

  const complaint = await complaintModel.findComplaintByCode(String(code).toUpperCase());
  if (!complaint || String(complaint.email || '').trim().toLowerCase() !== email.trim().toLowerCase()) {
    return null;
  }

  return {
    ...publicComplaint(complaint),
    name: complaint.name || '',
  };
}

async function createComplaint(body) {
  const cat = normalizeText(body?.cat || '');
  const loc = normalizeText(body?.loc || '');
  const text = normalizeText(body?.text || '');
  const name = normalizeText(body?.name || '');
  const email = normalizeText(body?.email || '').toLowerCase();
  const priority = ['normal', 'high', 'urgent'].includes(body?.priority) ? body.priority : 'normal';
  const coordinates = normalizeCoordinates(body?.coordinates);
  const evidence = body?.evidence || null;

  if (!CATEGORY_UNITS[cat] || !loc || loc.length > 200 || !text || text.length > 5000 || name.length > 120) {
    throw new AppError('Periksa kategori, lokasi, nama, dan deskripsi aduan.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  if (!email || !isValidEmail(email) || email.length > 160) {
    throw new AppError('Email wajib diisi dengan format yang valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  if (body?.coordinates !== undefined && body?.coordinates !== null && coordinates === null) {
    throw new AppError('Koordinat lokasi tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  if (!validEvidence(evidence)) {
    throw new AppError('Bukti harus berupa JPEG dan berukuran maksimal 2 MB.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  const complaint = await complaintModel.createComplaint({
    cat,
    loc,
    text,
    name,
    email,
    priority,
    unit: CATEGORY_UNITS[cat],
    coordinates,
    evidence,
  });

  return complaintModel.publicComplaintDetail(complaint);
}

async function listStaffComplaints(user) {
  const complaints = await complaintModel.listComplaints();
  const accessible = user.role === 'admin'
    ? complaints
    : complaints.filter((complaint) => complaint.unit === user.unit);
  return accessible.map(staffComplaintSummary);
}

function validateReportDate(value, label) {
  if (!value) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`Format ${label} tidak valid.`, { status: 400, code: 'VALIDATION_ERROR' });
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError(`Tanggal ${label} tidak valid.`, { status: 400, code: 'VALIDATION_ERROR' });
  }
  return value;
}

async function listStaffReportComplaints(user, filters = {}) {
  const from = validateReportDate(filters.from, 'awal');
  const to = validateReportDate(filters.to, 'akhir');
  if (from && to && from > to) {
    throw new AppError('Tanggal awal tidak boleh melewati tanggal akhir.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  const complaints = await listStaffComplaints(user);
  return complaints.filter((complaint) => {
    const date = String(complaint.at || '').slice(0, 10);
    return (!from || date >= from)
      && (!to || date <= to);
  });
}

async function getStaffComplaintByCode(code, user) {
  if (!validCode(code)) return null;
  const complaint = await complaintModel.findComplaintByCode(String(code).toUpperCase());
  if (!complaint || (user.role !== 'admin' && complaint.unit !== user.unit)) return null;

  const attachments = [];
  const seenEvidence = new Set();
  const addAttachment = (evidence, source, at, visibility = 'public') => {
    if (typeof evidence !== 'string' || seenEvidence.has(evidence)) return;
    seenEvidence.add(evidence);
    attachments.push({ evidence, source, at, visibility });
  };
  addAttachment(complaint.evidence, 'Pelapor', complaint.at);
  (Array.isArray(complaint.attachments) ? complaint.attachments : []).forEach((attachment) => {
    addAttachment(
      attachment.evidence,
      attachment.source || 'Bukti penanganan',
      attachment.at,
      attachment.visibility || 'public',
    );
  });
  (Array.isArray(complaint.log) ? complaint.log : []).forEach((entry) => {
    addAttachment(entry.evidence, `Petugas · ${entry.by || 'Unit penanganan'}`, entry.at, entry.visibility || 'public');
  });

  const staffDetails = { ...complaint, attachments };
  delete staffDetails.rating;
  return staffDetails;
}

async function updateStaffComplaint(code, body, user) {
  if (!validCode(code)) {
    throw new AppError('Nomor aduan tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  const operation = body.operation === 'request-info' ? 'request-info' : 'update';
  const rejecting = operation === 'update' && Number(body.status) === -1;
  const rejectionReason = String(body.rejectionReason ?? (rejecting ? body.note : '')).trim();
  const note = rejecting ? rejectionReason : String(body.note || '').trim();
  if (note.length > 2000) {
    throw new AppError('Catatan tindak lanjut maksimal 2.000 karakter.', { status: 400, code: 'VALIDATION_ERROR' });
  }
  if (!note) {
    throw new AppError(
      operation === 'request-info'
        ? 'Informasi yang diminta wajib diisi.'
        : rejecting
          ? 'Alasan penolakan wajib diisi.'
          : 'Catatan tindak lanjut wajib diisi.',
      { status: 400, code: 'VALIDATION_ERROR' },
    );
  }
  if (rejecting && body.visibility !== 'public') {
    throw new AppError('Alasan penolakan harus dapat dilihat warga.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  if (body.unit && !VALID_UNITS.has(body.unit)) {
    throw new AppError('Unit penanggung jawab tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  if (body.evidence !== undefined && body.evidence !== null && !validEvidence(body.evidence)) {
    throw new AppError('Bukti harus berupa JPEG dan berukuran maksimal 2 MB.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  return complaintModel.applyStaffAction(
    String(code).toUpperCase(),
    rejecting ? { ...body, note: rejectionReason, rejectionReason } : body,
    user,
  );
}

async function deleteStaffComplaints(codes, user) {
  if (user?.role !== 'admin') {
    throw new AppError('Hanya admin yang dapat menghapus aduan.', { status: 403, code: 'AUTH_FORBIDDEN' });
  }

  if (!Array.isArray(codes)) {
    throw new AppError('Daftar aduan yang akan dihapus tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  const normalized = [...new Set(codes.map((code) => String(code).toUpperCase()))];
  if (normalized.some((code) => !/^ADU-\d{4}-\d{4,6}$/.test(code))) {
    throw new AppError('Daftar aduan memuat nomor yang tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  if (!normalized.length) {
    throw new AppError('Pilih setidaknya satu nomor aduan yang valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }
  if (normalized.length > 100) {
    throw new AppError('Maksimal 100 aduan dapat dihapus dalam satu kali tindakan.', { status: 400, code: 'BULK_DELETE_LIMIT' });
  }

  return complaintModel.deleteComplaints(normalized);
}

async function submitResidentReply(code, note) {
  if (!validCode(code)) {
    throw new AppError('Nomor aduan tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  if (note.length < 5 || note.length > 2000) {
    throw new AppError('Balasan harus berisi 5 sampai 2.000 karakter.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  const complaint = await complaintModel.addResidentReply(String(code).toUpperCase(), note);
  if (!complaint) {
    throw new AppError('Aduan tidak menunggu informasi atau balasan tidak valid.', { status: 409, code: 'CONFLICT' });
  }

  return publicComplaint(complaint);
}

module.exports = {
  CATEGORY_UNITS,
  VALID_UNITS,
  createComplaint,
  deleteStaffComplaints,
  getComplaintByCode,
  getComplaintReceipt,
  getStaffComplaintByCode,
  listComplaints,
  listStaffComplaints,
  listStaffReportComplaints,
  submitResidentReply,
  updateStaffComplaint,
  validCode,
};
