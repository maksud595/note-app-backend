// Vercel serverless entry. Local development uses src/server.js instead.
const mongoose = require('mongoose');
const config = require('../src/config');
const app = require('../src/app');

// Reuse the connection between invocations of the same warm instance
let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

async function connect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(config.mongoUri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // retry on the next request
    throw err;
  }
  return cached.conn;
}

module.exports = async (req, res) => {
  // CORS is set here, before anything else, so it works even if CORS_ORIGIN is wrong or the DB is down.
  // Safe because auth uses the Authorization header, not cookies.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('X-Backend-Version', 'cors-v3'); // lets you confirm in the Network tab that this code is live

  // Preflight: answer immediately, no database needed
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    await connect();
  } catch (err) {
    console.error('DB connection failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ message: 'Database unavailable' }));
  }
  return app(req, res);
};