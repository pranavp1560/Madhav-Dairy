import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { StatusBadge } from '../common/StatusBadge';
import { FileText, Plus, Search, Printer, CreditCard } from 'lucide-react';

interface InvoicesViewProps {
  onOpenCreateInvoice: () => void;
  onOpenPrintInvoice: (id: string) => void;
  onOpenRecordPayment: () => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  onOpenCreateInvoice,
  onOpenPrintInvoice,
  onOpenRecordPayment,
}) => {
  const { invoices } = useDairy();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.retailerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalBilled = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalOutstanding = invoices.reduce((acc, i) => acc + i.outstandingAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Tax Invoicing & GST Billing</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            B2B Invoices & Bill of Supply
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Every invoice associates dispatched stock with explicit batch numbers for regulatory batch traceability.
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
          <button
            onClick={onOpenCreateInvoice}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Invoiced</span>
          <span className="text-lg font-black text-slate-900 font-mono-numbers mt-1 block">
            ₹{totalBilled.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Collections Realized</span>
          <span className="text-lg font-black text-green-600 font-mono-numbers mt-1 block">
            ₹{(totalBilled - totalOutstanding).toLocaleString('en-IN')}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Pending Invoice Dues</span>
          <span className="text-lg font-black text-rose-600 font-mono-numbers mt-1 block">
            ₹{totalOutstanding.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between text-xs">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search Invoice # or Retailer..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {['all', 'unpaid', 'partial', 'paid'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`text-xs px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table as specified in Section 23 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Invoice Number</th>
                <th className="p-3">Date</th>
                <th className="p-3">Retailer</th>
                <th className="p-3 text-right">Amount (₹)</th>
                <th className="p-3 text-right">Paid (₹)</th>
                <th className="p-3 text-right">Outstanding (₹)</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Print Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-numbers">
              {filteredInvoices.map(inv => (
                <tr
                  key={inv.id}
                  onClick={() => onOpenPrintInvoice(inv.id)}
                  className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                >
                  <td className="p-3 font-bold text-slate-900">{inv.invoiceNumber}</td>
                  <td className="p-3 font-sans text-slate-600">{inv.date}</td>
                  <td className="p-3 font-sans font-bold text-slate-900">{inv.retailerName}</td>
                  <td className="p-3 text-right font-bold text-slate-900">
                    ₹{inv.totalAmount.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-right text-green-600 font-semibold">
                    ₹{inv.paidAmount.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-right font-bold text-rose-600">
                    ₹{inv.outstandingAmount.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 font-sans">
                    <StatusBadge status={inv.status} type="invoice" size="sm" />
                  </td>
                  <td className="p-3 text-center font-sans">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onOpenPrintInvoice(inv.id);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 border border-slate-300 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
