const mongoose = require('mongoose');

/** 404 for unknown /api routes */
function notFound(req, res) {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
}

/**
 * Turns every error into JSON {"error": "..."} with a sensible HTTP status,
 * so the React app can show the real reason to the user.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join('. ');
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    message = `That ${field} is already registered: ${err.keyValue?.[field]}`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body';
  } else if (
    err.name === 'MongooseServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    /buffering timed out/i.test(message)
  ) {
    status = 503;
    message = 'Database unavailable. Make sure MongoDB is running.';
  }

  if (status >= 500) console.error('[ERROR]', err);
  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
