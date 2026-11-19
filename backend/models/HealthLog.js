const mongoose = require('mongoose');
const toJSON = require('./toJSON');
const { todayStr } = require('../utils/helpers');

const healthLogSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientName: String,
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Please select a reviewing doctor'], index: true },
    doctorName: String,
    logDate: { type: String, default: () => todayStr() },

    systolicBp: Number,
    diastolicBp: Number,
    bloodGlucose: Number,
    heartRate: Number,
    temperature: Number,
    weight: Number,
    sleepHours: Number,
    waterIntakeLiters: Number,
    symptoms: String,
    medicationAdherence: { type: String, enum: ['YES', 'PARTIAL', 'NO'], default: 'YES' },
    patientNotes: String,

    doctorFeedback: String,
    reviewedByDoctor: { type: Boolean, default: false },
  },
  { timestamps: true }
);

healthLogSchema.plugin(toJSON);

module.exports = mongoose.model('HealthLog', healthLogSchema);
