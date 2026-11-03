const complaintModel = require('../models/complaintModel');

const CATEGORY_UNITS = {
  'Jalan rusak': 'Seksi Pemeliharaan Jalan',
  Sampah: 'Dinas Kebersihan',
  'Lampu jalan': 'Seksi Sarana Umum',
  'Air dan drainase': 'Tim Drainase',
  'Layanan administrasi': 'Bagian Pelayanan Kelurahan',
  Lainnya: 'Koordinasi Lintas Instansi',
};
const VALID_UNITS = new Set(Object.values(CATEGORY_UNITS));
const VALID_CODE = /^ADU-\d{4}-\d{4,6}$/;

function validCode(code) {
  return VALID_CODE.test(String(code || '').toUpperCase());
}

async function listComplaints(req, res) {
  const complaints = await complaintModel.listComplaints();
  return res.json(complaints.map(complaintModel.publicComplaint));
}

async function getComplaintByCode(req, res) {
  if (!validCode(req.params.code)) return res.status(400).json({ message: 'Nomor aduan tidak valid.' });
  const complaint = await complaintModel.findComplaintByCode(req.params.code.toUpperCase());
  if (!complaint) return res.status(404).json({ message: 'Aduan tidak ditemukan.' });
  return res.json(complaintModel.publicComplaint(complaint));
}

async function createComplaint(req, res) {
  const body = req.body || {};
  const cat = String(body.cat || '');
  const loc = String(body.loc || '').trim();
  const text = String(body.text || '').trim();
  const name = String(body.name || '').trim();
  const priority = ['normal', 'high', 'urgent'].includes(body.priority) ? body.priority : 'normal';
  const coordinates = body.coordinates;
  const evidence = body.evidence || null;

  if (!CATEGORY_UNITS[cat] || !loc || loc.length > 200 || text.length < 15 || text.length > 5000 || name.length > 120) {
    return res.status(400).json({ message: 'Periksa kategori, lokasi, nama, dan deskripsi aduan.' });
  }
  if (coordinates !== null && coordinates !== undefined && (!Array.isArray(coordinates) || coordinates.length !== 2 || !Number.isFinite(Number(coordinates[0])) || !Number.isFinite(Number(coordinates[1])) || Math.abs(Number(coordinates[0])) > 90 || Math.abs(Number(coordinates[1])) > 180)) {
    return res.status(400).json({ message: 'Koordinat lokasi tidak valid.' });
  }
  if (evidence && (typeof evidence !== 'string' || !evidence.startsWith('data:image/jpeg;base64,') || evidence.length > 2800000)) {
    return res.status(400).json({ message: 'Bukti harus berupa JPEG dan berukuran maksimal 2 MB.' });
  }

  const complaint = await complaintModel.createComplaint({
    cat,
    loc,
    text,
    name,
    priority,
    unit: CATEGORY_UNITS[cat],
    coordinates: coordinates ? [Number(Number(coordinates[0]).toFixed(3)), Number(Number(coordinates[1]).toFixed(3))] : null,
    evidence,
  });
  return res.status(201).json(complaintModel.publicComplaint(complaint));
}

async function listStaffComplaints(req, res) {
  const complaints = await complaintModel.listComplaints();
  const visible = req.user.role === 'admin'
    ? complaints
    : complaints.filter((complaint) => complaint.unit === req.user.unit);
  return res.json(visible);
}

async function updateStaffComplaint(req, res) {
  if (!validCode(req.params.code)) return res.status(400).json({ message: 'Nomor aduan tidak valid.' });
  const body = req.body || {};
  if (body.unit && !VALID_UNITS.has(body.unit)) {
    return res.status(400).json({ message: 'Unit penanggung jawab tidak valid.' });
  }
  if (body.evidence && (typeof body.evidence !== 'string' || !body.evidence.startsWith('data:image/jpeg;base64,') || body.evidence.length > 2800000)) {
    return res.status(400).json({ message: 'Bukti harus berupa JPEG dan berukuran maksimal 2 MB.' });
  }

  const complaint = await complaintModel.applyStaffAction(req.params.code.toUpperCase(), body, req.user);
  if (!complaint) {
    return res.status(409).json({ message: 'Aduan tidak ditemukan, tidak dapat diakses, sudah ditutup, atau pembaruannya tidak valid.' });
  }
  return res.json(complaint);
}

async function deleteStaffComplaints(req, res) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Hanya admin yang dapat menghapus aduan.' });
  }
  const codes = Array.isArray(req.body?.codes)
    ? [...new Set(req.body.codes.map((code) => String(code).toUpperCase()).filter((code) => /^ADU-\d{4,6}-\d{4,6}$/.test(code)))].slice(0, 100)
    : [];
  if (!codes.length) return res.status(400).json({ message: 'Pilih setidaknya satu nomor aduan yang valid.' });
  await complaintModel.deleteComplaints(codes);
  return res.status(204).end();
}

async function submitResidentReply(req, res) {
  if (!validCode(req.params.code)) return res.status(400).json({ message: 'Nomor aduan tidak valid.' });
  const note = String(req.body?.note || '').trim();
  if (note.length < 5 || note.length > 2000) {
    return res.status(400).json({ message: 'Balasan harus berisi 5 sampai 2.000 karakter.' });
  }
  const complaint = await complaintModel.addResidentReply(req.params.code.toUpperCase(), note);
  if (!complaint) return res.status(409).json({ message: 'Aduan tidak menunggu informasi atau balasan tidak valid.' });
  return res.json(complaintModel.publicComplaint(complaint));
}

async function submitRating(req, res) {
  if (!validCode(req.params.code)) return res.status(400).json({ message: 'Nomor aduan tidak valid.' });
  const score = Number(req.body?.score);
  const comment = String(req.body?.comment || '').trim();
  const complaint = await complaintModel.addRating(req.params.code.toUpperCase(), score, comment);
  if (!complaint) return res.status(409).json({ message: 'Aduan belum ditutup atau penilaian tidak valid.' });
  return res.json(complaintModel.publicComplaint(complaint));
}

module.exports = {
  createComplaint,
  deleteStaffComplaints,
  getComplaintByCode,
  listComplaints,
  listStaffComplaints,
  submitRating,
  submitResidentReply,
  updateStaffComplaint,
};
