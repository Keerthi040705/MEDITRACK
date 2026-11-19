const express = require('express');
const mongoose = require('mongoose');
const config = require('../config');

const router = express.Router();

/**
 * GET /api/health  (public)
 * -> { status: "UP", database: "UP"|"DOWN", aiService: "UP"|"DOWN" }
 * The React app polls this to show the "not connected" banner.
 */
router.get('/', async (req, res) => {
  let database = 'DOWN';
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      database = 'UP';
    }
  } catch (e) {
    database = 'DOWN';
  }

  let aiService = 'DOWN';
  try {
    const r = await fetch(`${config.aiServiceUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) aiService = 'UP';
  } catch (e) {
    aiService = 'DOWN';
  }

  res.json({ status: 'UP', database, aiService, time: new Date().toISOString() });
});

module.exports = router;
