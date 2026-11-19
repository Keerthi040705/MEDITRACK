const express = require('express');
const Medicine = require('../models/Medicine');
const { protect, allowRoles } = require('../middleware/auth');
const { HttpError, asyncHandler, pick, todayStr } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

const withLiveStatus = (list) => list.map((m) => m.refreshStatus());

// GET /api/medicines   (full inventory, live status)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(withLiveStatus(await Medicine.find().sort({ name: 1 })));
  })
);

// GET /api/medicines/available   (not expired, quantity > 0)
router.get(
  '/available',
  asyncHandler(async (req, res) => {
    const list = await Medicine.find({
      quantity: { $gt: 0 },
      $or: [{ expiryDate: { $gte: todayStr() } }, { expiryDate: null }, { expiryDate: '' }],
    }).sort({ name: 1 });
    res.json(withLiveStatus(list));
  })
);

// GET /api/medicines/low-stock-alerts
router.get(
  '/low-stock-alerts',
  asyncHandler(async (req, res) => {
    const list = await Medicine.find().sort({ quantity: 1 });
    res.json(withLiveStatus(list).filter((m) => !m.isExpired() && m.isLowStock()));
  })
);

// POST /api/medicines/remove-expired   (pharmacist)  "remove expired automatically"
router.post(
  '/remove-expired',
  allowRoles('pharmacist'),
  asyncHandler(async (req, res) => {
    const filter = { expiryDate: { $lt: todayStr(), $ne: '' } };
    const expired = await Medicine.find(filter);
    if (expired.length) await Medicine.deleteMany({ _id: { $in: expired.map((m) => m._id) } });
    res.json({
      removedCount: expired.length,
      removedItems: expired,
      message: `${expired.length} expired medication batch(es) purged from inventory.`,
    });
  })
);

// POST /api/medicines   (pharmacist adds stock)
router.post(
  '/',
  allowRoles('pharmacist'),
  asyncHandler(async (req, res) => {
    const med = await Medicine.create(pick(req.body, Medicine.EDITABLE_FIELDS));
    res.status(201).json(med);
  })
);

// PUT /api/medicines/:id   (pharmacist edits / restocks)
router.put(
  '/:id',
  allowRoles('pharmacist'),
  asyncHandler(async (req, res) => {
    const med = await Medicine.findById(req.params.id);
    if (!med) throw new HttpError(404, 'Medicine not found.');
    Object.assign(med, pick(req.body, Medicine.EDITABLE_FIELDS));
    await med.save();
    res.json(med);
  })
);

// DELETE /api/medicines/:id
router.delete(
  '/:id',
  allowRoles('pharmacist'),
  asyncHandler(async (req, res) => {
    const med = await Medicine.findByIdAndDelete(req.params.id);
    if (!med) throw new HttpError(404, 'Medicine not found.');
    res.json({ message: `${med.name} deleted from inventory.` });
  })
);

module.exports = router;
