const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DEFAULT_SECRET = 'meditrack-dev-secret-change-me';

const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/final_capstone_db',
  jwtSecret: process.env.JWT_SECRET || DEFAULT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  aiServiceUrl: (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, ''),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  isDefaultSecret: !process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_SECRET,
};

module.exports = config;
