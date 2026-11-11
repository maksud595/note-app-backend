const express = require('express');
const User = require('../models/User');
const Note = require('../models/Note');
const Post = require('../models/Post');
const { authenticate, requireRole, validateIdParam } = require('../middleware/auth');
const {
  AppError,
  asyncHandler,
  str,
  parsePagination,
  paginated,
  normalizeInterests,
  checkPassword,
} = require('../utils/helpers');

const router = express.Router();

router.use(authenticate);

/* ------------------------- Any authenticated user ------------------------- */

// GET /api/users/me  -> profile (served by the _id index)
router.get('/me', (req, res) => res.json(req.user));

// PUT /api/users/me -> update own name / interests / password (never the role)
router.put(
  '/me',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (req.body.name !== undefined) user.name = str(req.body.name);
    if (req.body.interests !== undefined) user.interests = normalizeInterests(req.body.interests);
    if (req.body.password !== undefined) user.password = checkPassword(req.body.password);
    await user.save();
    res.json(user);
  })
);

/* ------------------------------ Admin only -------------------------------- */

router.use(requireRole('admin'));

// GET /api/users?page=1&limit=10 -> paginated list (_id index, reverse order)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const [data, total] = await Promise.all([
      User.find().sort({ _id: -1 }).skip(skip).limit(limit).lean(),
      User.estimatedDocumentCount(),
    ]);
    res.json(paginated(data.map(({ password, __v, ...u }) => u), total, page, limit));
  })
);

/*
 * AGGREGATION SCENARIO 1 - users grouped by interest.
 * GET /api/users/interests/groups?interest=chess&page=1&limit=10
 *
 * Exactly ONE User.aggregate() call, nothing else touches the DB.
 *  1. $match  -> uses the { interests: 1 } multikey index (optionally narrowed to one interest)
 *  2. $unwind -> one document per (user, interest)
 *  3. $match  -> (only with ?interest=) keeps just the requested interest after unwinding
 *  4. $group  -> per interest: count + list of users
 *  5. $sort   -> alphabetical by interest, for stable pagination
 *  6. $facet  -> page of groups + total group count, in the same single round trip
 */
router.get(
  '/interests/groups',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const interest = str(req.query.interest)?.trim().toLowerCase();

    const pipeline = [
      { $match: interest ? { interests: interest } : { interests: { $exists: true } } },
      { $unwind: '$interests' },
      ...(interest ? [{ $match: { interests: interest } }] : []),
      {
        $group: {
          _id: '$interests',
          count: { $sum: 1 },
          users: { $push: { _id: '$_id', name: '$name', email: '$email' } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            { $project: { _id: 0, interest: '$_id', count: 1, users: 1 } },
          ],
          meta: [{ $count: 'total' }],
        },
      },
    ];

    const [result] = await User.aggregate(pipeline);
    const total = result.meta[0]?.total || 0;
    res.json(paginated(result.data, total, page, limit));
  })
);

// POST /api/users -> admin creates a user (can choose the role)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = str(req.body.name);
    const email = str(req.body.email);
    if (!name || !email) throw new AppError(400, 'name and email are required');
    checkPassword(req.body.password);
    const role = req.body.role === undefined ? 'user' : str(req.body.role);

    const user = await User.create({
      name,
      email,
      password: req.body.password,
      role,
      interests: req.body.interests === undefined ? [] : normalizeInterests(req.body.interests),
    });
    res.status(201).json(user);
  })
);

// GET /api/users/:id -> _id index
router.get(
  '/:id',
  validateIdParam('id'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, 'User not found');
    res.json(user);
  })
);

// PUT /api/users/:id -> update name / email / role / interests / password
router.put(
  '/:id',
  validateIdParam('id'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, 'User not found');

    if (req.body.role !== undefined) {
      if (user._id.equals(req.user._id) && req.body.role !== 'admin') {
        throw new AppError(400, 'You cannot remove your own admin role');
      }
      user.role = str(req.body.role);
    }
    if (req.body.name !== undefined) user.name = str(req.body.name);
    if (req.body.email !== undefined) user.email = str(req.body.email);
    if (req.body.interests !== undefined) user.interests = normalizeInterests(req.body.interests);
    if (req.body.password !== undefined) user.password = checkPassword(req.body.password);

    await user.save();
    res.json(user);
  })
);

// DELETE /api/users/:id -> removes the user and their notes + posts
router.delete(
  '/:id',
  validateIdParam('id'),
  asyncHandler(async (req, res) => {
    if (req.user._id.equals(req.params.id)) throw new AppError(400, 'You cannot delete your own account');

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new AppError(404, 'User not found');

    await Promise.all([
      Note.deleteMany({ owner: user._id }), // { owner, _id } index
      Post.deleteMany({ author: user._id }), // { author, _id } index
    ]);
    res.status(204).end();
  })
);

module.exports = router;
