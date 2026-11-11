const express = require('express');
const Note = require('../models/Note');
const { authenticate, validateIdParam } = require('../middleware/auth');
const { AppError, asyncHandler, str, isObjectId, parsePagination, paginated } = require('../utils/helpers');

const router = express.Router();

router.use(authenticate);

const isOwner = (note, user) => note.owner._id
  ? note.owner._id.equals(user._id)
  : note.owner.equals(user._id);

// POST /api/notes
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const title = str(req.body.title);
    if (!title) throw new AppError(400, 'title is required');
    const note = await Note.create({ title, content: str(req.body.content) ?? '', owner: req.user._id });
    res.status(201).json(note);
  })
);

/*
 * GET /api/notes?page=1&limit=10
 *  - user:  only their own notes            -> { owner, _id } index
 *  - admin: everyone's notes (optionally ?owner=<userId>)
 *           all notes -> default _id index, one owner -> { owner, _id } index
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const isAdmin = req.user.role === 'admin';

    const filter = {};
    if (!isAdmin) filter.owner = req.user._id;
    else if (req.query.owner !== undefined) {
      if (!isObjectId(req.query.owner)) throw new AppError(400, 'Invalid owner');
      filter.owner = req.query.owner;
    }

    let query = Note.find(filter).sort({ _id: -1 }).skip(skip).limit(limit);
    if (isAdmin) query = query.populate('owner', 'name email'); // _id lookups on users
    const [data, total] = await Promise.all([
      query.lean(),
      Object.keys(filter).length ? Note.countDocuments(filter) : Note.estimatedDocumentCount(),
    ]);
    res.json(paginated(data, total, page, limit));
  })
);

// GET /api/notes/:id -> _id index; owner or admin
router.get(
  '/:id',
  validateIdParam('id'),
  asyncHandler(async (req, res) => {
    const note = await Note.findById(req.params.id);
    if (!note) throw new AppError(404, 'Note not found');
    if (req.user.role !== 'admin' && !isOwner(note, req.user)) throw new AppError(404, 'Note not found');
    res.json(note);
  })
);

// PUT /api/notes/:id -> only the owner (admins can read everyone's notes, but edit only their own)
router.put(
  '/:id',
  validateIdParam('id'),
  asyncHandler(async (req, res) => {
    const note = await Note.findById(req.params.id);
    if (!note || (req.user.role !== 'admin' && !isOwner(note, req.user))) throw new AppError(404, 'Note not found');
    if (!isOwner(note, req.user)) throw new AppError(403, 'Admins can view but not edit other users\' notes');

    if (req.body.title !== undefined) note.title = str(req.body.title);
    if (req.body.content !== undefined) note.content = str(req.body.content);
    await note.save();
    res.json(note);
  })
);

// DELETE /api/notes/:id -> only the owner
router.delete(
  '/:id',
  validateIdParam('id'),
  asyncHandler(async (req, res) => {
    const note = await Note.findById(req.params.id);
    if (!note || (req.user.role !== 'admin' && !isOwner(note, req.user))) throw new AppError(404, 'Note not found');
    if (!isOwner(note, req.user)) throw new AppError(403, 'Admins can view but not delete other users\' notes');

    await note.deleteOne();
    res.status(204).end();
  })
);

module.exports = router;
