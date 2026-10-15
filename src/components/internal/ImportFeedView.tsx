import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDairy } from '../../context/DairyContext';
import { customerImportService } from '../../services/customerImportService';
import { CustomerImportJob, CustomerImportJobStatus, CustomerImportRowResult } from '../../types/dairy';
import { Modal } from '../common/Modal';
import {
  ArrowLeft,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  Users,
  Eye,
  Filter,
  Check,
  Building,
  User,
  Phone,
  AlertCircle,
  BarChart3,
  ListFilter,
} from 'lucide-react';

interface ImportFeedViewProps {
  onBack: () => void;
  onOpenImportCustomers: () => void;
}

export const ImportFeedView: React.FC<ImportFeedViewProps> = ({
  onBack,
  onOpenImportCustomers,
}) => {
  const { addToast } = useDairy();

  const [jobs, setJobs] = useState<CustomerImportJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Job Details Modal State
  const [selectedJob, setSelectedJob] = useState<CustomerImportJob | null>(null);
  const [jobRows, setJobRows] = useState<CustomerImportRowResult[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalStatusFilter, setModalStatusFilter] = useState<string>('ALL');
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  // Load jobs from server
  const loadJobs = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const data = await customerImportService.fetchImportJobs();
      setJobs(data);
    } catch (err: any) {
      console.error('Failed to load import jobs:', err);
      if (!isSilent) {
        addToast(err.message || 'Unable to fetch customer import history.', 'error');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Auto-refresh when any job is actively PROCESSING or QUEUED
  useEffect(() => {
    const hasActiveJobs = jobs.some(j => {
      const st = String(j.status || '').toUpperCase();
      return st === 'PROCESSING' || st === 'QUEUED';
    });
    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      loadJobs(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [jobs, loadJobs]);

  // Open Details Modal & fetch job rows
  const handleOpenDetails = async (job: CustomerImportJob) => {
    setSelectedJob(job);
    setIsLoadingRows(true);
    setModalSearch('');
    setModalStatusFilter('ALL');
    try {
      const rows = await customerImportService.fetchJobRows(job.id);
      setJobRows(rows);
    } catch (err: any) {
      console.error('Failed to fetch job audit rows:', err);
      addToast('Could not load row-level results for this import job.', 'error');
      setJobRows([]);
    } finally {
      setIsLoadingRows(false);
    }
  };

  // Download Execution Result Report (.xlsx)
  const handleDownloadResultReport = async (job: CustomerImportJob) => {
    setIsDownloadingReport(true);
    try {
      let rowsToExport = jobRows;
      if (!selectedJob || selectedJob.id !== job.id || rowsToExport.length === 0) {
        rowsToExport = await customerImportService.fetchJobRows(job.id);
      }
      await customerImportService.downloadJobResultReport(job, rowsToExport);
      addToast(`Execution result report for ${job.jobNumber} downloaded successfully.`, 'success');
    } catch (err: any) {
      console.error('Failed to download report:', err);
      addToast(err.message || 'Could not generate report file.', 'error');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  // Metrics summary
  const totalJobsCount = jobs.length;
  const totalCreatedCount = useMemo(() => jobs.reduce((acc, j) => acc + (j.successfulRecords || 0), 0), [jobs]);
  const totalUpdatedCount = useMemo(() => jobs.reduce((acc, j) => acc + (j.updatedRecords || 0), 0), [jobs]);
  const totalFailedCount = useMemo(() => jobs.reduce((acc, j) => acc + (j.failedRecords || 0), 0), [jobs]);
  const activeJobsCount = useMemo(() => jobs.filter(j => {
    const s = String(j.status || '').toUpperCase();
    return s === 'PROCESSING' || s === 'QUEUED';
  }).length, [jobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(j => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        j.jobNumber.toLowerCase().includes(q) ||
        j.filename.toLowerCase().includes(q) ||
        (j.submittedByName && j.submittedByName.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'ALL' || String(j.status || '').toUpperCase() === statusFilter.toUpperCase();
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchQuery, statusFilter]);

  // Filtered rows inside detail modal
  const filteredModalRows = useMemo(() => {
    return jobRows.filter(r => {
      const q = modalSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.businessName.toLowerCase().includes(q) ||
        (r.ownerName && r.ownerName.toLowerCase().includes(q)) ||
        (r.mobile && r.mobile.includes(q)) ||
        (r.customerId && r.customerId.toLowerCase().includes(q));

      const matchesStatus =
        modalStatusFilter === 'ALL' ||
        String(r.status || '').toUpperCase() === modalStatusFilter.toUpperCase();

      return matchesSearch && matchesStatus;
    });
  }, [jobRows, modalSearch, modalStatusFilter]);

  // Status badge helper
  const renderStatusBadge = (status: CustomerImportJobStatus | string) => {
    const normalized = String(status || '').toUpperCase();
    switch (normalized) {
      case 'QUEUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            Queued
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Processing
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      case 'COMPLETED_WITH_ERRORS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Completed with Errors
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoString?: string): string => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Customer Management
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900">Import Feed & Job Audit</h1>
            {activeJobsCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {activeJobsCount} Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time tracking of persistent customer bulk imports, batch progress, and detailed execution logs.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => loadJobs(false)}
            disabled={isRefreshing}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            title="Refresh Feed"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={onOpenImportCustomers}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Import Customers</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Import Jobs</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900 font-mono-numbers">{totalJobsCount}</span>
            <span className="text-xs text-slate-400">jobs run</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">New Customers Created</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-700 font-mono-numbers">+{totalCreatedCount}</span>
            <span className="text-xs text-emerald-600">registered</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Customers Updated</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-blue-700 font-mono-numbers">↻ {totalUpdatedCount}</span>
            <span className="text-xs text-blue-600">modified</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Failed Records</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-rose-700 font-mono-numbers">{totalFailedCount}</span>
            <span className="text-xs text-rose-600">skipped / errors</span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Job ID, file, submitter..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="COMPLETED_WITH_ERRORS">Completed with Errors</option>
              <option value="FAILED">Failed</option>
              <option value="QUEUED">Queued</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-slate-500 shrink-0">
          Showing <strong>{filteredJobs.length}</strong> of <strong>{jobs.length}</strong> import jobs
        </span>
      </div>

      {/* Import Jobs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
            <p className="text-xs font-semibold">Loading import feed history...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No import jobs found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No jobs match your active filters. Clear search or filters to see all jobs.'
                : 'No bulk customer imports have been initiated yet. Click below to download a template and start your first import.'}
            </p>
            {!searchQuery && statusFilter === 'ALL' && (
              <button
                onClick={onOpenImportCustomers}
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Start First Import
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Job ID</th>
                  <th className="p-3.5">Uploaded File</th>
                  <th className="p-3.5">Submitted By</th>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5 w-44">Progress</th>
                  <th className="p-3.5">Breakdown</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map(job => {
                  const progressPct =
                    job.totalRecords > 0
                      ? Math.min(100, Math.round((job.processedRecords / job.totalRecords) * 100))
                      : 0;

                  return (
                    <tr key={job.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Job ID */}
                      <td className="p-3.5 font-mono text-xs font-bold text-slate-900">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800">
                          {job.jobNumber}
                        </span>
                      </td>

                      {/* File details */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="truncate max-w-[200px]">
                            <p className="font-semibold text-slate-900 truncate" title={job.filename}>
                              {job.filename}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {formatFileSize(job.fileSizeBytes)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Submitter */}
                      <td className="p-3.5 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                            {(job.submittedByName || 'S')[0].toUpperCase()}
                          </div>
                          <span>{job.submittedByName || 'Staff Member'}</span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        {formatDate(job.createdAt)}
                      </td>

                      {/* Progress Bar */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-medium text-slate-600">
                            <span>{job.processedRecords} / {job.totalRecords}</span>
                            <span>{progressPct}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                String(job.status || '').toUpperCase() === 'FAILED'
                                  ? 'bg-rose-500'
                                  : String(job.status || '').toUpperCase() === 'COMPLETED'
                                  ? 'bg-emerald-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Counts Breakdown */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span
                            className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold"
                            title="New Customers Created"
                          >
                            +{job.successfulRecords}
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold"
                            title="Existing Customers Updated"
                          >
                            ↻ {job.updatedRecords}
                          </span>
                          {job.failedRecords > 0 && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold"
                              title="Failed / Skipped Rows"
                            >
                              ! {job.failedRecords}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        {renderStatusBadge(job.status)}
                      </td>

                      {/* Action Buttons */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(job)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                            title="View Row-level Audit Log"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadResultReport(job)}
                            disabled={isDownloadingReport}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200 disabled:opacity-50"
                            title="Download Execution Report (.xlsx)"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Job Details & Audit Log Modal */}
      {selectedJob && (
        <Modal
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          title={`Job Audit Log: ${selectedJob.jobNumber}`}
          subtitle={`Imported from file "${selectedJob.filename}" on ${formatDate(selectedJob.createdAt)}`}
          maxWidth="5xl"
        >
          <div className="p-6 space-y-6">
            {/* Header info & summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                <div className="mt-1">{renderStatusBadge(selectedJob.status)}</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Created</span>
                <p className="text-lg font-black text-emerald-800 mt-0.5">+{selectedJob.successfulRecords}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-[10px] font-bold text-blue-700 uppercase">Updated</span>
                <p className="text-lg font-black text-blue-800 mt-0.5">↻ {selectedJob.updatedRecords}</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[10px] font-bold text-rose-700 uppercase">Failed / Skipped</span>
                <p className="text-lg font-black text-rose-800 mt-0.5">{selectedJob.failedRecords}</p>
              </div>
            </div>

            {selectedJob.errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Execution Error Encountered</p>
                  <p className="mt-0.5 font-mono text-[11px]">{selectedJob.errorMessage}</p>
                </div>
              </div>
            )}

            {/* Modal Row Search & Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  placeholder="Filter row results..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <select
                  value={modalStatusFilter}
                  onChange={e => setModalStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none"
                >
                  <option value="ALL">All Rows ({jobRows.length})</option>
                  <option value="SUCCESS">Success Only</option>
                  <option value="FAILED">Failed Only</option>
                  <option value="SKIPPED">Skipped Only</option>
                </select>

                <button
                  onClick={() => handleDownloadResultReport(selectedJob)}
                  disabled={isDownloadingReport}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Rows Table */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden max-h-96 overflow-y-auto">
              {isLoadingRows ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mb-2" />
                  <p className="text-xs">Loading row audit records...</p>
                </div>
              ) : filteredModalRows.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No row records match your filter criteria.
                </div>
              ) : (
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-14">#</th>
                      <th className="p-2.5 w-24">Action</th>
                      <th className="p-2.5">Business & Owner</th>
                      <th className="p-2.5">Contact</th>
                      <th className="p-2.5 w-24">Status</th>
                      <th className="p-2.5">Audit Messages</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredModalRows.map(row => {
                      const actionUpper = String(row.action || '').toUpperCase();
                      const statusUpper = String(row.status || '').toUpperCase();

                      return (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 font-mono text-[11px] text-slate-500">{row.rowIndex}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                actionUpper === 'CREATE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : actionUpper === 'UPDATE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {actionUpper}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <p className="font-bold text-slate-900">{row.businessName}</p>
                            {row.ownerName && <p className="text-[11px] text-slate-500">{row.ownerName}</p>}
                          </td>
                          <td className="p-2.5 text-[11px] text-slate-600">
                            {row.mobile ? `+91 ${row.mobile}` : '—'}
                            {row.address && <p className="text-[10px] text-slate-400 truncate max-w-xs">{row.address}</p>}
                          </td>
                          <td className="p-2.5">
                            {statusUpper === 'SUCCESS' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                <CheckCircle2 className="w-3 h-3" />
                                Success
                              </span>
                            ) : statusUpper === 'WARNING' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                                <AlertTriangle className="w-3 h-3" />
                                Warning
                              </span>
                            ) : statusUpper === 'SKIPPED' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                                Skipped
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                                <XCircle className="w-3 h-3" />
                                Failed
                              </span>
                            )}
                          </td>
                        <td className="p-2.5 text-[11px]">
                          {row.errorMessages && row.errorMessages.length > 0 ? (
                            <div className="text-rose-600 space-y-0.5">
                              {row.errorMessages.map((e, idx) => (
                                <p key={idx} className="flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  <span>{e}</span>
                                </p>
                              ))}
                            </div>
                          ) : row.warningMessages && row.warningMessages.length > 0 ? (
                            <div className="text-amber-600 space-y-0.5">
                              {row.warningMessages.map((w, idx) => (
                                <p key={idx} className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>{w}</span>
                                </p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No issues</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
