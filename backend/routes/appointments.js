const express = require('express');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { protect, allowRoles, selfOnly } = require('../middleware/auth');
const { HttpError, asyncHandler, todayStr } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

// POST /api/appointments   (patient books)
router.post(
  '/',
  allowRoles('patient'),
  asyncHandler(async (req, res) => {
    const { doctorId, appointmentDate, appointmentTime, reason, symptoms } = req.body || {};
    const mode = String(req.body?.mode || 'OFFLINE').toUpperCase();
    if (!['ONLINE', 'OFFLINE'].includes(mode)) throw new HttpError(400, 'Please choose Online or In-person.');
    if (!doctorId) throw new HttpError(400, 'Please select a doctor.');
    if (!appointmentDate) throw new HttpError(400, 'Please select an appointment date.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) throw new HttpError(400, 'Date must be YYYY-MM-DD.');
    if (appointmentDate < todayStr()) {
      throw new HttpError(400, 'Cannot book an appointment for a past date. Please choose today or a future date.');
    }

    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) throw new HttpError(404, 'Selected doctor was not found.');

    const offers = doctor.consultationMode || 'BOTH';
    if (mode === 'ONLINE' && offers === 'OFFLINE') throw new HttpError(400, `${doctor.name} sees patients in person only.`);
    if (mode === 'OFFLINE' && offers === 'ONLINE') throw new HttpError(400, `${doctor.name} offers online consultations only.`);
    if (mode === 'OFFLINE' && !doctor.clinicAddress) {
      throw new HttpError(400, `${doctor.name} has not added a clinic address yet. Choose an online visit instead.`);
    }

    const appt = await Appointment.create({
      patientId: req.user._id,
      patientName: req.user.name,
      doctorId: doctor._id,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization,
      appointmentDate,
      appointmentTime,
      reason,
      symptoms,
      mode,
      ...(mode === 'OFFLINE'
        ? { clinicAddress: doctor.clinicAddress, clinicCity: doctor.clinicCity, clinicMapUrl: doctor.clinicMapUrl }
        : {}),
      status: 'PENDING',
    });
    res.status(201).json(appt);
  })
);

// GET /api/appointments/doctor/:id
router.get(
  '/doctor/:id',
  allowRoles('doctor'),
  selfOnly('id'),
  asyncHandler(async (req, res) => {
    res.json(await Appointment.find({ doctorId: req.params.id }).sort({ appointmentDate: 1, createdAt: -1 }));
  })
);

// GET /api/appointments/patient/:id
router.get(
  '/patient/:id',
  allowRoles('patient'),
  selfOnly('id'),
  asyncHandler(async (req, res) => {
    res.json(await Appointment.find({ patientId: req.params.id }).sort({ appointmentDate: -1, createdAt: -1 }));
  })
);

// PUT /api/appointments/:id/status   body: { status: ACCEPTED|REJECTED, notes }
router.put(
  '/:id/status',
  allowRoles('doctor'),
  asyncHandler(async (req, res) => {
    const status = String(req.body?.status || '').toUpperCase();
    if (!['ACCEPTED', 'REJECTED'].includes(status)) {
      throw new HttpError(400, 'Status must be ACCEPTED or REJECTED.');
    }
    const appt = await Appointment.findById(req.params.id);
    if (!appt) throw new HttpError(404, 'Appointment not found.');
    if (String(appt.doctorId) !== String(req.user._id)) {
      throw new HttpError(403, 'This appointment belongs to another doctor.');
    }
    if (appt.status !== 'PENDING') throw new HttpError(409, `Appointment is already ${appt.status}.`);

    appt.status = status;
    if (req.body.notes !== undefined) appt.doctorNotes = req.body.notes;
    if (status === 'ACCEPTED' && appt.mode === 'ONLINE') {
      const link = String(req.body.meetingLink || req.user.meetingLink || '').trim();
      if (!link) throw new HttpError(400, 'Please add a video-call link for this online appointment.');
      if (!/^https?:\/\/[^\s]+$/i.test(link)) throw new HttpError(400, 'Meeting link must start with http:// or https://');
      appt.meetingLink = link;
    }
    await appt.save();
    res.json(appt);
  })
);

// PUT /api/appointments/:id/reschedule (patient reschedules their own request)
router.put('/:id/reschedule', allowRoles('patient'), asyncHandler(async (req, res) => {
  const { appointmentDate, appointmentTime } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(appointmentDate || '')) || appointmentDate < todayStr()) {
    throw new HttpError(400, 'Choose today or a future date.');
  }
  if (!appointmentTime) throw new HttpError(400, 'Choose an appointment time.');
  const appt = await Appointment.findById(req.params.id);
  if (!appt) throw new HttpError(404, 'Appointment not found.');
  if (String(appt.patientId) !== String(req.user._id)) throw new HttpError(403, 'You can only reschedule your own appointments.');
  if (!['PENDING', 'ACCEPTED'].includes(appt.status)) throw new HttpError(409, 'This appointment cannot be rescheduled.');
  appt.appointmentDate = appointmentDate;
  appt.appointmentTime = appointmentTime;
  appt.status = 'PENDING';
  appt.meetingLink = undefined;
  appt.doctorNotes = 'Patient requested a new appointment time.';
  await appt.save();
  res.json(appt);
}));

// Doctor can propose a new date/time for a patient under their care.
router.put('/:id/doctor-reschedule', allowRoles('doctor'), asyncHandler(async (req, res) => {
  const { appointmentDate, appointmentTime } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(appointmentDate || '')) || appointmentDate < todayStr()) throw new HttpError(400, 'Choose today or a future date.');
  if (!appointmentTime) throw new HttpError(400, 'Choose an appointment time.');
  const appt = await Appointment.findById(req.params.id);
  if (!appt) throw new HttpError(404, 'Appointment not found.');
  if (String(appt.doctorId) !== String(req.user._id)) throw new HttpError(403, 'This appointment belongs to another doctor.');
  if (!['PENDING', 'ACCEPTED'].includes(appt.status)) throw new HttpError(409, 'This appointment cannot be rescheduled.');
  appt.appointmentDate = appointmentDate;
  appt.appointmentTime = appointmentTime;
  appt.status = 'ACCEPTED';
  appt.doctorNotes = 'Appointment rescheduled by the doctor.';
  await appt.save();
  res.json(appt);
}));

// Doctor can cancel only their own patient's appointment.
router.put('/:id/doctor-cancel', allowRoles('doctor'), asyncHandler(async (req, res) => {
  const appt = await Appointment.findById(req.params.id);
  if (!appt) throw new HttpError(404, 'Appointment not found.');
  if (String(appt.doctorId) !== String(req.user._id)) throw new HttpError(403, 'This appointment belongs to another doctor.');
  if (!['PENDING', 'ACCEPTED'].includes(appt.status)) throw new HttpError(409, 'This appointment is already closed.');
  appt.status = 'CANCELLED';
  appt.doctorNotes = String(req.body?.reason || 'Appointment cancelled by the doctor.');
  await appt.save();
  res.json(appt);
}));

// PUT /api/appointments/:id/cancel   (patient cancels own)
router.put(
  '/:id/cancel',
  allowRoles('patient'),
  asyncHandler(async (req, res) => {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) throw new HttpError(404, 'Appointment not found.');
    if (String(appt.patientId) !== String(req.user._id)) {
      throw new HttpError(403, 'You can only cancel your own appointments.');
    }
    if (!['PENDING', 'ACCEPTED'].includes(appt.status)) {
      throw new HttpError(409, `Appointment is already ${appt.status}.`);
    }
    appt.status = 'CANCELLED';
    await appt.save();
    res.json(appt);
  })
);

module.exports = router;
