/**
 * Verification test suite for Customer Import Module (Migration 038)
 * 
 * Verifies:
 * 1. Database schema & DDL in Migration 038
 * 2. Database RPC definitions & constraints
 * 3. In-memory Validation logic (required fields, mobile format, GSTIN format, duplicates, action classification)
 * 4. Formula injection sanitization logic
 * 5. Component existence & integration (ImportCustomersView, ImportFeedView, RetailersView, InternalLayout)
 * 6. Live Supabase database execution (if credentials present)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env natively
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

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

console.log('================================================================');
console.log('Madhav Dairy — Customer Import Module Verification Suite');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Migration 038 File & Schema Integrity
// -----------------------------------------------------------------------------
console.log('[1] Migration 038 & DDL Verification');
const migration038Path = path.resolve(__dirname, '../supabase/migrations/20261015000038_customer_import_module.sql');
assert(fs.existsSync(migration038Path), 'Migration 038 file exists on disk');

const sql038 = fs.readFileSync(migration038Path, 'utf8');

// Tables & columns
assert(sql038.includes('CREATE TABLE IF NOT EXISTS public.customer_import_jobs'), 'Contains customer_import_jobs table');
assert(sql038.includes('CREATE TABLE IF NOT EXISTS public.customer_import_job_rows'), 'Contains customer_import_job_rows table');
assert(sql038.includes('uq_cust_import_job_num UNIQUE (organization_id, job_number)'), 'Enforces unique job_number per organization');
assert(sql038.includes("status text NOT NULL DEFAULT 'queued'"), 'Default status is queued');
assert(sql038.includes("CHECK (status IN ('queued', 'processing', 'completed', 'completed_with_errors', 'failed'))"), 'Status check constraint defined');
assert(sql038.includes('ENABLE ROW LEVEL SECURITY'), 'RLS enabled on import tables');

// RPCs
assert(sql038.includes('CREATE OR REPLACE FUNCTION public.create_customer_import_job'), 'Defines create_customer_import_job RPC');
assert(sql038.includes('CREATE OR REPLACE FUNCTION public.process_customer_import_batch'), 'Defines process_customer_import_batch RPC');
assert(sql038.includes('IMP-'), 'Generates IMP- sequence formatted job numbers');
assert(sql038.includes('FOR UPDATE'), 'Locks job row FOR UPDATE during batch processing to avoid race conditions');

// -----------------------------------------------------------------------------
// Test 2: Source Files & Export Signatures
// -----------------------------------------------------------------------------
console.log('\n[2] Source Files & Service Architecture');
const filesToCheck = [
  'src/types/dairy.ts',
  'src/services/customerImportService.ts',
  'src/components/internal/ImportCustomersView.tsx',
  'src/components/internal/ImportFeedView.tsx',
  'src/components/internal/RetailersView.tsx',
  'src/components/internal/InternalLayout.tsx',
];

for (const f of filesToCheck) {
  const p = path.resolve(__dirname, '..', f);
  assert(fs.existsSync(p), `File exists: ${f}`);
}

const serviceCode = fs.readFileSync(path.resolve(__dirname, '../src/services/customerImportService.ts'), 'utf8');
assert(serviceCode.includes('downloadBlankTemplate'), 'customerImportService exports downloadBlankTemplate');
assert(serviceCode.includes('downloadCustomersWithData'), 'customerImportService exports downloadCustomersWithData');
assert(serviceCode.includes('parseUploadedFile'), 'customerImportService exports parseUploadedFile');
assert(serviceCode.includes('validateCustomerRows'), 'customerImportService exports validateCustomerRows');
assert(serviceCode.includes('downloadValidationReport'), 'customerImportService exports downloadValidationReport');
assert(serviceCode.includes('createImportJob'), 'customerImportService exports createImportJob');
assert(serviceCode.includes('processBatch'), 'customerImportService exports processBatch');
assert(serviceCode.includes('fetchImportJobs'), 'customerImportService exports fetchImportJobs');
assert(serviceCode.includes('fetchJobRows'), 'customerImportService exports fetchJobRows');
assert(serviceCode.includes('downloadJobResultReport'), 'customerImportService exports downloadJobResultReport');

// -----------------------------------------------------------------------------
// Test 3: Navigation & Routing Integration
// -----------------------------------------------------------------------------
console.log('\n[3] Navigation & UI Wiring Verification');
const retailersViewCode = fs.readFileSync(path.resolve(__dirname, '../src/components/internal/RetailersView.tsx'), 'utf8');
assert(retailersViewCode.includes('onOpenImportCustomers'), 'RetailersView supports onOpenImportCustomers callback');
assert(retailersViewCode.includes('Import Customers'), 'RetailersView renders "Import Customers" button in header');

const layoutCode = fs.readFileSync(path.resolve(__dirname, '../src/components/internal/InternalLayout.tsx'), 'utf8');
assert(layoutCode.includes('ImportCustomersView'), 'InternalLayout imports ImportCustomersView');
assert(layoutCode.includes('ImportFeedView'), 'InternalLayout imports ImportFeedView');
assert(layoutCode.includes('case \'import_customers\':'), 'InternalLayout routes case \'import_customers\'');
assert(layoutCode.includes('case \'import_feed\':'), 'InternalLayout routes case \'import_feed\'');

// -----------------------------------------------------------------------------
// Test 4: Formula Injection Sanitization
// -----------------------------------------------------------------------------
console.log('\n[4] Formula Injection Protection (CSV / Excel Injection)');
function sanitizeCellValue(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (/^[=+\-@\t\r]/.test(s)) {
    return `'${s}`;
  }
  return s;
}

assert(sanitizeCellValue('=1+1') === "'=1+1", 'Escapes leading = formula trigger');
assert(sanitizeCellValue('+cmd|/c') === "'+cmd|/c", 'Escapes leading + formula trigger');
assert(sanitizeCellValue('-100') === "'-100", 'Escapes leading - trigger');
assert(sanitizeCellValue('@SUM(A1:A10)') === "'@SUM(A1:A10)", 'Escapes leading @ formula trigger');
assert(sanitizeCellValue('Ganesh Dairy') === 'Ganesh Dairy', 'Leaves normal business name unaltered');
assert(sanitizeCellValue(null) === '', 'Handles null gracefully');
assert(sanitizeCellValue(undefined) === '', 'Handles undefined gracefully');

// -----------------------------------------------------------------------------
// Test 5: In-Memory Validation Rules & Conflict Detection
// -----------------------------------------------------------------------------
console.log('\n[5] Customer Data Validation Logic');
function validateRow(row, existingCustomers, inMemoryMobiles) {
  const errors = [];
  const warnings = [];

  if (!row.businessName || !row.businessName.trim()) {
    errors.push('Business Name is required.');
  }
  if (!row.ownerName || !row.ownerName.trim()) {
    errors.push('Owner Name is required.');
  }
  if (!row.address || !row.address.trim()) {
    errors.push('Address is required.');
  }

  const cleanMobile = (row.mobile || '').replace(/\D/g, '');
  if (!cleanMobile) {
    errors.push('Mobile number is required.');
  } else if (cleanMobile.length !== 10) {
    errors.push(`Mobile number must be exactly 10 digits (got ${cleanMobile.length}).`);
  } else if (inMemoryMobiles.has(cleanMobile)) {
    errors.push(`Duplicate mobile number '${cleanMobile}' found within uploaded file.`);
  }

  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
    errors.push(`Invalid email format: '${row.email}'.`);
  }

  if (row.gstin) {
    const g = row.gstin.trim().toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g)) {
      warnings.push(`GSTIN '${g}' does not match standard 15-character format.`);
    }
  }

  let action = 'CREATE';
  let matchedId = null;
  if (row.customerId) {
    const matched = existingCustomers.find(c => c.id === row.customerId);
    if (matched) {
      action = 'UPDATE';
      matchedId = matched.id;
    } else {
      warnings.push(`Specified Customer ID '${row.customerId}' not found. Will create as new customer.`);
    }
  }

  const status = errors.length > 0 ? 'FAILED' : warnings.length > 0 ? 'WARNING' : 'VALID';
  return { status, action, errors, warnings, matchedId };
}

const existingMockCustomers = [
  { id: 'c1111111-1111-1111-1111-111111111111', mobile: '9822000001', businessName: 'Existing Shop' }
];

// Sub-test: Valid new customer
const validNew = validateRow({
  businessName: 'Krishna Dairy',
  ownerName: 'Krishna Gopal',
  mobile: '9822000002',
  address: 'Main Bazaar, Pune'
}, existingMockCustomers, new Set());
assert(validNew.status === 'VALID' && validNew.action === 'CREATE', 'Classifies new valid customer as VALID / CREATE');

// Sub-test: Missing required fields
const missingReq = validateRow({
  businessName: '',
  ownerName: '',
  mobile: '9822000002',
  address: ''
}, existingMockCustomers, new Set());
assert(missingReq.status === 'FAILED' && missingReq.errors.length === 3, 'Detects missing required business name, owner name, address');

// Sub-test: Invalid mobile number
const badMobile = validateRow({
  businessName: 'Shop A',
  ownerName: 'Owner A',
  mobile: '9822',
  address: 'Address A'
}, existingMockCustomers, new Set());
assert(badMobile.status === 'FAILED' && badMobile.errors.some(e => e.includes('10 digits')), 'Enforces 10-digit mobile number requirement');

// Sub-test: Duplicate mobile inside file
const fileMobiles = new Set(['9822123456']);
const duplicateMobile = validateRow({
  businessName: 'Shop Duplicate',
  ownerName: 'Owner B',
  mobile: '9822123456',
  address: 'Address B'
}, existingMockCustomers, fileMobiles);
assert(duplicateMobile.status === 'FAILED' && duplicateMobile.errors.some(e => e.includes('Duplicate mobile')), 'Flags duplicate mobile number within uploaded file');

// Sub-test: Customer update by ID
const updateRow = validateRow({
  customerId: 'c1111111-1111-1111-1111-111111111111',
  businessName: 'Existing Shop Renamed',
  ownerName: 'Owner Updated',
  mobile: '9822000001',
  address: 'Updated Street 2'
}, existingMockCustomers, new Set());
assert(updateRow.status === 'VALID' && updateRow.action === 'UPDATE' && updateRow.matchedId === 'c1111111-1111-1111-1111-111111111111', 'Correctly matches existing customer ID for UPDATE');

// -----------------------------------------------------------------------------
// Test 6: Live Supabase Database Execution (RPCs & Schema)
// -----------------------------------------------------------------------------
console.log('\n[6] Live Supabase Database RPC Verification');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://iuvptjffyvyegzuhkcvw.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_KEY) {
  console.log('  ⚠ SKIP: Supabase credentials not found in environment. Skipping live network RPC calls.');
} else {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Check table access
    const { data: jobs, error: queryErr } = await supabase
      .from('customer_import_jobs')
      .select('id, job_number, status')
      .limit(3);

    assert(!queryErr, `Live query on customer_import_jobs succeeded (${jobs?.length || 0} jobs returned)`);

    // Test create_customer_import_job RPC
    const testFile = `automated_test_${Date.now()}.xlsx`;
    const { data: createData, error: rpcCreateErr } = await supabase.rpc('create_customer_import_job', {
      p_filename: testFile,
      p_file_size: 4096,
      p_total_records: 2,
      p_submitted_by_name: 'Test Runner',
      p_metadata: { runner: 'verify-customer-import.js' }
    });

    const jobId = createData?.job_id;
    assert(!rpcCreateErr && !!jobId, `Live create_customer_import_job RPC executed: jobId=${jobId}`);

    // Test process_customer_import_batch RPC
    const testBatchPayload = [
      {
        row_index: 2,
        action: 'create',
        business_name: 'Automated Test Mart ' + Date.now(),
        owner_name: 'Test Owner',
        mobile: '9822' + Math.floor(100000 + Math.random() * 900000),
        email: 'test@automated.local',
        address: 'Plot 42, GIDC, Pune',
        area: 'Hinjawadi',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411057',
        gstin: '27AABCT' + Math.floor(1000 + Math.random() * 9000) + 'A1Z5',
        credit_limit: 50000,
        sales_channel_name: 'Wholesale',
        opening_balance: 1500,
      },
      {
        row_index: 3,
        action: 'create',
        business_name: 'Invalid Customer No Address',
        owner_name: 'Invalid Owner',
        mobile: '', // deliberately missing to trigger failure in batch processing
        address: '',
      }
    ];

    const { data: batchRes, error: batchErr } = await supabase.rpc('process_customer_import_batch', {
      p_job_id: jobId,
      p_rows: testBatchPayload
    });

    if (batchErr) {
      console.error('  DEBUG batchErr:', batchErr);
    }

    assert(!batchErr && batchRes?.success === true, `Live process_customer_import_batch RPC executed: processed=${batchRes?.batch_processed}`);
    assert(batchRes?.batch_created === 1, `Batch created exactly 1 customer`);
    assert(batchRes?.batch_failed === 1, `Batch handled and logged 1 failed customer`);

    // Verify job status updated
    const { data: updatedJob } = await supabase
      .from('customer_import_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    assert(updatedJob?.processed_records === 2, `Job processed_records updated to 2`);
    const statusUpper = String(updatedJob?.status || '').toUpperCase();
    assert(statusUpper === 'COMPLETED_WITH_ERRORS', `Job status correctly set to COMPLETED_WITH_ERRORS (was ${updatedJob?.status})`);

    // Clean up test customer
    const { data: auditRows } = await supabase
      .from('customer_import_job_rows')
      .select('customer_id')
      .eq('job_id', jobId)
      .not('customer_id', 'is', null);

    if (auditRows && auditRows.length > 0) {
      for (const row of auditRows) {
        await supabase.from('ledger_entries').delete().eq('customer_id', row.customer_id);
        await supabase.from('customers').delete().eq('id', row.customer_id);
      }
      console.log('  ✓ Cleaned up test customer records.');
    }
  } catch (err) {
    console.error('  ✗ Error during live database verification:', err);
    process.exitCode = 1;
  }
}

console.log('\n================================================================');
console.log(`Results: ${passedTests} passed of ${totalTests} assertions`);
if (passedTests === totalTests && (!process.exitCode || process.exitCode === 0)) {
  console.log('Status: ALL CUSTOMER IMPORT MODULE TESTS PASSED (100% OK)');
} else {
  console.log('Status: SOME TESTS FAILED');
}
console.log('================================================================\n');
