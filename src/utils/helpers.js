class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const OBJECT_ID = /^[a-f\d]{24}$/i;
const isObjectId = (v) => typeof v === 'string' && OBJECT_ID.test(v);

// Only accept real strings (blocks NoSQL operator injection such as { "$ne": "" })
const str = (v) => (typeof v === 'string' ? v : undefined);

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
}

function paginated(data, total, page, limit) {
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

function normalizeInterests(value) {
  if (!Array.isArray(value)) throw new AppError(400, 'interests must be an array of strings');
  if (value.length > 20) throw new AppError(400, 'A maximum of 20 interests is allowed');
  const out = new Set();
  for (const item of value) {
    if (typeof item !== 'string') throw new AppError(400, 'interests must be an array of strings');
    const v = item.trim().toLowerCase();
    if (v.length > 50) throw new AppError(400, 'Each interest must be at most 50 characters');
    if (v) out.add(v);
  }
  return [...out];
}

function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 128) {
    throw new AppError(400, 'Password must be a string of 8 to 128 characters');
  }
  return pw;
}

module.exports = {
  AppError,
  asyncHandler,
  isObjectId,
  str,
  parsePagination,
  paginated,
  normalizeInterests,
  checkPassword,
};
