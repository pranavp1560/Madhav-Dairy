import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDairy } from '../../context/DairyContext';
import { paymentService } from '../../services/paymentService';
import {
  PaymentMethod,
  CustomerOutstandingSummary,
  CustomerOutstandingInvoice,
  RecordCustomerPaymentResult,
  Retailer,
} from '../../types/dairy';
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  Banknote,
  Building,
  Smartphone,
  Calendar,
  FileText,
  User,
  Zap,
  RotateCcw,
  Printer,
  ChevronRight,
  ShieldCheck,
  Check,
  Hash,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface RecordPaymentViewProps {
  initialCustomerId?: string;
  onBack: () => void;
  onNavigateToLedger?: (customerId: string) => void;
}

export const RecordPaymentView: React.FC<RecordPaymentViewProps> = ({
  initialCustomerId,
  onBack,
  onNavigateToLedger,
}) => {
  const { retailers, setInternalView, setSelectedRetailerId, addToast } = useDairy();

  // Selected customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
  const [customerSummary, setCustomerSummary] = useState<CustomerOutstandingSummary | null>(null);
  const [invoices, setInvoices] = useState<CustomerOutstandingInvoice[]>([]);
  const [isLoadingCustomerData, setIsLoadingCustomerData] = useState(false);

  // Customer search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Invoice allocations: invoice_id -> allocated amount
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  // Submission & Success state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<RecordCustomerPaymentResult | null>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter retailers for search
  const filteredRetailers = useMemo(() => {
    if (!searchQuery.trim()) return retailers.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return retailers.filter(
      r =>
        r.businessName.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q) ||
        (r.mobile && r.mobile.toLowerCase().includes(q)) ||
        (r.customerCode && r.customerCode.toLowerCase().includes(q)) ||
        (r.area && r.area.toLowerCase().includes(q))
    ).slice(0, 12);
  }, [retailers, searchQuery]);

  // Load customer outstanding summary and invoices
  const loadCustomerDetails = async (custId: string) => {
    if (!custId) {
      setCustomerSummary(null);
      setInvoices([]);
      setAllocations({});
      return;
    }

    setIsLoadingCustomerData(true);
    setErrorMessage(null);
    try {
      const [summary, invList] = await Promise.all([
        paymentService.getCustomerOutstandingSummary(custId),
        paymentService.getCustomerOutstandingInvoices(custId),
      ]);

      setCustomerSummary(summary);
      setInvoices(invList);
      setAllocations({});

      // Auto-set default payment amount to total outstanding if available
      if (summary && summary.total_outstanding > 0) {
        setPaymentAmount(summary.total_outstanding);
        // Automatically FIFO-allocate full outstanding
        const initialAllocs: Record<string, number> = {};
        let rem = summary.total_outstanding;
        for (const inv of invList) {
          const invId = inv.id || (inv as any).invoice_id;
          if (rem <= 0) break;
          const toAlloc = Math.min(rem, inv.outstanding_amount);
          if (toAlloc > 0) {
            initialAllocs[invId] = toAlloc;
            rem -= toAlloc;
          }
        }
        setAllocations(initialAllocs);
      } else {
        setPaymentAmount('');
      }
    } catch (err: any) {
      console.error('Error loading customer payment data:', err);
      setErrorMessage(err.message || 'Failed to load customer outstanding invoices.');
      addToast('Failed to load customer invoices', 'error');
    } finally {
      setIsLoadingCustomerData(false);
    }
  };

  // If initialCustomerId changes or on mount
  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomerDetails(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const handleSelectCustomer = (retailer: Retailer) => {
    setSelectedCustomerId(retailer.id);
    setSearchQuery('');
    setIsSearchOpen(false);
    setSuccessResult(null);
    setErrorMessage(null);
  };

  const handleResetCustomer = () => {
    setSelectedCustomerId('');
    setCustomerSummary(null);
    setInvoices([]);
    setAllocations({});
    setPaymentAmount('');
    setReferenceNumber('');
    setNotes('');
    setSuccessResult(null);
    setErrorMessage(null);
  };

  // Calculations
  const numericPaymentAmount = typeof paymentAmount === 'number' ? paymentAmount : 0;
  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);
  }, [allocations]);

  const customerTotalOutstanding = customerSummary ? customerSummary.total_outstanding : 0;
  const remainingCustomerBalance = Math.max(0, customerTotalOutstanding - numericPaymentAmount);
  const unallocatedAmount = numericPaymentAmount - totalAllocated;

  // Validation checks
  const isAmountValid = numericPaymentAmount > 0;
  const isAmountWithinOutstanding = numericPaymentAmount <= customerTotalOutstanding;
  const isAllocationBalanced = Math.abs(unallocatedAmount) < 0.01;
  const hasInvoices = invoices.length > 0;

  const canSubmit =
    !isSubmitting &&
    selectedCustomerId !== '' &&
    hasInvoices &&
    isAmountValid &&
    isAmountWithinOutstanding &&
    isAllocationBalanced &&
    referenceNumber.trim().length > 0;

  // Manual Allocation change on single invoice
  const handleAllocationChange = (invoiceId: string, valueStr: string) => {
    const rawVal = parseFloat(valueStr);
    const val = isNaN(rawVal) || rawVal < 0 ? 0 : rawVal;
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    // Cap at invoice outstanding amount
    const cappedVal = Math.min(val, inv.outstanding_amount);

    setAllocations(prev => {
      const next = { ...prev };
      if (cappedVal === 0) {
        delete next[invoiceId];
      } else {
        next[invoiceId] = cappedVal;
      }
      return next;
    });
  };

  // Quick Action: Pay Full for single invoice
  const handlePayFullInvoice = (invoice: CustomerOutstandingInvoice) => {
    const invId = invoice.id || (invoice as any).invoice_id;
    setAllocations(prev => ({
      ...prev,
      [invId]: invoice.outstanding_amount,
    }));
  };

  // Auto-Allocate (FIFO Oldest First)
  const handleAutoAllocate = () => {
    if (!numericPaymentAmount || numericPaymentAmount <= 0) {
      addToast('Please enter a payment amount first to auto-allocate', 'warning');
      return;
    }

    if (numericPaymentAmount > customerTotalOutstanding) {
      addToast('Payment amount exceeds customer total outstanding balance', 'error');
      return;
    }

    let remainingToDistribute = numericPaymentAmount;
    const newAllocations: Record<string, number> = {};

    // Invoices are already sorted oldest first by RPC (invoice_date ASC)
    for (const inv of invoices) {
      const invId = inv.id || (inv as any).invoice_id;
      if (remainingToDistribute <= 0) break;
      const allocForInv = Math.min(remainingToDistribute, inv.outstanding_amount);
      if (allocForInv > 0) {
        newAllocations[invId] = allocForInv;
        remainingToDistribute -= allocForInv;
      }
    }

    setAllocations(newAllocations);
    addToast(
      `Auto-allocated ₹${numericPaymentAmount.toLocaleString('en-IN')} across ${Object.keys(newAllocations).length} oldest invoices`,
      'success'
    );
  };

  // Clear all allocations
  const handleClearAllocations = () => {
    setAllocations({});
  };

  // Submit payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedCustomerId) {
      setErrorMessage('Please select a customer.');
      return;
    }

    if (!numericPaymentAmount || numericPaymentAmount <= 0) {
      setErrorMessage('Payment amount must be greater than zero.');
      return;
    }

    if (numericPaymentAmount > customerTotalOutstanding) {
      setErrorMessage(
        `Payment amount (₹${numericPaymentAmount.toLocaleString('en-IN')}) cannot exceed customer total outstanding (₹${customerTotalOutstanding.toLocaleString('en-IN')}).`
      );
      return;
    }

    if (Math.abs(unallocatedAmount) >= 0.01) {
      setErrorMessage(
        `Total allocated (₹${totalAllocated.toLocaleString('en-IN')}) must exactly match payment amount (₹${numericPaymentAmount.toLocaleString('en-IN')}). Difference: ₹${unallocatedAmount.toLocaleString('en-IN')}.`
      );
      return;
    }

    if (!referenceNumber.trim()) {
      setErrorMessage('Please provide a reference number (e.g. UPI Ref / UTR / Cheque / Voucher).');
      return;
    }

    // Prepare allocations payload
    const allocPayload = Object.entries(allocations)
      .filter(([_, amt]) => amt > 0)
      .map(([invId, amt]) => ({
        invoice_id: invId,
        amount: Number(amt.toFixed(2)),
      }));

    if (allocPayload.length === 0) {
      setErrorMessage('Please allocate payment to at least one outstanding invoice.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await paymentService.recordCustomerPaymentWithAllocations({
        customerId: selectedCustomerId,
        paymentAmount: numericPaymentAmount,
        paymentMethod,
        allocations: allocPayload,
        referenceNumber: referenceNumber.trim(),
        notes: notes.trim() || undefined,
        paymentDate,
      });

      setSuccessResult(result);
      addToast(
        `Payment ${result.payment_number} of ₹${numericPaymentAmount.toLocaleString('en-IN')} recorded successfully!`,
        'success'
      );
    } catch (err: any) {
      console.error('Error recording payment with allocations:', err);
      setErrorMessage(err.message || 'Failed to record customer payment.');
      addToast(err.message || 'Payment submission failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for reference placeholder
  const getReferencePlaceholder = () => {
    switch (paymentMethod) {
      case 'upi':
        return 'e.g. UPI Ref: 428910398281';
      case 'bank_transfer':
        return 'e.g. Bank UTR / NEFT: HDFC0001234918';
      case 'cheque':
        return 'e.g. Cheque No: 004128 (SBI Branch)';
      case 'cash':
        return 'e.g. Cash Counter Voucher #042';
      default:
        return 'e.g. Payment Reference / Note';
    }
  };

  // Selected Retailer info
  const selectedRetailerObj = retailers.find(r => r.id === selectedCustomerId);

  // -------------------------------------------------------------
  // SUCCESS RECEIPT VIEW
  // -------------------------------------------------------------
  if (successResult) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Payments</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={handleResetCustomer}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Record Another Payment</span>
            </button>
          </div>
        </div>

        {/* Success Card */}
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 md:p-8 text-white">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/30 text-emerald-100 text-[11px] font-bold uppercase tracking-wider backdrop-blur-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Payment Recorded & Invoices Allocated</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black mt-2">
                  ₹{successResult.payment_amount.toLocaleString('en-IN')} Collected
                </h1>
                <p className="text-emerald-100 text-xs">
                  Receipt #{successResult.payment_number} • {successResult.payment_date}
                </p>
              </div>

              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xs border border-white/20 text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-200 block">
                  Remaining Customer Balance
                </span>
                <span className="text-xl font-black text-white font-mono-numbers mt-0.5 block">
                  ₹{successResult.remaining_customer_outstanding.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Summary Meta */}
          <div className="p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer</span>
                <span className="font-bold text-slate-900 block mt-0.5">{successResult.customer_name}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment Mode</span>
                <span className="font-bold text-slate-900 uppercase block mt-0.5">{successResult.payment_method}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Reference / UTR</span>
                <span className="font-mono text-slate-900 font-bold block mt-0.5">{successResult.reference_number}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 mt-0.5">
                  <Clock className="w-3 h-3" />
                  <span>Open Payment (Pending Audit)</span>
                </span>
              </div>
            </div>

            {/* Allocated Invoices Breakdown */}
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Allocated Invoices Breakdown ({successResult.allocations?.length || 0})
              </h3>
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Invoice #</th>
                      <th className="p-3 text-right">Allocated Amount</th>
                      <th className="p-3 text-right">Remaining Due</th>
                      <th className="p-3 text-center">Settlement Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono-numbers">
                    {successResult.allocations?.map(alloc => (
                      <tr key={alloc.invoice_id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-900">{alloc.invoice_number}</td>
                        <td className="p-3 text-right font-black text-emerald-600">
                          ₹{alloc.allocated_amount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right text-slate-700">
                          ₹{alloc.remaining_balance.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-center font-sans">
                          {alloc.remaining_balance === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              <Check className="w-3 h-3" />
                              <span>Fully Paid</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              <span>Partially Paid</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (onNavigateToLedger) {
                      onNavigateToLedger(successResult.customer_id);
                    } else {
                      setSelectedRetailerId(successResult.customer_id);
                      setInternalView('ledger');
                    }
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>View Customer Ledger</span>
                </button>
                <button
                  onClick={onBack}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  Return to Payments
                </button>
              </div>

              <button
                onClick={handleResetCustomer}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Record Another Payment</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MAIN WORKFLOW VIEW
  // -------------------------------------------------------------
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Payments</span>
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Record Customer Payment & Invoice Allocation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Collect payment, view authoritative customer dues, and allocate funds across outstanding invoices.
          </p>
        </div>

        {selectedCustomerId && (
          <button
            type="button"
            onClick={handleResetCustomer}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-red-600 bg-white border border-slate-200 hover:border-red-200 rounded-xl transition-colors shadow-2xs"
          >
            Change Customer
          </button>
        )}
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-800 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Validation Notice</span>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-700 text-sm font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Step 1: Customer Selection */}
      {!selectedCustomerId ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-5">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
              <User className="w-4 h-4" />
              <span>Step 1: Select Customer</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              Search & Choose a Customer to Record Payment
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Type retailer name, mobile number, customer code, or location to view current dues.
            </p>
          </div>

          <div ref={searchContainerRef} className="relative max-w-2xl">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Search by customer name, code (e.g. RET-8888), mobile, or area..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs md:text-sm font-medium focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all shadow-inner"
                autoFocus
              />
            </div>

            {/* Dropdown list */}
            {isSearchOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-80 overflow-y-auto z-40 divide-y divide-slate-100">
                {filteredRetailers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No customers match "{searchQuery}"
                  </div>
                ) : (
                  filteredRetailers.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelectCustomer(r)}
                      className="w-full p-3.5 text-left hover:bg-blue-50/50 transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs md:text-sm group-hover:text-blue-600 transition-colors">
                            {r.businessName}
                          </span>
                          {r.customerCode && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-semibold">
                              {r.customerCode}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                          <span>{r.ownerName}</span>
                          <span>•</span>
                          <span>{r.mobile}</span>
                          {r.area && (
                            <>
                              <span>•</span>
                              <span>{r.area}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Current Due
                        </span>
                        <span
                          className={`text-xs md:text-sm font-black font-mono-numbers ${
                            (r.outstandingAmount || 0) > 0 ? 'text-red-600' : 'text-slate-700'
                          }`}
                        >
                          ₹{Math.max(0, r.outstandingAmount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Selected Customer Summary Header */
        <div className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <Building className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900">
                    {customerSummary?.business_name || selectedRetailerObj?.businessName}
                  </h2>
                  {(customerSummary?.customer_code || selectedRetailerObj?.customerCode) && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-mono font-bold border border-slate-200">
                      {customerSummary?.customer_code || selectedRetailerObj?.customerCode}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                  {selectedRetailerObj?.ownerName && <span>Prop: {selectedRetailerObj.ownerName}</span>}
                  <span>•</span>
                  <span>{customerSummary?.mobile || selectedRetailerObj?.mobile}</span>
                  {selectedRetailerObj?.area && (
                    <>
                      <span>•</span>
                      <span>{selectedRetailerObj.area}</span>
                    </>
                  )}
                  {selectedRetailerObj?.paymentTerms && (
                    <>
                      <span>•</span>
                      <span className="text-slate-600 font-semibold">{selectedRetailerObj.paymentTerms}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Outstanding Summary Metric */}
            <div className="flex items-center gap-3 bg-red-50/70 border border-red-200/80 rounded-2xl p-3.5 sm:px-5">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-red-600 block tracking-wide">
                  Total Outstanding Balance
                </span>
                <span className="text-2xl font-black text-red-600 font-mono-numbers block leading-tight">
                  ₹{customerTotalOutstanding.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-red-500 font-medium">
                  {invoices.length} unpaid / open invoice{invoices.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Flow: If Customer Selected */}
      {selectedCustomerId && (
        <form onSubmit={handleSubmitPayment} className="space-y-6">
          {isLoadingCustomerData ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3" />
              <p className="text-xs text-slate-500 font-medium">
                Fetching authoritative customer invoices and balances...
              </p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                No Outstanding Invoices
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                This customer currently has zero open dues. All delivered invoices have been fully settled or accounted for.
              </p>
              <button
                type="button"
                onClick={handleResetCustomer}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
              >
                Select Another Customer
              </button>
            </div>
          ) : (
            <>
              {/* Payment Details Input Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
                  <Banknote className="w-4 h-4" />
                  <span>Step 2: Payment Collection Details</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Payment Amount */}
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Payment Amount (₹) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="1"
                        max={customerTotalOutstanding}
                        step="any"
                        value={paymentAmount}
                        onChange={e => {
                          const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                          setPaymentAmount(val);
                        }}
                        placeholder="0.00"
                        className={`w-full pl-8 pr-4 py-2.5 bg-slate-50 border rounded-xl text-sm font-bold font-mono-numbers focus:outline-none focus:bg-white focus:ring-2 transition-all ${
                          numericPaymentAmount > customerTotalOutstanding
                            ? 'border-red-400 focus:border-red-600 focus:ring-red-100 text-red-600'
                            : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100 text-slate-900'
                        }`}
                        required
                      />
                    </div>
                    {/* Quick fill buttons */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentAmount(customerTotalOutstanding);
                          // Auto allocate immediately
                          let rem = customerTotalOutstanding;
                          const newAllocs: Record<string, number> = {};
                          for (const inv of invoices) {
                            const invId = inv.id || (inv as any).invoice_id;
                            if (rem <= 0) break;
                            const toAlloc = Math.min(rem, inv.outstanding_amount);
                            if (toAlloc > 0) {
                              newAllocs[invId] = toAlloc;
                              rem -= toAlloc;
                            }
                          }
                          setAllocations(newAllocs);
                        }}
                        className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md transition-colors"
                      >
                        Full Dues (₹{customerTotalOutstanding.toLocaleString('en-IN')})
                      </button>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                    >
                      <option value="upi">UPI (GPay / PhonePe / QR)</option>
                      <option value="cash">Cash (Counter / Agent)</option>
                      <option value="bank_transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                      <option value="cheque">Bank Cheque</option>
                      <option value="other">Other Settlement</option>
                    </select>
                  </div>

                  {/* Payment Date */}
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Payment Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Reference / UTR Number */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Reference / UTR / Voucher # <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={e => setReferenceNumber(e.target.value)}
                      placeholder={getReferencePlaceholder()}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                      required
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Internal Notes / Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. Received via sales route driver / cashier note"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Outstanding Invoices & Multi-Invoice Allocation */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
                      <FileText className="w-4 h-4" />
                      <span>Step 3: Allocate Funds Across Invoices</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Invoices are sorted oldest-first. Use Auto-Allocate or manually enter allocation amounts.
                    </p>
                  </div>

                  {/* Auto-Allocate & Reset Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoAllocate}
                      disabled={!numericPaymentAmount || numericPaymentAmount <= 0}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-200"
                    >
                      <Zap className="w-3.5 h-3.5 fill-blue-600 text-blue-600" />
                      <span>Auto-Allocate (FIFO)</span>
                    </button>
                    {totalAllocated > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllocations}
                        className="px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Invoices Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[700px]">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-10 text-center">#</th>
                          <th className="p-3">Invoice Details</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Invoice Total</th>
                          <th className="p-3 text-right">Already Paid</th>
                          <th className="p-3 text-right font-bold text-slate-900">Remaining Due</th>
                          <th className="p-3 text-right w-44">Allocate (₹)</th>
                          <th className="p-3 w-24 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono-numbers">
                        {invoices.map((inv, idx) => {
                          const invId = inv.id || (inv as any).invoice_id;
                          const currentAlloc = allocations[invId] || 0;
                          const isAllocated = currentAlloc > 0;
                          const remainingAfterThis = Math.max(0, inv.outstanding_amount - currentAlloc);
                          const isPastDue = inv.due_date && new Date(inv.due_date) < new Date();

                          return (
                            <tr
                              key={invId}
                              className={`transition-colors ${
                                isAllocated ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'
                              }`}
                            >
                              <td className="p-3 text-center font-sans text-slate-400 font-bold">
                                {idx + 1}
                              </td>

                              {/* Invoice Details */}
                              <td className="p-3 font-sans">
                                <div className="font-bold text-slate-900">{inv.invoice_number}</div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span>Date: {inv.invoice_date}</span>
                                  {inv.due_date && (
                                    <>
                                      <span>•</span>
                                      <span className={isPastDue ? 'text-red-600 font-semibold' : ''}>
                                        Due: {inv.due_date} {isPastDue && '(Overdue)'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="p-3 font-sans">
                                {inv.status === 'ready' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Ready
                                  </span>
                                )}
                                {inv.status === 'delivered' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                    Delivered
                                  </span>
                                )}
                                {inv.status === 'open_payment' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                                    Open Payment
                                  </span>
                                )}
                              </td>

                              {/* Total Amount */}
                              <td className="p-3 text-right text-slate-600">
                                ₹{inv.total_amount.toLocaleString('en-IN')}
                              </td>

                              {/* Already Paid */}
                              <td className="p-3 text-right text-slate-500">
                                ₹{(inv.already_paid || 0).toLocaleString('en-IN')}
                              </td>

                              {/* Remaining Due */}
                              <td className="p-3 text-right font-black text-red-600">
                                ₹{inv.outstanding_amount.toLocaleString('en-IN')}
                              </td>

                              {/* Allocation Input */}
                              <td className="p-3 text-right">
                                <div className="relative inline-block w-full">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                    ₹
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={inv.outstanding_amount}
                                    step="any"
                                    value={currentAlloc === 0 ? '' : currentAlloc}
                                    onChange={e => handleAllocationChange(invId, e.target.value)}
                                    placeholder="0.00"
                                    className={`w-full pl-6 pr-2.5 py-1.5 text-xs font-bold rounded-lg border text-right font-mono-numbers focus:outline-none focus:ring-2 transition-all ${
                                      isAllocated
                                        ? 'bg-blue-50/80 border-blue-400 text-blue-900 focus:ring-blue-100'
                                        : 'bg-white border-slate-300 text-slate-700 focus:ring-blue-100'
                                    }`}
                                  />
                                </div>
                                {isAllocated && (
                                  <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">
                                    Leaves ₹{remainingAfterThis.toLocaleString('en-IN')}
                                  </span>
                                )}
                              </td>

                              {/* Quick Pay Full */}
                              <td className="p-3 text-center font-sans">
                                <button
                                  type="button"
                                  onClick={() => handlePayFullInvoice(inv)}
                                  className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-md transition-colors"
                                  title="Allocate full balance of this invoice"
                                >
                                  Pay Full
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Step 4: Live Reconciliation Summary & Action Bar */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-lg border border-slate-800 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                      Payment Reconciliation Barometer
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ensures every rupee entered is accounted and attributed across eligible invoices.
                    </p>
                  </div>

                  {/* Real-time status badge */}
                  <div>
                    {numericPaymentAmount <= 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Enter payment amount</span>
                      </span>
                    ) : numericPaymentAmount > customerTotalOutstanding ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Amount exceeds customer balance</span>
                      </span>
                    ) : isAllocationBalanced ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>100% Balanced & Reconciled</span>
                      </span>
                    ) : unallocatedAmount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>₹{unallocatedAmount.toLocaleString('en-IN')} unallocated</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Over-allocated by ₹{Math.abs(unallocatedAmount).toLocaleString('en-IN')}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Metric Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
                  <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Customer Current Due
                    </span>
                    <span className="text-base sm:text-lg font-black text-white font-mono-numbers mt-1 block">
                      ₹{customerTotalOutstanding.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Payment Amount
                    </span>
                    <span className="text-base sm:text-lg font-black text-blue-400 font-mono-numbers mt-1 block">
                      ₹{numericPaymentAmount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Total Allocated
                    </span>
                    <span
                      className={`text-base sm:text-lg font-black font-mono-numbers mt-1 block ${
                        isAllocationBalanced && numericPaymentAmount > 0
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      ₹{totalAllocated.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Customer Due After Pay
                    </span>
                    <span className="text-base sm:text-lg font-black text-white font-mono-numbers mt-1 block">
                      ₹{remainingCustomerBalance.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Validation Guidance message */}
                {!isAllocationBalanced && numericPaymentAmount > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        {unallocatedAmount > 0
                          ? `You have ₹${unallocatedAmount.toLocaleString('en-IN')} left to allocate. Click Auto-Allocate or distribute to invoices.`
                          : `Allocated amount exceeds payment amount by ₹${Math.abs(unallocatedAmount).toLocaleString('en-IN')}. Please reduce invoice amounts.`}
                      </span>
                    </div>
                    {unallocatedAmount > 0 && (
                      <button
                        type="button"
                        onClick={handleAutoAllocate}
                        className="px-3 py-1 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-amber-400 transition-colors shrink-0"
                      >
                        Auto-Distribute
                      </button>
                    )}
                  </div>
                )}

                {/* Bottom Action Submit Button */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
                  <div className="text-xs text-slate-400">
                    {!referenceNumber.trim() ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Please enter a Reference / UTR # to record.
                      </span>
                    ) : !canSubmit ? (
                      <span>Complete allocation to record payment.</span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ready to submit concurrency-locked transaction.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-1/2 sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="w-1/2 sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Recording...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Record Payment (₹{numericPaymentAmount.toLocaleString('en-IN')})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
};
