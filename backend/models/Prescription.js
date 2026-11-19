const mongoose = require('mongoose');
const toJSON = require('./toJSON');

const itemSchema = new mongoose.Schema(
  {
    medicineId: String,
    medicineName: { type: String, required: true },
    dosage: String,
    frequency: String,
    durationDays: Number,
    quantity: { type: Number, min: 1 },
    unitPrice: Number,
    instructions: String,
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorName: String,
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Please select a patient'], index: true },
    patientName: String,
    diagnosis: { type: String, default: 'Clinical Consultation' },
    items: {
      type: [itemSchema],
      validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: 'Add at least one medicine' },
    },
    notes: String,
    status: { type: String, enum: ['ACTIVE', 'DISPENSED', 'MODIFIED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

prescriptionSchema.plugin(toJSON);

module.exports = mongoose.model('Prescription', prescriptionSchema);
