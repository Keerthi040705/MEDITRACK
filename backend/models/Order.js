const mongoose = require('mongoose');
const toJSON = require('./toJSON');

const orderItemSchema = new mongoose.Schema(
  {
    medicineId: String,
    medicineName: String,
    unitPrice: Number,
    quantity: { type: Number, min: 1 },
    lineTotal: Number,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    billNumber: { type: String, unique: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientName: String,
    patientEmail: String,
    deliveryAddress: { type: String, required: true, trim: true },
    prescriptionId: String,
    doctorName: String,
    items: [orderItemSchema],
    subtotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, default: 'PAID' },
    paymentMethod: { type: String, default: 'ONLINE_GATEWAY' },
    orderDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

orderSchema.plugin(toJSON);

module.exports = mongoose.model('Order', orderSchema);
