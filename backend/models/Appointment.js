const mongoose = require('mongoose');
const toJSON = require('./toJSON');

const STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'];
const MODES = ['ONLINE', 'OFFLINE'];

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientName: String,
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Please select a doctor'], index: true },
    doctorName: String,
    doctorSpecialization: String,
    appointmentDate: { type: String, required: [true, 'Appointment date is required'] }, // YYYY-MM-DD
    appointmentTime: { type: String, default: '10:30 AM' },
    mode: { type: String, enum: { values: MODES, message: 'Mode must be ONLINE or OFFLINE' }, default: 'OFFLINE' },
    // Copied from the doctor's profile when booked, so the record keeps the place even if the doctor moves later
    clinicAddress: String,
    clinicCity: String,
    clinicMapUrl: String,
    meetingLink: String, // online visits: shared by the doctor when accepting
    reason: { type: String, default: 'General Consultation' },
    symptoms: String,
    status: { type: String, enum: STATUSES, default: 'PENDING' },
    doctorNotes: String,
  },
  { timestamps: true }
);

appointmentSchema.plugin(toJSON);
appointmentSchema.statics.STATUSES = STATUSES;
appointmentSchema.statics.MODES = MODES;

module.exports = mongoose.model('Appointment', appointmentSchema);
