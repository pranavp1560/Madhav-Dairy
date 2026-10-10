import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { StatusBadge } from '../ui/StatusBadge';
import { Invoice, CustomerPaymentSubmission } from '../../types/dairy';
import { paymentMethodService } from '../../services/paymentMethodService';
import {
  CreditCard,
  Receipt,
  FileText,
  Copy,
  Check,
  Building2,
  QrCode,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Upload,
  X,
  Loader2,
  DollarSign,
  ArrowRight,
  RotateCcw
} from 'lucide-react';

interface CustomerPaymentsProps {
  onNavigate: (tab: string) => void;
}

export const CustomerPayments: React.FC<CustomerPaymentsProps> = ({ onNavigate }) => {
  const {
    currentRetailer,
    invoices,
    payments,
    paymentMethods,
    paymentSubmissions,
    submitCustomerPayment,
    addToast
  } = useDairy();

  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'invoices' | 'claims' | 'receipts'>('invoices');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Pay Now Modal State
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payMethodType, setPayMethodType] = useState<'upi' | 'bank_transfer'>('upi');
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payReference, setPayReference] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payReceiptUrl, setPayReceiptUrl] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const outstandingAmount = currentRetailer?.outstandingAmount || 0;
  const creditLimit = currentRetailer?.creditLimit || 50000;
  const paymentTerms = currentRetailer?.paymentTerms || 'Net 15 Days';

  // Strict customer isolation
  const customerInvoices = currentRetailer
    ? invoices.filter(inv => inv.retailerId === currentRetailer.id)
    : [];

  const customerPayments = currentRetailer
    ? payments.filter(pay => pay.retailerId === currentRetailer.id)
    : [];

  const customerSubmissions = currentRetailer
    ? paymentSubmissions.filter(sub => sub.customerId === currentRetailer.id)
    : [];

  // Active payment methods
  const activeBankMethods = paymentMethods.filter(m => m.methodType === 'bank_account' && m.isActive);
  const activeUpiMethods = paymentMethods.filter(m => m.methodType === 'upi' && m.isActive);

  // Default methods for hero quick cards
  const defaultBankMethod = activeBankMethods.find(m => m.isDefault) || activeBankMethods[0];
  const defaultUpiMethod = activeUpiMethods.find(m => m.isDefault) || activeUpiMethods[0];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    addToast(`${label} copied to clipboard!`, 'info');
    setTimeout(() => {
      setCopiedField(prev => (prev === label ? null : prev));
    }, 2000);
  };

  const getPendingAmountForInvoice = (invoiceId: string) => {
    return customerSubmissions
      .filter(s => s.invoiceId === invoiceId && s.status === 'open')
      .reduce((sum, s) => sum + s.amount, 0);
  };

  const handleOpenPayNow = (invoice: Invoice) => {
    setFormErrors({});
    setPayingInvoice(invoice);
    const pendingOnInv = getPendingAmountForInvoice(invoice.id);
    const maxPayable = Math.max(0, invoice.outstandingAmount - pendingOnInv);
    setPayAmount(maxPayable > 0 ? maxPayable : invoice.outstandingAmount);
    setPayMethodType('upi');
    setSelectedMethodId(defaultUpiMethod?.id || activeUpiMethods[0]?.id || '');
    setPayReference('');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayReceiptUrl('');
    setPayNotes('');
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingReceipt(true);
      const url = await paymentMethodService.uploadReceipt(file);
      setPayReceiptUrl(url);
      addToast('Receipt screenshot uploaded successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'Receipt upload failed', 'error');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const validatePaymentSubmission = () => {
    const errors: Record<string, string> = {};
    if (!payingInvoice) return false;

    const pendingOnInv = getPendingAmountForInvoice(payingInvoice.id);
    const maxAllowed = Math.max(0, payingInvoice.outstandingAmount - pendingOnInv);

    if (!payAmount || payAmount <= 0) {
      errors.amount = 'Please enter a valid amount greater than ₹0';
    } else if (payAmount > payingInvoice.outstandingAmount) {
      errors.amount = `Amount cannot exceed invoice outstanding balance of ₹${payingInvoice.outstandingAmount.toLocaleString()}`;
    }

    const cleanRef = payReference.trim();
    if (!cleanRef) {
      errors.reference = 'Transaction Reference / UTR Number is required';
    } else if (cleanRef.length < 3) {
      errors.reference = 'Reference must be at least 3 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitPaymentClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice || !validatePaymentSubmission()) return;

    try {
      setIsSubmittingPay(true);
      await submitCustomerPayment({
        invoiceId: payingInvoice.id,
        paymentMethodType: payMethodType,
        transactionReference: payReference.trim(),
        amount: Number(payAmount),
        paymentMethodId: selectedMethodId || undefined,
        transactionDate: payDate,
        receiptUrl: payReceiptUrl || undefined,
        notes: payNotes.trim() || undefined,
      });

      setPayingInvoice(null);
      setActiveTab('claims');
    } catch (err) {
      // Toast triggered in context
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'settled':
      case 'paid':
        return <StatusBadge status="completed" label="Fully Paid" size="sm" />;
      case 'open_payment':
      case 'partial':
        return <StatusBadge status="warning" label="Partially Paid" size="sm" />;
      case 'delivered':
      case 'ready':
      case 'unpaid':
      default:
        return <StatusBadge status="rejected" label="Payment Due" size="sm" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-28 font-sans">
      {/* 1. Page Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {t.customer.payments.title}
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
          {t.customer.payments.subtitle}
        </p>
      </div>

      {/* 2. Primary Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Outstanding Balance (Hero Card) */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-700">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-bold uppercase tracking-wider text-slate-500">
                {t.customer.payments.outstanding}
              </span>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                outstandingAmount > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {outstandingAmount > 0 ? 'Payment Due' : 'All Dues Cleared'}
            </span>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono-numbers tracking-tight">
              ₹{outstandingAmount.toLocaleString('en-IN')}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Total pending balance payable to Madhav Dairy
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <div>
              <span className="font-medium text-slate-500">Terms: </span>
              <span className="font-bold text-slate-900">{paymentTerms}</span>
            </div>
            <div>
              <span className="font-medium text-slate-500">Credit Limit: </span>
              <span className="font-bold text-slate-900 font-mono-numbers">
                ₹{creditLimit.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Bank & Settlement Quick Info (Dynamic from DB) */}
        <div className="bg-blue-50/80 rounded-2xl border border-blue-200 p-5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-blue-900 font-bold text-base mb-1">
              <QrCode className="w-5 h-5 text-blue-700" />
              <span>Official Settlement Accounts</span>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              Transfer funds directly to official Madhav Dairy accounts via UPI or NEFT.
            </p>
          </div>

          {/* Quick Copy UPI */}
          {defaultUpiMethod ? (
            <div className="bg-white p-3 rounded-xl border border-blue-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  {defaultUpiMethod.displayName}
                </span>
                {defaultUpiMethod.qrCodeUrl && (
                  <a
                    href={defaultUpiMethod.qrCodeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5"
                  >
                    <QrCode className="w-3 h-3" />
                    QR
                  </a>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 font-mono-numbers truncate">
                  {defaultUpiMethod.upiId}
                </span>
                <button
                  onClick={() => handleCopy(defaultUpiMethod.upiId || '', 'UPI ID')}
                  className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition-colors shrink-0"
                  title="Copy UPI ID"
                >
                  {copiedField === 'UPI ID' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {/* Quick Copy Bank Details */}
          {defaultBankMethod ? (
            <div className="bg-white p-3 rounded-xl border border-blue-200 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase block truncate">
                {defaultBankMethod.bankName} • A/C {defaultBankMethod.accountNumber}
              </span>
              <div className="flex items-center justify-between gap-2 text-xs text-slate-700">
                <div className="truncate">
                  <span className="font-mono-numbers text-slate-600 block text-[11px]">
                    IFSC: {defaultBankMethod.ifscCode}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(
                    `A/C: ${defaultBankMethod.accountNumber}, IFSC: ${defaultBankMethod.ifscCode}, Bank: ${defaultBankMethod.bankName}`,
                    'Bank Details'
                  )}
                  className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition-colors shrink-0"
                  title="Copy Bank Details"
                >
                  {copiedField === 'Bank Details' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 3. Section Switcher Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'invoices'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Invoices & Pay Now</span>
          <span className="text-xs font-mono-numbers bg-slate-200/80 px-2 py-0.5 rounded-full">
            {customerInvoices.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'claims'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Submitted Claims</span>
          {customerSubmissions.filter(s => s.status === 'open').length > 0 && (
            <span className="text-xs font-mono-numbers bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
              {customerSubmissions.filter(s => s.status === 'open').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'receipts'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Accounted Receipts</span>
          <span className="text-xs font-mono-numbers bg-slate-200/80 px-2 py-0.5 rounded-full">
            {customerPayments.length}
          </span>
        </button>
      </div>

      {/* 4. Tab 1: Invoices with "Pay Now" Action */}
      {activeTab === 'invoices' && (
        <div className="space-y-3">
          {customerInvoices.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{t.customer.payments.noInvoices}</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                When dispatch creates an invoice for your dairy order, it will appear here with full line-item details.
              </p>
              <button
                onClick={() => onNavigate('products')}
                className="min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-2xs transition-colors"
              >
                Place New Order
              </button>
            </div>
          ) : (
            customerInvoices.map(invoice => {
              const isExpanded = expandedInvoiceId === invoice.id;
              const pendingOnInv = getPendingAmountForInvoice(invoice.id);
              const isPayable = invoice.outstandingAmount > 0 && invoice.status !== 'cancelled';

              return (
                <div
                  key={invoice.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-3 transition-all hover:border-blue-200"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base sm:text-lg font-bold text-slate-900 font-mono-numbers">
                          {invoice.invoiceNumber}
                        </span>
                        {getInvoiceStatusBadge(invoice.status)}
                        {pendingOnInv > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-mono-numbers">
                            <Clock className="w-3 h-3 text-amber-600" />
                            ₹{pendingOnInv.toLocaleString()} Under Verification
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500 font-mono-numbers">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Date: {invoice.date}
                        </span>
                        <span>Due: {invoice.dueDate}</span>
                      </div>
                    </div>

                    <div className="sm:text-right space-y-0.5">
                      <span className="text-xs font-semibold uppercase text-slate-400 block">
                        Invoice Total
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono-numbers">
                        ₹{invoice.totalAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Payment Breakdown Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 rounded-xl text-xs sm:text-sm font-mono-numbers">
                    <div>
                      <span className="text-slate-500 block text-xs">Total Amount:</span>
                      <span className="font-bold text-slate-900">₹{invoice.totalAmount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">Accounted Paid:</span>
                      <span className="font-bold text-emerald-700">₹{invoice.paidAmount.toLocaleString()}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-slate-500 block text-xs">Remaining Balance:</span>
                      <span className={`font-bold ${invoice.outstandingAmount > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                        ₹{invoice.outstandingAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar: Expand Items + PAY NOW button */}
                  <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <button
                      onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)}
                      className="min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1.5 transition-colors"
                    >
                      <span>{isExpanded ? 'Hide Product Items' : `View ${invoice.items.length} Product Items`}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isPayable && (
                      <button
                        onClick={() => handleOpenPayNow(invoice)}
                        className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Pay Now (₹{invoice.outstandingAmount.toLocaleString()})</span>
                      </button>
                    )}
                  </div>

                  {/* Expanded Items Table */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                        {invoice.items.map((item, idx) => (
                          <div key={idx} className="p-3 bg-white flex items-center justify-between text-xs sm:text-sm">
                            <div>
                              <span className="font-bold text-slate-900 block">{item.productName}</span>
                              <span className="text-xs text-slate-500 font-mono-numbers">
                                {item.quantity} {item.unit} × ₹{item.rate}
                              </span>
                            </div>
                            <span className="font-mono-numbers font-bold text-slate-900">
                              ₹{item.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. Tab 2: Submitted Payment Claims & Status Tracking */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Payment Submission Process</span>
              <p className="text-blue-800 leading-relaxed">
                When you make a payment via UPI or Bank Transfer and submit the UTR transaction reference, your payment claim is marked <strong>Open</strong> while our accounts team verifies receipt with our bank statement. Once verified, it is marked <strong>Accounted</strong> and your invoice dues are officially reduced.
              </p>
            </div>
          </div>

          {customerSubmissions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No payment submissions yet</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                After paying an invoice via UPI or bank transfer, submit your UTR reference to have our finance desk verify it.
              </p>
            </div>
          ) : (
            customerSubmissions.map(sub => (
              <div
                key={sub.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-numbers font-bold text-slate-900 text-sm">
                      Ref: {sub.transactionReference}
                    </span>
                    {sub.status === 'open' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Awaiting Verification
                      </span>
                    )}
                    {sub.status === 'accounted' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Accounted
                      </span>
                    )}
                    {sub.status === 'rejected' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                        <XCircle className="w-3 h-3 text-red-600" />
                        Rejected
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-400 font-mono-numbers">
                    Submitted: {new Date(sub.submittedAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl text-xs font-mono-numbers">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Claimed Amount:</span>
                    <span className="font-bold text-slate-900 text-sm">₹{sub.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">For Invoice:</span>
                    <span className="font-bold text-blue-700">{sub.invoiceNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Method:</span>
                    <span className="font-bold uppercase text-slate-700">{sub.paymentMethodType.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Transfer Date:</span>
                    <span className="text-slate-700">{sub.transactionDate}</span>
                  </div>
                </div>

                {sub.status === 'rejected' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-2">
                    <span className="font-bold text-red-900 block">
                      Rejection Reason from Accounts Desk:
                    </span>
                    <p className="text-red-800 italic">{sub.rejectionReason}</p>
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          const inv = customerInvoices.find(i => i.id === sub.invoiceId);
                          if (inv) handleOpenPayNow(inv);
                        }}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-2xs flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Resubmit Payment Reference</span>
                      </button>
                    </div>
                  </div>
                )}

                {sub.status === 'accounted' && sub.accountedPaymentNumber && (
                  <div className="text-xs text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <span>
                      ✓ Payment verified and recorded under official receipt <strong>{sub.accountedPaymentNumber}</strong>.
                    </span>
                    <button
                      onClick={() => setActiveTab('receipts')}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      View Receipt →
                    </button>
                  </div>
                )}

                {sub.receiptUrl && (
                  <div className="pt-1">
                    <a
                      href={sub.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Uploaded Receipt
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 6. Tab 3: Official Accounted Receipts */}
      {activeTab === 'receipts' && (
        <div className="space-y-3">
          {customerPayments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{t.customer.payments.noPayments}</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                When Madhav Dairy records a verified payment (via UPI, cash, or bank transfer), your receipt will be listed here.
              </p>
            </div>
          ) : (
            customerPayments.map(payment => (
              <div
                key={payment.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 font-mono-numbers text-base">
                      {payment.paymentNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Accounted
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-mono-numbers">
                    <span>Date: {payment.date}</span>
                    <span>Ref: {payment.reference}</span>
                    {payment.invoiceNumber && <span>Inv: {payment.invoiceNumber}</span>}
                  </div>
                </div>

                <div className="sm:text-right">
                  <span className="text-xs uppercase text-slate-400 block font-semibold">Amount</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono-numbers">
                    ₹{payment.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 7. Pay Now Modal (Section 5 Requirement) */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                  Invoice Payment
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  Pay Invoice #{payingInvoice.invoiceNumber}
                </h3>
              </div>
              <button
                onClick={() => setPayingInvoice(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice Balances Summary */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3 text-xs font-mono-numbers">
              <div>
                <span className="text-slate-400 block text-[11px] font-sans">Original Invoice Total:</span>
                <span className="font-bold text-slate-800">₹{payingInvoice.totalAmount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px] font-sans">Already Accounted:</span>
                <span className="font-bold text-emerald-700">₹{payingInvoice.paidAmount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px] font-sans">Current Outstanding:</span>
                <span className="font-bold text-slate-900 text-sm">₹{payingInvoice.outstandingAmount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px] font-sans">Awaiting Verification:</span>
                <span className="font-bold text-amber-700">
                  ₹{getPendingAmountForInvoice(payingInvoice.id).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Method Switcher */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Select Payment Channel</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPayMethodType('upi');
                    setSelectedMethodId(defaultUpiMethod?.id || activeUpiMethods[0]?.id || '');
                  }}
                  className={`min-h-[44px] p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    payMethodType === 'upi'
                      ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-2xs ring-1 ring-blue-600'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>UPI / QR Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPayMethodType('bank_transfer');
                    setSelectedMethodId(defaultBankMethod?.id || activeBankMethods[0]?.id || '');
                  }}
                  className={`min-h-[44px] p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    payMethodType === 'bank_transfer'
                      ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-2xs ring-1 ring-blue-600'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Bank Transfer (NEFT/RTGS)</span>
                </button>
              </div>
            </div>

            {/* Official Deposit Instructions Display */}
            {payMethodType === 'upi' ? (
              <div className="bg-blue-50/80 rounded-2xl border border-blue-200 p-4 space-y-3 text-xs">
                {activeUpiMethods.length > 0 ? (
                  <>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {defaultUpiMethod?.qrCodeUrl && (
                        <div className="p-2 bg-white rounded-xl border border-blue-200 shrink-0 text-center shadow-2xs">
                          <img
                            src={defaultUpiMethod.qrCodeUrl}
                            alt="Scan UPI QR"
                            className="w-28 h-28 object-contain"
                          />
                          <span className="text-[10px] text-slate-500 font-bold mt-1 block">Scan & Pay</span>
                        </div>
                      )}

                      <div className="space-y-2 flex-1 w-full">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Payee Name:</span>
                          <span className="font-bold text-slate-900 block text-sm">
                            {defaultUpiMethod?.accountHolderName || 'Madhav Dairy'}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 text-[11px] block">Official UPI ID:</span>
                          <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-blue-200">
                            <span className="font-bold text-slate-900 font-mono-numbers text-xs truncate">
                              {defaultUpiMethod?.upiId}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(defaultUpiMethod?.upiId || '', 'UPI ID')}
                              className="p-1 rounded text-blue-600 hover:bg-blue-50 shrink-0"
                            >
                              {copiedField === 'UPI ID' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {defaultUpiMethod?.instructions && (
                          <p className="text-[11px] text-blue-800 italic">
                            {defaultUpiMethod.instructions}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-500">No active UPI methods configured. Please use Bank Transfer.</p>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5 text-xs">
                {activeBankMethods.length > 0 ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Bank Name:</span>
                      <span className="font-bold text-slate-900">{defaultBankMethod?.bankName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Account Holder:</span>
                      <span className="font-bold text-slate-900">{defaultBankMethod?.accountHolderName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Account Number:</span>
                      <div className="flex items-center gap-1.5 font-mono-numbers">
                        <span className="font-bold text-slate-900">{defaultBankMethod?.accountNumber}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(defaultBankMethod?.accountNumber || '', 'Account Number')}
                          className="p-1 text-slate-400 hover:text-blue-600"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">IFSC Code:</span>
                      <div className="flex items-center gap-1.5 font-mono-numbers">
                        <span className="font-bold text-slate-900">{defaultBankMethod?.ifscCode}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(defaultBankMethod?.ifscCode || '', 'IFSC')}
                          className="p-1 text-slate-400 hover:text-blue-600"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {defaultBankMethod?.branchName && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Branch:</span>
                        <span className="text-slate-700">{defaultBankMethod.branchName}</span>
                      </div>
                    )}
                    {defaultBankMethod?.instructions && (
                      <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200">
                        {defaultBankMethod.instructions}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-slate-500">No active bank accounts configured. Please use UPI.</p>
                )}
              </div>
            )}

            {/* Submission Form */}
            <form onSubmit={handleSubmitPaymentClaim} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount Paid (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono-numbers font-bold text-sm focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                  {formErrors.amount && (
                    <p className="text-red-600 text-[11px] mt-1">{formErrors.amount}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Transfer Date *</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Transaction / UTR Reference ID *
                </label>
                <input
                  type="text"
                  value={payReference}
                  onChange={e => setPayReference(e.target.value)}
                  placeholder="e.g. 429381902831 or UPI Ref ID"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono-numbers focus:outline-none focus:border-blue-600 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Find the 12-digit UTR number in your banking or UPI app payment confirmation receipt.
                </span>
                {formErrors.reference && (
                  <p className="text-red-600 text-[11px] mt-1">{formErrors.reference}</p>
                )}
              </div>

              {/* Optional Receipt Upload */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Upload Payment Screenshot / Receipt (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold border border-slate-300 cursor-pointer flex items-center gap-1.5 transition-colors">
                    {isUploadingReceipt ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{isUploadingReceipt ? 'Uploading...' : 'Choose File (≤ 5MB)'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={handleReceiptUpload}
                      disabled={isUploadingReceipt}
                      className="hidden"
                    />
                  </label>

                  {payReceiptUrl && (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Uploaded
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="e.g. Paid via PhonePe from ICICI account"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              {/* Verification Disclaimer */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900">
                <strong>Important:</strong> Your payment reference will be reviewed against bank statement credits by the Madhav Dairy finance desk. Once verified, the payment will be marked accounted on your statement.
              </div>

              {/* Form Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay || isUploadingReceipt}
                  className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingPay && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Submit Payment Reference</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
