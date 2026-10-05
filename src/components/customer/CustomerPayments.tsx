import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { StatusBadge } from '../ui/StatusBadge';
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
  AlertCircle
} from 'lucide-react';

interface CustomerPaymentsProps {
  onNavigate: (tab: string) => void;
}

export const CustomerPayments: React.FC<CustomerPaymentsProps> = ({ onNavigate }) => {
  const { currentRetailer, invoices, payments, addToast } = useDairy();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    addToast(`${label} copied to clipboard!`, 'info');
    setTimeout(() => {
      setCopiedField(prev => (prev === label ? null : prev));
    }, 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <StatusBadge status="completed" label="Fully Paid" size="sm" />;
      case 'partial':
        return <StatusBadge status="warning" label="Partially Paid" size="sm" />;
      case 'unpaid':
      default:
        return <StatusBadge status="rejected" label="Payment Due" size="sm" />;
    }
  };

  const getMethodBadge = (method: string) => {
    const formatted = method.replace('_', ' ').toUpperCase();
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
        {formatted}
      </span>
    );
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

        {/* Bank & Settlement Quick Info */}
        <div className="bg-blue-50/80 rounded-2xl border border-blue-200 p-5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-blue-900 font-bold text-base mb-1">
              <QrCode className="w-5 h-5 text-blue-700" />
              <span>Direct Settlement</span>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              Transfer settlement directly to Madhav Dairy via UPI or NEFT.
            </p>
          </div>

          {/* Quick Copy UPI */}
          <div className="bg-white p-3 rounded-xl border border-blue-200 space-y-1">
            <span className="text-xs font-semibold text-slate-500 block uppercase">Official UPI ID</span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900 font-mono-numbers truncate">
                madhavdairy@upi
              </span>
              <button
                onClick={() => handleCopy('madhavdairy@upi', 'UPI ID')}
                className="min-h-[44px] min-w-[44px] p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition-colors shrink-0"
                title="Copy UPI ID"
                aria-label="Copy UPI ID"
              >
                {copiedField === 'UPI ID' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Quick Copy Bank Details */}
          <div className="bg-white p-3 rounded-xl border border-blue-200 space-y-1">
            <span className="text-xs font-semibold text-slate-500 block uppercase">Bank Account</span>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-700">
              <div className="truncate">
                <span className="font-bold text-slate-900 block truncate">HDFC Bank • A/C 9876543210</span>
                <span className="font-mono-numbers text-slate-500">IFSC: HDFC0001234</span>
              </div>
              <button
                onClick={() => handleCopy('A/C: 9876543210, IFSC: HDFC0001234, Bank: HDFC Bank', 'Bank Details')}
                className="min-h-[44px] min-w-[44px] p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition-colors shrink-0"
                title="Copy Bank Details"
                aria-label="Copy Bank Details"
              >
                {copiedField === 'Bank Details' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Section Switcher Tabs (Invoices vs Payments) */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm sm:text-base font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'invoices'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{t.customer.payments.recentInvoices}</span>
          <span className="text-xs font-mono-numbers bg-slate-200/80 px-2 py-0.5 rounded-full">
            {customerInvoices.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm sm:text-base font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'payments'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>{t.customer.payments.paymentHistory}</span>
          <span className="text-xs font-mono-numbers bg-slate-200/80 px-2 py-0.5 rounded-full">
            {customerPayments.length}
          </span>
        </button>
      </div>

      {/* 4. Tab Content: Recent Invoices */}
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
              return (
                <div
                  key={invoice.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-3 transition-all hover:border-blue-200"
                >
                  {/* Top Bar: Invoice Number, Status, Bill Amount */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base sm:text-lg font-bold text-slate-900 font-mono-numbers">
                          {invoice.invoiceNumber}
                        </span>
                        {getStatusBadge(invoice.status)}
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

                  {/* Payment Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 rounded-xl text-xs sm:text-sm font-mono-numbers">
                    <div>
                      <span className="text-slate-500 block text-xs">Total Amount:</span>
                      <span className="font-bold text-slate-900">₹{invoice.totalAmount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">Paid So Far:</span>
                      <span className="font-bold text-emerald-700">₹{invoice.paidAmount.toLocaleString()}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-slate-500 block text-xs">Remaining Due:</span>
                      <span className={`font-bold ${invoice.outstandingAmount > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                        ₹{invoice.outstandingAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Expand Line Items Toggle */}
                  <div className="pt-1 flex items-center justify-between">
                    <button
                      onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)}
                      className="min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-1.5 transition-colors"
                    >
                      <span>{isExpanded ? 'Hide Product Items' : `View ${invoice.items.length} Product Items`}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
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

      {/* 5. Tab Content: Payment Receipts */}
      {activeTab === 'payments' && (
        <div className="space-y-3">
          {customerPayments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{t.customer.payments.noPayments}</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                When Madhav Dairy records a received payment (via UPI, cash, or bank transfer), your receipt will be listed here.
              </p>
            </div>
          ) : (
            customerPayments.map(payment => (
              <div
                key={payment.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-3 transition-all hover:border-blue-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base sm:text-lg font-bold text-slate-900 font-mono-numbers">
                        {payment.paymentNumber}
                      </span>
                      {getMethodBadge(payment.paymentMethod)}
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-mono-numbers">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Received on {payment.date}</span>
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-xs font-semibold uppercase text-slate-400 block">
                      Amount Paid
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono-numbers">
                      ₹{payment.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Additional Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-600 bg-slate-50 p-3 rounded-xl">
                  <div>
                    <span className="text-slate-400 block text-xs">Reference / UTR:</span>
                    <span className="font-semibold text-slate-900 font-mono-numbers">
                      {payment.reference || 'Direct Deposit'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs">Allocated Statement:</span>
                    <span className="font-semibold text-slate-900 font-mono-numbers">
                      {payment.invoiceNumber || 'Direct Account Credit'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
