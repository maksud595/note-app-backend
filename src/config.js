require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 16) {
  throw new Error('JWT_SECRET must be set (at least 16 characters). See .env.example');
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/secure_notes',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  bcryptRounds: 12,
  // Comma separated list of allowed frontend origins
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
};
