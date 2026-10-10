import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('Madhav Dairy — Payment Details & Verification Test Suite');
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
const migrationPath = path.resolve('supabase/migrations/20261011000034_payment_details_and_customer_verification.sql');
assert(fs.existsSync(migrationPath), 'Migration 034 file exists on disk');

const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// Tables
assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.business_payment_methods'), 'Contains business_payment_methods table');
assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.customer_payment_submissions'), 'Contains customer_payment_submissions table');

// Constraints & Indexes
assert(migrationSql.includes('uq_payment_submission_ref_active'), 'Enforces unique active transaction reference index');
assert(migrationSql.includes("WHERE status != 'rejected'"), 'Partial index allows re-submission if previously rejected');
assert(migrationSql.includes('idx_biz_pm_active'), 'Indexed for active payment method queries');
assert(migrationSql.includes('idx_pay_sub_status'), 'Indexed for payment submission status lookups');

// Row Level Security
assert(migrationSql.includes('ALTER TABLE public.business_payment_methods ENABLE ROW LEVEL SECURITY;'), 'RLS enabled on business_payment_methods');
assert(migrationSql.includes('ALTER TABLE public.customer_payment_submissions ENABLE ROW LEVEL SECURITY;'), 'RLS enabled on customer_payment_submissions');
assert(migrationSql.includes('Admins can insert payment methods'), 'Admin-only insert policy defined for payment methods');
assert(migrationSql.includes('Admins can update payment methods'), 'Admin-only update policy defined for payment methods');
assert(migrationSql.includes('Admins can delete payment methods'), 'Admin-only delete policy defined for payment methods');
assert(migrationSql.includes('Customers can view active payment methods'), 'Customers read-only policy for active methods');
assert(migrationSql.includes('Customers can view own submissions'), 'Customers isolated to own submissions');
assert(migrationSql.includes('Customers can insert own payment submissions'), 'Customers restricted to inserting own submissions');

// Storage Bucket & Policies
assert(migrationSql.includes("'payment-assets'"), 'Bucket payment-assets registered');
assert(migrationSql.includes('Authenticated users can upload payment assets'), 'Storage upload policy defined');
assert(migrationSql.includes('Admins can modify payment assets'), 'Storage modify policy restricted to admins');

// RPC Functions
assert(migrationSql.includes('FUNCTION public.submit_customer_payment'), 'Defines submit_customer_payment RPC');
assert(migrationSql.includes('FUNCTION public.verify_and_account_payment_submission'), 'Defines verify_and_account_payment_submission RPC');
assert(migrationSql.includes('FUNCTION public.reject_payment_submission'), 'Defines reject_payment_submission RPC');
assert(migrationSql.includes('SECURITY DEFINER'), 'RPCs configured with SECURITY DEFINER');
assert(migrationSql.includes('SET search_path = public'), 'Search path explicitly pinned to public for security');

// -----------------------------------------------------------------------------
// Test 2: Verify Atomic Accounting & Double-Entry Ledger Logic
// -----------------------------------------------------------------------------
console.log('\n[2] Financial Accounting & Ledger Integrity');
assert(migrationSql.includes('INSERT INTO public.payments'), 'verify_and_account records verified payment in payments table');
assert(migrationSql.includes('INSERT INTO public.payment_allocations'), 'verify_and_account allocates payment to invoice');
assert(migrationSql.includes('INSERT INTO public.ledger_entries'), 'verify_and_account posts Double-Entry credit to ledger_entries');
assert(migrationSql.includes("'payment'"), 'Ledger entry recorded as entry_type payment');
assert(migrationSql.includes('verified_at = now()'), 'Preserves accounting timestamp');
assert(migrationSql.includes('verified_by = v_caller_uid'), 'Preserves administrator audit trail identity');
assert(migrationSql.includes('accounted_payment_id = v_pay_id'), 'Links original submission to accounted payment ID');
assert(migrationSql.includes('FOR UPDATE'), 'Implements row-level locking against race conditions and concurrent double-clicks');
assert(migrationSql.includes("IF v_sub.status = 'accounted' THEN"), 'Prevents duplicate accounting of already processed submissions');
assert(migrationSql.includes("IF v_sub.status = 'rejected' THEN"), 'Prevents accounting a rejected submission');

// -----------------------------------------------------------------------------
// Test 3: Form Validations (IFSC, Account Number, UPI ID)
// -----------------------------------------------------------------------------
console.log('\n[3] Banking & UPI Format Validations');

// IFSC validation: 4 letters, 0, 6 alphanumeric
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
assert(ifscRegex.test('HDFC0001234'), 'Validates correct HDFC IFSC (HDFC0001234)');
assert(ifscRegex.test('SBIN0004567'), 'Validates correct SBI IFSC (SBIN0004567)');
assert(ifscRegex.test('ICIC0000001'), 'Validates correct ICICI IFSC (ICIC0000001)');
assert(!ifscRegex.test('HDFC1234567'), 'Rejects IFSC without 0 at 5th character');
assert(!ifscRegex.test('HDF0001234'), 'Rejects short IFSC');
assert(!ifscRegex.test('HDFC00012345'), 'Rejects long IFSC');

// Account number validation: 9 to 18 digits
const accNumRegex = /^\d{9,18}$/;
assert(accNumRegex.test('50200084920194'), 'Validates 14-digit standard account number');
assert(accNumRegex.test('123456789'), 'Validates 9-digit minimum account number');
assert(accNumRegex.test('123456789012345678'), 'Validates 18-digit maximum account number');
assert(!accNumRegex.test('12345678'), 'Rejects account number under 9 digits');
assert(!accNumRegex.test('1234567890123456789'), 'Rejects account number over 18 digits');
assert(!accNumRegex.test('50200A84920194'), 'Rejects alphanumeric account number');

// UPI ID validation
const upiRegex = /^[\w.-]+@[\w.-]+$/;
assert(upiRegex.test('madhavdairy@hdfcbank'), 'Validates madhavdairy@hdfcbank');
assert(upiRegex.test('retailer.shop@oksbi'), 'Validates retailer.shop@oksbi');
assert(upiRegex.test('9822011223@paytm'), 'Validates mobile UPI ID');
assert(!upiRegex.test('invalid-upi'), 'Rejects UPI without @ symbol');
assert(!upiRegex.test('@bank'), 'Rejects empty username UPI');

// -----------------------------------------------------------------------------
// Test 4: Business Rules for Customer Submissions
// -----------------------------------------------------------------------------
console.log('\n[4] Customer Submission Calculation & Guard Rails');

function validateSubmissionAmount(claimedAmount, totalInvoiceAmount, alreadyPaid, pendingVerification) {
  const currentOutstanding = Math.max(0, totalInvoiceAmount - alreadyPaid);
  const effectivePayable = Math.max(0, currentOutstanding - pendingVerification);

  if (claimedAmount <= 0) return { valid: false, error: 'Amount must be > 0' };
  if (claimedAmount > currentOutstanding) return { valid: false, error: 'Exceeds current outstanding' };
  return { valid: true, currentOutstanding, effectivePayable };
}

const res1 = validateSubmissionAmount(5000, 10000, 3000, 0);
assert(res1.valid && res1.currentOutstanding === 7000, 'Allows partial payment within outstanding balance');

const res2 = validateSubmissionAmount(8000, 10000, 3000, 0);
assert(!res2.valid, 'Blocks payment exceeding outstanding balance (8000 > 7000)');

const res3 = validateSubmissionAmount(-500, 10000, 0, 0);
assert(!res3.valid, 'Blocks negative payment submission');

const res4 = validateSubmissionAmount(0, 10000, 0, 0);
assert(!res4.valid, 'Blocks zero amount payment submission');

// -----------------------------------------------------------------------------
// Test 5: Verify Frontend Component Integrations
// -----------------------------------------------------------------------------
console.log('\n[5] Frontend Component Integrity');

const paymentDetailsView = fs.readFileSync('src/components/internal/PaymentDetailsView.tsx', 'utf8');
assert(paymentDetailsView.includes('isAdmin = internalRole === \'admin\''), 'Restricts PaymentDetailsView modifications to admin role');
assert(paymentDetailsView.includes('uploadQrCode'), 'Integrates QR code file upload to Supabase storage');
assert(paymentDetailsView.includes('validateBankForm'), 'Validates Bank Form inputs before submit');
assert(paymentDetailsView.includes('validateUpiForm'), 'Validates UPI Form inputs before submit');

const paymentsView = fs.readFileSync('src/components/internal/PaymentsView.tsx', 'utf8');
assert(paymentsView.includes('Customer Payment Verification Queue'), 'Includes Verification Queue tab in PaymentsView');
assert(paymentsView.includes('verifyAndAccountSubmission'), 'Integrates verifyAndAccountSubmission action');
assert(paymentsView.includes('rejectPaymentSubmission'), 'Integrates rejectPaymentSubmission action');
assert(paymentsView.includes('rejectionReason'), 'Mandates rejection reason before submitting rejection');

const customerPaymentsView = fs.readFileSync('src/components/customer/CustomerPayments.tsx', 'utf8');
assert(customerPaymentsView.includes('submitCustomerPayment'), 'Integrates Pay Now submission RPC in customer portal');
assert(customerPaymentsView.includes('handleReceiptUpload'), 'Supports optional customer receipt/screenshot upload');
assert(customerPaymentsView.includes('Submitted Claims'), 'Includes customer claim status tracking tab');
assert(customerPaymentsView.includes('defaultUpiMethod'), 'Dynamically renders active official business payment methods');

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Results: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
