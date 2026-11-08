class AppError extends Error {
  constructor(message, { status = 500, code, details } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code || 'APP_ERROR';
    this.details = details || null;
  }
}

function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error?.type === 'entity.parse.failed') {
    return new AppError('Format data JSON tidak valid.', { status: 400, code: 'INVALID_JSON' });
  }

  if (error?.type === 'entity.too.large') {
    return new AppError('Ukuran data terlalu besar. Maksimal 4 MB.', {
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
  }

  const normalized = new AppError(error?.message || 'Terjadi kesalahan pada server.', {
    status: error?.status || 500,
    code: error?.code || 'INTERNAL_ERROR',
    details: error?.details || null,
  });

  return normalized;
}

module.exports = {
  AppError,
  normalizeError,
};
