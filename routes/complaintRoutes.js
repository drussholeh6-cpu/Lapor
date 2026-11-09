const express = require('express');
const { rateLimit } = require('express-rate-limit');
const complaintController = require('../controllers/complaintController');
const { asyncHandler, requireAdmin, requireStaff } = require('../middleware/staffAuth');

const router = express.Router();
const publicWriteLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 30,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: { message: 'Terlalu banyak permintaan. Silakan coba kembali nanti.' },
});
const receiptResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan kirim ulang email. Silakan coba kembali nanti.' },
});

router.get('/complaints', asyncHandler(complaintController.listComplaints));
router.get('/complaints/:code', asyncHandler(complaintController.getComplaintByCode));
router.post('/complaints', publicWriteLimiter, asyncHandler(complaintController.createComplaint));
router.post('/complaints/:code/confirmation', receiptResendLimiter, asyncHandler(complaintController.resendComplaintReceipt));
router.post('/complaints/:code/replies', publicWriteLimiter, asyncHandler(complaintController.submitResidentReply));
router.post('/complaints/:code/ratings', publicWriteLimiter, asyncHandler(complaintController.submitRating));
router.get('/staff/complaints', requireStaff, asyncHandler(complaintController.listStaffComplaints));
router.get('/staff/complaints/:code', requireStaff, asyncHandler(complaintController.getStaffComplaintByCode));
router.patch('/staff/complaints/:code', requireStaff, asyncHandler(complaintController.updateStaffComplaint));
router.delete('/staff/complaints', requireAdmin, asyncHandler(complaintController.deleteStaffComplaints));

module.exports = router;
