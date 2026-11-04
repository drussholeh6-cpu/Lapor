const complaintService = require('../services/complaintService');

async function listComplaints(req, res) {
  const complaints = await complaintService.listComplaints();
  return res.json(complaints);
}

async function getComplaintByCode(req, res) {
  const complaint = await complaintService.getComplaintByCode(req.params.code);
  if (!complaint) return res.status(404).json({ message: 'Aduan tidak ditemukan.' });
  return res.json(complaint);
}

async function createComplaint(req, res) {
  try {
    const complaint = await complaintService.createComplaint(req.body || {});
    return res.status(201).json(complaint);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
}

async function listStaffComplaints(req, res) {
  const complaints = await complaintService.listStaffComplaints(req.user);
  return res.json(complaints);
}

async function updateStaffComplaint(req, res) {
  try {
    const complaint = await complaintService.updateStaffComplaint(req.params.code, req.body || {}, req.user);
    if (!complaint) {
      return res.status(409).json({ message: 'Aduan tidak ditemukan, tidak dapat diakses, sudah ditutup, atau pembaruannya tidak valid.' });
    }
    return res.json(complaint);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
}

async function deleteStaffComplaints(req, res) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Hanya admin yang dapat menghapus aduan.' });
  }

  try {
    await complaintService.deleteStaffComplaints(req.body?.codes || []);
    return res.status(204).end();
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
}

async function submitResidentReply(req, res) {
  try {
    const complaint = await complaintService.submitResidentReply(req.params.code, String(req.body?.note || '').trim());
    return res.json(complaint);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
}

async function submitRating(req, res) {
  try {
    const complaint = await complaintService.submitRating(req.params.code, req.body?.score, req.body?.comment);
    return res.json(complaint);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
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
