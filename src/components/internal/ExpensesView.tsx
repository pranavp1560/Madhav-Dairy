import React, { useState, useMemo } from 'react';
import { useDairy } from '../../context/DairyContext';
import { ExpenseCategory, PaymentMethod, VendorAdvance, Expense } from '../../types/dairy';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CreditCard,
  IndianRupee,
  Scale,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Loader2,
  Calendar,
  RefreshCw,
  Wallet,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { RecordAdvanceModal } from './RecordAdvanceModal';
import { AdjustAdvanceModal } from './AdjustAdvanceModal';
import { Modal } from '../common/Modal';

interface ExpensesViewProps {
  onOpenAddExpense: () => void;
}

interface UnifiedExpenseItem {
  id: string;
  originalId: string;
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
    deleteExpense,
  } = useDairy();

  // Modals state
  const [isRecordAdvanceOpen, setIsRecordAdvanceOpen] = useState(false);
  const [selectedAdvanceToAdjust, setSelectedAdvanceToAdjust] = useState<VendorAdvance | null>(null);

  // Delete Expense Confirmation state
  const [expenseToDelete, setExpenseToDelete] = useState<UnifiedExpenseItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // -----------------------------------------------------------------------------
  // 1. UNIFIED EXPENSES & ADVANCES LEDGER
  // -----------------------------------------------------------------------------
  const unifiedItems: UnifiedExpenseItem[] = useMemo(() => {
    const list: UnifiedExpenseItem[] = [];

    // Add regular expenses
    (expenses || []).forEach(exp => {
      list.push({
        id: `exp-${exp.id}`,
        originalId: exp.id,
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
    (vendorAdvances || []).forEach(adv => {
      list.push({
        id: `adv-${adv.id}`,
        originalId: adv.id,
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

  // Unique categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    unifiedItems.forEach(i => set.add(i.category));
    return Array.from(set).sort();
  }, [unifiedItems]);

  // Date constants for filtering
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);
  const startOfMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  // Filtered List
  const filteredItems = useMemo(() => {
    return unifiedItems.filter(item => {
      // Category filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'Vendor Advance' && !item.isAdvance) return false;
        if (item.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      }

      // Date filter
      if (dateFilter === 'today' && item.date !== todayStr) return false;
      if (dateFilter === 'week' && item.date < sevenDaysAgoStr) return false;
      if (dateFilter === 'month' && item.date < startOfMonthStr) return false;

      // Payment method filter
      if (paymentMethodFilter !== 'all' && item.paymentMethod !== paymentMethodFilter) return false;

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matches =
          item.description.toLowerCase().includes(q) ||
          item.paidTo.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.referenceNumber.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [unifiedItems, categoryFilter, dateFilter, paymentMethodFilter, searchQuery, todayStr, sevenDaysAgoStr, startOfMonthStr]);

  // -----------------------------------------------------------------------------
  // 2. EXPENSE TOTALS & KPIS
  // -----------------------------------------------------------------------------
  const todayTotal = useMemo(() => {
    return unifiedItems
      .filter(item => item.date === todayStr)
      .reduce((acc, item) => acc + item.amount, 0);
  }, [unifiedItems, todayStr]);

  const monthTotal = useMemo(() => {
    return unifiedItems
      .filter(item => item.date >= startOfMonthStr)
      .reduce((acc, item) => acc + item.amount, 0);
  }, [unifiedItems, startOfMonthStr]);

  const totalAdvancesGiven = useMemo(() => {
    return (vendorAdvances || []).reduce((acc, adv) => acc + adv.amount, 0);
  }, [vendorAdvances]);

  const totalAvailableAdvanceBalance = useMemo(() => {
    return (vendorAdvances || []).reduce((acc, adv) => acc + (adv.balanceAmount || 0), 0);
  }, [vendorAdvances]);

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      await deleteExpense(expenseToDelete.originalId);
      setExpenseToDelete(null);
    } catch {
      // Handled in context toast
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryBadgeClass = (category: string, isAdvance: boolean) => {
    if (isAdvance) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    const cat = category.toLowerCase();
    if (cat.includes('raw')) return 'bg-blue-50 text-blue-800 border-blue-200';
    if (cat.includes('packaging')) return 'bg-purple-50 text-purple-800 border-purple-200';
    if (cat.includes('transport') || cat.includes('fuel')) return 'bg-amber-50 text-amber-800 border-amber-200';
    if (cat.includes('electric') || cat.includes('utility')) return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    if (cat.includes('salary')) return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    if (cat.includes('maintenance')) return 'bg-rose-50 text-rose-800 border-rose-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const isAnyFilterActive = categoryFilter !== 'all' || dateFilter !== 'all' || paymentMethodFilter !== 'all' || searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setCategoryFilter('all');
    setDateFilter('all');
    setPaymentMethodFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Dual Buttons */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Receipt className="w-4 h-4 text-blue-600" />
            <span>Operations & Plant Accounting</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Dairy Operating Expenses & Advances
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log procurement, operational overheads, utilities, and farmer/vendor advances with one-click adjustments.
          </p>
        </div>

        {/* Buttons: + Advance Payment alongside + Add Expense */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsRecordAdvanceOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            title="Record an advance payment given to a vendor or farmer"
          >
            <CreditCard className="w-4 h-4" />
            <span>+ Advance Payment</span>
          </button>

          <button
            onClick={onOpenAddExpense}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Expense</span>
          </button>
        </div>
      </div>

      {/* 4 Dashboard Cards: Both expenses and advances reflected in totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Card 1: Today's Expenses */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500">Today's Expenses</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <span className="text-xl font-black text-slate-900 font-mono-numbers mt-1.5 block">
            ₹{todayTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Recorded today ({todayStr})</span>
        </div>

        {/* Card 2: Total Month's Expenses */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500">Total Expenses MTD</span>
            <Wallet className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <span className="text-xl font-black text-slate-900 font-mono-numbers mt-1.5 block">
            ₹{monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Month-to-date operating total</span>
        </div>

        {/* Card 3: Total Advances Disbursed */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500">Advances Disbursed</span>
            <CreditCard className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <span className="text-xl font-black text-slate-800 font-mono-numbers mt-1.5 block">
            ₹{totalAdvancesGiven.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Total given to vendors/farmers</span>
        </div>

        {/* Card 4: Available Advance Balance */}
        <div className="p-4 bg-gradient-to-br from-white to-emerald-50/50 rounded-2xl border border-emerald-200 shadow-sm hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-800">Available Advance Balance</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <span className="text-xl font-black text-emerald-700 font-mono-numbers mt-1.5 block">
            ₹{totalAvailableAdvanceBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-emerald-700/80 font-medium mt-0.5 block">Ready to adjust against goods</span>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search description, vendor, or voucher..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none transition-all"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="Vendor Advance">Vendor Advance Payments</option>
              {uniqueCategories
                .filter(c => c !== 'Vendor Advance')
                .map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
            </select>

            {/* Payment Method Dropdown */}
            <select
              value={paymentMethodFilter}
              onChange={e => setPaymentMethodFilter(e.target.value)}
              className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">All Payment Modes</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>

            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                title="Reset all search and filter parameters"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Filter Pills */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Date Range:</span>
          </span>

          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'Last 7 Days' },
            { id: 'month', label: 'This Month' },
          ].map(pill => {
            const isSelected = dateFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setDateFilter(pill.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Unified Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Date</th>
                <th className="py-3 px-3.5">Category</th>
                <th className="py-3 px-3.5">Description</th>
                <th className="py-3 px-3.5 text-right">Amount</th>
                <th className="py-3 px-3.5">Payment Mode</th>
                <th className="py-3 px-3.5">Paid To / Vendor</th>
                <th className="py-3 px-3.5">Voucher / Ref #</th>
                <th className="py-3 px-3.5">Status / Balance</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600 text-sm">No expense or advance entries found.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {isAnyFilterActive
                        ? 'Try clearing your filters or search keywords.'
                        : 'Record your first operational expense or vendor advance.'}
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      {isAnyFilterActive ? (
                        <button
                          onClick={handleResetFilters}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Clear All Filters</span>
                        </button>
                      ) : (
                        <button
                          onClick={onOpenAddExpense}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                        >
                          + Add First Expense
                        </button>
                      )}
                    </div>
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
                      className={`hover:bg-blue-50/30 transition-colors ${
                        isAdvance ? 'bg-emerald-50/10' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3 px-3.5 font-mono-numbers text-slate-700 whitespace-nowrap font-medium">
                        {item.date}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${getCategoryBadgeClass(
                            item.category,
                            isAdvance
                          )}`}
                        >
                          {isAdvance && <CreditCard className="w-3 h-3 text-emerald-700" />}
                          <span>{item.category}</span>
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-3.5 max-w-[280px]">
                        <span className="font-semibold text-slate-900 block truncate" title={item.description}>
                          {item.description}
                        </span>
                        {isAdvance && adv.adjustedAmount > 0 && (
                          <span className="text-[10px] text-slate-500 font-mono-numbers block mt-0.5">
                            ₹{adv.adjustedAmount.toLocaleString('en-IN')} adjusted against goods • ₹{adv.balanceAmount.toLocaleString('en-IN')} balance remaining
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3.5 text-right font-mono-numbers font-black text-slate-900 text-sm whitespace-nowrap">
                        ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          {item.paymentMethod.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Paid To / Vendor */}
                      <td className="py-3 px-3.5 font-semibold text-slate-800 whitespace-nowrap">
                        {item.paidTo}
                      </td>

                      {/* Voucher / Ref # */}
                      <td className="py-3 px-3.5 font-mono-numbers text-slate-500 text-[11px] whitespace-nowrap">
                        {item.referenceNumber}
                      </td>

                      {/* Advance Balance / Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {isAdvance ? (
                          isFullyAdjusted ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 inline-flex items-center gap-1 border border-slate-200">
                              <CheckCircle2 className="w-3 h-3 text-slate-500" />
                              <span>Fully Adjusted</span>
                            </span>
                          ) : adv.adjustedAmount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 font-mono-numbers inline-flex items-center gap-1">
                              <span>Bal: ₹{adv.balanceAmount.toLocaleString('en-IN')}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono-numbers inline-flex items-center gap-1">
                              <span>Available: ₹{adv.balanceAmount.toLocaleString('en-IN')}</span>
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            Recorded
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdvance ? (
                            hasRemainingAdvance ? (
                              <button
                                onClick={() => setSelectedAdvanceToAdjust(adv)}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                                title="Adjust this advance against goods or raw materials received"
                              >
                                <Scale className="w-3.5 h-3.5" />
                                <span>Adjust</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-emerald-700 font-bold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Adjusted</span>
                              </span>
                            )
                          ) : (
                            <button
                              onClick={() => setExpenseToDelete(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
                              title="Delete this expense entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* Delete Expense Confirmation Modal */}
      {expenseToDelete && (
        <Modal
          isOpen={Boolean(expenseToDelete)}
          onClose={() => {
            if (!isDeleting) setExpenseToDelete(null);
          }}
          title="Delete Expense Entry"
          subtitle="Permanently remove this operating expense record"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-900 text-sm">Are you sure you want to delete this expense?</p>
                <p className="text-xs text-rose-700 leading-relaxed">
                  This action will permanently delete the expense entry and remove it from your operating expense totals.
                </p>
              </div>
            </div>

            {/* Expense Snapshot */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-semibold text-slate-900">{expenseToDelete.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category:</span>
                <span className="font-semibold text-slate-900">{expenseToDelete.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Description:</span>
                <span className="font-medium text-slate-900">{expenseToDelete.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid To:</span>
                <span className="font-semibold text-slate-900">{expenseToDelete.paidTo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-mono-numbers font-black text-rose-600 text-sm">
                  ₹{expenseToDelete.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Voucher / Ref #:</span>
                <span className="font-mono-numbers text-slate-700">{expenseToDelete.referenceNumber}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Expense</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Advance Modal */}
      <RecordAdvanceModal
        isOpen={isRecordAdvanceOpen}
        onClose={() => setIsRecordAdvanceOpen(false)}
      />

      {/* Adjust Advance Modal */}
      <AdjustAdvanceModal
        isOpen={!!selectedAdvanceToAdjust}
        onClose={() => setSelectedAdvanceToAdjust(null)}
        advance={selectedAdvanceToAdjust}
      />
    </div>
  );
};
