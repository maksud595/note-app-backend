const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: '', maxlength: 20000 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

/*
 * INDEX
 *
 * { owner: 1, _id: -1 }
 *    - User listing their own notes:  find({ owner }).sort({ _id: -1 })  (index-ordered, no in-memory sort)
 *    - Admin filtering by owner:      same query shape, same index
 *    - countDocuments({ owner }) for pagination totals
 *    - Cascade delete of a user's notes: deleteMany({ owner })
 *
 * Not indexed on purpose:
 *    - GET /notes/:id               -> default _id index
 *    - Admin listing ALL notes      -> find({}).sort({ _id: -1 }) uses the default _id index
 */
noteSchema.index({ owner: 1, _id: -1 });

noteSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Note', noteSchema);
