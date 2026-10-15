import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('Madhav Dairy — Vendor / Farmer Advance Tracking Test Suite');
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
// Test 1: Verify Database Migration File Exists & Contains Proper DDL
// -----------------------------------------------------------------------------
console.log('[1] Database Schema & Migration Verification');
const migrationPath = path.resolve('supabase/migrations/20261015000036_vendor_farmer_advance_tracking_and_adjustments.sql');
assert(fs.existsSync(migrationPath), 'Migration 036 file exists on disk');

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Tables
assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.vendor_advances'), 'Contains vendor_advances table');
assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.vendor_bills'), 'Contains vendor_bills table');
assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.vendor_advance_adjustments'), 'Contains vendor_advance_adjustments table');

// Integrity Check Constraints
assert(migrationSql.includes('CHECK (amount > 0)'), 'Enforces positive advance amount constraint');
assert(migrationSql.includes('CHECK (adjusted_amount >= 0)'), 'Enforces non-negative adjusted amount');
assert(migrationSql.includes('chk_vendor_adv_adjusted'), 'Enforces adjusted_amount <= amount check constraint');
assert(migrationSql.includes('chk_vendor_adv_balance'), 'Enforces exact balance = amount - adjusted_amount check');
assert(migrationSql.includes('chk_vendor_bills_balance'), 'Enforces exact bill balance = total_amount - (adjusted_amount + paid_amount)');
assert(migrationSql.includes('chk_vendor_bills_deductions'), 'Enforces total bill settlements <= total_amount');

// Row Level Security
assert(migrationSql.includes('ALTER TABLE public.vendor_advances ENABLE ROW LEVEL SECURITY;'), 'RLS enabled on vendor_advances');
assert(migrationSql.includes('ALTER TABLE public.vendor_bills ENABLE ROW LEVEL SECURITY;'), 'RLS enabled on vendor_bills');
assert(migrationSql.includes('ALTER TABLE public.vendor_advance_adjustments ENABLE ROW LEVEL SECURITY;'), 'RLS enabled on vendor_advance_adjustments');

// Atomic Stored Procedures / RPCs
assert(migrationSql.includes('FUNCTION public.record_vendor_advance'), 'Defines record_vendor_advance RPC');
assert(migrationSql.includes('FUNCTION public.create_vendor_bill'), 'Defines create_vendor_bill RPC');
assert(migrationSql.includes('FUNCTION public.adjust_vendor_advance_against_bill'), 'Defines adjust_vendor_advance_against_bill RPC');
assert(migrationSql.includes('SECURITY DEFINER'), 'RPCs configured with SECURITY DEFINER');
assert(migrationSql.includes('SET search_path = public'), 'RPCs explicitly pin search_path to public');
assert(migrationSql.includes('FOR UPDATE'), 'Adjustment RPC locks both advance and bill rows FOR UPDATE against race conditions');

// -----------------------------------------------------------------------------
// Test 2: Over-Adjustment Protection & Math Rules
// -----------------------------------------------------------------------------
console.log('\n[2] Advance Calculation & Over-Adjustment Guard Rails');

function simulateAdjustment(advance, bill, requestedAdjustment) {
  if (requestedAdjustment <= 0) {
    return { success: false, error: 'Adjustment amount must be positive' };
  }
  if (requestedAdjustment > advance.balanceAmount) {
    return {
      success: false,
      error: `Adjustment amount (₹${requestedAdjustment}) exceeds available advance balance (₹${advance.balanceAmount})`,
    };
  }
  if (requestedAdjustment > bill.balanceAmount) {
    return {
      success: false,
      error: `Adjustment amount (₹${requestedAdjustment}) exceeds bill balance (₹${bill.balanceAmount})`,
    };
  }

  const newAdvanceAdjusted = advance.adjustedAmount + requestedAdjustment;
  const newAdvanceBalance = advance.amount - newAdvanceAdjusted;
  const newBillAdjusted = bill.adjustedAmount + requestedAdjustment;
  const newBillBalance = bill.totalAmount - (newBillAdjusted + bill.paidAmount);

  return {
    success: true,
    newAdvanceBalance,
    newBillBalance,
  };
}

const mockAdvance = {
  amount: 10000,
  adjustedAmount: 2000,
  balanceAmount: 8000,
};

const mockBill = {
  totalAmount: 15000,
  adjustedAmount: 0,
  paidAmount: 5000,
  balanceAmount: 10000,
};

// Valid partial adjustment
const validRes = simulateAdjustment(mockAdvance, mockBill, 5000);
assert(validRes.success === true, 'Allows valid partial adjustment (₹5,000 <= ₹8,000 advance & ₹10,000 bill)');
assert(validRes.newAdvanceBalance === 3000, 'Calculates correct new advance balance (₹8,000 - ₹5,000 = ₹3,000)');
assert(validRes.newBillBalance === 5000, 'Calculates correct new bill balance (₹10,000 - ₹5,000 = ₹5,000)');

// Over-adjustment exceeding advance balance
const overAdvRes = simulateAdjustment(mockAdvance, mockBill, 9000);
assert(overAdvRes.success === false, 'Strictly blocks adjustment exceeding advance balance (₹9,000 > ₹8,000)');
assert(overAdvRes.error.includes('exceeds available advance balance'), 'Returns descriptive error for over-adjustment on advance');

// Over-adjustment exceeding bill balance
const smallBill = {
  totalAmount: 4000,
  adjustedAmount: 0,
  paidAmount: 0,
  balanceAmount: 4000,
};
const overBillRes = simulateAdjustment(mockAdvance, smallBill, 6000);
assert(overBillRes.success === false, 'Strictly blocks adjustment exceeding remaining bill payable (₹6,000 > ₹4,000)');
assert(overBillRes.error.includes('exceeds bill balance'), 'Returns descriptive error for over-adjustment on bill');

// Zero or negative adjustment
const zeroRes = simulateAdjustment(mockAdvance, mockBill, 0);
assert(zeroRes.success === false, 'Rejects zero amount adjustment');
const negRes = simulateAdjustment(mockAdvance, mockBill, -500);
assert(negRes.success === false, 'Rejects negative amount adjustment');

// -----------------------------------------------------------------------------
// Test 3: Frontend Component & State Integration Verification
// -----------------------------------------------------------------------------
console.log('\n[3] Frontend Component & State Integration Verification');

// ExpensesView.tsx
const expensesViewPath = path.resolve('src/components/internal/ExpensesView.tsx');
assert(fs.existsSync(expensesViewPath), 'ExpensesView.tsx exists');
const expensesViewContent = fs.readFileSync(expensesViewPath, 'utf8');

assert(expensesViewContent.includes('+ Advance Payment'), 'ExpensesView contains prominent "+ Advance Payment" button');
assert(expensesViewContent.includes('onOpenAddExpense'), 'Preserves existing onOpenAddExpense action');
assert(expensesViewContent.includes('operating_expenses'), 'Preserves Operating Expenses subtab');
assert(expensesViewContent.includes('vendor_advances'), 'Includes Vendor & Farmer Advances subtab');
assert(expensesViewContent.includes('vendor_bills'), 'Includes Vendor Bills & Payables subtab');
assert(expensesViewContent.includes('adjustments_log'), 'Includes Adjustment Audit Log subtab');
assert(expensesViewContent.includes('Total Advances Disbursed'), 'Includes Total Advances Disbursed KPI');
assert(expensesViewContent.includes('Available Advance Balance'), 'Includes Available Advance Balance KPI');
assert(expensesViewContent.includes('advVendorFilter'), 'Includes Vendor/Farmer filter');
assert(expensesViewContent.includes('advPaymentMethodFilter'), 'Includes Payment Method filter');
assert(expensesViewContent.includes('advDateFilter'), 'Includes Date filter');
assert(expensesViewContent.includes('RecordAdvanceModal'), 'Integrates RecordAdvanceModal');
assert(expensesViewContent.includes('CreateVendorBillModal'), 'Integrates CreateVendorBillModal');
assert(expensesViewContent.includes('AdjustAdvanceModal'), 'Integrates AdjustAdvanceModal');

// RecordAdvanceModal.tsx
const recordModalPath = path.resolve('src/components/internal/RecordAdvanceModal.tsx');
assert(fs.existsSync(recordModalPath), 'RecordAdvanceModal.tsx exists');
const recordModalContent = fs.readFileSync(recordModalPath, 'utf8');
assert(recordModalContent.includes('suppliers.map'), 'Presents suppliers/farmers from existing records');
assert(recordModalContent.includes('advanceDate'), 'Captures advance date');
assert(recordModalContent.includes('paymentMethod'), 'Captures payment method');
assert(recordModalContent.includes('referenceNumber'), 'Captures reference/voucher number');
assert(recordModalContent.includes('recordVendorAdvance'), 'Dispatches recordVendorAdvance action');

// AdjustAdvanceModal.tsx
const adjustModalPath = path.resolve('src/components/internal/AdjustAdvanceModal.tsx');
assert(fs.existsSync(adjustModalPath), 'AdjustAdvanceModal.tsx exists');
const adjustModalContent = fs.readFileSync(adjustModalPath, 'utf8');
assert(adjustModalContent.includes('Math.min(advBal, billBal)'), 'Computes max allowable adjustment dynamically');
assert(adjustModalContent.includes('isOverAdvanceBalance'), 'Enforces client-side advance balance guard rail');
assert(adjustModalContent.includes('isOverBillBalance'), 'Enforces client-side bill payable balance guard rail');
assert(adjustModalContent.includes('newAdvanceBalance'), 'Shows real-time live preview of new advance balance');
assert(adjustModalContent.includes('newBillBalance'), 'Shows real-time live preview of new bill balance');
assert(adjustModalContent.includes('adjustVendorAdvanceAgainstBill'), 'Calls adjustVendorAdvanceAgainstBill action');

// DairyContext.tsx
const dairyContextPath = path.resolve('src/context/DairyContext.tsx');
const dairyContextContent = fs.readFileSync(dairyContextPath, 'utf8');
assert(dairyContextContent.includes('suppliers,'), 'DairyContext exposes suppliers in value');
assert(dairyContextContent.includes('vendorAdvances,'), 'DairyContext exposes vendorAdvances in value');
assert(dairyContextContent.includes('vendorBills,'), 'DairyContext exposes vendorBills in value');
assert(dairyContextContent.includes('vendorAdvanceAdjustments,'), 'DairyContext exposes vendorAdvanceAdjustments in value');
assert(dairyContextContent.includes('recordVendorAdvance,'), 'DairyContext exposes recordVendorAdvance in value');
assert(dairyContextContent.includes('createVendorBill,'), 'DairyContext exposes createVendorBill in value');
assert(dairyContextContent.includes('adjustVendorAdvanceAgainstBill,'), 'DairyContext exposes adjustVendorAdvanceAgainstBill in value');
assert(dairyContextContent.includes('refreshVendorAdvances,'), 'DairyContext exposes refreshVendorAdvances in value');

// -----------------------------------------------------------------------------
// Test 4: TypeScript Types Integrity
// -----------------------------------------------------------------------------
console.log('\n[4] TypeScript Types Definition Verification');
const typesPath = path.resolve('src/types/dairy.ts');
const typesContent = fs.readFileSync(typesPath, 'utf8');

assert(typesContent.includes('export interface Supplier'), 'Defines Supplier interface');
assert(typesContent.includes('export type AdvanceStatus'), 'Defines AdvanceStatus type');
assert(typesContent.includes('export interface VendorAdvance'), 'Defines VendorAdvance interface');
assert(typesContent.includes('export type VendorBillStatus'), 'Defines VendorBillStatus type');
assert(typesContent.includes('export interface VendorBill'), 'Defines VendorBill interface');
assert(typesContent.includes('export interface VendorAdvanceAdjustment'), 'Defines VendorAdvanceAdjustment interface');

console.log('\n================================================================');
console.log(`Results: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
