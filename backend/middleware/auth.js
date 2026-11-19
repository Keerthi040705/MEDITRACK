const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { HttpError, asyncHandler } = require('../utils/helpers');

function signToken(user) {
  return jwt.sign({ id: String(user._id), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/** Requires "Authorization: Bearer <token>" and loads req.user. */
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please sign in to continue.');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (e) {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }

  const user = await User.findById(payload.id);
  if (!user) throw new HttpError(401, 'Account no longer exists. Please sign in again.');
  req.user = user;
  next();
});

/** Allows only the given roles. */
const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new HttpError(403, `Only ${roles.join(' / ')} accounts can do this.`));
  }
  next();
};

/** The :param in the URL must be the signed-in user's own id. */
const selfOnly = (param = 'id') => (req, res, next) => {
  if (!req.user || String(req.user._id) !== String(req.params[param])) {
    return next(new HttpError(403, 'You can only access your own records.'));
  }
  next();
};

module.exports = { signToken, protect, allowRoles, selfOnly };
