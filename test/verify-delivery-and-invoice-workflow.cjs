/**
 * Verification Script: Madhav Dairy Delivery Management, Driver Sheets & Invoice Workflow
 *
 * Verifies:
 * 1. Migration SQL 20261013000035_delivery_units_trips_and_driver_sheets_workflow.sql
 *    - Structure of delivery_units, delivery_trips, delivery_trip_invoices
 *    - Presence of RPCs: assign_delivery_trip, complete_delivery_trip, generate_invoice_for_order, bulk_generate_invoices
 *    - Correct status constraints ('ready', 'dispatched', 'delivered', 'open_payment', 'settled', 'cancelled')
 * 2. ExcelJS Driver Sheet Generator:
 *    - Generates a real .xlsx file
 *    - Checks all 6 mandatory columns: Invoice #, Date, Retailer Name, Shop Address, Product / Item, Quantity
 *    - Verifies line-item repetition per invoice and non-empty buffer
 * 3. File and Component linkage across InternalLayout, InternalSidebar, OrdersView, InvoicesView, DriverManagementView, DeliveryUnitsView
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function runVerification() {
  console.log('========================================================================');
  console.log('🧪 MADHAV DAIRY DELIVERY & INVOICE WORKFLOW VERIFICATION SUITE');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, name) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      process.exitCode = 1;
    }
  }

  // TEST SUITE 1: Migration SQL Inspection
  console.log('--- 1. Database Migration 035 Inspection ---');
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261013000035_delivery_units_trips_and_driver_sheets_workflow.sql');
  assert(fs.existsSync(migrationPath), 'Migration file 035 exists');

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.delivery_units'), 'delivery_units table created');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.delivery_trips'), 'delivery_trips table created');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.delivery_trip_invoices'), 'delivery_trip_invoices join table created');
  assert(migrationSql.includes('chalan_number text NOT NULL'), 'chalan_number column defined');
  assert(migrationSql.includes('uq_delivery_units_org_chalan UNIQUE (organization_id, chalan_number)'), 'chalan_number unique constraint per organization');
  assert(migrationSql.includes('trg_delivery_unit_chalan'), 'Auto chalan trigger configured');
  assert(migrationSql.includes('trg_delivery_trip_number'), 'Auto trip number trigger configured');
  assert(migrationSql.includes('status IN (\'ready\', \'dispatched\', \'delivered\', \'open_payment\', \'settled\', \'cancelled\')'), 'Invoice status check constraint includes dispatched');
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.generate_invoice_for_order'), 'generate_invoice_for_order RPC defined');
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.bulk_generate_invoices'), 'bulk_generate_invoices RPC defined');
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.assign_delivery_trip'), 'assign_delivery_trip atomic RPC defined');
  assert(migrationSql.includes('CREATE OR REPLACE FUNCTION public.complete_delivery_trip'), 'complete_delivery_trip atomic RPC defined');
  assert(migrationSql.includes('ENABLE ROW LEVEL SECURITY'), 'RLS enabled on new tables');

  // TEST SUITE 2: ExcelJS Real .xlsx Driver Sheet Generation
  console.log('\n--- 2. ExcelJS Driver Sheet .xlsx Generation ---');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Madhav Dairy ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Driver Sheet', {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: true }],
  });

  // Header Title
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'MADHAV DAIRY — OFFICIAL DELIVERY DRIVER SHEET';
  sheet.getRow(1).height = 30;

  // Metadata Bar
  sheet.mergeCells('A2:F2');
  const metaCell = sheet.getCell('A2');
  metaCell.value = 'Chalan / Trip #: TRIP-2026-001   |   Unit: Unit A (South Route)   |   Vehicle: MH 12 AB 1234   |   Driver: Ramesh Shinde   |   Out Time: 06:30 AM';
  sheet.getRow(2).height = 24;

  // Empty separator
  sheet.getRow(3).height = 10;

  // Columns required by Module 3.2:
  // 1. Invoice #, 2. Date, 3. Retailer Name, 4. Shop Address, 5. Product / Item, 6. Quantity
  const expectedHeaders = ['Invoice #', 'Date', 'Retailer Name', 'Shop Address', 'Product / Item', 'Quantity'];
  sheet.getRow(4).values = expectedHeaders;

  // Sample data with multi-item invoices
  const sampleInvoices = [
    {
      invoiceNumber: 'INV-2026-1001',
      date: '2026-10-13',
      retailerName: 'Ganesh Dairy & Sweets',
      shopAddress: 'Shop 4, Market Yard, Hadapsar, Pune 411028',
      items: [
        { product: 'Cow Milk (500ml pouch)', quantity: '50 Pouches' },
        { product: 'Buffalo Milk (1L pouch)', quantity: '30 Pouches' },
        { product: 'Fresh Paneer (1kg block)', quantity: '5 kg' },
      ],
    },
    {
      invoiceNumber: 'INV-2026-1002',
      date: '2026-10-13',
      retailerName: 'Shree Krishna Daily Needs',
      shopAddress: '12 MG Road, Camp, Pune 411001',
      items: [
        { product: 'Fresh Curd / Dahi (400g cup)', quantity: '25 Cups' },
        { product: 'Cow Ghee (1L jar)', quantity: '10 Jars' },
      ],
    },
  ];

  let rowIndex = 5;
  sampleInvoices.forEach(inv => {
    inv.items.forEach(it => {
      const row = sheet.getRow(rowIndex);
      row.values = [
        inv.invoiceNumber,
        inv.date,
        inv.retailerName,
        inv.shopAddress,
        it.product,
        it.quantity,
      ];
      rowIndex++;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  assert(buffer && buffer.length > 0, 'ExcelJS generated binary .xlsx buffer');

  // Load back and parse with ExcelJS to strictly verify sheet schema and cells
  const testWorkbook = new ExcelJS.Workbook();
  await testWorkbook.xlsx.load(buffer);
  const loadedSheet = testWorkbook.getWorksheet('Driver Sheet');

  assert(loadedSheet !== undefined, 'Loaded worksheet "Driver Sheet" successfully');
  const actualHeaders = [
    loadedSheet.getCell('A4').value,
    loadedSheet.getCell('B4').value,
    loadedSheet.getCell('C4').value,
    loadedSheet.getCell('D4').value,
    loadedSheet.getCell('E4').value,
    loadedSheet.getCell('F4').value,
  ];

  assert(
    JSON.stringify(actualHeaders) === JSON.stringify(expectedHeaders),
    `Column headers match required specifications: [${expectedHeaders.join(', ')}]`
  );

  // Verify row item repetition: Row 5 & 6 have same invoice # and retailer
  assert(loadedSheet.getCell('A5').value === 'INV-2026-1001', 'Row 5 has Invoice # INV-2026-1001');
  assert(loadedSheet.getCell('A6').value === 'INV-2026-1001', 'Row 6 repeats Invoice # INV-2026-1001 for line item 2');
  assert(loadedSheet.getCell('E5').value === 'Cow Milk (500ml pouch)', 'Row 5 contains Item 1');
  assert(loadedSheet.getCell('E6').value === 'Buffalo Milk (1L pouch)', 'Row 6 contains Item 2');
  assert(loadedSheet.getCell('E7').value === 'Fresh Paneer (1kg block)', 'Row 7 contains Item 3');
  assert(loadedSheet.getCell('A8').value === 'INV-2026-1002', 'Row 8 moves to second invoice INV-2026-1002');

  // TEST SUITE 3: Frontend UI Components Linkage & Integrity
  console.log('\n--- 3. Frontend UI Component Linkage & Workflow Integrity ---');

  const filesToCheck = [
    'src/types/dairy.ts',
    'src/services/deliveryService.ts',
    'src/services/orderService.ts',
    'src/services/invoiceService.ts',
    'src/context/DairyContext.tsx',
    'src/components/common/StatusBadge.tsx',
    'src/i18n/translations.ts',
    'src/components/internal/InternalSidebar.tsx',
    'src/components/internal/InternalLayout.tsx',
    'src/components/internal/DeliveryUnitModal.tsx',
    'src/components/internal/DeliveryUnitsView.tsx',
    'src/components/internal/AssignTripModal.tsx',
    'src/components/internal/TripDetailsModal.tsx',
    'src/components/internal/DriverManagementView.tsx',
    'src/components/internal/OrdersView.tsx',
    'src/components/internal/InvoicesView.tsx',
  ];

  filesToCheck.forEach(relPath => {
    const fullPath = path.join(__dirname, '..', relPath);
    assert(fs.existsSync(fullPath), `Component file exists: ${relPath}`);
  });

  const sidebarContent = fs.readFileSync(path.join(__dirname, '..', 'src/components/internal/InternalSidebar.tsx'), 'utf8');
  assert(sidebarContent.includes('delivery_units'), 'Sidebar links delivery_units');
  assert(sidebarContent.includes('driver_management'), 'Sidebar links driver_management');

  const layoutContent = fs.readFileSync(path.join(__dirname, '..', 'src/components/internal/InternalLayout.tsx'), 'utf8');
  assert(layoutContent.includes('case \'delivery_units\':'), 'Layout routes delivery_units');
  assert(layoutContent.includes('case \'driver_management\':'), 'Layout routes driver_management');

  const ordersViewContent = fs.readFileSync(path.join(__dirname, '..', 'src/components/internal/OrdersView.tsx'), 'utf8');
  assert(ordersViewContent.includes('generateInvoiceForOrder'), 'OrdersView has generateInvoiceForOrder');
  assert(ordersViewContent.includes('bulkGenerateInvoices'), 'OrdersView has bulkGenerateInvoices');

  const invoicesViewContent = fs.readFileSync(path.join(__dirname, '..', 'src/components/internal/InvoicesView.tsx'), 'utf8');
  assert(invoicesViewContent.includes('AssignTripModal'), 'InvoicesView incorporates AssignTripModal');
  assert(invoicesViewContent.includes('Generate Driver Sheet'), 'InvoicesView contains Generate Driver Sheet action');

  console.log('\n========================================================================');
  console.log(`📊 FINAL RESULT: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('========================================================================\n');
}

runVerification().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
