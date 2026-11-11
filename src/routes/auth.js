const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { jwtSecret, jwtExpiresIn, bcryptRounds } = require('../config');
const User = require('../models/User');
const { AppError, asyncHandler, str, normalizeInterests, checkPassword } = require('../utils/helpers');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: jwtExpiresIn,
  });

// Compared against when the email is unknown, so response time doesn't reveal valid emails
const DUMMY_HASH = bcrypt.hashSync('dummy-password', bcryptRounds);

// Public registration: ALWAYS creates a normal "user" (role from the body is ignored)
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const name = str(req.body.name);
    const email = str(req.body.email);
    if (!name || !email) throw new AppError(400, 'name and email are required');
    checkPassword(req.body.password);

    const user = await User.create({
      name,
      email,
      password: req.body.password,
      role: 'user',
      interests: req.body.interests === undefined ? [] : normalizeInterests(req.body.interests),
    });
    res.status(201).json({ token: signToken(user), user });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = str(req.body.email);
    const password = str(req.body.password);
    if (!email || !password) throw new AppError(400, 'email and password are required');

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password'); // email index
    const ok = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
    if (!user || !ok) throw new AppError(401, 'Invalid email or password');

    res.json({ token: signToken(user), user });
  })
);

module.exports = router;
