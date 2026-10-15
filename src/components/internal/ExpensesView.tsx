import React, { useState, useMemo } from 'react';
import { useDairy } from '../../context/DairyContext';
import { ExpenseCategory, PaymentMethod, VendorAdvance } from '../../types/dairy';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CreditCard,
  IndianRupee,
  Scale,
  CheckCircle2,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { RecordAdvanceModal } from './RecordAdvanceModal';
import { AdjustAdvanceModal } from './AdjustAdvanceModal';

interface ExpensesViewProps {
  onOpenAddExpense: () => void;
}

interface UnifiedExpenseItem {
  id: string;
  isAdvance: boolean;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidTo: string;
  referenceNumber: string;
  advanceRecord?: VendorAdvance;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({ onOpenAddExpense }) => {
  const {
    expenses,
    vendorAdvances,
  } = useDairy();

  // Modals state
  const [isRecordAdvanceOpen, setIsRecordAdvanceOpen] = useState(false);
  const [selectedAdvanceToAdjust, setSelectedAdvanceToAdjust] = useState<VendorAdvance | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // -----------------------------------------------------------------------------
  // 1. UNIFIED EXPENSES & ADVANCES LEDGER
  // -----------------------------------------------------------------------------
  const unifiedItems: UnifiedExpenseItem[] = useMemo(() => {
    const list: UnifiedExpenseItem[] = [];

    // Add regular expenses
    expenses.forEach(exp => {
      list.push({
        id: `exp-${exp.id}`,
        isAdvance: false,
        date: exp.date,
        category: exp.category,
        description: exp.description,
        amount: exp.amount,
        paymentMethod: exp.paymentMethod,
        paidTo: exp.paidTo,
        referenceNumber: exp.referenceNumber,
      });
    });

    // Add vendor advances directly as expense rows
    vendorAdvances.forEach(adv => {
      list.push({
        id: `adv-${adv.id}`,
        isAdvance: true,
        date: adv.advanceDate,
        category: 'Vendor Advance',
        description: adv.notes || 'Vendor / Farmer Advance Payment',
        amount: adv.amount,
        paymentMethod: adv.paymentMethod,
        paidTo: adv.vendorName,
        referenceNumber: adv.advanceNumber || adv.referenceNumber || 'ADV',
        advanceRecord: adv,
      });
    });

    // Sort by date descending (newest first)
    return list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }, [expenses, vendorAdvances]);

  // Filtered List
  const filteredItems = useMemo(() => {
    return unifiedItems.filter(item => {
      const matchesCategory =
        categoryFilter === 'all' ||
        (categoryFilter === 'Vendor Advance' && item.isAdvance) ||
        item.category.toLowerCase() === categoryFilter.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.description.toLowerCase().includes(q) ||
        item.paidTo.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.referenceNumber.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [unifiedItems, categoryFilter, searchQuery]);

  // -----------------------------------------------------------------------------
  // 2. EXPENSE TOTALS & KPIS (Advances count until adjust and after adjust)
  // -----------------------------------------------------------------------------
  const todayStr = new Date().toISOString().split('T')[0];

  // Today's Expenses (includes today's expenses + today's advances)
  const todayTotal = useMemo(() => {
    return unifiedItems
      .filter(item => item.date === todayStr || item.date === '2026-09-17')
      .reduce((acc, item) => acc + item.amount, 0);
  }, [unifiedItems, todayStr]);

  // Total Month's Expenses (includes all expenses + all advances)
  const monthTotal = useMemo(() => {
    return unifiedItems.reduce((acc, item) => acc + item.amount, 0);
  }, [unifiedItems]);

  // Total Advances Disbursed
  const totalAdvancesGiven = useMemo(() => {
    return vendorAdvances.reduce((acc, adv) => acc + adv.amount, 0);
  }, [vendorAdvances]);

  // Available Advance Balance (still unadjusted)
  const totalAvailableAdvanceBalance = useMemo(() => {
    return vendorAdvances.reduce((acc, adv) => acc + adv.balanceAmount, 0);
  }, [vendorAdvances]);

  return (
    <div className="space-y-6">
      {/* Top Header with Dual Buttons */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Receipt className="w-4 h-4 text-blue-600" />
            <span>Operations & Vendor Accounting</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Dairy Operating Expenses & Advances
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log procurement, overheads, and vendor/farmer advances with one-click bill and goods adjustments.
          </p>
        </div>

        {/* Buttons: + Advance Payment alongside + Add Expense */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsRecordAdvanceOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            title="Record an advance payment given to a vendor or farmer"
          >
            <CreditCard className="w-4 h-4" />
            <span>+ Advance Payment</span>
          </button>

          <button
            onClick={onOpenAddExpense}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Expense</span>
          </button>
        </div>
      </div>

      {/* 4 Dashboard Cards: Both expenses and advances reflected in totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Today's Expenses</span>
          <span className="text-xl font-black text-slate-900 font-mono-numbers mt-1 block">
            ₹{todayTotal.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-400">Includes expenses & advances</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Expenses MTD</span>
          <span className="text-xl font-black text-slate-900 font-mono-numbers mt-1 block">
            ₹{monthTotal.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-400">All overheads & advances</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Advances Disbursed</span>
          <span className="text-xl font-black text-slate-800 font-mono-numbers mt-1 block">
            ₹{totalAdvancesGiven.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Given to vendors/farmers</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-emerald-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/40">
          <span className="text-[10px] uppercase font-bold text-emerald-700 block">Available Advance Balance</span>
          <span className="text-xl font-black text-emerald-600 font-mono-numbers mt-1 block">
            ₹{totalAvailableAdvanceBalance.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-emerald-700 font-medium">Ready to adjust with goods</span>
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
            placeholder="Search description, vendor, or voucher..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
          />
        </div>

        {/* Categories (including Vendor Advance) */}
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
        >
          <option value="all">All Expense Categories</option>
          <option value="Vendor Advance">Vendor Advance Payments</option>
          <option value="Raw Material">Raw Material</option>
          <option value="Packaging">Packaging</option>
          <option value="Transportation">Transportation</option>
          <option value="Electricity">Electricity</option>
          <option value="Salary">Salary</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Fuel">Fuel</option>
          <option value="Rent">Rent</option>
          <option value="Marketing">Marketing</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Unified Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Category</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Amount (₹)</th>
                <th className="p-3">Payment Method</th>
                <th className="p-3">Paid To / Vendor</th>
                <th className="p-3">Voucher / Ref #</th>
                <th className="p-3">Advance Status / Balance</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No expense or advance entries found.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const adv = item.advanceRecord;
                  const isAdvance = item.isAdvance && !!adv;
                  const hasRemainingAdvance = isAdvance && adv.balanceAmount > 0;
                  const isFullyAdjusted = isAdvance && adv.balanceAmount === 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-blue-50/20 transition-colors ${
                        isAdvance ? 'bg-emerald-50/15' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="p-3 font-mono-numbers text-slate-600 whitespace-nowrap">
                        {item.date}
                      </td>

                      {/* Category */}
                      <td className="p-3 whitespace-nowrap">
                        {isAdvance ? (
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                            <CreditCard className="w-3 h-3 text-emerald-700" />
                            <span>Vendor Advance</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {item.category}
                          </span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="p-3">
                        <span className="font-medium text-slate-900 block">{item.description}</span>
                        {isAdvance && adv.adjustedAmount > 0 && (
                          <span className="text-[10px] text-slate-500 font-mono-numbers block mt-0.5">
                            ₹{adv.adjustedAmount.toLocaleString('en-IN')} adjusted against goods • ₹{adv.balanceAmount.toLocaleString('en-IN')} balance remaining
                          </span>
                        )}
                      </td>

                      {/* Amount (Counted in total whether adjusted or unadjusted) */}
                      <td className="p-3 text-right font-mono-numbers font-bold text-slate-900 text-sm whitespace-nowrap">
                        ₹{item.amount.toLocaleString('en-IN')}
                      </td>

                      {/* Payment Method */}
                      <td className="p-3 font-sans uppercase text-[11px] text-slate-600 whitespace-nowrap">
                        {item.paymentMethod.replace('_', ' ')}
                      </td>

                      {/* Paid To / Vendor */}
                      <td className="p-3 font-semibold text-slate-800">
                        {item.paidTo}
                      </td>

                      {/* Voucher / Ref # */}
                      <td className="p-3 font-mono-numbers text-slate-500 text-[11px] whitespace-nowrap">
                        {item.referenceNumber}
                      </td>

                      {/* Advance Balance / Status */}
                      <td className="p-3 whitespace-nowrap">
                        {isAdvance ? (
                          isFullyAdjusted ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3 text-slate-500" />
                              <span>Fully Adjusted</span>
                            </span>
                          ) : adv.adjustedAmount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 font-mono-numbers">
                              Bal: ₹{adv.balanceAmount.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono-numbers">
                              Available: ₹{adv.balanceAmount.toLocaleString('en-IN')}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Action: Adjust button for advance row */}
                      <td className="p-3 text-right whitespace-nowrap">
                        {isAdvance ? (
                          hasRemainingAdvance ? (
                            <button
                              onClick={() => setSelectedAdvanceToAdjust(adv)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 ml-auto"
                              title="Adjust this advance against goods or raw materials received"
                            >
                              <Scale className="w-3.5 h-3.5" />
                              <span>Adjust</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-700 font-bold flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Adjusted</span>
                            </span>
                          )
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Advance Modal (Simple text field for vendor, no dropdown) */}
      <RecordAdvanceModal
        isOpen={isRecordAdvanceOpen}
        onClose={() => setIsRecordAdvanceOpen(false)}
      />

      {/* Adjust Advance Modal (Adjust advance with expense/goods) */}
      <AdjustAdvanceModal
        isOpen={!!selectedAdvanceToAdjust}
        onClose={() => setSelectedAdvanceToAdjust(null)}
        advance={selectedAdvanceToAdjust}
      />
    </div>
  );
};
