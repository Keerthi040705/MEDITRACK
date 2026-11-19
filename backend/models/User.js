const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const toJSON = require('./toJSON');

const ROLES = ['doctor', 'patient', 'pharmacist'];

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: [true, 'User ID is required'], unique: true, trim: true },
    password: { type: String, required: [true, 'Password is required'], minlength: [6, 'Password must be at least 6 characters'], select: false },
    role: { type: String, enum: { values: ROLES, message: 'Role must be doctor, patient or pharmacist' }, required: true },
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },

    // Doctor
    specialization: String,
    licenseNumber: String,
    hospital: String,
    experienceYears: Number,
    consultationHours: String,
    bio: String,
    // Where / how the doctor consults
    consultationMode: { type: String, enum: ['BOTH', 'OFFLINE', 'ONLINE'], default: 'BOTH' },
    clinicAddress: String,   // street address shown to patients for in-person visits
    clinicCity: String,
    clinicMapUrl: String,    // optional Google Maps link
    meetingLink: String,     // default video-call link for online visits

    // Patient
    age: Number,
    gender: String,
    bloodGroup: String,
    emergencyContact: String,
    allergies: String,
    medicalHistory: String,

    // Pharmacist
    pharmacyName: String,
    drugLicenseNumber: String,
    pharmacyAddress: String,
    storePhone: String,
  },
  { timestamps: true }
);

const isWebLink = (v) => !v || /^https?:\/\/[^\s]+$/i.test(String(v).trim());
userSchema.path('clinicMapUrl').validate(isWebLink, 'Map link must start with http:// or https://');
userSchema.path('meetingLink').validate(isWebLink, 'Meeting link must start with http:// or https://');

// Hash password whenever it is set or changed
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function matchPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.plugin(toJSON);

/** Fields a user may change on their own profile (never role / userId / password here). */
userSchema.statics.EDITABLE_FIELDS = [
  'name', 'phone', 'email',
  'specialization', 'licenseNumber', 'hospital', 'experienceYears', 'consultationHours', 'bio',
  'consultationMode', 'clinicAddress', 'clinicCity', 'clinicMapUrl', 'meetingLink',
  'age', 'gender', 'bloodGroup', 'emergencyContact', 'allergies', 'medicalHistory',
  'pharmacyName', 'drugLicenseNumber', 'pharmacyAddress', 'storePhone',
];
userSchema.statics.ROLES = ROLES;

module.exports = mongoose.model('User', userSchema);
