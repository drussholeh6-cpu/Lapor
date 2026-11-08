const complaintModel = require('../models/complaintModel');
const { AppError } = require('../core/errors');
const {
  isValidComplaintCode,
  isValidCoordinates,
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
  return publicComplaint(complaint);
}

async function createComplaint(body) {
  const cat = normalizeText(body?.cat || '');
  const loc = normalizeText(body?.loc || '');
  const text = normalizeText(body?.text || '');
  const name = normalizeText(body?.name || '');
  const priority = ['normal', 'high', 'urgent'].includes(body?.priority) ? body.priority : 'normal';
  const coordinates = normalizeCoordinates(body?.coordinates);
  const evidence = body?.evidence || null;

  if (!CATEGORY_UNITS[cat] || !loc || loc.length > 200 || text.length < 15 || text.length > 5000 || name.length > 120) {
    throw new AppError('Periksa kategori, lokasi, nama, dan deskripsi aduan.', { status: 400, code: 'VALIDATION_ERROR' });
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
    priority,
    unit: CATEGORY_UNITS[cat],
    coordinates,
    evidence,
  });

  return publicComplaint(complaint);
}

async function listStaffComplaints(user) {
  const complaints = await complaintModel.listComplaints();
  if (user.role === 'admin') return complaints;
  return complaints.filter((complaint) => complaint.unit === user.unit);
}

async function updateStaffComplaint(code, body, user) {
  if (!validCode(code)) {
    throw new AppError('Nomor aduan tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  if (body.unit && !VALID_UNITS.has(body.unit)) {
    throw new AppError('Unit penanggung jawab tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  if (body.evidence !== undefined && body.evidence !== null && !validEvidence(body.evidence)) {
    throw new AppError('Bukti harus berupa JPEG dan berukuran maksimal 2 MB.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  return complaintModel.applyStaffAction(String(code).toUpperCase(), body, user);
}

async function deleteStaffComplaints(codes) {
  const normalized = [...new Set(codes.map((code) => String(code).toUpperCase()).filter((code) => /^ADU-\d{4}-\d{4,6}$/.test(code)))].slice(0, 100);
  if (!normalized.length) {
    throw new AppError('Pilih setidaknya satu nomor aduan yang valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  await complaintModel.deleteComplaints(normalized);
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

async function submitRating(code, score, comment) {
  if (!validCode(code)) {
    throw new AppError('Nomor aduan tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  const complaint = await complaintModel.addRating(String(code).toUpperCase(), Number(score), normalizeText(comment));
  if (!complaint) {
    throw new AppError('Aduan belum ditutup atau penilaian tidak valid.', { status: 409, code: 'CONFLICT' });
  }

  return publicComplaint(complaint);
}

module.exports = {
  CATEGORY_UNITS,
  VALID_UNITS,
  createComplaint,
  deleteStaffComplaints,
  getComplaintByCode,
  listComplaints,
  listStaffComplaints,
  submitRating,
  submitResidentReply,
  updateStaffComplaint,
  validCode,
};
