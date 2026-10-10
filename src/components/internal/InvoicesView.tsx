import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { Invoice, InvoiceStatus, PaymentMethod } from '../../types/dairy';
import { 
  FileText, Plus, Search, Printer, CreditCard, CheckCircle2, 
  Truck, CheckSquare, Square, ArrowRight, Clock, AlertCircle, DollarSign
} from 'lucide-react';

interface InvoicesViewProps {
  onOpenPrintInvoice: (id: string) => void;
  onOpenRecordPayment: () => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  onOpenPrintInvoice,
  onOpenRecordPayment,
}) => {
  const { 
    invoices, 
    markInvoiceDelivered, 
    bulkDeliverInvoices, 
    allocateInvoicePayment, 
    confirmInvoicePayment, 
    bulkConfirmInvoicePayments,
    addToast
  } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Bulk selection state
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Allocate Payment Modal State
  const [allocatingInvoice, setAllocatingInvoice] = useState<Invoice | null>(null);
  const [allocAmount, setAllocAmount] = useState<number>(0);
  const [allocMethod, setAllocMethod] = useState<PaymentMethod>('upi');
  const [allocRef, setAllocRef] = useState<string>('');
  const [allocNotes, setAllocNotes] = useState<string>('');
  const [allocDate, setAllocDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmittingAlloc, setIsSubmittingAlloc] = useState<false | true>(false);

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.retailerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.orderNumber && inv.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const allFilteredSelected = filteredInvoices.length > 0 && filteredInvoices.every(i => selectedInvoiceIds.includes(i.id));
  const someFilteredSelected = filteredInvoices.some(i => selectedInvoiceIds.includes(i.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(filteredInvoices.map(i => i.id));
    }
  };

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoiceIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Group selected by status
  const selectedReadyIds = filteredInvoices.filter(i => selectedInvoiceIds.includes(i.id) && i.status === 'ready').map(i => i.id);
  const selectedOpenPaymentIds = filteredInvoices.filter(i => selectedInvoiceIds.includes(i.id) && i.status === 'open_payment').map(i => i.id);

  const handleBulkDeliver = async () => {
    if (selectedReadyIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await bulkDeliverInvoices(selectedReadyIds);
      setSelectedInvoiceIds(prev => prev.filter(id => !selectedReadyIds.includes(id)));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkConfirmPayments = async () => {
    if (selectedOpenPaymentIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await bulkConfirmInvoicePayments(selectedOpenPaymentIds);
      setSelectedInvoiceIds(prev => prev.filter(id => !selectedOpenPaymentIds.includes(id)));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleOpenAllocateModal = (inv: Invoice) => {
    setAllocatingInvoice(inv);
    setAllocAmount(inv.outstandingAmount > 0 ? inv.outstandingAmount : inv.totalAmount);
    setAllocMethod('upi');
    setAllocRef(`UPI-${Date.now().toString().slice(-6)}`);
    setAllocNotes(`Payment against invoice ${inv.invoiceNumber}`);
    setAllocDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmitAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingInvoice) return;

    const maxAllowed = allocatingInvoice.outstandingAmount > 0 
      ? allocatingInvoice.outstandingAmount 
      : 0;

    if (maxAllowed <= 0) {
      addToast('This invoice has no outstanding balance to allocate payment against.', 'warning');
      return;
    }

    if (allocAmount <= 0) {
      addToast('Payment allocation amount must be greater than zero.', 'warning');
      return;
    }

    if (allocAmount > maxAllowed) {
      addToast(`Payment amount (₹${allocAmount.toLocaleString('en-IN')}) cannot exceed remaining outstanding balance of ₹${maxAllowed.toLocaleString('en-IN')}`, 'error');
      return;
    }

    setIsSubmittingAlloc(true);
    try {
      await allocateInvoicePayment({
        invoiceId: allocatingInvoice.id,
        amount: allocAmount,
        paymentMethod: allocMethod,
        reference: allocRef,
        notes: allocNotes,
        paymentDate: allocDate,
      });
      setAllocatingInvoice(null);
    } finally {
      setIsSubmittingAlloc(false);
    }
  };

  const totalBilled = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalOutstanding = invoices.reduce((acc, i) => acc + i.outstandingAmount, 0);
  const totalSettled = invoices.filter(i => i.status === 'settled').reduce((acc, i) => acc + i.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Tax Invoicing & GST Billing Workflow</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            B2B Invoices & Bill of Supply
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Production Flow: <span className="font-semibold text-sky-700">Ready</span> &rarr; <span className="font-semibold text-blue-700">Delivered</span> &rarr; <span className="font-semibold text-amber-700">Open Payment</span> &rarr; <span className="font-semibold text-emerald-700">Settled</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenRecordPayment}
            className="px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4 text-slate-600" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Invoiced</span>
          <span className="text-lg font-black text-slate-900 font-mono-numbers mt-1 block">
            ₹{totalBilled.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-sky-700 block">Ready / Outward</span>
          <span className="text-lg font-black text-sky-700 font-mono-numbers mt-1 block">
            {invoices.filter(i => i.status === 'ready').length} Invoices
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-amber-700 block">Awaiting Settlement</span>
          <span className="text-lg font-black text-amber-600 font-mono-numbers mt-1 block">
            ₹{totalOutstanding.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-emerald-700 block">Settled (Verified)</span>
          <span className="text-lg font-black text-emerald-600 font-mono-numbers mt-1 block">
            ₹{totalSettled.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Filters and Status Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between text-xs">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search Invoice #, Retailer, Order #..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Invoices' },
            { id: 'ready', label: 'Ready' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'open_payment', label: 'Open Payment' },
            { id: 'settled', label: 'Settled' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`text-xs px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Operations Toolbar */}
      {selectedInvoiceIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span>{selectedInvoiceIds.length} invoice(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            {selectedReadyIds.length > 0 && (
              <button
                onClick={handleBulkDeliver}
                disabled={isBulkProcessing}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Bulk Mark Delivered ({selectedReadyIds.length})</span>
              </button>
            )}

            {selectedOpenPaymentIds.length > 0 && (
              <button
                onClick={handleBulkConfirmPayments}
                disabled={isBulkProcessing}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Bulk Confirm Payments ({selectedOpenPaymentIds.length})</span>
              </button>
            )}

            <button
              onClick={() => setSelectedInvoiceIds([])}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={input => {
                      if (input) input.indeterminate = someFilteredSelected && !allFilteredSelected;
                    }}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="p-3">Invoice #</th>
                <th className="p-3">Date</th>
                <th className="p-3">Retailer</th>
                <th className="p-3 text-right">Total (₹)</th>
                <th className="p-3 text-right">Allocated (₹)</th>
                <th className="p-3 text-right">Outstanding (₹)</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Workflow Actions</th>
                <th className="p-3 text-center">Print</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-numbers">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                    No invoices match your search or filter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => {
                  const isSelected = selectedInvoiceIds.includes(inv.id);

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectInvoice(inv.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{inv.invoiceNumber}</span>
                        {inv.orderNumber && (
                          <span className="text-[10px] text-blue-600 block font-normal font-sans">
                            {inv.orderNumber}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-sans text-slate-600">{inv.date}</td>
                      <td className="p-3 font-sans font-bold text-slate-900">{inv.retailerName}</td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        ₹{inv.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right text-emerald-600 font-semibold">
                        ₹{inv.paidAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right font-bold text-rose-600">
                        ₹{inv.outstandingAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 font-sans">
                        <StatusBadge status={inv.status} type="invoice" size="sm" />
                      </td>

                      {/* Workflow Actions Column */}
                      <td className="p-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.status === 'ready' && (
                            <button
                              onClick={() => markInvoiceDelivered(inv.id)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded text-[11px] font-bold transition-all flex items-center gap-1"
                              title="Mark invoice as delivered to retailer"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Mark Delivered</span>
                            </button>
                          )}

                          {inv.status === 'delivered' && (
                            <button
                              onClick={() => handleOpenAllocateModal(inv)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 border border-amber-200 rounded text-[11px] font-bold transition-all flex items-center gap-1"
                              title="Allocate collected payment against this invoice"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Allocate Payment</span>
                            </button>
                          )}

                          {inv.status === 'open_payment' && (
                            <>
                              <button
                                onClick={() => confirmInvoicePayment(inv.id)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold transition-all flex items-center gap-1"
                                title="Confirm and account payment (posts double-entry credit and settles)"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Confirm Payment</span>
                              </button>
                              {inv.outstandingAmount > 0 && (
                                <button
                                  onClick={() => handleOpenAllocateModal(inv)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-medium transition-colors"
                                  title="Allocate additional installment"
                                >
                                  + Add Installment
                                </button>
                              )}
                            </>
                          )}

                          {inv.status === 'settled' && (
                            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Accounted & Settled</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Print Preview Button */}
                      <td className="p-3 text-center font-sans">
                        <button
                          onClick={() => onOpenPrintInvoice(inv.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 border border-slate-300 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocate Payment Modal */}
      {allocatingInvoice && (
        <Modal
          isOpen={Boolean(allocatingInvoice)}
          onClose={() => setAllocatingInvoice(null)}
          title={`Allocate Payment: ${allocatingInvoice.invoiceNumber}`}
          subtitle={`Retailer: ${allocatingInvoice.retailerName}`}
          maxWidth="md"
        >
          <form onSubmit={handleSubmitAllocation} className="space-y-4 text-xs">
            {/* Invoice summary banner */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl grid grid-cols-3 gap-2 text-center font-mono-numbers">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Due</span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  ₹{allocatingInvoice.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Already Paid</span>
                <span className="text-sm font-bold text-emerald-600 block mt-0.5">
                  ₹{allocatingInvoice.paidAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Outstanding</span>
                <span className="text-sm font-bold text-rose-600 block mt-0.5">
                  ₹{allocatingInvoice.outstandingAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Payment Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  {allocatingInvoice.outstandingAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => setAllocAmount(allocatingInvoice.outstandingAmount)}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
                    >
                      Fill Full (₹{allocatingInvoice.outstandingAmount.toLocaleString('en-IN')})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  max={allocatingInvoice.outstandingAmount > 0 ? allocatingInvoice.outstandingAmount : 0}
                  value={allocAmount}
                  onChange={e => setAllocAmount(parseFloat(e.target.value) || 0)}
                  className={`w-full p-2.5 bg-slate-50/50 border rounded-lg text-xs font-mono-numbers font-bold focus:ring-2 focus:outline-none ${
                    allocAmount > (allocatingInvoice.outstandingAmount > 0 ? allocatingInvoice.outstandingAmount : 0)
                      ? 'border-red-400 text-red-600 focus:border-red-600 focus:ring-red-100'
                      : 'border-slate-300 text-emerald-600 focus:border-blue-600 focus:ring-blue-100'
                  }`}
                  required
                />
                {allocAmount > (allocatingInvoice.outstandingAmount > 0 ? allocatingInvoice.outstandingAmount : 0) && (
                  <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                    <span>Cannot exceed remaining outstanding balance of ₹{(allocatingInvoice.outstandingAmount > 0 ? allocatingInvoice.outstandingAmount : 0).toLocaleString('en-IN')}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={allocDate}
                  onChange={e => setAllocDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-mono-numbers focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={allocMethod}
                  onChange={e => setAllocMethod(e.target.value as PaymentMethod)}
                  className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none cursor-pointer"
                  required
                >
                  <option value="upi">UPI / QR Code</option>
                  <option value="cash">Cash Collection</option>
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reference / Transaction No.
                </label>
                <input
                  type="text"
                  value={allocRef}
                  onChange={e => setAllocRef(e.target.value)}
                  placeholder="e.g. UPI Ref / Cheque No."
                  className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-mono-numbers focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Notes / Remarks
              </label>
              <textarea
                value={allocNotes}
                onChange={e => setAllocNotes(e.target.value)}
                rows={2}
                placeholder="Optional payment notes..."
                className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-[11px] text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Two-Step Settlement Process</p>
                <p className="mt-0.5 text-[10px]">
                  Allocating moves the invoice to <strong>Open Payment</strong>. Once verified by accounts, clicking <strong>Confirm Payment</strong> posts the double-entry ledger credit and moves the invoice to <strong>Settled</strong>.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAllocatingInvoice(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isSubmittingAlloc || 
                  allocAmount <= 0 || 
                  allocAmount > (allocatingInvoice.outstandingAmount > 0 ? allocatingInvoice.outstandingAmount : 0)
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{isSubmittingAlloc ? 'Allocating...' : 'Allocate Payment'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
