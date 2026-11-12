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
  // CORS preflight needs no database
  if (req.method === 'OPTIONS') return app(req, res);

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