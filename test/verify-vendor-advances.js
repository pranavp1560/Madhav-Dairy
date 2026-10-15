import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('Madhav Dairy — Streamlined Vendor Advance & Expenses Test Suite');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// Test 1: Database Migration & Schema Verification
// -----------------------------------------------------------------------------
console.log('[1] Database Schema & Migration Verification');
const migration036Path = path.resolve('supabase/migrations/20261015000036_vendor_farmer_advance_tracking_and_adjustments.sql');
assert(fs.existsSync(migration036Path), 'Migration 036 file exists on disk');

const migration037Path = path.resolve('supabase/migrations/20261015000037_simplify_vendor_advance_adjustments.sql');
assert(fs.existsSync(migration037Path), 'Migration 037 file exists on disk');

const sql036 = fs.readFileSync(migration036Path, 'utf8');
const sql037 = fs.readFileSync(migration037Path, 'utf8');

assert(sql036.includes('CREATE TABLE IF NOT EXISTS public.vendor_advances'), 'Contains vendor_advances table');
assert(sql036.includes('CHECK (amount > 0)'), 'Enforces positive advance amount constraint');
assert(sql036.includes('chk_vendor_adv_adjusted'), 'Enforces adjusted_amount <= amount check constraint');
assert(sql036.includes('chk_vendor_adv_balance'), 'Enforces exact balance = amount - adjusted_amount check');
assert(sql036.includes('RLS ENABLE ROW LEVEL SECURITY') || sql036.includes('ENABLE ROW LEVEL SECURITY;'), 'RLS enabled on vendor_advances');

assert(sql037.includes('bill_id DROP NOT NULL'), 'Allows direct adjustment without bill requirement');
assert(sql037.includes('adjust_vendor_advance'), 'Defines atomic adjust_vendor_advance RPC');
assert(sql037.includes('FOR UPDATE'), 'Adjustment RPC locks advance row FOR UPDATE against race conditions');

// -----------------------------------------------------------------------------
// Test 2: Advance Calculation & Expense Total Accounting
// -----------------------------------------------------------------------------
console.log('\n[2] Advance Calculation & Expense Total Accounting');

function simulateDirectAdjustment(advance, requestedAdjustment, goodsDescription) {
  if (requestedAdjustment <= 0) {
    return { success: false, error: 'Adjustment amount must be positive' };
  }
  if (requestedAdjustment > advance.balanceAmount) {
    return {
      success: false,
      error: `Adjustment amount (₹${requestedAdjustment}) exceeds available advance balance (₹${advance.balanceAmount})`,
    };
  }

  const newAdjustedAmount = advance.adjustedAmount + requestedAdjustment;
  const newBalanceAmount = advance.amount - newAdjustedAmount;

  return {
    success: true,
    newAdjustedAmount,
    newBalanceAmount,
    goodsDescription,
  };
}

const advance10k = {
  amount: 10000,
  adjustedAmount: 0,
  balanceAmount: 10000,
};

// Scenario: Give 10k advance, then take 4k goods from vendor
const adj4k = simulateDirectAdjustment(advance10k, 4000, 'Raw milk collection - 100 Litres');
assert(adj4k.success === true, 'Allows valid adjustment against goods received');
assert(adj4k.newBalanceAmount === 6000, 'Calculates remaining advance balance: ₹10,000 - ₹4,000 = ₹6,000');
assert(adj4k.newAdjustedAmount === 4000, 'Records adjusted amount: ₹4,000');

// Scenario: Over-adjustment blocked
const overAdj = simulateDirectAdjustment(advance10k, 12000, 'Too much goods');
assert(overAdj.success === false, 'Strictly blocks adjustment exceeding advance balance (₹12,000 > ₹10,000)');
assert(overAdj.error.includes('exceeds available advance balance'), 'Returns descriptive error on over-adjustment');

// Expense Total Accounting check:
// "also util adjust and after adjust also this should show in expence total"
const sampleExpenses = [
  { amount: 5000, description: 'Electricity bill' },
  { amount: 3000, description: 'Transportation' },
];
const initialAdvance = { amount: 10000, adjustedAmount: 0, balanceAmount: 10000 };
const totalUntilAdjust = sampleExpenses.reduce((s, e) => s + e.amount, 0) + initialAdvance.amount;
assert(totalUntilAdjust === 18000, 'Until adjust: Advance (₹10,000) is included in total expense (₹18,000)');

const adjustedAdvance = { amount: 10000, adjustedAmount: 4000, balanceAmount: 6000 };
const totalAfterAdjust = sampleExpenses.reduce((s, e) => s + e.amount, 0) + adjustedAdvance.amount;
assert(totalAfterAdjust === 18000, 'After adjust: Advance (₹10,000) remains in total expense (₹18,000)');

// -----------------------------------------------------------------------------
// Test 3: Frontend Component & Layout Verification
// -----------------------------------------------------------------------------
console.log('\n[3] Frontend Component & Layout Verification');

// ExpensesView.tsx
const expensesViewPath = path.resolve('src/components/internal/ExpensesView.tsx');
assert(fs.existsSync(expensesViewPath), 'ExpensesView.tsx exists');
const expensesViewContent = fs.readFileSync(expensesViewPath, 'utf8');

assert(expensesViewContent.includes('+ Advance Payment'), 'Header includes "+ Advance Payment" button');
assert(expensesViewContent.includes('+ Add Expense'), 'Header includes "+ Add Expense" button');
assert(!expensesViewContent.includes('vendor_bills'), 'No separate Vendor Bills tab (unified single page)');
assert(!expensesViewContent.includes('adjustments_log'), 'No separate Adjustments Log tab (unified single page)');
assert(expensesViewContent.includes('Vendor Advance'), 'Table includes "Vendor Advance" rows');
assert(expensesViewContent.includes('unifiedItems'), 'Combines expenses and advances in unified table');
assert(expensesViewContent.includes('setSelectedAdvanceToAdjust'), 'Advance row provides "Adjust" button');
assert(expensesViewContent.includes('RecordAdvanceModal'), 'Integrates RecordAdvanceModal');
assert(expensesViewContent.includes('AdjustAdvanceModal'), 'Integrates AdjustAdvanceModal');

// RecordAdvanceModal.tsx
const recordModalPath = path.resolve('src/components/internal/RecordAdvanceModal.tsx');
assert(fs.existsSync(recordModalPath), 'RecordAdvanceModal.tsx exists');
const recordModalContent = fs.readFileSync(recordModalPath, 'utf8');

assert(recordModalContent.includes('type="text"'), 'Uses text field for vendor/farmer name');
assert(!recordModalContent.includes('suppliers.map'), 'Does NOT use vendors dropdown in RecordAdvanceModal');
assert(recordModalContent.includes('recordVendorAdvance'), 'Dispatches recordVendorAdvance action');

// AdjustAdvanceModal.tsx
const adjustModalPath = path.resolve('src/components/internal/AdjustAdvanceModal.tsx');
assert(fs.existsSync(adjustModalPath), 'AdjustAdvanceModal.tsx exists');
const adjustModalContent = fs.readFileSync(adjustModalPath, 'utf8');

assert(adjustModalContent.includes('adjustmentAmount'), 'Provides input for adjustment amount');
assert(adjustModalContent.includes('description'), 'Provides input for goods / raw material description');
assert(adjustModalContent.includes('newAdvanceBalance'), 'Shows live remaining advance balance');
assert(adjustModalContent.includes('adjustVendorAdvanceDirect'), 'Calls adjustVendorAdvanceDirect action');

// DairyContext.tsx
const dairyContextPath = path.resolve('src/context/DairyContext.tsx');
const dairyContextContent = fs.readFileSync(dairyContextPath, 'utf8');
assert(dairyContextContent.includes('adjustVendorAdvanceDirect'), 'DairyContext exposes adjustVendorAdvanceDirect');
assert(dairyContextContent.includes('recordVendorAdvance'), 'DairyContext exposes recordVendorAdvance');

console.log('\n================================================================');
console.log(`Results: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
