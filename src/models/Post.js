const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: '', maxlength: 20000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

/*
 * INDEX
 *
 * { author: 1, _id: -1 }
 *    - Aggregation Scenario 2: the $lookup sub-pipeline matches
 *      { $expr: { $eq: ['$author', '$$uid'] } }, sorts by _id desc and pages.
 *      The index serves the equality match AND the sort.
 *    - The second $lookup (total count) is answered from the same index.
 *    - Cascade delete of a user's posts: deleteMany({ author })
 *
 * Not indexed on purpose:
 *    - Public list of all posts -> find({}).sort({ _id: -1 }) uses the default _id index
 *    - GET/DELETE by id         -> default _id index
 */
postSchema.index({ author: 1, _id: -1 });

postSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Post', postSchema);
