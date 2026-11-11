const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { bcryptRounds } = require('../config');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    // select:false -> the hash is never returned unless explicitly requested (login only)
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    interests: { type: [String], default: [] },
  },
  { timestamps: true }
);

/*
 * INDEXES (only what the queries need)
 *
 * 1. { email: 1 } unique
 *    - POST /auth/login          -> User.findOne({ email })
 *    - uniqueness of accounts    -> register / admin create / admin update
 *
 * 2. { interests: 1 } (multikey)
 *    - Aggregation Scenario 1: the leading $match on `interests` (both the
 *      "all users with interests" and the "?interest=chess" variants) is
 *      served by this index instead of a collection scan.
 *
 * Not indexed on purpose:
 *    - GET /users/:id, GET /users/me  -> served by the default _id index.
 *    - GET /users (admin list)        -> paginated and sorted by _id desc,
 *      which walks the default _id index in reverse, so no extra index.
 */
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ interests: 1 });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, bcryptRounds);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
