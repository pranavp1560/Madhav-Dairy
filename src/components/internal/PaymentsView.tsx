import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { CustomerPaymentSubmission, Invoice, Payment, PaymentSubmissionStatus } from '../../types/dairy';
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Eye,
  Check,
  X,
  FileText,
  Filter,
  Calendar,
  ExternalLink,
  ShieldAlert,
  Loader2,
  DollarSign,
  Printer
} from 'lucide-react';

interface PaymentsViewProps {
  onOpenRecordPayment: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({ onOpenRecordPayment }) => {
  const {
    payments,
    paymentSubmissions,
    invoices,
    confirmInvoicePayment,
    bulkConfirmInvoicePayments,
    rejectInvoicePayment,
    verifyAndAccountSubmission,
    rejectPaymentSubmission,
    markDirectPaymentAccounted,
    rejectDirectPayment,
    internalRole,
    addToast
  } = useDairy();

  const isAdmin = internalRole === 'admin';

  // Invoices in Open Payment status
  const openPaymentInvoices = invoices.filter(inv => inv.status === 'open_payment');
  const openPaymentInvoicesCount = openPaymentInvoices.length;
  const openPaymentInvoicesTotal = openPaymentInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  // Active Main Tab - Default to open_invoices if any exist
  const [activeTab, setActiveTab] = useState<'open_invoices' | 'verification_queue' | 'collections'>('open_invoices');

  // Search & Selection for Open Payment Invoices
  const [openInvoicesSearch, setOpenInvoicesSearch] = useState('');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [selectedInvoiceForAction, setSelectedInvoiceForAction] = useState<Invoice | null>(null);

  // Search & Filters for Collections
  const [collectionsSearch, setCollectionsSearch] = useState('');

  // Search & Filters for Verification Queue
  const [queueSearch, setQueueSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'accounted' | 'rejected'>('open');
  const [methodFilter, setMethodFilter] = useState<'all' | 'upi' | 'bank_transfer' | 'other'>('all');

  // Modal Detail & Action States
  const [selectedSubmission, setSelectedSubmission] = useState<CustomerPaymentSubmission | null>(null);
  const [selectedDirectPayment, setSelectedDirectPayment] = useState<Payment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [actionModal, setActionModal] = useState<
    'verify' | 'reject' | 'direct_verify' | 'direct_reject' | 'invoice_confirm' | 'invoice_reject' | null
  >(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Collections filtering
  const filteredPayments = payments.filter(p =>
    p.retailerName.toLowerCase().includes(collectionsSearch.toLowerCase()) ||
    p.paymentNumber.toLowerCase().includes(collectionsSearch.toLowerCase()) ||
    p.invoiceNumber.toLowerCase().includes(collectionsSearch.toLowerCase()) ||
    p.reference.toLowerCase().includes(collectionsSearch.toLowerCase())
  );
  const totalCollected = payments.reduce((acc, p) => acc + p.amount, 0);

  // Verification Queue filtering
  const filteredSubmissions = paymentSubmissions.filter(sub => {
    const matchesSearch =
      sub.customerName?.toLowerCase().includes(queueSearch.toLowerCase()) ||
      sub.invoiceNumber?.toLowerCase().includes(queueSearch.toLowerCase()) ||
      sub.transactionReference.toLowerCase().includes(queueSearch.toLowerCase()) ||
      (sub.customerCode && sub.customerCode.toLowerCase().includes(queueSearch.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || sub.paymentMethodType === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  const openSubmissions = paymentSubmissions.filter(s => s.status === 'open');
  const openSubmissionsCount = openSubmissions.length;
  const openSubmissionsAmount = openSubmissions.reduce((sum, s) => sum + s.amount, 0);
  const accountedSubmissionsCount = paymentSubmissions.filter(s => s.status === 'accounted').length;
  const rejectedSubmissionsCount = paymentSubmissions.filter(s => s.status === 'rejected').length;

  const handleOpenDetail = (submission: CustomerPaymentSubmission) => {
    setSelectedSubmission(submission);
    setIsDetailModalOpen(true);
  };

  const handleStartVerify = (submission: CustomerPaymentSubmission) => {
    setSelectedSubmission(submission);
    setVerificationNotes('');
    setActionModal('verify');
  };

  const handleStartReject = (submission: CustomerPaymentSubmission) => {
    setSelectedSubmission(submission);
    setRejectionReason('');
    setActionModal('reject');
  };

  const handleConfirmVerify = async () => {
    if (!selectedSubmission) return;
    try {
      setIsProcessingAction(true);
      await verifyAndAccountSubmission(selectedSubmission.id, verificationNotes);
      setActionModal(null);
      setIsDetailModalOpen(false);
      setSelectedSubmission(null);
    } catch (err) {
      // Toast triggered in context
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedSubmission) return;
    if (!rejectionReason.trim()) {
      addToast('A rejection reason is mandatory', 'warning');
      return;
    }
    try {
      setIsProcessingAction(true);
      await rejectPaymentSubmission(selectedSubmission.id, rejectionReason.trim());
      setActionModal(null);
      setIsDetailModalOpen(false);
      setSelectedSubmission(null);
    } catch (err) {
      // Toast triggered in context
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleStartDirectAccount = (payment: Payment) => {
    setSelectedDirectPayment(payment);
    setActionModal('direct_verify');
  };

  const handleStartDirectReject = (payment: Payment) => {
    setSelectedDirectPayment(payment);
    setRejectionReason('');
    setActionModal('direct_reject');
  };

  const handleConfirmDirectAccount = async () => {
    if (!selectedDirectPayment) return;
    try {
      setIsProcessingAction(true);
      await markDirectPaymentAccounted(selectedDirectPayment.id);
      setActionModal(null);
      setSelectedDirectPayment(null);
    } catch (err) {
      // Toast triggered in context
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmDirectReject = async () => {
    if (!selectedDirectPayment) return;
    if (!rejectionReason.trim()) {
      addToast('A rejection reason is mandatory', 'warning');
      return;
    }
    try {
      setIsProcessingAction(true);
      await rejectDirectPayment(selectedDirectPayment.id, rejectionReason.trim());
      setActionModal(null);
      setSelectedDirectPayment(null);
    } catch (err) {
      // Toast triggered in context
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Open Invoices filtering
  const filteredOpenInvoices = openPaymentInvoices.filter(inv =>
    inv.invoiceNumber.toLowerCase().includes(openInvoicesSearch.toLowerCase()) ||
    inv.retailerName.toLowerCase().includes(openInvoicesSearch.toLowerCase()) ||
    (inv.orderNumber && inv.orderNumber.toLowerCase().includes(openInvoicesSearch.toLowerCase()))
  );

  const handleStartConfirmInvoice = (inv: Invoice) => {
    setSelectedInvoiceForAction(inv);
    setActionModal('invoice_confirm');
  };

  const handleStartRejectInvoice = (inv: Invoice) => {
    setSelectedInvoiceForAction(inv);
    setRejectionReason('');
    setActionModal('invoice_reject');
  };

  const handleConfirmInvoiceAction = async () => {
    if (!selectedInvoiceForAction) return;
    try {
      setIsProcessingAction(true);
      await confirmInvoicePayment(selectedInvoiceForAction.id);
      setActionModal(null);
      setSelectedInvoiceForAction(null);
    } catch (err) {
      // toast in context
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRejectInvoiceAction = async () => {
    if (!selectedInvoiceForAction) return;
    if (!rejectionReason.trim()) {
      addToast('A rejection reason is mandatory', 'warning');
      return;
    }
    try {
      setIsProcessingAction(true);
      await rejectInvoicePayment(selectedInvoiceForAction.id, rejectionReason.trim());
      setActionModal(null);
      setSelectedInvoiceForAction(null);
    } catch (err) {
      // toast in context
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleBulkConfirmInvoices = async () => {
    if (selectedInvoiceIds.length === 0) return;
    try {
      setIsProcessingAction(true);
      await bulkConfirmInvoicePayments(selectedInvoiceIds);
      setSelectedInvoiceIds([]);
    } catch (err) {
      // toast in context
    } finally {
      setIsProcessingAction(false);
    }
  };

  const toggleSelectAllInvoices = () => {
    if (selectedInvoiceIds.length === filteredOpenInvoices.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(filteredOpenInvoices.map(i => i.id));
    }
  };

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoiceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const renderStatusBadge = (status: PaymentSubmissionStatus) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Open (Awaiting Verification)</span>
          </span>
        );
      case 'accounted':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Accounted</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
            <XCircle className="w-3 h-3 text-red-600" />
            <span>Rejected</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <CreditCard className="w-4 h-4" />
            <span>Finance & Accounts Receivable</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-1">
            Collections & Payment Verification
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit customer bank and UPI payment submissions, and track double-entry ledger receipts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => addToast('Collections statement exported', 'info')}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold border border-slate-300 transition-colors"
          >
            Export Statement
          </button>
          <button
            onClick={onOpenRecordPayment}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Direct Payment</span>
          </button>
        </div>
      </div>

      {/* Open Payment Invoices Immediate Action Alert */}
      {openPaymentInvoicesCount > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                <AlertCircle className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <span>Invoices in Open Payment Status Awaiting Confirmation</span>
                  <span className="text-xs bg-amber-200/90 text-amber-900 font-extrabold px-2.5 py-0.5 rounded-full font-mono-numbers">
                    {openPaymentInvoicesCount} Invoices (₹{openPaymentInvoicesTotal.toLocaleString('en-IN')})
                  </span>
                </h3>
                <p className="text-xs text-amber-800">
                  Payments have been allocated against these invoices. Confirm and mark as accounted to post double-entry ledger credit and settle the invoices.
                </p>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => bulkConfirmInvoicePayments(openPaymentInvoices.map(i => i.id))}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Bulk Confirm All ({openPaymentInvoicesCount})</span>
              </button>
            )}
          </div>

          {/* Quick Action Preview Cards for Open Invoices */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {openPaymentInvoices.slice(0, 3).map(inv => (
              <div key={inv.id} className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-2xs space-y-2">
                <div className="flex items-start justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{inv.invoiceNumber}</span>
                    <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">{inv.retailerName}</span>
                  </div>
                  <div className="text-right font-mono-numbers">
                    <span className="font-black text-slate-900 block">₹{inv.totalAmount.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-emerald-600 font-bold block">Paid: ₹{inv.paidAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => handleStartConfirmInvoice(inv)}
                      className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <Check className="w-3 h-3" />
                      <span>Confirm & Settle</span>
                    </button>
                    <button
                      onClick={() => handleStartRejectInvoice(inv)}
                      className="py-1 px-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] rounded-lg border border-red-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Reject</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium block text-center py-1">
                    Awaiting Admin Approval
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Customer Submissions Immediate Action Alert */}
      {openSubmissionsCount > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                  <span>Customer Payments Awaiting Verification</span>
                  <span className="text-xs bg-blue-200/80 text-blue-900 font-extrabold px-2.5 py-0.5 rounded-full font-mono-numbers">
                    {openSubmissionsCount} Pending Claims (₹{openSubmissionsAmount.toLocaleString('en-IN')})
                  </span>
                </h3>
                <p className="text-xs text-blue-800">
                  Customers have submitted payment references. Review bank statements and mark as accounted or reject.
                </p>
              </div>
            </div>
            {activeTab !== 'verification_queue' && (
              <button
                onClick={() => setActiveTab('verification_queue')}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
              >
                Go to Verification Queue →
              </button>
            )}
          </div>

          {/* Quick Action Preview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {openSubmissions.slice(0, 3).map(sub => (
              <div key={sub.id} className="bg-white p-3 rounded-xl border border-blue-200/80 shadow-2xs space-y-2">
                <div className="flex items-start justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block truncate max-w-[150px]">{sub.customerName}</span>
                    <span className="text-[10px] text-blue-700 font-mono-numbers">{sub.invoiceNumber}</span>
                  </div>
                  <span className="font-black text-emerald-700 font-mono-numbers">₹{sub.amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono-numbers">
                  <span className="truncate max-w-[130px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">UTR: {sub.transactionReference}</span>
                  <span className="uppercase text-[10px] font-semibold text-slate-500">{sub.paymentMethodType}</span>
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => handleStartVerify(sub)}
                      className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <Check className="w-3 h-3" />
                      <span>Mark Accounted</span>
                    </button>
                    <button
                      onClick={() => handleStartReject(sub)}
                      className="py-1 px-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] rounded-lg border border-red-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleOpenDetail(sub)}
                      className="p-1 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleOpenDetail(sub)}
                    className="w-full py-1 text-center text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
                  >
                    View Details
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('open_invoices')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 ${
            activeTab === 'open_invoices'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Invoices in Open Payment</span>
          {openPaymentInvoicesCount > 0 ? (
            <span className="text-xs font-bold font-mono-numbers bg-amber-500 text-white px-2.5 py-0.5 rounded-full animate-pulse">
              {openPaymentInvoicesCount} Pending
            </span>
          ) : (
            <span className="text-xs font-mono-numbers bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
              0
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('verification_queue')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 ${
            activeTab === 'verification_queue'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Customer Verification Claims</span>
          {openSubmissionsCount > 0 ? (
            <span className="text-xs font-bold font-mono-numbers bg-blue-600 text-white px-2.5 py-0.5 rounded-full animate-pulse">
              {openSubmissionsCount} Pending
            </span>
          ) : (
            <span className="text-xs font-mono-numbers bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
              {paymentSubmissions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('collections')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 ${
            activeTab === 'collections'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Collections & Receipts</span>
          <span className="text-xs font-mono-numbers bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
            {payments.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Invoices in Open Payment Status */}
      {activeTab === 'open_invoices' && (
        <div className="space-y-6">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 bg-white rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Open Payment Invoices</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-amber-900 font-mono-numbers">
                  {openPaymentInvoicesCount} Invoices
                </span>
                <span className="text-sm font-bold text-amber-700 font-mono-numbers">
                  ₹{openPaymentInvoicesTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Settled & Accounted Invoices</span>
              <span className="text-2xl font-black text-emerald-700 font-mono-numbers mt-1 block">
                {invoices.filter(i => i.status === 'settled').length} Invoices
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Verification Rule</span>
              <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                Invoices in <strong>Open Payment</strong> have allocated money awaiting accounts audit. Confirming marks them accounted and posts double-entry credit.
              </p>
            </div>
          </div>

          {/* Search & Bulk Action Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={openInvoicesSearch}
                onChange={e => setOpenInvoicesSearch(e.target.value)}
                placeholder="Search invoice #, order #, retailer..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            {isAdmin && selectedInvoiceIds.length > 0 && (
              <button
                onClick={handleBulkConfirmInvoices}
                disabled={isProcessingAction}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <CheckCircle2 className="w-4 h-4" />
                <span>Bulk Confirm Selected ({selectedInvoiceIds.length})</span>
              </button>
            )}
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={
                          filteredOpenInvoices.length > 0 &&
                          selectedInvoiceIds.length === filteredOpenInvoices.length
                        }
                        onChange={toggleSelectAllInvoices}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="p-3">Invoice Ref</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Retailer Partner</th>
                    <th className="p-3 text-right">Invoice Total (₹)</th>
                    <th className="p-3 text-right">Paid / Allocated (₹)</th>
                    <th className="p-3 text-right">Balance Due (₹)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredOpenInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-sans">
                        No invoices currently in Open Payment status. All payments are accounted.
                      </td>
                    </tr>
                  ) : (
                    filteredOpenInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedInvoiceIds.includes(inv.id)}
                            onChange={() => toggleSelectInvoice(inv.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">{inv.invoiceNumber}</span>
                          {inv.orderNumber && (
                            <span className="text-[10px] text-blue-600 block">{inv.orderNumber}</span>
                          )}
                        </td>
                        <td className="p-3 font-sans text-slate-600">{inv.date}</td>
                        <td className="p-3 font-sans font-bold text-slate-900">{inv.retailerName}</td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          ₹{inv.totalAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-600">
                          ₹{inv.paidAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-500">
                          ₹{inv.outstandingAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 font-sans">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Open Payment</span>
                          </span>
                        </td>
                        <td className="p-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAdmin ? (
                              <>
                                <button
                                  onClick={() => handleStartConfirmInvoice(inv)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                                  title="Confirm Payment and Mark Accounted"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Confirm Payment</span>
                                </button>
                                <button
                                  onClick={() => handleStartRejectInvoice(inv)}
                                  className="px-2 py-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors flex items-center gap-1"
                                  title="Reject Payment"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">
                                Awaiting Admin
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: Collections & Receipts (Existing View) */}
      {activeTab === 'collections' && (
        <div className="space-y-6">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Collections Recorded</span>
              <span className="text-xl font-black text-green-600 font-mono-numbers mt-1 block">
                ₹{totalCollected.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">UPI & Online Share</span>
              <span className="text-xl font-black text-slate-900 font-mono-numbers mt-1 block">
                68.4%
              </span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Average Settlement Turnaround</span>
              <span className="text-xl font-black text-slate-900 font-mono-numbers mt-1 block">
                6.2 Days
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={collectionsSearch}
              onChange={e => setCollectionsSearch(e.target.value)}
              placeholder="Search by retailer name, receipt #, invoice reference or UTR..."
              className="w-full text-xs bg-transparent focus:outline-none text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Receipt #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Retailer</th>
                    <th className="p-3">Invoice Ref</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                    <th className="p-3">Payment Method</th>
                    <th className="p-3">Reference / UTR</th>
                    <th className="p-3">Accounting Status</th>
                    <th className="p-3">Recorded By</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredPayments.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{p.paymentNumber}</td>
                      <td className="p-3 font-sans text-slate-600">{p.date}</td>
                      <td className="p-3 font-sans font-bold text-slate-900">{p.retailerName}</td>
                      <td className="p-3 font-semibold text-slate-800 font-mono-numbers">{p.invoiceNumber}</td>
                      <td className="p-3 text-right font-bold text-green-600 text-sm">
                        ₹{p.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 font-sans">
                        <span className="uppercase font-semibold text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {p.paymentMethod.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-[11px]">{p.reference}</td>
                      <td className="p-3 font-sans">
                        {p.isAccounted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Accounted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Allocated / Pending
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-sans text-slate-600">{p.recordedBy}</td>
                      <td className="p-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          {!p.isAccounted && isAdmin ? (
                            <>
                              <button
                                onClick={() => handleStartDirectAccount(p)}
                                className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                                title="Mark Accounted"
                              >
                                <Check className="w-3 h-3" />
                                <span>Mark Accounted</span>
                              </button>
                              <button
                                onClick={() => handleStartDirectReject(p)}
                                className="px-2 py-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors flex items-center gap-1"
                                title="Reject / Void"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-400">
                              {p.isAccounted ? 'Verified' : 'Staff View'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Customer Payment Verification Queue */}
      {activeTab === 'verification_queue' && (
        <div className="space-y-6">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 bg-white rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Open Submissions Awaiting Audit</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-amber-800 font-mono-numbers">
                  {openSubmissionsCount} Claims
                </span>
                <span className="text-sm font-bold text-amber-700 font-mono-numbers">
                  ₹{openSubmissionsAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Verified & Accounted</span>
              <span className="text-2xl font-black text-emerald-700 font-mono-numbers mt-1 block">
                {accountedSubmissionsCount} Submissions
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Rejected Claims</span>
              <span className="text-2xl font-black text-slate-700 font-mono-numbers mt-1 block">
                {rejectedSubmissionsCount} Submissions
              </span>
            </div>
          </div>

          {/* Audit Rule Notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Compliance Rule:</strong> Customer submissions are claims only and never automatically reduce invoice dues. Only verified Owner / Admin accounts can confirm bank receipts and post ledger credits.
              </span>
            </div>
            {!isAdmin && (
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded shrink-0">
                Staff: View Only
              </span>
            )}
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={queueSearch}
                onChange={e => setQueueSearch(e.target.value)}
                placeholder="Search retailer, UTR, invoice #..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {(['all', 'open', 'accounted', 'rejected'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold capitalize transition-all ${
                      statusFilter === st
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none"
              >
                <option value="all">All Methods</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Queue Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Submitted</th>
                    <th className="p-3">Retailer</th>
                    <th className="p-3">Invoice Ref</th>
                    <th className="p-3 text-right">Claimed (₹)</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">UTR / Ref ID</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                        No customer payment submissions match current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map(sub => (
                      <tr key={sub.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-3 font-sans text-slate-600 text-[11px]">
                          {new Date(sub.submittedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="p-3 font-sans">
                          <span className="font-bold text-slate-900 block truncate max-w-[180px]">
                            {sub.customerName}
                          </span>
                          {sub.customerCode && (
                            <span className="text-[10px] text-slate-400 font-mono-numbers">{sub.customerCode}</span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-blue-700 font-mono-numbers">
                          {sub.invoiceNumber}
                        </td>
                        <td className="p-3 text-right font-black text-slate-900 text-sm">
                          ₹{sub.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 font-sans">
                          <span className="uppercase font-semibold text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            {sub.paymentMethodType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 font-mono-numbers font-bold text-slate-800 text-[11px]">
                          {sub.transactionReference}
                        </td>
                        <td className="p-3 font-sans">
                          {renderStatusBadge(sub.status)}
                        </td>
                        <td className="p-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenDetail(sub)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Details</span>
                            </button>

                            {sub.status === 'open' && isAdmin && (
                              <>
                                <button
                                  onClick={() => handleStartVerify(sub)}
                                  className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
                                  title="Verify & Mark Accounted"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Mark Accounted</span>
                                </button>
                                <button
                                  onClick={() => handleStartReject(sub)}
                                  className="px-2.5 py-1.5 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors flex items-center gap-1"
                                  title="Reject Submission"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Detailed Submission Modal */}
      {isDetailModalOpen && selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Payment Submission Audit Details
                </h3>
                <span className="text-xs text-slate-400 font-mono-numbers">
                  ID: {selectedSubmission.id}
                </span>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Status Header Strip */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-medium">Audit Status:</span>
                {renderStatusBadge(selectedSubmission.status)}
              </div>

              {/* Retailer & Invoice Meta */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Retailer Partner:</span>
                  <span className="font-bold text-slate-900 block">{selectedSubmission.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Linked Invoice:</span>
                  <span className="font-bold text-blue-700 font-mono-numbers block">
                    {selectedSubmission.invoiceNumber}
                  </span>
                </div>
              </div>

              {/* Transaction Breakdown */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 font-mono-numbers">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Claimed Amount:</span>
                  <span className="text-base font-black text-emerald-700">
                    ₹{selectedSubmission.amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Payment Method:</span>
                  <span className="font-bold uppercase font-sans text-slate-800">
                    {selectedSubmission.paymentMethodType.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Transaction Reference / UTR:</span>
                  <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {selectedSubmission.transactionReference}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Submission Date:</span>
                  <span className="text-slate-700">
                    {new Date(selectedSubmission.submittedAt).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Customer Notes */}
              {selectedSubmission.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Retailer Transfer Notes:</span>
                  <p className="text-slate-800 mt-1 italic">{selectedSubmission.notes}</p>
                </div>
              )}

              {/* Uploaded Receipt Preview */}
              {selectedSubmission.receiptUrl && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-bold block">Uploaded Bank Receipt:</span>
                    <a
                      href={selectedSubmission.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 font-semibold text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open Full Size
                    </a>
                  </div>
                  <div className="max-h-48 overflow-hidden rounded-lg border border-slate-200 bg-white flex items-center justify-center">
                    <img
                      src={selectedSubmission.receiptUrl}
                      alt="Bank Receipt"
                      className="max-h-48 w-auto object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Audit Trail for Settled or Rejected */}
              {selectedSubmission.status === 'accounted' && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                  <span className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Accounted & Posted to Ledger
                  </span>
                  <p className="text-[11px] text-emerald-800">
                    Verified on {selectedSubmission.verifiedAt ? new Date(selectedSubmission.verifiedAt).toLocaleString('en-IN') : 'N/A'}. 
                    {selectedSubmission.accountedPaymentNumber && ` Linked Payment Receipt: ${selectedSubmission.accountedPaymentNumber}.`}
                  </p>
                </div>
              )}

              {selectedSubmission.status === 'rejected' && (
                <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl text-red-900 space-y-1">
                  <span className="font-bold flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-red-600" />
                    Submission Rejected
                  </span>
                  <p className="text-[11px] text-red-800">
                    Reason: {selectedSubmission.rejectionReason}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Close
              </button>

              {selectedSubmission.status === 'open' && (
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <>
                      <button
                        onClick={() => {
                          setActionModal('reject');
                        }}
                        className="px-3.5 py-2 rounded-xl text-red-700 bg-red-50 hover:bg-red-100 font-bold border border-red-200 transition-colors"
                      >
                        Reject Claim
                      </button>
                      <button
                        onClick={() => {
                          setActionModal('verify');
                        }}
                        className="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-bold shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Verify & Mark Accounted</span>
                      </button>
                    </>
                  ) : (
                    <span className="text-slate-400 text-[11px] italic">
                      Admin authorization required to verify or reject
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Verification Confirmation Modal */}
      {actionModal === 'verify' && selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-700 font-bold text-lg pb-3 border-b border-slate-100">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <span>Verify & Mark as Accounted</span>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Please confirm that the payment receipt of{' '}
                <strong className="text-slate-900 font-mono-numbers">
                  ₹{selectedSubmission.amount.toLocaleString('en-IN')}
                </strong>{' '}
                with reference{' '}
                <strong className="text-slate-900 font-mono-numbers">
                  {selectedSubmission.transactionReference}
                </strong>{' '}
                has been verified against your official bank statement or UPI merchant dashboard.
              </p>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 text-[11px] space-y-1">
                <span className="font-bold block">Financial Accounting Impact:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Creates official payment receipt record.</li>
                  <li>Allocates ₹{selectedSubmission.amount} to Invoice {selectedSubmission.invoiceNumber}.</li>
                  <li>Posts Double-Entry credit to Customer Financial Ledger.</li>
                  <li>Recalculates customer balance and updates invoice status.</li>
                </ul>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Optional Verification Remarks / Bank Voucher Ref:
                </label>
                <input
                  type="text"
                  value={verificationNotes}
                  onChange={e => setVerificationNotes(e.target.value)}
                  placeholder="e.g. Verified on HDFC NetBanking batch #1094"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 text-xs">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setActionModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleConfirmVerify}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingAction && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirm & Post Ledger</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Rejection Modal */}
      {actionModal === 'reject' && selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-700 font-bold text-lg pb-3 border-b border-slate-100">
              <XCircle className="w-6 h-6 text-red-600 shrink-0" />
              <span>Reject Payment Submission</span>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Provide a clear reason why the payment submission of{' '}
                <strong className="text-slate-900 font-mono-numbers">
                  ₹{selectedSubmission.amount.toLocaleString('en-IN')}
                </strong>{' '}
                is not being accepted. The customer will be notified with this reason.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Reference UTR not found on bank statement, or amount differs from deposit..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-red-600 focus:bg-white"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-600 text-[11px]">
                <strong>Note:</strong> Rejection does not modify invoice balances. The customer will be permitted to submit a rectified transaction reference.
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 text-xs">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => setActionModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingAction || !rejectionReason.trim()}
                onClick={handleConfirmReject}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingAction && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Reject Submission</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Direct Payment Account Modal */}
      {actionModal === 'direct_verify' && selectedDirectPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-700 font-bold text-lg pb-3 border-b border-slate-100">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <span>Mark Payment as Accounted</span>
            </div>
            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Are you sure you want to mark receipt <strong className="text-slate-900 font-mono-numbers">{selectedDirectPayment.paymentNumber}</strong> of <strong className="text-emerald-700 font-mono-numbers">₹{selectedDirectPayment.amount.toLocaleString('en-IN')}</strong> from <strong className="text-slate-900">{selectedDirectPayment.retailerName}</strong> as accounted?
              </p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 text-[11px] space-y-1">
                <span className="font-bold block">Status Update:</span>
                <p>This confirms that payment has cleared and marks the collection record as accounted.</p>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActionModal(null);
                  setSelectedDirectPayment(null);
                }}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDirectAccount}
                disabled={isProcessingAction}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Mark Accounted</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Direct Payment Reject Modal */}
      {actionModal === 'direct_reject' && selectedDirectPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-700 font-bold text-lg pb-3 border-b border-slate-100">
              <XCircle className="w-6 h-6 text-red-600 shrink-0" />
              <span>Reject / Void Payment</span>
            </div>
            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Provide a reason for rejecting payment receipt <strong className="text-slate-900 font-mono-numbers">{selectedDirectPayment.paymentNumber}</strong> (₹{selectedDirectPayment.amount.toLocaleString('en-IN')}) from <strong className="text-slate-900">{selectedDirectPayment.retailerName}</strong>:
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Cheque returned, erroneous transfer, duplicate payment record..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActionModal(null);
                  setSelectedDirectPayment(null);
                }}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDirectReject}
                disabled={isProcessingAction || !rejectionReason.trim()}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Invoice Payment Confirm Modal */}
      {actionModal === 'invoice_confirm' && selectedInvoiceForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-700 font-bold text-lg pb-3 border-b border-slate-100">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <span>Confirm Invoice Payment & Settle</span>
            </div>
            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Confirm and mark as accounted the payment for Invoice <strong className="text-slate-900 font-mono-numbers">{selectedInvoiceForAction.invoiceNumber}</strong> of <strong className="text-emerald-700 font-mono-numbers">₹{selectedInvoiceForAction.totalAmount.toLocaleString('en-IN')}</strong> for <strong className="text-slate-900">{selectedInvoiceForAction.retailerName}</strong>?
              </p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 text-[11px] space-y-1">
                <span className="font-bold block">Financial Accounting Action:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Marks linked payments as accounted.</li>
                  <li>Posts Double-Entry ledger credit to customer account.</li>
                  <li>Moves invoice status to <strong>Settled</strong>.</li>
                </ul>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActionModal(null);
                  setSelectedInvoiceForAction(null);
                }}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInvoiceAction}
                disabled={isProcessingAction}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Settle Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Invoice Payment Reject Modal */}
      {actionModal === 'invoice_reject' && selectedInvoiceForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-700 font-bold text-lg pb-3 border-b border-slate-100">
              <XCircle className="w-6 h-6 text-red-600 shrink-0" />
              <span>Reject Invoice Payment</span>
            </div>
            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Reject payment for invoice <strong className="text-slate-900 font-mono-numbers">{selectedInvoiceForAction.invoiceNumber}</strong> (₹{selectedInvoiceForAction.totalAmount.toLocaleString('en-IN')}) for <strong className="text-slate-900">{selectedInvoiceForAction.retailerName}</strong>.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Allocation incorrect, cheque dishonoured, customer requested reversal..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-600 text-[11px]">
                <strong>Note:</strong> Rejection reverts invoice status back to <em>Delivered</em> so it can be re-allocated correctly.
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActionModal(null);
                  setSelectedInvoiceForAction(null);
                }}
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectInvoiceAction}
                disabled={isProcessingAction || !rejectionReason.trim()}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

