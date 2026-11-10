const { createHmac, randomBytes, randomInt, timingSafeEqual } = require('node:crypto');
const { AppError } = require('../core/errors');

const TOKEN_TTL_MS = 5 * 60 * 1000;
const redeemedChallenges = new Map();
const signingKey = Buffer.from(
  process.env.CHALLENGE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || randomBytes(32).toString('hex'),
);

function sign(payload) {
  return createHmac('sha256', signingKey).update(payload).digest();
}

function issueMathChallenge() {
  const a = randomInt(3, 13);
  const b = randomInt(2, 10);
  const payload = Buffer.from(JSON.stringify({ a, b, exp: Date.now() + TOKEN_TTL_MS, nonce: randomBytes(18).toString('hex') })).toString('base64url');
  const signature = sign(payload).toString('base64url');
  return { question: `${a} + ${b} = ?`, token: `${payload}.${signature}` };
}

function verifyMathChallenge(req, res, next) {
  const { captchaToken, captchaAnswer } = req.body || {};
  if (typeof captchaToken !== 'string' || typeof captchaAnswer !== 'string' || captchaToken.length > 1024) {
    return next(new AppError('Jawab soal verifikasi sebelum mengirim aduan.', { status: 400, code: 'CHALLENGE_REQUIRED' }));
  }

  try {
    const [payload, encodedSignature, extra] = captchaToken.split('.');
    if (!payload || !encodedSignature || extra) throw new Error('invalid token');
    const providedSignature = Buffer.from(encodedSignature, 'base64url');
    const expectedSignature = sign(payload);
    if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) {
      throw new Error('invalid signature');
    }

    const challenge = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isSafeInteger(challenge.exp) || challenge.exp < Date.now()) throw new Error('expired challenge');
    if (redeemedChallenges.has(challenge.nonce)) throw new Error('reused challenge');
    if (!/^\d{1,2}$/.test(captchaAnswer) || Number(captchaAnswer) !== challenge.a + challenge.b) {
      throw new Error('wrong answer');
    }

    redeemedChallenges.set(challenge.nonce, challenge.exp);
    for (const [nonce, expiresAt] of redeemedChallenges) {
      if (expiresAt < Date.now()) redeemedChallenges.delete(nonce);
    }
    return next();
  } catch {
    return next(new AppError('Jawaban salah atau soal sudah kedaluwarsa. Muat soal baru lalu coba lagi.', { status: 400, code: 'CHALLENGE_INVALID' }));
  }
}

module.exports = { issueMathChallenge, verifyMathChallenge };
