const express = require('express');
const { rateLimit } = require('express-rate-limit');
const authController = require('../controllers/authController');
const { asyncHandler, requireStaff } = require('../middleware/staffAuth');

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan masuk. Coba lagi beberapa menit.' },
});

router.post('/login', loginLimiter, asyncHandler(authController.login));
router.get('/me', requireStaff, authController.me);
router.post('/logout', authController.logout);

module.exports = router;