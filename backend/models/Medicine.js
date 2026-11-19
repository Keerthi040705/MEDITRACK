const mongoose = require('mongoose');
const toJSON = require('./toJSON');
const { todayStr } = require('../utils/helpers');

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Medicine name is required'], trim: true },
    genericName: String,
    category: { type: String, default: 'General' },
    dosageForm: { type: String, default: 'Tablet' },
    batchNumber: String,
    price: { type: Number, required: true, min: [0, 'Price cannot be negative'], default: 0 },
    quantity: { type: Number, required: true, min: [0, 'Quantity cannot be negative'], default: 0 },
    expiryDate: { type: String, match: [/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD'] },
    minStockThreshold: { type: Number, default: 15, min: 0 },
    manufacturer: String,
    description: String,
    status: { type: String, enum: ['IN_STOCK', 'LOW_STOCK', 'EXPIRED'], default: 'IN_STOCK' },
  },
  { timestamps: true, collection: 'medicines' }
);

medicineSchema.methods.isExpired = function isExpired() {
  return Boolean(this.expiryDate) && this.expiryDate < todayStr();
};

medicineSchema.methods.isLowStock = function isLowStock() {
  return (this.quantity ?? 0) <= (this.minStockThreshold ?? 15);
};

medicineSchema.methods.refreshStatus = function refreshStatus() {
  if (this.isExpired()) this.status = 'EXPIRED';
  else if (this.isLowStock()) this.status = 'LOW_STOCK';
  else this.status = 'IN_STOCK';
  return this;
};

medicineSchema.pre('save', function computeStatus(next) {
  this.refreshStatus();
  next();
});

medicineSchema.plugin(toJSON);

medicineSchema.statics.EDITABLE_FIELDS = [
  'name', 'genericName', 'category', 'dosageForm', 'batchNumber', 'price',
  'quantity', 'expiryDate', 'minStockThreshold', 'manufacturer', 'description',
];

module.exports = mongoose.model('Medicine', medicineSchema);
