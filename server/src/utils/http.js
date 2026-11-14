export class AppError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function sendData(res, data, status = 200, message) {
  return res.status(status).json({ success: true, ...(message ? { message } : {}), data });
}

export function parsePagination(query) {
  const page = Math.max(1, Math.min(Number.parseInt(query.page, 10) || 1, 100000));
  const limit = Math.max(1, Math.min(Number.parseInt(query.limit, 10) || 12, 100));
  return { page, limit, skip: (page - 1) * limit };
}

export function safeUser(user) {
  if (!user) return null;
  const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.tokenVersion;
  delete obj.__v;
  return obj;
}
