const complaintService = require('../services/complaintService');
const complaintReportService = require('../services/complaintReportService');
const emailService = require('../services/emailService');
const publicStatisticsService = require('../services/publicStatisticsService');

async function getPublicStatistics(req, res) {
  res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=10');
  return res.json(await publicStatisticsService.getPublicStatistics());
}

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
    emailService.assertConfigured();
  } catch (error) {
    console.error(`Email konfirmasi belum dikonfigurasi: ${error.message}`);
    return res.status(503).json({
      message: 'Aduan belum dikirim. Layanan email konfirmasi belum siap. Silakan coba kembali nanti.',
      code: 'EMAIL_SERVICE_UNAVAILABLE',
    });
  }

  let complaint;
  try {
    complaint = await complaintService.createComplaint(req.body || {});
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
  publicStatisticsService.invalidatePublicStatistics();

  try {
    await emailService.sendComplaintReceipt({
      complaint,
      recipientEmail: String(req.body?.email || '').trim().toLowerCase(),
      recipientName: String(req.body?.name || '').trim(),
    });
  } catch (error) {
    console.error(`Gagal mengirim email konfirmasi aduan ${complaint.code}: ${error.message}`);
    return res.status(502).json({
      message: 'Aduan sudah tersimpan, tetapi email konfirmasi belum terkirim. Jangan kirim aduan baru; gunakan tombol kirim ulang email.',
      code: 'EMAIL_DELIVERY_FAILED',
      complaintSaved: true,
      complaintCode: complaint.code,
    });
  }

  return res.status(201).json({ ...complaint, emailDelivery: { sent: true } });
}

async function resendComplaintReceipt(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const complaint = await complaintService.getComplaintReceipt(req.params.code, email);
  if (!complaint) {
    return res.status(404).json({ message: 'Nomor aduan atau email tidak cocok.', code: 'COMPLAINT_NOT_FOUND' });
  }

  try {
    await emailService.sendComplaintReceipt({
      complaint,
      recipientEmail: email,
      recipientName: complaint.name,
    });
  } catch (error) {
    console.error(`Gagal mengirim ulang email konfirmasi aduan ${complaint.code}: ${error.message}`);
    return res.status(502).json({
      message: 'Email belum berhasil dikirim. Periksa konfigurasi layanan email atau coba kembali nanti.',
      code: 'EMAIL_DELIVERY_FAILED',
    });
  }

  return res.json({ sent: true });
}

async function listStaffComplaints(req, res) {
  const complaints = await complaintService.listStaffComplaints(req.user);
  return res.json(complaints);
}

async function exportStaffComplaintReport(req, res) {
  const filters = {
    from: req.query.from || '',
    to: req.query.to || '',
  };
  const complaints = await complaintService.listStaffReportComplaints(req.user, filters);
  const workbook = await complaintReportService.createComplaintWorkbook(complaints, filters);
  const filename = `laporan-aduan-${new Date().toISOString().slice(0, 10)}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.send(Buffer.from(workbook));
}

async function getStaffComplaintByCode(req, res) {
  const complaint = await complaintService.getStaffComplaintByCode(req.params.code, req.user);
  if (!complaint) return res.status(404).json({ message: 'Aduan tidak ditemukan.' });
  return res.json(complaint);
}

async function updateStaffComplaint(req, res) {
  try {
    const complaint = await complaintService.updateStaffComplaint(req.params.code, req.body || {}, req.user);
    if (!complaint) {
      return res.status(409).json({ message: 'Aduan tidak ditemukan, tidak dapat diakses, sudah ditutup, atau pembaruannya tidak valid.' });
    }
    publicStatisticsService.invalidatePublicStatistics();

    let emailSent = false;
    try {
      await emailService.sendComplaintUpdate({
        complaint,
        recipientEmail: String(complaint.email || '').trim().toLowerCase(),
        recipientName: String(complaint.name || '').trim(),
      });
      emailSent = true;
    } catch (emailError) {
      console.error(`Pembaruan aduan ${complaint.code} tersimpan tetapi email pemberitahuan gagal: ${emailError.message}`);
    }

    return res.json({ ...complaint, emailNotification: { sent: emailSent } });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
}

async function deleteStaffComplaints(req, res) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Hanya admin yang dapat menghapus aduan.' });
  }

  try {
    const deletedCodes = await complaintService.deleteStaffComplaints(req.body?.codes || [], req.user);
    if (deletedCodes.length) publicStatisticsService.invalidatePublicStatistics();
    return res.json({ deletedCodes });
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
  getPublicStatistics,
  createComplaint,
  deleteStaffComplaints,
  exportStaffComplaintReport,
  getComplaintByCode,
  listComplaints,
  listStaffComplaints,
  getStaffComplaintByCode,
  resendComplaintReceipt,
  submitRating,
  submitResidentReply,
  updateStaffComplaint,
};
