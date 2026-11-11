const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const User = require('../models/User');
const { AppError, asyncHandler, isObjectId } = require('../utils/helpers');

// Verifies the Bearer token and loads the CURRENT user from the DB, so a deleted
// user or a changed role takes effect immediately (not only when the token expires).
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Authentication required');

  const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  if (!isObjectId(payload.sub)) throw new AppError(401, 'Invalid token');

  const user = await User.findById(payload.sub); // _id index
  if (!user) throw new AppError(401, 'User no longer exists');

  req.user = user;
  next();
});

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'You do not have permission to perform this action'));
  }
  next();
};

const validateIdParam = (name) => (req, _res, next) => {
  if (!isObjectId(req.params[name])) return next(new AppError(400, `Invalid ${name}`));
  next();
};

module.exports = { authenticate, requireRole, validateIdParam };
