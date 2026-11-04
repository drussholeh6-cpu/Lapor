function normalizeText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function isValidComplaintCode(code) {
  return /^ADU-\d{4}-\d{4,6}$/i.test(String(code || '').trim());
}

function isValidCoordinates(value) {
  if (value === null || value === undefined) return true;
  if (!Array.isArray(value) || value.length !== 2) return false;

  const lat = Number(value[0]);
  const lng = Number(value[1]);

  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function isValidImageEvidence(value, maxBytes = 2_800_000) {
  return value === null || value === undefined || (
    typeof value === 'string' &&
    value.startsWith('data:image/jpeg;base64,') &&
    value.length <= maxBytes
  );
}

module.exports = {
  isValidComplaintCode,
  isValidCoordinates,
  isValidEmail,
  isValidImageEvidence,
  normalizeText,
};
