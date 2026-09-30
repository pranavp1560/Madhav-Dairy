import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Button } from '../ui/Button';
import { BookOpen, Printer, Download, User } from 'lucide-react';

export const LedgerView: React.FC = () => {
  const { ledger, retailers, addToast } = useDairy();

  const [selectedRetailerId, setSelectedRetailerId] = useState<string>(retailers[0]?.id || '');
  const selectedRetailer = retailers.find(r => r.id === selectedRetailerId) || retailers[0];

  const currentLedger = ledger.filter(l => l.retailerId === selectedRetailerId);

  const openingBalance = 20000;
  const totalDebits = currentLedger.reduce((acc, l) => acc + (l.debit || 0), 0);
  const totalCredits = currentLedger.reduce((acc, l) => acc + (l.credit || 0), 0);
  const closingBalance = selectedRetailer?.outstandingAmount || (openingBalance + totalDebits - totalCredits);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900">Customer Account Statement Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Formal double-entry statement showing invoice debits, payment credits, and running balance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => {
              window.print();
              addToast('Printing account statement', 'info');
            }}
          >
            Print Statement
          </Button>
        </div>
      </div>

      {/* Customer Account Selector */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <label className="font-semibold text-slate-700 whitespace-nowrap">
            Select Customer Account:
          </label>
          <select
            value={selectedRetailerId}
            onChange={e => setSelectedRetailerId(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
          >
            {retailers.map(r => (
              <option key={r.id} value={r.id}>
                {r.businessName} ({r.area}) • Bal: ₹{r.outstandingAmount.toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] text-slate-500">
          GSTIN: <strong className="font-mono-numbers text-slate-800">{selectedRetailer.gstin}</strong> • Terms: <strong>{selectedRetailer.paymentTerms}</strong>
        </div>
      </div>

      {/* Financial Statement Summary Cards (Section 21) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Opening Balance</span>
          <span className="text-base font-bold text-slate-900 font-mono-numbers mt-1 block">
            ₹{openingBalance.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400">As of 01 Sep 2026</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Invoiced (Debit)</span>
          <span className="text-base font-bold text-slate-900 font-mono-numbers mt-1 block">
            ₹{totalDebits.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-500">Goods dispatched</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Paid (Credit)</span>
          <span className="text-base font-bold text-green-600 font-mono-numbers mt-1 block">
            ₹{totalCredits.toLocaleString()}
          </span>
          <span className="text-[10px] text-green-600">Payments credited</span>
        </div>

        {/* Highly Visible Outstanding (Section 21) */}
        <div className="p-3.5 bg-blue-50/80 rounded-xl border-2 border-blue-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-blue-700 block">Current Outstanding</span>
          <span className="text-lg font-bold text-rose-600 font-mono-numbers mt-1 block">
            ₹{closingBalance.toLocaleString()} (Dr)
          </span>
          <span className="text-[10px] text-blue-600 font-medium">Pending Settlement</span>
        </div>
      </div>

      {/* Statement Table (Financial Statement format) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Particulars / Description</th>
                <th className="py-3 px-3">Voucher Ref</th>
                <th className="py-3 px-3 text-right">Debit (₹)</th>
                <th className="py-3 px-3 text-right">Credit (₹)</th>
                <th className="py-3 px-4 text-right">Running Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {/* Opening Balance Row */}
              <tr className="bg-slate-50/80 font-semibold">
                <td className="py-2.5 px-4 font-mono-numbers text-slate-500">2026-09-01</td>
                <td className="py-2.5 px-4 text-slate-700" colSpan={2}>
                  Opening Ledger Balance b/f
                </td>
                <td className="py-2.5 px-3 text-right font-mono-numbers text-slate-400">—</td>
                <td className="py-2.5 px-3 text-right font-mono-numbers text-slate-400">—</td>
                <td className="py-2.5 px-4 text-right font-mono-numbers font-bold text-slate-900">
                  ₹{openingBalance.toLocaleString()}
                </td>
              </tr>

              {/* Transactions */}
              {currentLedger.map(entry => (
                <tr key={entry.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4 font-mono-numbers text-slate-600">{entry.date}</td>
                  <td className="py-3 px-4 font-medium text-slate-900">{entry.particular}</td>
                  <td className="py-3 px-3 font-mono-numbers text-slate-500">{entry.reference}</td>
                  <td className="py-3 px-3 text-right font-mono-numbers font-semibold text-slate-900">
                    {entry.debit ? `₹${entry.debit.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-numbers font-bold text-green-600">
                    {entry.credit ? `₹${entry.credit.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-numbers font-bold text-slate-900">
                    ₹{entry.balance.toLocaleString()}
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
