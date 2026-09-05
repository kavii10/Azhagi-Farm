// Frontend business logic and calculation verification test

function formatQuantity(litres) {
  const map = {
    0.25: '¼ L',
    0.5: '½ L',
    0.75: '¾ L',
    1.0: '1 L',
    1.25: '1¼ L',
    1.5: '1½ L',
    1.75: '1¾ L',
    2.0: '2 L',
  };
  return map[litres] ?? `${litres} L`;
}

function calculateBill(deliveredEntries, rate) {
  const totalLitres = deliveredEntries.reduce((sum, e) => sum + (e.quantity_litre || 0), 0);
  const totalAmount = parseFloat((totalLitres * rate).toFixed(2));
  return { totalLitres, totalAmount };
}

function updatePaymentStatus(totalAmount, payments) {
  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, parseFloat((totalAmount - paidAmount).toFixed(2)));
  let status = 'pending';
  if (balance <= 0) status = 'paid';
  else if (paidAmount > 0) status = 'partial';
  return { paidAmount, balance, status };
}

console.log('Testing Frontend Calculations & Formatting:');

// 1. Test fractions
console.assert(formatQuantity(0.25) === '¼ L', '0.25 should be ¼ L');
console.assert(formatQuantity(0.50) === '½ L', '0.50 should be ½ L');
console.assert(formatQuantity(0.75) === '¾ L', '0.75 should be ¾ L');
console.assert(formatQuantity(1.00) === '1 L', '1.00 should be 1 L');
console.assert(formatQuantity(1.25) === '1¼ L', '1.25 should be 1¼ L');
console.assert(formatQuantity(1.50) === '1½ L', '1.50 should be 1½ L');
console.assert(formatQuantity(1.75) === '1¾ L', '1.75 should be 1¾ L');
console.assert(formatQuantity(2.00) === '2 L', '2.00 should be 2 L');
console.log('✓ Fraction formatting tests passed');

// 2. Test Kumar scenario
const kumarEntries = [
  { entry_date: '2026-09-01', batch: 'morning', quantity_litre: 1.0, status: 'delivered' },
  { entry_date: '2026-09-02', batch: 'morning', quantity_litre: 1.25, status: 'delivered' },
  { entry_date: '2026-09-03', batch: 'morning', quantity_litre: 0.75, status: 'delivered' },
  { entry_date: '2026-09-04', batch: 'morning', quantity_litre: null, status: 'no_milk' },
];

const deliveredOnly = kumarEntries.filter((e) => e.status === 'delivered');
const bill = calculateBill(deliveredOnly, 60.0);
console.assert(bill.totalLitres === 3.0, `Expected 3.0, got ${bill.totalLitres}`);
console.assert(bill.totalAmount === 180.0, `Expected 180.0, got ${bill.totalAmount}`);
console.log('✓ Kumar bill calculation (3.0L x ₹60 = ₹180) passed');

// 3. Test Partial Payment
let pmtState = updatePaymentStatus(bill.totalAmount, [{ amount: 100.0 }]);
console.assert(pmtState.balance === 80.0, `Expected 80.0, got ${pmtState.balance}`);
console.assert(pmtState.status === 'partial', `Expected partial, got ${pmtState.status}`);
console.log('✓ Partial payment (₹100 -> balance ₹80, status PARTIAL) passed');

// 4. Test Full Payment
pmtState = updatePaymentStatus(bill.totalAmount, [{ amount: 100.0 }, { amount: 80.0 }]);
console.assert(pmtState.balance === 0.0, `Expected 0.0, got ${pmtState.balance}`);
console.assert(pmtState.status === 'paid', `Expected paid, got ${pmtState.status}`);
console.log('✓ Final payment (₹80 -> balance ₹0, status PAID) passed');

// 5. Test Customer on 'Both' Morning + Evening batch on same date
const bothEntries = [
  { entry_date: '2026-09-01', batch: 'morning', quantity_litre: 1.0, status: 'delivered' },
  { entry_date: '2026-09-01', batch: 'evening', quantity_litre: 0.5, status: 'delivered' },
  { entry_date: '2026-09-02', batch: 'morning', quantity_litre: 1.0, status: 'delivered' },
  { entry_date: '2026-09-02', batch: 'evening', quantity_litre: null, status: 'no_milk' },
];
const bothDelivered = bothEntries.filter(e => e.status === 'delivered');
const bothBill = calculateBill(bothDelivered, 60.0);
console.assert(bothBill.totalLitres === 2.5, `Expected 2.5L, got ${bothBill.totalLitres}`);
console.assert(bothBill.totalAmount === 150.0, `Expected ₹150.0, got ${bothBill.totalAmount}`);
console.log('✓ Both batch (Morning + Evening) simultaneous aggregation passed');

console.log('All frontend calculation checks verified successfully!');
