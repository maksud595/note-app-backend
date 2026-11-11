const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { corsOrigin } = require('./config');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// The frontend is a separate app on another origin, so allow it explicitly (not "*")
app.use(cors({ origin: corsOrigin, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '100kb' }));

app.use(
  '/api/auth',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false })
);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/posts', require('./routes/posts'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
