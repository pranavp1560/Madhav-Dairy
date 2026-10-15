import React, { useState, useRef, useMemo } from 'react';
import { useDairy } from '../../context/DairyContext';
import { customerImportService } from '../../services/customerImportService';
import { ValidationRow, ValidationReportSummary } from '../../types/dairy';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  UploadCloud,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  Users,
  RefreshCw,
  X,
  FileText,
  AlertCircle,
  PlayCircle,
  Sparkles,
} from 'lucide-react';

interface ImportCustomersViewProps {
  onBack: () => void;
  onGoToImportFeed: () => void;
}

export const ImportCustomersView: React.FC<ImportCustomersViewProps> = ({
  onBack,
  onGoToImportFeed,
}) => {
  const { retailers, salesChannels, refreshData, currentUser, addToast } = useDairy();

  // ---------------------------------------------------------------------------
  // Step 1 State: Download Template
  // ---------------------------------------------------------------------------
  const [isDownloadingBlank, setIsDownloadingBlank] = useState(false);
  const [isDownloadingData, setIsDownloadingData] = useState(false);

  // ---------------------------------------------------------------------------
  // Step 2 State: Validation
  // ---------------------------------------------------------------------------
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validatedRows, setValidatedRows] = useState<ValidationRow[] | null>(null);
  const [validationSummary, setValidationSummary] = useState<ValidationReportSummary | null>(null);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  const templateInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Step 3 State: Upload & Import
  // ---------------------------------------------------------------------------
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportValidatedRows, setReportValidatedRows] = useState<ValidationRow[] | null>(null);
  const [isParsingReport, setIsParsingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    jobId: string;
    jobNumber: string;
    currentBatch: number;
    totalBatches: number;
    processed: number;
    total: number;
    created: number;
    updated: number;
    failed: number;
  } | null>(null);

  const reportInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Handlers for Step 1: Download Template
  // ---------------------------------------------------------------------------
  const handleDownloadBlank = async () => {
    try {
      setIsDownloadingBlank(true);
      await customerImportService.downloadBlankTemplate();
      addToast('Blank customer template downloaded successfully!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to download template', 'error');
    } finally {
      setIsDownloadingBlank(false);
    }
  };

  const handleDownloadWithData = async () => {
    try {
      setIsDownloadingData(true);
      await customerImportService.downloadCustomersWithData(retailers);
      addToast(`Exported ${retailers.length} organization customers to template!`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to export customer data', 'error');
    } finally {
      setIsDownloadingData(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers for Step 2: Validate
  // ---------------------------------------------------------------------------
  const handleTemplateFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTemplateFile(file);
      setValidationError(null);
      setValidatedRows(null);
      setValidationSummary(null);
    }
  };

  const handleClearTemplateFile = () => {
    setTemplateFile(null);
    setValidationError(null);
    setValidatedRows(null);
    setValidationSummary(null);
    if (templateInputRef.current) {
      templateInputRef.current.value = '';
    }
  };

  const handleValidate = async () => {
    if (!templateFile) return;

    try {
      setIsValidating(true);
      setValidationError(null);

      // Parse uploaded file
      const rawRows = await customerImportService.parseUploadedFile(templateFile);

      if (rawRows.length === 0) {
        throw new Error('No valid customer records found in the uploaded file.');
      }

      // Run full in-depth validation against current organization database
      const result = customerImportService.validateCustomerRows(
        rawRows,
        retailers,
        salesChannels
      );

      setValidatedRows(result.rows);
      setValidationSummary(result.summary);

      // Automatically make these rows available for Step 3 as well
      setReportValidatedRows(result.rows);

      addToast(`Validation complete: ${result.summary.validRows} valid, ${result.summary.warningRows} warnings, ${result.summary.failedRows} failed.`, 'success');
    } catch (err: any) {
      setValidationError(err.message || 'Failed to validate customer file.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDownloadValidationReport = async () => {
    if (!validatedRows || !validationSummary) return;

    try {
      setIsDownloadingReport(true);
      await customerImportService.downloadValidationReport(validatedRows, validationSummary);
      addToast('Validation report downloaded successfully!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to download report', 'error');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers for Step 3: Upload & Import
  // ---------------------------------------------------------------------------
  const handleReportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReportFile(file);
      setReportError(null);

      try {
        setIsParsingReport(true);
        const rawRows = await customerImportService.parseUploadedFile(file);
        // Re-validate to ensure no tampering
        const result = customerImportService.validateCustomerRows(
          rawRows,
          retailers,
          salesChannels
        );
        setReportValidatedRows(result.rows);
        addToast(`Report loaded: ${result.summary.validRows + result.summary.warningRows} rows eligible for import.`, 'success');
      } catch (err: any) {
        setReportError(err.message || 'Failed to parse uploaded validation report.');
        setReportValidatedRows(null);
      } finally {
        setIsParsingReport(false);
      }
    }
  };

  const handleClearReportFile = () => {
    setReportFile(null);
    setReportError(null);
    if (reportInputRef.current) {
      reportInputRef.current.value = '';
    }
    // Revert to validated rows from Step 2 if available
    if (validatedRows) {
      setReportValidatedRows(validatedRows);
    } else {
      setReportValidatedRows(null);
    }
  };

  // Effective rows to import: only VALID and WARNING rows. Never FAILED rows.
  const rowsToImport = useMemo(() => {
    if (!reportValidatedRows) return [];
    return reportValidatedRows.filter((r: ValidationRow) => r.status === 'VALID' || r.status === 'WARNING');
  }, [reportValidatedRows]);

  const newCustomersCount = useMemo(() => {
    return rowsToImport.filter((r: ValidationRow) => r.action === 'CREATE').length;
  }, [rowsToImport]);

  const updateCustomersCount = useMemo(() => {
    return rowsToImport.filter((r: ValidationRow) => r.action === 'UPDATE').length;
  }, [rowsToImport]);

  const failedSkippedCount = useMemo(() => {
    if (!reportValidatedRows) return 0;
    return reportValidatedRows.filter((r: ValidationRow) => r.status === 'FAILED').length;
  }, [reportValidatedRows]);

  const handleStartImport = async () => {
    if (rowsToImport.length === 0) {
      setReportError('No valid rows found to import.');
      return;
    }

    try {
      setIsImporting(true);
      setReportError(null);

      const filename = reportFile?.name || templateFile?.name || 'Customer_Import.xlsx';
      const fileSize = reportFile?.size || templateFile?.size || 0;
      const userName = currentUser?.fullName || 'Staff Member';

      // 1. Create persistent import job on database server
      const jobInfo = await customerImportService.createImportJob({
        filename,
        fileSizeBytes: fileSize,
        totalRecords: rowsToImport.length,
        submittedByName: userName,
        metadata: {
          newCustomersExpected: newCustomersCount,
          updatesExpected: updateCustomersCount,
          failedSkipped: failedSkippedCount,
        }
      });

      // 2. Process records in batches of 25 on server
      const BATCH_SIZE = 25;
      const totalBatches = Math.ceil(rowsToImport.length / BATCH_SIZE);

      let processedSoFar = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalFailed = 0;

      setImportProgress({
        jobId: jobInfo.jobId,
        jobNumber: jobInfo.jobNumber,
        currentBatch: 1,
        totalBatches,
        processed: 0,
        total: rowsToImport.length,
        created: 0,
        updated: 0,
        failed: 0,
      });

      for (let b = 0; b < totalBatches; b++) {
        const batchRows = rowsToImport.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const batchResult = await customerImportService.processBatch(jobInfo.jobId, batchRows);

        processedSoFar += batchRows.length;
        totalCreated += batchResult.batch_created || 0;
        totalUpdated += batchResult.batch_updated || 0;
        totalFailed += batchResult.batch_failed || 0;

        setImportProgress({
          jobId: jobInfo.jobId,
          jobNumber: jobInfo.jobNumber,
          currentBatch: b + 1,
          totalBatches,
          processed: processedSoFar,
          total: rowsToImport.length,
          created: totalCreated,
          updated: totalUpdated,
          failed: totalFailed,
        });
      }

      // 3. Refresh live domain data
      await refreshData();
      addToast(`Import job ${jobInfo.jobNumber} completed successfully! Created: ${totalCreated}, Updated: ${totalUpdated}.`, 'success');
    } catch (err: any) {
      setReportError(err.message || 'Background import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
            title="Return to Customer Management"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Customer Management</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 mt-1">
              Import Customers
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Bulk upload, validate, and update your retail and wholesale customer database.
            </p>
          </div>
        </div>

        {/* Go to Import Feed Link in Top-Right Corner */}
        <button
          onClick={onGoToImportFeed}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-200"
        >
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Go to Import Feed</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* 3-Step Import Workflow Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* =================================================================== */}
        {/* STEP 1: DOWNLOAD TEMPLATE (Green Theme)                             */}
        {/* =================================================================== */}
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-white to-emerald-50/20">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                Step 1
              </span>
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>

            <h2 className="text-base font-bold text-slate-900">
              Download Template
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Blank template, or export every existing customer for bulk updates.
            </p>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Supported Customer Fields</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Business Name, Owner, 10-digit Phone, Address, Email, GSTIN, Area, City, Credit Limit, Channel & Opening Balance.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 mt-6">
            <button
              onClick={handleDownloadBlank}
              disabled={isDownloadingBlank}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDownloadingBlank ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Blank Template</span>
            </button>

            <button
              onClick={handleDownloadWithData}
              disabled={isDownloadingData || retailers.length === 0}
              className="w-full py-2.5 px-4 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              title="Export all customers from your organization"
            >
              {isDownloadingData ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <Users className="w-4 h-4 text-emerald-600" />
              )}
              <span>Download with Data ({retailers.length})</span>
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* STEP 2: VALIDATE (Blue Theme)                                       */}
        {/* =================================================================== */}
        <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5 flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-white to-blue-50/20">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-blue-100 text-blue-800 border border-blue-200">
                Step 2
              </span>
              <FileCheck className="w-5 h-5 text-blue-600" />
            </div>

            <h2 className="text-base font-bold text-slate-900">
              Validate
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Upload filled template to check for errors, formatting, and duplicates.
            </p>

            {/* Drop Zone */}
            <div
              onClick={() => templateInputRef.current?.click()}
              className={`mt-4 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                templateFile
                  ? 'border-blue-400 bg-blue-50/40'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/60'
              }`}
            >
              <input
                ref={templateInputRef}
                type="file"
                accept=".xlsx, .csv"
                onChange={handleTemplateFileSelect}
                className="hidden"
              />
              <UploadCloud className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                Click to select filled template
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Supported formats: .xlsx, .csv
              </p>
            </div>

            {/* Selected File Badge */}
            {templateFile && (
              <div className="mt-3 p-2.5 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-semibold text-slate-900 truncate">
                    {templateFile.name}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono-numbers">
                    ({(templateFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleClearTemplateFile();
                  }}
                  className="p-1 hover:bg-blue-100 rounded-md text-slate-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {validationError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Validation Summary Metrics */}
            {validationSummary && (
              <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-800">Validation Summary</span>
                  <span className="text-[11px] font-mono-numbers text-slate-500">
                    {validationSummary.totalRows} Total Rows
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="block text-emerald-800 font-black font-mono-numbers text-xs">
                      {validationSummary.validRows}
                    </span>
                    <span className="text-emerald-700">Valid</span>
                  </div>
                  <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="block text-amber-800 font-black font-mono-numbers text-xs">
                      {validationSummary.warningRows}
                    </span>
                    <span className="text-amber-700">Warnings</span>
                  </div>
                  <div className="p-1.5 bg-red-50 rounded-lg border border-red-100">
                    <span className="block text-red-800 font-black font-mono-numbers text-xs">
                      {validationSummary.failedRows}
                    </span>
                    <span className="text-red-700">Failed</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600">
                  <span>New to Create: <strong>{validationSummary.newCustomers}</strong></span>
                  <span>Existing to Update: <strong>{validationSummary.existingCustomers}</strong></span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2.5 mt-6">
            <button
              onClick={handleValidate}
              disabled={!templateFile || isValidating}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validating Data...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>Validate File</span>
                </>
              )}
            </button>

            {validationSummary && (
              <button
                onClick={handleDownloadValidationReport}
                disabled={isDownloadingReport}
                className="w-full py-2.5 px-4 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                {isDownloadingReport ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-blue-600" />
                )}
                <span>Download Validation Report</span>
              </button>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* STEP 3: UPLOAD & IMPORT (Green / Emerald Theme)                     */}
        {/* =================================================================== */}
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-white to-emerald-50/20">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                Step 3
              </span>
              <UploadCloud className="w-5 h-5 text-emerald-600" />
            </div>

            <h2 className="text-base font-bold text-slate-900">
              Upload & Import
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Execute validated records on the server with background job tracking.
            </p>

            {/* Drop Zone for Validation Report */}
            <div
              onClick={() => reportInputRef.current?.click()}
              className={`mt-4 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                reportFile
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-300 hover:border-emerald-400 bg-slate-50/60'
              }`}
            >
              <input
                ref={reportInputRef}
                type="file"
                accept=".xlsx, .csv"
                onChange={handleReportFileSelect}
                className="hidden"
              />
              <FileSpreadsheet className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                Upload Validation Report
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {validatedRows
                  ? 'Or use the validated data from Step 2 directly'
                  : 'Select the .xlsx report generated in Step 2'}
              </p>
            </div>

            {/* Selected Report File Badge */}
            {reportFile && (
              <div className="mt-3 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-900 truncate">
                    {reportFile.name}
                  </span>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleClearReportFile();
                  }}
                  className="p-1 hover:bg-emerald-100 rounded-md text-slate-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {reportError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{reportError}</span>
              </div>
            )}

            {/* Ready Confirmation Summary */}
            {rowsToImport.length > 0 && !isImporting && (
              <div className="mt-4 p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs space-y-1.5">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Ready to Import in Background</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  <strong>{newCustomersCount}</strong> new customers will be created.
                </p>
                <p className="text-[11px] text-emerald-800">
                  <strong>{updateCustomersCount}</strong> existing customers will be updated.
                </p>
                {failedSkippedCount > 0 && (
                  <p className="text-[10px] text-slate-500 italic">
                    Note: {failedSkippedCount} failed rows will be safely skipped.
                  </p>
                )}
              </div>
            )}

            {/* Live Progress Bar when importing */}
            {importProgress && (
              <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>Job {importProgress.jobNumber}</span>
                  <span className="font-mono-numbers text-emerald-700">
                    {Math.round((importProgress.processed / importProgress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.round((importProgress.processed / importProgress.total) * 100)}%`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-numbers">
                  <span>Batch {importProgress.currentBatch} of {importProgress.totalBatches}</span>
                  <span>{importProgress.processed} / {importProgress.total} records</span>
                </div>
                {importProgress.processed >= importProgress.total && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Completed
                    </span>
                    <button
                      onClick={onGoToImportFeed}
                      className="text-blue-600 hover:underline font-bold text-xs flex items-center gap-1"
                    >
                      <span>View in Feed</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2.5 mt-6">
            <button
              onClick={handleStartImport}
              disabled={rowsToImport.length === 0 || isImporting || isParsingReport}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Batches...</span>
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  <span>Import in Background</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
