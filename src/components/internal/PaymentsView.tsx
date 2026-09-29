import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { CreditCard, Plus, Search, CheckCircle2, Download } from 'lucide-react';

interface PaymentsViewProps {
  onOpenRecordPayment: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({ onOpenRecordPayment }) => {
  const { payments, addToast } = useDairy();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPayments = payments.filter(p =>
    p.retailerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.paymentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.reference.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCollected = payments.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <CreditCard className="w-4 h-4" />
            <span>Cash & Bank Settlement</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Collections & Payment Receipts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log UPI collections, delivery agent cash handovers, NEFT/RTGS receipts, and bank cheques.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => addToast('Collections statement exported to Excel (simulated)', 'info')}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold border border-slate-300 transition-colors"
          >
            Export Statement
          </button>
          <button
            onClick={onOpenRecordPayment}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Payment</span>
          </button>
        </div>
      </div>

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

      {/* Table as specified in Section 25 */}
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
                <th className="p-3">Recorded By</th>
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
                  <td className="p-3 font-sans text-slate-600">{p.recordedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
