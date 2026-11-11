const notFound = (_req, res) => res.status(404).json({ message: 'Route not found' });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ message: err.message });

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join('; ');
    return res.status(400).json({ message });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: `Invalid ${err.path}` });
  if (err.code === 11000) return res.status(409).json({ message: 'Email is already in use' });
  if (err.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expired' });
  if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
    return res.status(401).json({ message: 'Invalid token' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Malformed JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Payload too large' });

  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
};

module.exports = { notFound, errorHandler };
