const express = require('express');
const { rateLimit } = require('express-rate-limit');
const complaintController = require('../controllers/complaintController');
const { asyncHandler, requireAdmin, requireStaff } = require('../middleware/staffAuth');
const { issueMathChallenge, verifyMathChallenge } = require('../middleware/mathChallenge');

const router = express.Router();
const publicWriteLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 30,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: { message: 'Terlalu banyak permintaan. Silakan coba kembali nanti.' },
});
const complaintSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Batas pengiriman aduan tercapai. Silakan coba kembali nanti.' },
});
const challengeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan soal verifikasi. Coba lagi sebentar.' },
});
const statisticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan statistik. Silakan coba kembali nanti.' },
});
const receiptResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan kirim ulang email. Silakan coba kembali nanti.' },
});

router.get('/complaints', asyncHandler(complaintController.listComplaints));
router.get('/statistics', statisticsLimiter, asyncHandler(complaintController.getPublicStatistics));
router.get('/complaints/:code', asyncHandler(complaintController.getComplaintByCode));
router.get('/challenge', challengeLimiter, (req, res) => res.json(issueMathChallenge()));
router.post('/complaints', complaintSubmissionLimiter, verifyMathChallenge, asyncHandler(complaintController.createComplaint));
router.post('/complaints/:code/confirmation', receiptResendLimiter, asyncHandler(complaintController.resendComplaintReceipt));
router.post('/complaints/:code/replies', publicWriteLimiter, asyncHandler(complaintController.submitResidentReply));
router.post('/complaints/:code/ratings', publicWriteLimiter, asyncHandler(complaintController.submitRating));
router.get('/staff/complaints', requireStaff, asyncHandler(complaintController.listStaffComplaints));
router.get('/staff/complaints/report.xlsx', requireStaff, asyncHandler(complaintController.exportStaffComplaintReport));
router.get('/staff/complaints/:code', requireStaff, asyncHandler(complaintController.getStaffComplaintByCode));
router.patch('/staff/complaints/:code', requireStaff, asyncHandler(complaintController.updateStaffComplaint));
router.delete('/staff/complaints', requireAdmin, asyncHandler(complaintController.deleteStaffComplaints));

module.exports = router;
