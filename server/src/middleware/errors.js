import mongoose from 'mongoose';
import { ZodError } from 'zod';

export function notFound(req, _res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.path}`);
  err.status = 404;
  err.code = 'ROUTE_NOT_FOUND';
  next(err);
}

export function errorHandler(err, _req, res, _next) {
  if (res.headersSent) return;
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred.';
  let details = err.details;
  if (err instanceof ZodError) {
    status = 422; code = 'VALIDATION_ERROR'; message = 'Please check the submitted information.';
    details = err.issues.map(({ path, message: issue }) => ({ path: path.join('.'), message: issue }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422; code = 'VALIDATION_ERROR'; message = 'One or more fields are invalid.';
    details = Object.values(err.errors).map(e => ({ path: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400; code = 'INVALID_IDENTIFIER'; message = 'A supplied identifier or value is invalid.';
  } else if (err?.code === 11000) {
    status = 409; code = 'DUPLICATE_RESOURCE'; message = 'A record with this unique value already exists.';
  }
  if (status >= 500) message = 'The server could not complete the request.';
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
}
