const express = require('express');
const User = require('../models/User');
const { signToken, protect, allowRoles, selfOnly } = require('../middleware/auth');
const { HttpError, asyncHandler, pick } = require('../utils/helpers');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const HealthLog = require('../models/HealthLog');

const router = express.Router();

const authResponse = (user) => ({ token: signToken(user), user: user.toJSON() });

// POST /api/auth/register
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = pick(req.body, ['userId', 'password', 'role', ...User.EDITABLE_FIELDS]);
    if (!data.userId || !data.password || !data.name || !data.email) {
      throw new HttpError(400, 'User ID, password, name and email are required.');
    }
    if (!User.ROLES.includes(data.role)) {
      throw new HttpError(400, 'Please choose a role: doctor, patient or pharmacist.');
    }
    if (!String(data.phone || '').trim()) throw new HttpError(400, 'Contact phone is required.');
    const requiredByRole = {
      doctor: ['specialization', 'licenseNumber', 'hospital', 'experienceYears', 'consultationHours', 'consultationMode'],
      patient: ['age', 'gender', 'bloodGroup'],
      pharmacist: ['pharmacyName', 'drugLicenseNumber', 'pharmacyAddress'],
    };
    const missing = requiredByRole[data.role].filter((key) => data[key] === undefined || data[key] === null || String(data[key]).trim() === '');
    if (missing.length) throw new HttpError(400, `Please complete all required ${data.role} registration fields.`);
    if (data.role === 'patient' && (Number(data.age) < 1 || Number(data.age) > 130)) throw new HttpError(400, 'Enter a valid age.');
    if (data.role === 'doctor' && Number(data.experienceYears) < 0) throw new HttpError(400, 'Enter valid years of experience.');
    if (data.role === 'doctor' && (data.consultationMode || 'BOTH') !== 'ONLINE' && (!String(data.clinicAddress || '').trim() || !String(data.clinicCity || '').trim())) {
      throw new HttpError(400, 'Please enter your clinic address and city so patients can find you for in-person visits.');
    }
    if (await User.exists({ userId: data.userId.trim() })) {
      throw new HttpError(409, `User ID '${data.userId}' already exists.`);
    }
    if (await User.exists({ email: String(data.email).toLowerCase().trim() })) {
      throw new HttpError(409, `Email '${data.email}' is already registered.`);
    }
    const user = await User.create(data);
    res.status(201).json(authResponse(user));
  })
);

// POST /api/auth/login   body: { userId, password, role }
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { userId, password, role } = req.body || {};
    const id = String(userId || '').trim();
    if (!id || !password) throw new HttpError(400, 'Please enter your User ID / Email and password.');

    const user = await User.findOne({
      $or: [{ userId: id }, { email: id.toLowerCase() }],
    }).select('+password');

    if (!user) throw new HttpError(401, `No account found for '${id}'.`);
    if (!(await user.matchPassword(password))) throw new HttpError(401, 'Invalid password.');
    if (role && user.role !== String(role).toLowerCase()) {
      throw new HttpError(401, `Role mismatch: this account is registered as a ${user.role}.`);
    }
    res.json(authResponse(user));
  })
);

// POST /api/auth/change-password - username and old password must match the signed-in account.
router.post('/change-password', protect, asyncHandler(async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body || {};
  if (!userId || !oldPassword || !newPassword) throw new HttpError(400, 'Username, old password and new password are required.');
  if (String(newPassword).length < 8) throw new HttpError(400, 'New password must contain at least 8 characters.');
  if (String(userId).trim() !== req.user.userId) throw new HttpError(403, 'Username does not match the signed-in account.');
  const user = await User.findById(req.user._id).select('+password');
  if (!user || !(await user.matchPassword(oldPassword))) throw new HttpError(401, 'Old password is incorrect.');
  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated successfully.' });
}));

// GET /api/auth/me   -> current user (validates a stored token)
router.get('/me', protect, (req, res) => res.json(req.user));

// PUT /api/auth/profile/:id   (own profile only)
router.put(
  '/profile/:id',
  protect,
  selfOnly('id'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found.');
    Object.assign(user, pick(req.body, User.EDITABLE_FIELDS)); // role, userId and password are never editable here
    if (user.role === 'doctor' && (user.consultationMode || 'BOTH') !== 'ONLINE' && !String(user.clinicAddress || '').trim()) {
      throw new HttpError(400, 'Add a clinic address, or switch Consultation Type to Online only.');
    }
    await user.save();
    res.json(user);
  })
);

// GET /api/auth/doctors
router.get(
  '/doctors',
  protect,
  asyncHandler(async (req, res) => {
    res.json(await User.find({ role: 'doctor' }).sort({ name: 1 }));
  })
);

// GET /api/auth/patients  (doctors only)
router.get(
  '/patients',
  protect,
  allowRoles('doctor'),
  asyncHandler(async (req, res) => {
    const doctorId = req.user._id;
    const [appointments, prescriptions, logs] = await Promise.all([
      Appointment.distinct('patientId', { doctorId, status: 'ACCEPTED' }),
      Prescription.distinct('patientId', { doctorId }),
      HealthLog.distinct('patientId', { doctorId }),
    ]);
    const patientIds = [...new Set([...appointments, ...prescriptions, ...logs].map(String))];
    res.json(patientIds.length ? await User.find({ _id: { $in: patientIds }, role: 'patient' }).sort({ name: 1 }) : []);
  })
);

module.exports = router;
