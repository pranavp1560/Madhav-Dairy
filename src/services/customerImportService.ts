import ExcelJS from 'exceljs';
import { supabase } from '../lib/supabase';
import {
  Retailer,
  SalesChannel,
  CustomerImportJob,
  CustomerImportRowResult,
  ValidationRow,
  ValidationReportSummary,
} from '../types/dairy';
import { getEffectiveOrgId } from './orgService';

// Formula injection protection helper
export function sanitizeCellValue(val: any): any {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
      return `'${val}`;
    }
  }
  return val;
}

// Download helper for browser
function downloadBufferAsFile(buffer: ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const customerImportService = {
  /**
   * 1. Generate & Download Blank Customer Template (.xlsx)
   */
  async downloadBlankTemplate(): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Madhav Dairy ERP';
    workbook.created = new Date();

    // Sheet 1: Customers Data Entry
    const sheet = workbook.addWorksheet('Customers', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = [
      { header: 'Customer ID (for updates)', key: 'customerId', width: 28 },
      { header: 'Business Name *', key: 'businessName', width: 28 },
      { header: 'Owner Name *', key: 'ownerName', width: 22 },
      { header: 'Mobile Number *', key: 'mobile', width: 18 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Address *', key: 'address', width: 32 },
      { header: 'Area / Region', key: 'area', width: 20 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'State', key: 'state', width: 18 },
      { header: 'Pincode', key: 'pincode', width: 14 },
      { header: 'GSTIN', key: 'gstin', width: 20 },
      { header: 'Credit Limit (₹)', key: 'creditLimit', width: 18 },
      { header: 'Sales Channel', key: 'salesChannelName', width: 18 },
      { header: 'Opening Balance (₹)', key: 'openingBalance', width: 20 },
    ];

    // Style Header Row (Green Theme matching Step 1)
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF059669' } // Emerald-600
      };
      cell.font = {
        name: 'Segoe UI',
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF047857' } },
        bottom: { style: 'medium', color: { argb: 'FF047857' } },
        left: { style: 'thin', color: { argb: 'FF10B981' } },
        right: { style: 'thin', color: { argb: 'FF10B981' } },
      };
    });

    // Sample Instruction Data Row
    const sampleRow = sheet.addRow({
      customerId: '', // Blank for new
      businessName: 'Mahalaxmi Dairy & Sweets (Example)',
      ownerName: 'Ramesh Patil',
      mobile: '9876543210',
      email: 'ramesh.dairy@example.com',
      address: 'Shop 4, Gandhi Chowk, Main Road',
      area: 'Kothrud',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411038',
      gstin: '27AAAAA0000A1Z5',
      creditLimit: 50000,
      salesChannelName: 'Wholesale',
      openingBalance: 0,
    });
    sampleRow.font = { italic: true, color: { argb: 'FF6B7280' }, size: 10 };

    // Sheet 2: Instructions
    const infoSheet = workbook.addWorksheet('Instructions');
    infoSheet.columns = [
      { header: 'Field Name', key: 'field', width: 25 },
      { header: 'Required?', key: 'required', width: 15 },
      { header: 'Format & Notes', key: 'notes', width: 55 },
    ];

    const infoHeader = infoSheet.getRow(1);
    infoHeader.height = 25;
    infoHeader.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    const instructions = [
      { field: 'Customer ID', required: 'Optional', notes: 'Leave blank to create a NEW customer. Keep unchanged if doing bulk updates.' },
      { field: 'Business Name', required: 'REQUIRED', notes: 'Full registered trade or retail store name.' },
      { field: 'Owner Name', required: 'REQUIRED', notes: 'Proprietor or primary contact person name.' },
      { field: 'Mobile Number', required: 'REQUIRED', notes: 'Valid 10-digit mobile number (e.g. 9876543210).' },
      { field: 'Email', required: 'Optional', notes: 'Valid email format for invoices and notifications.' },
      { field: 'Address', required: 'REQUIRED', notes: 'Full shop or delivery address for driver routing.' },
      { field: 'Area / Region', required: 'Optional', notes: 'Locality or sub-area (e.g. Kothrud, Hadapsar).' },
      { field: 'City', required: 'Optional', notes: 'Defaults to Pune if left blank.' },
      { field: 'State', required: 'Optional', notes: 'Defaults to Maharashtra if left blank.' },
      { field: 'Pincode', required: 'Optional', notes: '6-digit Indian postal code.' },
      { field: 'GSTIN', required: 'Optional', notes: '15-character GST identification number (e.g. 27ABCDE1234F1Z5).' },
      { field: 'Credit Limit (₹)', required: 'Optional', notes: 'Numeric credit threshold. Defaults to ₹50,000.' },
      { field: 'Sales Channel', required: 'Optional', notes: 'Wholesale, Retail, Institution, or Modern Trade. Defaults to Wholesale.' },
      { field: 'Opening Balance (₹)', required: 'Optional', notes: 'Initial debit balance to carry forward into customer ledger.' },
    ];

    instructions.forEach(item => {
      infoSheet.addRow(item);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBufferAsFile(
      buffer,
      'Madhav_Dairy_Customer_Template.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  },

  /**
   * 2. Download Template Populated with Existing Organization Customers
   */
  async downloadCustomersWithData(customers: Retailer[]): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Madhav Dairy ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Customers', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = [
      { header: 'Customer ID (for updates)', key: 'customerId', width: 36 },
      { header: 'Business Name *', key: 'businessName', width: 28 },
      { header: 'Owner Name *', key: 'ownerName', width: 22 },
      { header: 'Mobile Number *', key: 'mobile', width: 18 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Address *', key: 'address', width: 32 },
      { header: 'Area / Region', key: 'area', width: 20 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'State', key: 'state', width: 18 },
      { header: 'Pincode', key: 'pincode', width: 14 },
      { header: 'GSTIN', key: 'gstin', width: 20 },
      { header: 'Credit Limit (₹)', key: 'creditLimit', width: 18 },
      { header: 'Sales Channel', key: 'salesChannelName', width: 18 },
      { header: 'Opening Balance (₹)', key: 'openingBalance', width: 20 },
    ];

    // Style Header
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF059669' }
      };
      cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Populate data safely with formula injection protection
    customers.forEach(cust => {
      sheet.addRow({
        customerId: sanitizeCellValue(cust.id),
        businessName: sanitizeCellValue(cust.businessName),
        ownerName: sanitizeCellValue(cust.ownerName),
        mobile: sanitizeCellValue(cust.mobile),
        email: sanitizeCellValue(cust.email || ''),
        address: sanitizeCellValue(cust.address),
        area: sanitizeCellValue(cust.area || ''),
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '',
        gstin: sanitizeCellValue(cust.gstin || ''),
        creditLimit: cust.creditLimit || 50000,
        salesChannelName: sanitizeCellValue(cust.salesChannelName || 'Wholesale'),
        openingBalance: 0,
      });
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBufferAsFile(
      buffer,
      `Madhav_Dairy_Customers_Export_${todayStr}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  },

  /**
   * 3. Parse Uploaded File (.xlsx or .csv)
   */
  async parseUploadedFile(file: File): Promise<any[]> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx') {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const sheet = workbook.worksheets[0];
      if (!sheet || sheet.rowCount < 2) {
        throw new Error('Uploaded Excel file contains no data rows.');
      }

      // Map headers from row 1
      const headerMap: Record<number, string> = {};
      const headerRow = sheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const text = String(cell.value || '').toLowerCase().trim();
        if (text.includes('customer id') || text.includes('id')) headerMap[colNumber] = 'customerId';
        else if (text.includes('business') || text.includes('store')) headerMap[colNumber] = 'businessName';
        else if (text.includes('owner') || text.includes('proprietor')) headerMap[colNumber] = 'ownerName';
        else if (text.includes('mobile') || text.includes('phone')) headerMap[colNumber] = 'mobile';
        else if (text.includes('email')) headerMap[colNumber] = 'email';
        else if (text.includes('address')) headerMap[colNumber] = 'address';
        else if (text.includes('area') || text.includes('region')) headerMap[colNumber] = 'area';
        else if (text.includes('city')) headerMap[colNumber] = 'city';
        else if (text.includes('state')) headerMap[colNumber] = 'state';
        else if (text.includes('pincode') || text.includes('pin')) headerMap[colNumber] = 'pincode';
        else if (text.includes('gst')) headerMap[colNumber] = 'gstin';
        else if (text.includes('credit')) headerMap[colNumber] = 'creditLimit';
        else if (text.includes('channel') || text.includes('type')) headerMap[colNumber] = 'salesChannelName';
        else if (text.includes('opening') || text.includes('balance')) headerMap[colNumber] = 'openingBalance';
      });

      const rows: any[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const rowData: Record<string, any> = {};
        let hasContent = false;

        row.eachCell((cell, colNumber) => {
          const key = headerMap[colNumber];
          if (key) {
            let val = cell.value;
            // Handle formula objects if any
            if (val && typeof val === 'object' && 'result' in val) {
              val = (val as any).result;
            }
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              hasContent = true;
              rowData[key] = String(val).trim();
            }
          }
        });

        // Skip instruction row if user didn't delete it
        if (hasContent) {
          if (String(rowData.businessName || '').includes('(Example)')) {
            return;
          }
          rows.push({ ...rowData, rowIndex: rowNumber });
        }
      });

      return rows;
    } else if (ext === 'csv') {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('CSV file contains no data rows.');
      }

      // Simple CSV split
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const headerKeys = headers.map(text => {
        if (text.includes('customer id') || text.includes('id')) return 'customerId';
        if (text.includes('business') || text.includes('store')) return 'businessName';
        if (text.includes('owner') || text.includes('proprietor')) return 'ownerName';
        if (text.includes('mobile') || text.includes('phone')) return 'mobile';
        if (text.includes('email')) return 'email';
        if (text.includes('address')) return 'address';
        if (text.includes('area') || text.includes('region')) return 'area';
        if (text.includes('city')) return 'city';
        if (text.includes('state')) return 'state';
        if (text.includes('pincode') || text.includes('pin')) return 'pincode';
        if (text.includes('gst')) return 'gstin';
        if (text.includes('credit')) return 'creditLimit';
        if (text.includes('channel') || text.includes('type')) return 'salesChannelName';
        if (text.includes('opening') || text.includes('balance')) return 'openingBalance';
        return 'unknown';
      });

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        const rowData: Record<string, any> = {};
        let hasContent = false;
        parts.forEach((val, colIdx) => {
          const key = headerKeys[colIdx];
          if (key && key !== 'unknown' && val) {
            hasContent = true;
            rowData[key] = val;
          }
        });

        if (hasContent && !String(rowData.businessName || '').includes('(Example)')) {
          rows.push({ ...rowData, rowIndex: i + 1 });
        }
      }
      return rows;
    } else {
      throw new Error(`Unsupported file format ".${ext}". Please upload an Excel (.xlsx) or CSV (.csv) file.`);
    }
  },

  /**
   * 4. Complete In-Memory Validation & Conflict Detection
   */
  validateCustomerRows(
    rawRows: any[],
    existingCustomers: Retailer[],
    salesChannels: SalesChannel[]
  ): { rows: ValidationRow[]; summary: ValidationReportSummary } {
    const validatedRows: ValidationRow[] = [];
    const seenMobilesInFile = new Set<string>();
    const seenIdsInFile = new Set<string>();

    let validCount = 0;
    let warningCount = 0;
    let failedCount = 0;
    let newCount = 0;
    let updateCount = 0;

    rawRows.forEach(raw => {
      const errors: string[] = [];
      const warnings: string[] = [];

      const bName = String(raw.businessName || '').trim();
      const oName = String(raw.ownerName || '').trim();
      let mobile = String(raw.mobile || '').replace(/[^0-9]/g, '');
      if (mobile.length === 12 && mobile.startsWith('91')) {
        mobile = mobile.substring(2);
      }
      if (mobile.length === 11 && mobile.startsWith('0')) {
        mobile = mobile.substring(1);
      }

      const email = String(raw.email || '').trim();
      const address = String(raw.address || '').trim();
      const area = String(raw.area || '').trim();
      const city = String(raw.city || '').trim() || 'Pune';
      const state = String(raw.state || '').trim() || 'Maharashtra';
      const pincode = String(raw.pincode || '').replace(/[^0-9]/g, '');
      const gstin = String(raw.gstin || '').trim().toUpperCase();
      const creditLimit = raw.creditLimit !== undefined ? Number(raw.creditLimit) : 50000;
      const salesChannelName = String(raw.salesChannelName || '').trim();
      const openingBalance = raw.openingBalance !== undefined ? Number(raw.openingBalance) : 0;
      const customerId = String(raw.customerId || '').trim();

      // 1. Mandatory Field Checks
      if (!bName) errors.push('Business Name is required.');
      if (!oName) errors.push('Owner Name is required.');
      if (!mobile) {
        errors.push('Mobile Number is required.');
      } else if (mobile.length !== 10) {
        errors.push(`Invalid phone number "${raw.mobile}". Must be 10 digits.`);
      }
      if (!address) errors.push('Address is required.');

      // 2. Email validation
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Invalid email address "${email}".`);
      }

      // 3. GSTIN validation (15 alphanumeric characters)
      if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
        warnings.push(`GSTIN "${gstin}" does not match standard 15-character GST format.`);
      }

      // 4. Numeric value validations
      if (isNaN(creditLimit) || creditLimit < 0) {
        errors.push('Credit Limit must be a non-negative number.');
      }
      if (isNaN(openingBalance) || openingBalance < 0) {
        errors.push('Opening Balance must be a non-negative number.');
      }

      // 5. In-File Duplicate Checks
      if (mobile && seenMobilesInFile.has(mobile)) {
        errors.push(`Duplicate mobile number "${mobile}" found multiple times within this uploaded file.`);
      } else if (mobile) {
        seenMobilesInFile.add(mobile);
      }

      if (customerId && seenIdsInFile.has(customerId.toLowerCase())) {
        errors.push(`Duplicate Customer ID "${customerId}" found in multiple rows within this file.`);
      } else if (customerId) {
        seenIdsInFile.add(customerId.toLowerCase());
      }

      // 6. Match Existing Customer (by Customer ID or Mobile)
      let matchedCust: Retailer | undefined;
      if (customerId) {
        matchedCust = existingCustomers.find(
          c => c.id.toLowerCase() === customerId.toLowerCase() ||
               (c.customerCode && c.customerCode.toLowerCase() === customerId.toLowerCase())
        );
        if (!matchedCust) {
          warnings.push(`Specified Customer ID "${customerId}" was not found. Record will be created as a new customer.`);
        }
      }

      if (!matchedCust && mobile) {
        matchedCust = existingCustomers.find(c => c.mobile === mobile);
      }

      // 7. Channel check
      if (salesChannelName) {
        const foundCh = salesChannels.find(
          c => c.name.toLowerCase() === salesChannelName.toLowerCase() ||
               c.code.toLowerCase() === salesChannelName.toLowerCase()
        );
        if (!foundCh) {
          warnings.push(`Sales Channel "${salesChannelName}" not recognized; will default to Wholesale.`);
        }
      }

      // 8. Action & Status Determination
      let action: 'CREATE' | 'UPDATE' | 'SKIP' = 'CREATE';
      let status: 'VALID' | 'WARNING' | 'FAILED' = 'VALID';

      if (errors.length > 0) {
        status = 'FAILED';
        action = 'SKIP';
        failedCount++;
      } else if (warnings.length > 0) {
        status = 'WARNING';
        warningCount++;
        if (matchedCust) {
          action = 'UPDATE';
          updateCount++;
        } else {
          action = 'CREATE';
          newCount++;
        }
      } else {
        status = 'VALID';
        validCount++;
        if (matchedCust) {
          action = 'UPDATE';
          updateCount++;
        } else {
          action = 'CREATE';
          newCount++;
        }
      }

      validatedRows.push({
        rowIndex: raw.rowIndex,
        status,
        action,
        matchedCustomerId: matchedCust?.id,
        customerCode: matchedCust?.customerCode,
        businessName: bName,
        ownerName: oName,
        mobile,
        email,
        address,
        area,
        city,
        state,
        pincode,
        gstin,
        creditLimit,
        salesChannelName,
        openingBalance,
        validationErrors: errors,
        validationWarnings: warnings,
        originalData: raw,
      });
    });

    return {
      rows: validatedRows,
      summary: {
        totalRows: rawRows.length,
        validRows: validCount,
        warningRows: warningCount,
        failedRows: failedCount,
        newCustomers: newCount,
        existingCustomers: updateCount,
      }
    };
  },

  /**
   * 5. Generate & Download Validation Report (.xlsx)
   */
  async downloadValidationReport(
    validatedRows: ValidationRow[],
    summary: ValidationReportSummary
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Madhav Dairy ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Validation Report', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = [
      { header: 'Import Status', key: 'status', width: 16 },
      { header: 'Action', key: 'action', width: 14 },
      { header: 'Validation Errors', key: 'errors', width: 35 },
      { header: 'Validation Warnings', key: 'warnings', width: 35 },
      { header: 'Matched Customer ID', key: 'matchedCustomerId', width: 34 },
      { header: 'Customer ID (for updates)', key: 'customerId', width: 28 },
      { header: 'Business Name *', key: 'businessName', width: 28 },
      { header: 'Owner Name *', key: 'ownerName', width: 22 },
      { header: 'Mobile Number *', key: 'mobile', width: 18 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Address *', key: 'address', width: 32 },
      { header: 'Area / Region', key: 'area', width: 20 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'State', key: 'state', width: 18 },
      { header: 'Pincode', key: 'pincode', width: 14 },
      { header: 'GSTIN', key: 'gstin', width: 20 },
      { header: 'Credit Limit (₹)', key: 'creditLimit', width: 18 },
      { header: 'Sales Channel', key: 'salesChannelName', width: 18 },
      { header: 'Opening Balance (₹)', key: 'openingBalance', width: 20 },
    ];

    // Header styling (Blue theme matching Step 2 Validate)
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' } // Blue-600
      };
      cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Populate validated rows with colored indicators
    validatedRows.forEach(row => {
      const addedRow = sheet.addRow({
        status: row.status,
        action: row.action,
        errors: row.validationErrors.join(' | '),
        warnings: row.validationWarnings.join(' | '),
        matchedCustomerId: row.matchedCustomerId || '',
        customerId: sanitizeCellValue(row.originalData?.customerId || ''),
        businessName: sanitizeCellValue(row.businessName),
        ownerName: sanitizeCellValue(row.ownerName),
        mobile: sanitizeCellValue(row.mobile),
        email: sanitizeCellValue(row.email || ''),
        address: sanitizeCellValue(row.address),
        area: sanitizeCellValue(row.area || ''),
        city: sanitizeCellValue(row.city || 'Pune'),
        state: sanitizeCellValue(row.state || 'Maharashtra'),
        pincode: sanitizeCellValue(row.pincode || ''),
        gstin: sanitizeCellValue(row.gstin || ''),
        creditLimit: row.creditLimit || 50000,
        salesChannelName: sanitizeCellValue(row.salesChannelName || 'Wholesale'),
        openingBalance: row.openingBalance || 0,
      });

      // Highlight status cell
      const statusCell = addedRow.getCell(1);
      if (row.status === 'VALID') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Light green
        statusCell.font = { bold: true, color: { argb: 'FF065F46' } };
      } else if (row.status === 'WARNING') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Light yellow
        statusCell.font = { bold: true, color: { argb: 'FF92400E' } };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Light red
        statusCell.font = { bold: true, color: { argb: 'FF991B1B' } };
      }
    });

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Count', key: 'count', width: 15 },
    ];
    summarySheet.addRow({ metric: 'Total Records Evaluated', count: summary.totalRows });
    summarySheet.addRow({ metric: 'Ready to Import (VALID)', count: summary.validRows });
    summarySheet.addRow({ metric: 'Importable with Review (WARNING)', count: summary.warningRows });
    summarySheet.addRow({ metric: 'Rejected / Cannot Import (FAILED)', count: summary.failedRows });
    summarySheet.addRow({ metric: 'New Customers to Create', count: summary.newCustomers });
    summarySheet.addRow({ metric: 'Existing Customers to Update', count: summary.existingCustomers });

    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:T]/g, '').substring(0, 12);
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBufferAsFile(
      buffer,
      `Customer_Validation_Report_${dateStr}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  },

  /**
   * 6. Server RPC: Create Persistent Background Job
   */
  async createImportJob(params: {
    filename: string;
    fileSizeBytes: number;
    totalRecords: number;
    submittedByName?: string;
    metadata?: any;
  }): Promise<{ jobId: string; jobNumber: string }> {
    const { data, error } = await supabase.rpc('create_customer_import_job', {
      p_filename: params.filename,
      p_file_size: params.fileSizeBytes,
      p_total_records: params.totalRecords,
      p_submitted_by_name: params.submittedByName || 'Staff Member',
      p_metadata: params.metadata || {},
    });

    if (error) {
      console.error('Failed to create import job:', error);
      throw new Error(error.message || 'Failed to initialize background import job.');
    }

    return {
      jobId: data.job_id,
      jobNumber: data.job_number,
    };
  },

  /**
   * 7. Server RPC: Process Batch of Rows Atomically
   */
  async processBatch(jobId: string, rows: ValidationRow[]): Promise<any> {
    const payload = rows.map(r => ({
      row_index: r.rowIndex,
      action: r.action.toLowerCase(),
      matched_customer_id: r.matchedCustomerId || null,
      business_name: r.businessName,
      owner_name: r.ownerName,
      mobile: r.mobile,
      email: r.email || null,
      address: r.address,
      area: r.area || null,
      city: r.city || 'Pune',
      state: r.state || 'Maharashtra',
      pincode: r.pincode || null,
      gstin: r.gstin || null,
      credit_limit: r.creditLimit || 50000,
      sales_channel_name: r.salesChannelName || null,
      opening_balance: r.openingBalance || 0,
    }));

    const { data, error } = await supabase.rpc('process_customer_import_batch', {
      p_job_id: jobId,
      p_rows: payload,
    });

    if (error) {
      console.error('Batch processing error:', error);
      throw new Error(error.message || 'Failed to process import batch.');
    }

    return data;
  },

  /**
   * 8. Fetch All Import Jobs (For Import Feed)
   */
  async fetchImportJobs(): Promise<CustomerImportJob[]> {
    const orgId = await getEffectiveOrgId();

    const { data, error } = await supabase
      .from('customer_import_jobs')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching import jobs:', error);
      throw error;
    }

    return (data || []).map((row: any): CustomerImportJob => ({
      id: row.id,
      organizationId: row.organization_id,
      jobNumber: row.job_number,
      filename: row.filename,
      fileSizeBytes: Number(row.file_size_bytes || 0),
      submittedById: row.submitted_by_id || undefined,
      submittedByName: row.submitted_by_name || 'Staff Member',
      totalRecords: Number(row.total_records || 0),
      processedRecords: Number(row.processed_records || 0),
      successfulRecords: Number(row.successful_records || 0),
      updatedRecords: Number(row.updated_records || 0),
      failedRecords: Number(row.failed_records || 0),
      status: row.status,
      errorMessage: row.error_message || undefined,
      summaryMetadata: row.summary_metadata || {},
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
      updatedAt: row.updated_at,
    }));
  },

  /**
   * 9. Fetch Row-level Audit Log for a Specific Job
   */
  async fetchJobRows(jobId: string): Promise<CustomerImportRowResult[]> {
    const { data, error } = await supabase
      .from('customer_import_job_rows')
      .select('*')
      .eq('job_id', jobId)
      .order('row_index', { ascending: true });

    if (error) {
      console.warn('Error fetching job rows:', error);
      throw error;
    }

    return (data || []).map((row: any): CustomerImportRowResult => ({
      id: row.id,
      jobId: row.job_id,
      rowIndex: row.row_index,
      action: row.action,
      customerId: row.customer_id || undefined,
      businessName: row.business_name,
      ownerName: row.owner_name || undefined,
      mobile: row.mobile || undefined,
      email: row.email || undefined,
      address: row.address || undefined,
      area: row.area || undefined,
      city: row.city || undefined,
      state: row.state || undefined,
      pincode: row.pincode || undefined,
      gstin: row.gstin || undefined,
      creditLimit: row.credit_limit ? Number(row.credit_limit) : undefined,
      salesChannelName: row.sales_channel_name || undefined,
      status: row.status,
      errorMessages: row.error_messages || [],
      warningMessages: row.warning_messages || [],
      createdAt: row.created_at,
    }));
  },

  /**
   * 10. Generate Final Execution Result Report (.xlsx)
   */
  async downloadJobResultReport(job: CustomerImportJob, rows: CustomerImportRowResult[]): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Madhav Dairy ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Execution Results', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = [
      { header: 'Row #', key: 'rowIndex', width: 10 },
      { header: 'Result Status', key: 'status', width: 16 },
      { header: 'Action', key: 'action', width: 14 },
      { header: 'Customer ID', key: 'customerId', width: 34 },
      { header: 'Business Name', key: 'businessName', width: 28 },
      { header: 'Owner Name', key: 'ownerName', width: 22 },
      { header: 'Mobile', key: 'mobile', width: 18 },
      { header: 'Address', key: 'address', width: 32 },
      { header: 'Errors / Failure Reason', key: 'errors', width: 35 },
      { header: 'Warnings', key: 'warnings', width: 30 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    rows.forEach(r => {
      sheet.addRow({
        rowIndex: r.rowIndex,
        status: r.status.toUpperCase(),
        action: r.action.toUpperCase(),
        customerId: r.customerId || '',
        businessName: r.businessName,
        ownerName: r.ownerName || '',
        mobile: r.mobile || '',
        address: r.address || '',
        errors: r.errorMessages.join(' | '),
        warnings: r.warningMessages.join(' | '),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBufferAsFile(
      buffer,
      `Import_Result_${job.jobNumber}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  }
};
