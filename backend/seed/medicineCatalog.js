const Medicine = require('../models/Medicine');

// Starter pharmacy catalogue only: no demo users, patient records or person IDs are created.
async function seedMedicineCatalog() {
  if (await Medicine.countDocuments()) return;
  const expiryDate = `${new Date().getFullYear() + 2}-12-31`;
  const items = [
    ['Paracetamol 500 mg', 'Paracetamol', 'Pain relief / Fever', 'Tablet', 1.5, 250],
    ['ORS Sachet', 'Oral Rehydration Salts', 'Hydration', 'Sachet', 20, 100],
    ['Cetirizine 10 mg', 'Cetirizine', 'Allergy', 'Tablet', 2, 120],
    ['Antacid Chewable Tablet', 'Calcium carbonate', 'Antacid', 'Tablet', 3, 100],
    ['Pantoprazole 40 mg', 'Pantoprazole', 'Gastrointestinal', 'Tablet', 5, 100],
    ['Povidone-Iodine 10% Solution', 'Povidone-Iodine', 'Antiseptic', 'Solution', 65, 30],
    ['Saline Nasal Spray', 'Sodium chloride', 'Nasal care', 'Spray', 75, 30],
    ['Clotrimazole 1% Cream', 'Clotrimazole', 'Topical antifungal', 'Cream', 38, 40],
    ['Diclofenac 1% Gel', 'Diclofenac', 'Topical pain relief', 'Gel', 95, 30],
    ['Metformin 500 mg', 'Metformin', 'Antidiabetic', 'Tablet', 4, 150],
    ['Amlodipine 5 mg', 'Amlodipine', 'Cardiovascular', 'Tablet', 2, 120],
    ['Atorvastatin 10 mg', 'Atorvastatin', 'Cardiovascular', 'Tablet', 4, 100],
  ];
  await Medicine.insertMany(items.map(([name, genericName, category, dosageForm, price, quantity], i) => ({
    name, genericName, category, dosageForm, price, quantity, expiryDate,
    batchNumber: `START-${String(i + 1).padStart(3, '0')}`,
    minStockThreshold: 15,
    manufacturer: 'Generic catalogue',
    description: 'Starter inventory entry. Pharmacist should verify product, batch, expiry and local MRP before sale.',
    status: quantity <= 15 ? 'LOW_STOCK' : 'IN_STOCK',
  })));
  console.log(`[STOCK] Added ${items.length} starter medicine entries; no user accounts were created.`);
}
module.exports = { seedMedicineCatalog };
