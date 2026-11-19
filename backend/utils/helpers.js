/** Local date as YYYY-MM-DD (expiry/appointment dates are stored in this format). */
function todayStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(days, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return todayStr(d);
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Error with an HTTP status, turned into {"error": message} by the error handler. */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wraps async route handlers so thrown errors reach the error middleware (Express 4). */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Copies only the listed keys that are present (not undefined) from src. */
function pick(src, keys) {
  const out = {};
  for (const k of keys) {
    if (src && src[k] !== undefined) out[k] = src[k];
  }
  return out;
}

module.exports = { todayStr, addDays, round2, HttpError, asyncHandler, pick };
