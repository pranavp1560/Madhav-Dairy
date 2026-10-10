import React, { useState, useMemo } from 'react';
import { useDairy } from '../../context/DairyContext';
import { CustomerPaymentSubmission, Invoice, Payment, PaymentMethod, PaymentSubmissionStatus } from '../../types/dairy';
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
  Banknote,
  DollarSign
} from 'lucide-react';

interface PaymentsViewProps {
  onOpenRecordPayment: () => void;
}

interface UnifiedPaymentItem {
  id: string;
  paymentNumber: string;
  date: string;
  retailerId: string;
  retailerName: string;
  invoiceNumber: string;
  invoiceId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference: string;
  notes?: string;
  recordedBy: string;
  isAccounted: boolean;
  accountedAt?: string;
  accountedBy?: string;
  sourceType: 'invoice_allocation' | 'direct_payment';
  rawPayment?: Payment;
  rawInvoice?: Invoice;
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

  // Active Main Tab:
  // 1. 'payments' (Unified single section: direct payments + invoice allocations + open payment invoices)
  // 2. 'verification_queue' (Customer online claims submitted via portal)
  const [activeTab, setActiveTab] = useState<'payments' | 'verification_queue'>('payments');

  // Filters for Unified Payments Section
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'open' | 'accounted' | 'rejected'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [paymentSourceFilter, setPaymentSourceFilter] = useState<'all' | 'invoice_allocation' | 'direct_payment'>('all');

  // Filters for Verification Queue
  const [queueSearch, setQueueSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'accounted' | 'rejected'>('open');
  const [methodFilter, setMethodFilter] = useState<'all' | 'upi' | 'bank_transfer' | 'other'>('all');

  // Modal States
  const [selectedUnifiedItem, setSelectedUnifiedItem] = useState<UnifiedPaymentItem | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<CustomerPaymentSubmission | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [actionModal, setActionModal] = useState<
    'unified_account' | 'unified_reject' | 'claim_verify' | 'claim_reject' | null
  >(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // ---------------------------------------------------------------------------
  // 1. UNIFIED PAYMENTS LIST
  // Combines both:
  // - Direct payments added with "+ Record Direct Payment"
  // - Payments allocated directly from invoices
  // - Plus any invoices in 'open_payment' status to guarantee nothing is missed
  // ---------------------------------------------------------------------------
  const unifiedPayments: UnifiedPaymentItem[] = useMemo(() => {
    const list: UnifiedPaymentItem[] = [];
    const openInvoiceIdsCovered = new Set<string>();

    payments.forEach(p => {
      const isAllocated = Boolean(p.invoiceNumber && p.invoiceNumber !== 'Direct Payment');
      const matchedInv = isAllocated
        ? invoices.find(i => i.invoiceNumber === p.invoiceNumber || (p.invoiceId && i.id === p.invoiceId))
        : undefined;

      if (matchedInv) {
        openInvoiceIdsCovered.add(matchedInv.id);
      } else if (p.invoiceId) {
        openInvoiceIdsCovered.add(p.invoiceId);
      }

      list.push({
        id: p.id,
        paymentNumber: p.paymentNumber,
        date: p.date,
        retailerId: p.retailerId,
        retailerName: p.retailerName,
        invoiceNumber: p.invoiceNumber || 'Direct Payment',
        invoiceId: p.invoiceId || matchedInv?.id,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        reference: p.reference || 'Direct Transfer',
        notes: p.notes,
        recordedBy: p.recordedBy || 'Finance Desk',
        isAccounted: Boolean(p.isAccounted),
        accountedAt: p.accountedAt,
        accountedBy: p.accountedBy,
        sourceType: isAllocated ? 'invoice_allocation' : 'direct_payment',
        rawPayment: p,
        rawInvoice: matchedInv,
      });
    });

    // Ensure every single invoice in 'open_payment' status appears in the payments section
    invoices.filter(i => i.status === 'open_payment').forEach(inv => {
      if (!openInvoiceIdsCovered.has(inv.id)) {
        list.push({
          id: `open-inv-${inv.id}`,
          paymentNumber: `ALLOC-${inv.invoiceNumber}`,
          date: inv.date,
          retailerId: inv.retailerId,
          retailerName: inv.retailerName,
          invoiceNumber: inv.invoiceNumber,
          invoiceId: inv.id,
          amount: inv.paidAmount > 0 ? inv.paidAmount : inv.totalAmount,
          paymentMethod: 'cash',
          reference: 'Allocated from Invoice',
          notes: 'Invoice in Open Payment awaiting accounting verification',
          recordedBy: 'Staff Allocation',
          isAccounted: false,
          sourceType: 'invoice_allocation',
          rawInvoice: inv,
        });
      }
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, invoices]);

  // Unified Payments Filtering
  const filteredUnifiedPayments = useMemo(() => {
    return unifiedPayments.filter(item => {
      const q = paymentSearch.toLowerCase();
      const matchesSearch =
        item.retailerName.toLowerCase().includes(q) ||
        item.paymentNumber.toLowerCase().includes(q) ||
        item.invoiceNumber.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      const isRejected = Boolean(item.notes?.includes('[REJECTED:'));
      let matchesStatus = true;
      if (paymentStatusFilter === 'open') {
        matchesStatus = !item.isAccounted && !isRejected;
      } else if (paymentStatusFilter === 'accounted') {
        matchesStatus = Boolean(item.isAccounted);
      } else if (paymentStatusFilter === 'rejected') {
        matchesStatus = isRejected;
      }

      const matchesMethod = paymentMethodFilter === 'all' || item.paymentMethod === paymentMethodFilter;
      const matchesSource = paymentSourceFilter === 'all' || item.sourceType === paymentSourceFilter;

      return matchesSearch && matchesStatus && matchesMethod && matchesSource;
    });
  }, [unifiedPayments, paymentSearch, paymentStatusFilter, paymentMethodFilter, paymentSourceFilter]);

  // Statistics for Unified Payments
  const totalCollectionsAmount = useMemo(() => {
    return unifiedPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [unifiedPayments]);

  const openPayments = useMemo(() => {
    return unifiedPayments.filter(p => !p.isAccounted && !p.notes?.includes('[REJECTED:'));
  }, [unifiedPayments]);
  const openPaymentsCount = openPayments.length;
  const openPaymentsAmount = useMemo(() => {
    return openPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [openPayments]);

  const accountedPayments = useMemo(() => {
    return unifiedPayments.filter(p => p.isAccounted);
  }, [unifiedPayments]);
  const accountedPaymentsCount = accountedPayments.length;
  const accountedPaymentsAmount = useMemo(() => {
    return accountedPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [accountedPayments]);

  const rejectedPaymentsCount = useMemo(() => {
    return unifiedPayments.filter(p => p.notes?.includes('[REJECTED:')).length;
  }, [unifiedPayments]);

  // ---------------------------------------------------------------------------
  // 2. CUSTOMER VERIFICATION CLAIMS (ONLINE PORTAL SUBMISSIONS)
  // ---------------------------------------------------------------------------
  const filteredSubmissions = useMemo(() => {
    return paymentSubmissions.filter(sub => {
      const q = queueSearch.toLowerCase();
      const matchesSearch =
        sub.customerName?.toLowerCase().includes(q) ||
        sub.invoiceNumber?.toLowerCase().includes(q) ||
        sub.transactionReference.toLowerCase().includes(q) ||
        (sub.customerCode && sub.customerCode.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
      const matchesMethod = methodFilter === 'all' || sub.paymentMethodType === methodFilter;

      return matchesSearch && matchesStatus && matchesMethod;
    });
  }, [paymentSubmissions, queueSearch, statusFilter, methodFilter]);

  const openSubmissions = useMemo(() => {
    return paymentSubmissions.filter(s => s.status === 'open');
  }, [paymentSubmissions]);
  const openSubmissionsCount = openSubmissions.length;
  const openSubmissionsAmount = useMemo(() => {
    return openSubmissions.reduce((sum, s) => sum + s.amount, 0);
  }, [openSubmissions]);
  const accountedSubmissionsCount = paymentSubmissions.filter(s => s.status === 'accounted').length;
  const rejectedSubmissionsCount = paymentSubmissions.filter(s => s.status === 'rejected').length;

  // ---------------------------------------------------------------------------
  // ACTION HANDLERS
  // ---------------------------------------------------------------------------

  // Unified Payment: Mark Accounted
  const handleStartUnifiedAccount = (item: UnifiedPaymentItem) => {
    setSelectedUnifiedItem(item);
    setActionModal('unified_account');
  };

  const handleConfirmUnifiedAccount = async () => {
    if (!selectedUnifiedItem) return;
    try {
      setIsProcessingAction(true);
      if (selectedUnifiedItem.invoiceId) {
        await confirmInvoicePayment(selectedUnifiedItem.invoiceId);
      } else if (selectedUnifiedItem.rawPayment) {
        await markDirectPaymentAccounted(selectedUnifiedItem.rawPayment.id);
      }
      setActionModal(null);
      setSelectedUnifiedItem(null);
    } catch (err) {
      // Toast triggered in context
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Unified Payment: Reject
  const handleStartUnifiedReject = (item: UnifiedPaymentItem) => {
    setSelectedUnifiedItem(item);
    setRejectionReason('');
    setActionModal('unified_reject');
  };

  const handleConfirmUnifiedReject = async () => {
    if (!selectedUnifiedItem) return;
    if (!rejectionReason.trim()) {
      addToast('A rejection reason is mandatory', 'warning');
      return;
    }
    try {
      setIsProcessingAction(true);
      if (selectedUnifiedItem.invoiceId) {
        await rejectInvoicePayment(selectedUnifiedItem.invoiceId, rejectionReason.trim());
      } else if (selectedUnifiedItem.rawPayment) {
        await rejectDirectPayment(selectedUnifiedItem.rawPayment.id, rejectionReason.trim());
      }
      setActionModal(null);
      setSelectedUnifiedItem(null);
    } catch (err) {
      // Toast triggered in context
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Bulk Confirm all Open Payments
  const handleBulkConfirmOpenPayments = async () => {
    const openInvoiceIds = openPayments
      .filter(p => p.invoiceId)
      .map(p => p.invoiceId!)
      .filter((id, index, self) => self.indexOf(id) === index);

    try {
      setIsProcessingAction(true);
      if (openInvoiceIds.length > 0) {
        await bulkConfirmInvoicePayments(openInvoiceIds);
      }
      // Also account any direct open payments
      const openDirectPayments = openPayments.filter(p => !p.invoiceId && p.rawPayment);
      for (const dp of openDirectPayments) {
        if (dp.rawPayment) {
          await markDirectPaymentAccounted(dp.rawPayment.id);
        }
      }
    } catch (err) {
      // Toast handled in context
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Customer Claims Queue Handlers
  const handleOpenDetail = (submission: CustomerPaymentSubmission) => {
    setSelectedSubmission(submission);
    setIsDetailModalOpen(true);
  };

  const handleStartClaimVerify = (submission: CustomerPaymentSubmission) => {
    setSelectedSubmission(submission);
    setVerificationNotes('');
    setActionModal('claim_verify');
  };

  const handleStartClaimReject = (submission: CustomerPaymentSubmission) => {
    setSelectedSubmission(submission);
    setRejectionReason('');
    setActionModal('claim_reject');
  };

  const handleConfirmClaimVerify = async () => {
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

  const handleConfirmClaimReject = async () => {
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

  const renderClaimStatusBadge = (status: PaymentSubmissionStatus) => {
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
            Payments & Collections
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage all direct payments, invoice allocations, and verify customer payments in one unified ledger.
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

      {/* 2. Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 ${
            activeTab === 'payments'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payments & Collections</span>
          {openPaymentsCount > 0 ? (
            <span className="text-xs font-bold font-mono-numbers bg-amber-500 text-white px-2.5 py-0.5 rounded-full animate-pulse">
              {openPaymentsCount} Pending
            </span>
          ) : (
            <span className="text-xs font-mono-numbers bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
              {unifiedPayments.length}
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
          <span>Customer Payment Verification Queue</span>
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
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: UNIFIED PAYMENTS & COLLECTIONS                                 */}
      {/* Both direct payments and invoice allocations show together here           */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* 1. Total Collections */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Payments & Collections</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-slate-900 font-mono-numbers">
                  ₹{totalCollectionsAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-semibold text-slate-500 font-mono-numbers">
                  {unifiedPayments.length} Entries
                </span>
              </div>
            </div>

            {/* 2. Open / Pending Confirmation */}
            <div className="p-4 bg-white rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">Open / Pending Confirmation</span>
                {openPaymentsCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-amber-900 font-mono-numbers">
                  ₹{openPaymentsAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-bold text-amber-700 font-mono-numbers">
                  {openPaymentsCount} Awaiting Accounting
                </span>
              </div>
            </div>

            {/* 3. Accounted & Settled */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 bg-emerald-50/20 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Accounted & Settled</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-800 font-mono-numbers">
                  ₹{accountedPaymentsAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-bold text-emerald-700 font-mono-numbers">
                  {accountedPaymentsCount} Verified
                </span>
              </div>
            </div>
          </div>

          {/* Prompt banner for open payments if any exist */}
          {openPaymentsCount > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5 sm:mt-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                    <span>{openPaymentsCount} Payment{openPaymentsCount > 1 ? 's' : ''} in Open Status Awaiting Confirmation</span>
                    <span className="text-xs bg-amber-200 text-amber-900 font-extrabold px-2 py-0.5 rounded-full font-mono-numbers">
                      ₹{openPaymentsAmount.toLocaleString('en-IN')}
                    </span>
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Payments recorded via "+ Record Direct Payment" and directly via "Allocate Payment" on invoices are listed below. Click <strong>Mark Accounted</strong> to post the ledger credit and settle, or <strong>Reject</strong> if invalid.
                  </p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={handleBulkConfirmOpenPayments}
                  disabled={isProcessingAction}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
                >
                  {isProcessingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Bulk Confirm All Open ({openPaymentsCount})</span>
                </button>
              )}
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={paymentSearch}
                onChange={e => setPaymentSearch(e.target.value)}
                placeholder="Search retailer, receipt #, invoice #, UTR..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            {/* Filter Chips & Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Status Chips */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {(['all', 'open', 'accounted', 'rejected'] as const).map(st => {
                  const label =
                    st === 'all'
                      ? `All (${unifiedPayments.length})`
                      : st === 'open'
                      ? `Open (${openPaymentsCount})`
                      : st === 'accounted'
                      ? `Accounted (${accountedPaymentsCount})`
                      : `Rejected (${rejectedPaymentsCount})`;
                  return (
                    <button
                      key={st}
                      onClick={() => setPaymentStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                        paymentStatusFilter === st
                          ? 'bg-white text-blue-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Source Filter */}
              <select
                value={paymentSourceFilter}
                onChange={e => setPaymentSourceFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none"
              >
                <option value="all">All Sources</option>
                <option value="invoice_allocation">Invoice Allocation</option>
                <option value="direct_payment">Direct Payment</option>
              </select>

              {/* Method Filter */}
              <select
                value={paymentMethodFilter}
                onChange={e => setPaymentMethodFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none"
              >
                <option value="all">All Methods</option>
                <option value="upi">UPI / QR</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Unified Payments Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[950px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Receipt / Ref #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Retailer</th>
                    <th className="p-3">Payment Source / Invoice</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Reference / UTR</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredUnifiedPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-sans">
                        No payments found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUnifiedPayments.map(p => {
                      const isRejected = p.notes?.includes('[REJECTED:');
                      const isOpen = !p.isAccounted && !isRejected;

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isOpen ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          {/* Receipt Number */}
                          <td className="p-3 font-semibold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{p.paymentNumber}</span>
                            </div>
                          </td>

                          {/* Date */}
                          <td className="p-3 text-slate-600 font-sans">
                            {new Date(p.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>

                          {/* Retailer */}
                          <td className="p-3 font-sans font-bold text-slate-900">
                            {p.retailerName}
                          </td>

                          {/* Payment Source / Linked Invoice */}
                          <td className="p-3 font-sans">
                            {p.sourceType === 'invoice_allocation' ? (
                              <div className="flex flex-col">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 w-fit">
                                  <FileText className="w-3 h-3 text-blue-600" />
                                  <span>{p.invoiceNumber}</span>
                                </span>
                                {p.rawInvoice && (
                                  <span className="text-[10px] text-slate-400 mt-0.5">
                                    Status: {p.rawInvoice.status === 'open_payment' ? 'Open Payment' : p.rawInvoice.status}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit">
                                <Banknote className="w-3 h-3 text-slate-600" />
                                <span>Direct Payment</span>
                              </span>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="p-3 text-right font-black text-slate-900">
                            ₹{p.amount.toLocaleString('en-IN')}
                          </td>

                          {/* Payment Method */}
                          <td className="p-3 font-sans capitalize">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                              {p.paymentMethod.replace('_', ' ')}
                            </span>
                          </td>

                          {/* Reference / UTR */}
                          <td className="p-3 text-slate-600">
                            <span className="truncate max-w-[140px] block" title={p.reference}>
                              {p.reference || '—'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-3 font-sans">
                            {isRejected ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                                <XCircle className="w-3 h-3 text-red-600" />
                                <span>Rejected</span>
                              </span>
                            ) : isOpen ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full border border-amber-300">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Open / Pending</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Accounted</span>
                              </span>
                            )}
                          </td>

                          {/* Actions: Mark Accounted & Reject */}
                          <td className="p-3 text-right font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              {isOpen && isAdmin ? (
                                <>
                                  <button
                                    onClick={() => handleStartUnifiedAccount(p)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                                    title="Mark Accounted & Settle"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Mark Accounted</span>
                                  </button>
                                  <button
                                    onClick={() => handleStartUnifiedReject(p)}
                                    className="px-2 py-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors flex items-center gap-1"
                                    title="Reject Payment"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              ) : isOpen && !isAdmin ? (
                                <span className="text-[11px] font-medium text-slate-400">
                                  Awaiting Admin Approval
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-slate-400">
                                  {isRejected ? 'Voided' : 'Settled'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: CUSTOMER PAYMENT VERIFICATION QUEUE (ONLINE CLAIMS)            */}
      {/* ========================================================================= */}
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
                        No customer payment submissions found.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map(sub => (
                      <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-slate-600 font-sans">
                          {new Date(sub.createdAt || Date.now()).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="p-3 font-sans font-bold text-slate-900">
                          {sub.customerName || 'Retailer Customer'}
                          {sub.customerCode && (
                            <span className="block text-[10px] text-slate-400 font-mono">
                              {sub.customerCode}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-blue-600 font-sans">
                          {sub.invoiceNumber || '—'}
                        </td>
                        <td className="p-3 text-right font-black text-slate-900">
                          ₹{sub.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 font-sans capitalize text-slate-700">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                            {sub.paymentMethodType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-slate-800 font-mono">
                          {sub.transactionReference}
                        </td>
                        <td className="p-3 font-sans">
                          {renderClaimStatusBadge(sub.status)}
                        </td>
                        <td className="p-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenDetail(sub)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {sub.status === 'open' && isAdmin ? (
                              <>
                                <button
                                  onClick={() => handleStartClaimVerify(sub)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                                  title="Mark as Accounted"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Verify</span>
                                </button>
                                <button
                                  onClick={() => handleStartClaimReject(sub)}
                                  className="px-2 py-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors flex items-center gap-1"
                                  title="Reject Submission"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Reject</span>
                                </button>
                              </>
                            ) : sub.status === 'open' && !isAdmin ? (
                              <span className="text-[11px] font-medium text-slate-400">
                                Staff View
                              </span>
                            ) : null}
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

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}

      {/* 1. Unified Payment: Confirm / Mark Accounted Modal */}
      {actionModal === 'unified_account' && selectedUnifiedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-700 font-bold text-lg pb-3 border-b border-slate-100">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <span>Mark Payment as Accounted</span>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Confirm that payment of{' '}
                <strong className="text-slate-900 font-mono-numbers">
                  ₹{selectedUnifiedItem.amount.toLocaleString('en-IN')}
                </strong>{' '}
                from <strong className="text-slate-900">{selectedUnifiedItem.retailerName}</strong> has been received and verified.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 font-mono-numbers text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Payment Ref:</span>
                  <span className="font-bold text-slate-900">{selectedUnifiedItem.paymentNumber}</span>
                </div>
                {selectedUnifiedItem.invoiceNumber && selectedUnifiedItem.invoiceNumber !== 'Direct Payment' && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Linked Invoice:</span>
                    <span className="font-bold text-blue-600 font-sans">{selectedUnifiedItem.invoiceNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Payment Method:</span>
                  <span className="font-semibold text-slate-800 capitalize font-sans">{selectedUnifiedItem.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">UTR / Reference:</span>
                  <span className="font-mono text-slate-800">{selectedUnifiedItem.reference || '—'}</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 text-[11px] space-y-1 font-sans">
                <span className="font-bold block">Financial Accounting Impact:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Marks this collection record as permanently Accounted.</li>
                  <li>Posts Double-Entry credit to Customer Financial Ledger.</li>
                  {selectedUnifiedItem.invoiceId && (
                    <li>Settle Invoice {selectedUnifiedItem.invoiceNumber} and reconciles order payment status.</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => {
                  setActionModal(null);
                  setSelectedUnifiedItem(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleConfirmUnifiedAccount}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Mark Accounted</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Unified Payment: Reject Modal */}
      {actionModal === 'unified_reject' && selectedUnifiedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-700 font-bold text-lg pb-3 border-b border-slate-100">
              <XCircle className="w-6 h-6 text-red-600 shrink-0" />
              <span>Reject / Void Payment</span>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Provide a reason for rejecting payment of{' '}
                <strong className="text-slate-900 font-mono-numbers">
                  ₹{selectedUnifiedItem.amount.toLocaleString('en-IN')}
                </strong>{' '}
                from <strong className="text-slate-900">{selectedUnifiedItem.retailerName}</strong>:
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Bank bounced, invalid reference, duplicate entry..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {selectedUnifiedItem.invoiceId && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-amber-900 text-[11px]">
                  <strong>Invoice Effect:</strong> Invoice {selectedUnifiedItem.invoiceNumber} will revert to Delivered status with outstanding balance preserved.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => {
                  setActionModal(null);
                  setSelectedUnifiedItem(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingAction || !rejectionReason.trim()}
                onClick={handleConfirmUnifiedReject}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Customer Claim Verify Modal */}
      {actionModal === 'claim_verify' && selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-700 font-bold text-lg pb-3 border-b border-slate-100">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <span>Verify & Mark as Accounted</span>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Confirm that customer payment claim of{' '}
                <strong className="text-slate-900 font-mono-numbers">
                  ₹{selectedSubmission.amount.toLocaleString('en-IN')}
                </strong>{' '}
                with reference{' '}
                <strong className="text-slate-900 font-mono-numbers">
                  {selectedSubmission.transactionReference}
                </strong>{' '}
                has been verified against your official bank statement or UPI merchant dashboard.
              </p>

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
                onClick={handleConfirmClaimVerify}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingAction && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirm & Post Ledger</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Customer Claim Reject Modal */}
      {actionModal === 'claim_reject' && selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-700 font-bold text-lg pb-3 border-b border-slate-100">
              <XCircle className="w-6 h-6 text-red-600 shrink-0" />
              <span>Reject Payment Submission</span>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Provide a clear reason why the customer submission of{' '}
                <strong className="text-slate-900 font-mono-numbers">
                  ₹{selectedSubmission.amount.toLocaleString('en-IN')}
                </strong>{' '}
                is not being accepted.
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
                onClick={handleConfirmClaimReject}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingAction && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Reject Submission</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Customer Claim Detail Drawer / Modal */}
      {isDetailModalOpen && selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Payment Claim Audit
                </h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Retailer Customer</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{selectedSubmission.customerName || '—'}</span>
                  {selectedSubmission.customerCode && (
                    <span className="text-[10px] text-slate-500 font-mono">{selectedSubmission.customerCode}</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Invoice Number</span>
                  <span className="font-bold text-blue-600 block mt-0.5">{selectedSubmission.invoiceNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Claimed Amount</span>
                  <span className="text-base font-black text-slate-900 block mt-0.5 font-mono-numbers">
                    ₹{selectedSubmission.amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment Method</span>
                  <span className="font-semibold text-slate-800 block mt-0.5 capitalize">
                    {selectedSubmission.paymentMethodType.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Transaction Reference / UTR:</span>
                  <span className="font-bold font-mono text-slate-900">{selectedSubmission.transactionReference}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Submitted Timestamp:</span>
                  <span className="font-mono-numbers text-slate-800">
                    {new Date(selectedSubmission.createdAt || Date.now()).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Verification Status:</span>
                  <div>{renderClaimStatusBadge(selectedSubmission.status)}</div>
                </div>
                {selectedSubmission.notes && (
                  <div className="py-1.5">
                    <span className="text-slate-500 block">Customer Remarks:</span>
                    <p className="mt-0.5 p-2 bg-slate-50 rounded-lg text-slate-700 italic border border-slate-100">
                      "{selectedSubmission.notes}"
                    </p>
                  </div>
                )}
                {selectedSubmission.receiptUrl && (
                  <div className="pt-2">
                    <span className="text-slate-500 block mb-1">Receipt Attachment:</span>
                    <a
                      href={selectedSubmission.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Uploaded Proof</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Close
              </button>
              {selectedSubmission.status === 'open' && isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleStartClaimReject(selectedSubmission);
                    }}
                    className="px-3.5 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl font-bold border border-red-200 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleStartClaimVerify(selectedSubmission);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition-colors"
                  >
                    Verify & Account
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
