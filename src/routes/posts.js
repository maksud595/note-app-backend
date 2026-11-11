const express = require('express');
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const { authenticate, validateIdParam } = require('../middleware/auth');
const { AppError, asyncHandler, str, parsePagination, paginated } = require('../utils/helpers');

const router = express.Router();

// GET /api/posts -> public, paginated (default _id index, newest first)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const [data, total] = await Promise.all([
      Post.find().sort({ _id: -1 }).skip(skip).limit(limit).populate('author', 'name').lean(),
      Post.estimatedDocumentCount(),
    ]);
    res.json(paginated(data, total, page, limit));
  })
);

/*
 * AGGREGATION SCENARIO 2 - all posts of one user, via $lookup.
 * GET /api/posts/user/:userId?page=1&limit=10     (public: posts are visible to everyone)
 *
 * ONE User.aggregate() with $lookup stages:
 *  1. $match   -> the user by _id (default index)
 *  2. $lookup  -> posts: sub-pipeline matches author == user._id, sorts newest first, paginates.
 *                 Served by the { author: 1, _id: -1 } index (equality + sort).
 *  3. $lookup  -> total number of posts, counted from the same index (for pagination metadata)
 */
router.get(
  '/user/:userId',
  validateIdParam('userId'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);

    const [result] = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.params.userId) } },
      { $project: { name: 1 } },
      {
        $lookup: {
          from: Post.collection.name,
          let: { uid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$author', '$$uid'] } } },
            { $sort: { _id: -1 } },
            { $skip: skip },
            { $limit: limit },
            { $project: { __v: 0 } },
          ],
          as: 'posts',
        },
      },
      {
        $lookup: {
          from: Post.collection.name,
          let: { uid: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$author', '$$uid'] } } }, { $count: 'n' }],
          as: 'postCount',
        },
      },
    ]);

    if (!result) throw new AppError(404, 'User not found');
    const total = result.postCount[0]?.n || 0;
    res.json({
      user: { _id: result._id, name: result.name },
      ...paginated(result.posts, total, page, limit),
    });
  })
);

// POST /api/posts -> any authenticated user
router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const title = str(req.body.title);
    if (!title) throw new AppError(400, 'title is required');
    const post = await Post.create({ title, content: str(req.body.content) ?? '', author: req.user._id });
    res.status(201).json(post);
  })
);

// DELETE /api/posts/:id -> author or admin
router.delete(
  '/:id',
  authenticate,
  validateIdParam('id'),
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) throw new AppError(404, 'Post not found');
    if (req.user.role !== 'admin' && !post.author.equals(req.user._id)) {
      throw new AppError(403, 'You can only delete your own posts');
    }
    await post.deleteOne();
    res.status(204).end();
  })
);

module.exports = router;
