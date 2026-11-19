const express = require('express');
const Prescription = require('../models/Prescription');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const { protect, allowRoles, selfOnly } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

const ITEM_FIELDS = ['medicineId', 'medicineName', 'dosage', 'frequency', 'durationDays', 'quantity', 'unitPrice', 'instructions'];
const cleanItems = (items) =>
  (Array.isArray(items) ? items : []).map((i) =>
    Object.fromEntries(ITEM_FIELDS.filter((k) => i[k] !== undefined).map((k) => [k, i[k]]))
  );

// POST /api/prescriptions   (doctor issues)
router.post(
  '/',
  allowRoles('doctor'),
  asyncHandler(async (req, res) => {
    const { patientId, diagnosis, notes, items } = req.body || {};
    if (!patientId) throw new HttpError(400, 'Please select a patient.');
    const patient = await User.findOne({ _id: patientId, role: 'patient' });
    if (!patient) throw new HttpError(404, 'Selected patient was not found.');
    const consultation = await Appointment.exists({ doctorId: req.user._id, patientId: patient._id, status: 'ACCEPTED' });
    if (!consultation) throw new HttpError(403, 'You can prescribe only to patients with an accepted consultation under your care.');

    const rx = await Prescription.create({
      doctorId: req.user._id,
      doctorName: req.user.name,
      patientId: patient._id,
      patientName: patient.name,
      diagnosis,
      notes,
      items: cleanItems(items),
      status: 'ACTIVE',
    });
    res.status(201).json(rx);
  })
);

// PUT /api/prescriptions/:id   (issuing doctor edits)
router.put(
  '/:id',
  allowRoles('doctor'),
  asyncHandler(async (req, res) => {
    const rx = await Prescription.findById(req.params.id);
    if (!rx) throw new HttpError(404, 'Prescription not found.');
    if (String(rx.doctorId) !== String(req.user._id)) {
      throw new HttpError(403, 'You can only edit prescriptions you issued.');
    }
    const { diagnosis, notes, items, status } = req.body || {};
    if (diagnosis !== undefined) rx.diagnosis = diagnosis;
    if (notes !== undefined) rx.notes = notes;
    if (items !== undefined) rx.items = cleanItems(items);
    rx.status = status && ['ACTIVE', 'DISPENSED', 'MODIFIED'].includes(status) ? status : 'MODIFIED';
    await rx.save();
    res.json(rx);
  })
);

// GET /api/prescriptions/doctor/:id
router.get(
  '/doctor/:id',
  allowRoles('doctor'),
  selfOnly('id'),
  asyncHandler(async (req, res) => {
    res.json(await Prescription.find({ doctorId: req.params.id }).sort({ createdAt: -1 }));
  })
);

// GET /api/prescriptions/patient/:id
router.get(
  '/patient/:id',
  allowRoles('patient'),
  selfOnly('id'),
  asyncHandler(async (req, res) => {
    res.json(await Prescription.find({ patientId: req.params.id }).sort({ createdAt: -1 }));
  })
);

module.exports = router;
