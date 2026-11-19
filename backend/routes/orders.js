const express = require('express');
const crypto = require('crypto');
const Order = require('../models/Order');
const Medicine = require('../models/Medicine');
const { protect, allowRoles, selfOnly } = require('../middleware/auth');
const { HttpError, asyncHandler, round2 } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

const TAX_RATE = 0.05; // 5% healthcare dispensary tax

const newBillNumber = () =>
  `RX-INV-${new Date().getFullYear()}-${crypto.randomInt(100000, 999999)}`;

/**
 * POST /api/orders   (patient)
 * body: { items: [{ medicineId, quantity }], prescriptionId? }
 * - Prices always come from the pharmacy inventory, never from the browser.
 * - Every line is checked first; stock is then decremented atomically
 *   (quantity >= requested) and rolled back if any line fails.
 */
router.post(
  '/',
  allowRoles('patient'),
  asyncHandler(async (req, res) => {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const deliveryAddress = typeof req.body?.deliveryAddress === 'string' ? req.body.deliveryAddress.trim() : '';
    if (!rawItems.length) throw new HttpError(400, 'Your cart is empty.');
    if (!deliveryAddress) throw new HttpError(400, 'Please provide a delivery address before placing the order.');

    // Merge duplicate lines for the same medicine
    const wanted = new Map();
    for (const it of rawItems) {
      const qty = Number.parseInt(it.quantity, 10);
      if (!it.medicineId || !Number.isFinite(qty) || qty < 1) {
        throw new HttpError(400, 'Each order item needs a medicine and a quantity of at least 1.');
      }
      wanted.set(String(it.medicineId), (wanted.get(String(it.medicineId)) || 0) + qty);
    }

    // Pass 1: validate everything before touching stock
    const meds = await Medicine.find({ _id: { $in: [...wanted.keys()] } });
    const byId = new Map(meds.map((m) => [String(m._id), m]));
    for (const [id, qty] of wanted) {
      const med = byId.get(id);
      if (!med) throw new HttpError(404, `Medicine not found: ${id}`);
      if (med.isExpired()) throw new HttpError(409, `${med.name} is expired and cannot be sold.`);
      if (med.quantity < qty) {
        throw new HttpError(409, `Insufficient stock for ${med.name}. In stock: ${med.quantity}, requested: ${qty}.`);
      }
    }

    // Pass 2: atomic decrement with rollback
    const done = [];
    try {
      for (const [id, qty] of wanted) {
        const updated = await Medicine.findOneAndUpdate(
          { _id: id, quantity: { $gte: qty } },
          { $inc: { quantity: -qty } },
          { new: true }
        );
        if (!updated) throw new HttpError(409, `${byId.get(id).name} just went out of stock. Please try again.`);
        done.push([id, qty]);
        updated.refreshStatus(); // recompute LOW_STOCK / IN_STOCK status
        await updated.save();
      }
    } catch (err) {
      for (const [id, qty] of done) {
        await Medicine.updateOne({ _id: id }, { $inc: { quantity: qty } });
      }
      throw err;
    }

    // Build the bill
    const items = [...wanted].map(([id, qty]) => {
      const med = byId.get(id);
      return {
        medicineId: id,
        medicineName: med.name,
        unitPrice: med.price,
        quantity: qty,
        lineTotal: round2(med.price * qty),
      };
    });
    const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
    const taxAmount = round2(subtotal * TAX_RATE);

    let order;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        order = await Order.create({
          billNumber: newBillNumber(),
          patientId: req.user._id,
          patientName: req.user.name,
          patientEmail: req.user.email,
          deliveryAddress,
          prescriptionId: req.body.prescriptionId,
          doctorName: req.body.prescriptionId ? 'Prescription Order' : 'Dispensary Verification',
          items,
          subtotal,
          taxAmount,
          discount: 0,
          totalAmount: round2(subtotal + taxAmount),
          paymentStatus: 'PAID',
        });
        break;
      } catch (e) {
        if (e.code !== 11000 || attempt === 2) throw e; // retry only on duplicate bill number
      }
    }
    res.status(201).json(order);
  })
);

// GET /api/orders/patient/:id
router.get(
  '/patient/:id',
  allowRoles('patient'),
  selfOnly('id'),
  asyncHandler(async (req, res) => {
    res.json(await Order.find({ patientId: req.params.id }).sort({ orderDate: -1 }));
  })
);

// GET /api/orders/sales-history   (pharmacist)
router.get(
  '/sales-history',
  allowRoles('pharmacist'),
  asyncHandler(async (req, res) => {
    res.json(await Order.find().sort({ orderDate: -1 }));
  })
);

module.exports = router;
