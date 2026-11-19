/**
 * MediTrack API server  (Node.js + Express + MongoDB)
 *
 *   http://localhost:5000/api/...     REST API used by the React app
 *   http://localhost:5000/            React app (after "npm run build" in /frontend)
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config');
const { connectDB, isDbConnected } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Fail fast instead of silently queueing queries while MongoDB is down
mongoose.set('bufferCommands', false);

// ---------- Middleware ----------
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / tools (no Origin header), configured origins, and any localhost port in development
      if (!origin || config.clientOrigins.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
  })
);
app.use(express.json({ limit: '1mb' }));

// Simple request log
app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start} ms)`));
  next();
});

// ---------- Routes ----------
app.use('/api/health', require('./routes/health'));

// Every other API route needs the database
app.use('/api', (req, res, next) => {
  if (!isDbConnected()) {
    return res.status(503).json({ error: 'Database not connected. Start MongoDB - the server reconnects automatically.' });
  }
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/medicines', require('./routes/medicines'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/health-logs', require('./routes/healthLogs'));
app.use('/api/ai', require('./routes/ai').router);
app.use('/api/chat', require('./routes/chat'));
app.use('/api', notFound);

// ---------- Serve the built React app (production / single-port mode) ----------
const clientDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  console.log('[WEB] Serving React build from frontend/dist');
} else {
  app.get('/', (req, res) =>
    res.type('text').send('MediTrack API is running. Open the React app at http://localhost:5173 (npm run dev).')
  );
}

app.use(errorHandler);

// ---------- Start ----------
let seeded = false;
async function connectWithRetry() {
  try {
    await connectDB();
    seeded = true; // New installations start with real user registrations; no demo people are inserted.
    const Medicine = require('./models/Medicine');
    const { seedMedicineCatalog } = require('./seed/medicineCatalog');
    await seedMedicineCatalog();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    await Medicine.deleteMany({ expiryDate: { $lt: todayKey, $ne: '' } });
  } catch (e) {
    console.log('[DB] Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
}

mongoose.connection.on('disconnected', () => console.warn('[DB] MongoDB disconnected'));

if (require.main === module) {
  if (config.isDefaultSecret) {
    console.warn('[AUTH] Using the default JWT secret. Set JWT_SECRET in backend/.env for real use.');
  }
  const server = app.listen(config.port, () => {
    console.log(`[API] MediTrack API listening on http://localhost:${config.port}`);
    console.log(`[AI ] Expecting Python AI service at ${config.aiServiceUrl}`);
  });
  setInterval(async () => {
    if (!isDbConnected()) return;
    const Medicine = require('./models/Medicine');
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    try { await Medicine.deleteMany({ expiryDate: { $lt: todayKey, $ne: '' } }); } catch (e) { console.error('[STOCK] Expiry cleanup failed:', e.message); }
  }, 60 *  60 * 1000).unref();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[API] Port ${config.port} is already in use. Close the other program or set PORT in backend/.env`);
      process.exit(1);
    }
    throw err;
  });
  connectWithRetry();
}

module.exports = app;
