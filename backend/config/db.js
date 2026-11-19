const mongoose = require('mongoose');
const config = require('./index');

/**
 * Connects to MongoDB. Fails fast (5 s) with a clear message instead of hanging,
 * because "backend not connecting" is almost always MongoDB not running.
 */
async function connectDB() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[DB] MongoDB connected -> ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.error('==============================================================');
    console.error('[DB] COULD NOT CONNECT TO MONGODB');
    console.error(`     URI   : ${config.mongoUri}`);
    console.error(`     Reason: ${err.message}`);
    console.error('     Fix   : start MongoDB (Windows: "net start MongoDB")');
    console.error('             or set MONGODB_URI in backend/.env');
    console.error('==============================================================');
    throw err;
  }
}

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDbConnected };
