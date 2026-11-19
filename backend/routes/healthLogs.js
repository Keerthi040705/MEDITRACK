const express = require('express');
const HealthLog = require('../models/HealthLog');
const User = require('../models/User');
const { protect, allowRoles, selfOnly } = require('../middleware/auth');
const { HttpError, asyncHandler, pick } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

const VITAL_FIELDS = [
  'logDate', 'systolicBp', 'diastolicBp', 'bloodGlucose', 'heartRate', 'temperature', 'weight',
  'sleepHours', 'waterIntakeLiters', 'symptoms', 'medicationAdherence', 'patientNotes',
];

// POST /api/health-logs   (patient submits daily vitals to a doctor)
router.post(
  '/',
  allowRoles('patient'),
  asyncHandler(async (req, res) => {
    const doctor = req.body?.doctorId ? await User.findOne({ _id: req.body.doctorId, role: 'doctor' }) : null;
    if (!doctor) throw new HttpError(400, 'Please select a reviewing doctor.');
    const Appointment = require('../models/Appointment');
    const consultation = await Appointment.exists({ doctorId: doctor._id, patientId: req.user._id, status: 'ACCEPTED' });
    if (!consultation) throw new HttpError(403, 'Daily updates can be sent only to a doctor with an accepted consultation.');

    const log = await HealthLog.create({
      ...pick(req.body, VITAL_FIELDS),
      patientId: req.user._id,
      patientName: req.user.name,
      doctorId: doctor._id,
      doctorName: doctor.name,
      reviewedByDoctor: false,
    });
    res.status(201).json(log);
  })
);

// GET /api/health-logs/patient/:id
router.get(
  '/patient/:id',
  allowRoles('patient'),
  selfOnly('id'),
  asyncHandler(async (req, res) => {
    res.json(await HealthLog.find({ patientId: req.params.id }).sort({ logDate: -1, createdAt: -1 }));
  })
);

// GET /api/health-logs/doctor/:id   (logs sent to this doctor)
router.get(
  '/doctor/:id',
  allowRoles('doctor'),
  selfOnly('id'),
  asyncHandler(async (req, res) => {
    res.json(await HealthLog.find({ doctorId: req.params.id }).sort({ logDate: -1, createdAt: -1 }));
  })
);

// PUT /api/health-logs/:id/feedback   body: { feedback }
router.put(
  '/:id/feedback',
  allowRoles('doctor'),
  asyncHandler(async (req, res) => {
    const feedback = String(req.body?.feedback || '').trim();
    if (!feedback) throw new HttpError(400, 'Please enter clinical feedback.');
    const log = await HealthLog.findById(req.params.id);
    if (!log) throw new HttpError(404, 'Health log not found.');
    if (String(log.doctorId) !== String(req.user._id)) {
      throw new HttpError(403, 'This health update was sent to another doctor.');
    }
    log.doctorFeedback = feedback;
    log.reviewedByDoctor = true;
    await log.save();
    res.json(log);
  })
);

module.exports = router;
