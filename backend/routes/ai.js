const express = require('express');
const config = require('../config');
const { protect } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

/**
 * Forwards a request to the Python (Flask) AI service.
 * If Python is not running, the user gets a clear 503 message instead of fake results.
 */
async function callAiService(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${config.aiServiceUrl}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000), // first call may train models (a few seconds)
    });
  } catch (e) {
    throw new HttpError(
      503,
      `AI service is not reachable at ${config.aiServiceUrl}. Start it with "npm run ai" (see README).`
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, data.error || `AI service error (HTTP ${res.status})`);
  return data;
}

// GET /api/ai/symptoms   -> symptom checklist metadata
router.get(
  '/symptoms',
  asyncHandler(async (req, res) => res.json(await callAiService('/symptoms')))
);

// GET /api/ai/models   -> form fields + accuracy "model card" for each trained disease model
router.get(
  '/models',
  asyncHandler(async (req, res) => res.json(await callAiService('/models')))
);

// POST /api/ai/symptom-check   body: { symptoms: ["fever", ...] }
router.post(
  '/symptom-check',
  asyncHandler(async (req, res) => {
    res.json(await callAiService('/symptom-check', { method: 'POST', body: { symptoms: req.body?.symptoms || [] } }));
  })
);

// POST /api/ai/predict-disease   body: { diseaseType, features: {...} }
router.post(
  '/predict-disease',
  asyncHandler(async (req, res) => {
    const { diseaseType, features } = req.body || {};
    res.json(await callAiService('/predict-disease', { method: 'POST', body: { diseaseType, features: features || {} } }));
  })
);

module.exports = { router, callAiService };
