import React, { useState, useMemo } from 'react';
import { useDairy } from '../../context/DairyContext';
import { ExpenseCategory, PaymentMethod, VendorAdvance, VendorBill } from '../../types/dairy';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Users,
  CreditCard,
  IndianRupee,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Scale,
  Calendar,
  Layers,
  Building2,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { RecordAdvanceModal } from './RecordAdvanceModal';
import { CreateVendorBillModal } from './CreateVendorBillModal';
import { AdjustAdvanceModal } from './AdjustAdvanceModal';

interface ExpensesViewProps {
  onOpenAddExpense: () => void;
}

type ExpenseTab = 'operating_expenses' | 'vendor_advances' | 'vendor_bills' | 'adjustments_log';

export const ExpensesView: React.FC<ExpensesViewProps> = ({ onOpenAddExpense }) => {
  const {
    expenses,
    suppliers,
    vendorAdvances,
    vendorBills,
    vendorAdvanceAdjustments,
  } = useDairy();

  // Active Sub-tab
  const [activeTab, setActiveTab] = useState<ExpenseTab>('operating_expenses');

  // Modals state
  const [isRecordAdvanceOpen, setIsRecordAdvanceOpen] = useState(false);
  const [recordAdvanceSupplierId, setRecordAdvanceSupplierId] = useState<string | undefined>();

  const [isCreateBillOpen, setIsCreateBillOpen] = useState(false);
  const [createBillSupplierId, setCreateBillSupplierId] = useState<string | undefined>();
  const [createBillVendorName, setCreateBillVendorName] = useState<string | undefined>();

  const [isAdjustAdvanceOpen, setIsAdjustAdvanceOpen] = useState(false);
  const [adjustAdvanceId, setAdjustAdvanceId] = useState<string | undefined>();
  const [adjustBillId, setAdjustBillId] = useState<string | undefined>();

  // --- Operating Expenses Tab States ---
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Vendor Advances Tab Filters ---
  const [advVendorFilter, setAdvVendorFilter] = useState('all');
  const [advPaymentMethodFilter, setAdvPaymentMethodFilter] = useState('all');
  const [advStatusFilter, setAdvStatusFilter] = useState('all');
  const [advDateFilter, setAdvDateFilter] = useState('all');
  const [advSearchQuery, setAdvSearchQuery] = useState('');

  // --- Vendor Bills Tab Filters ---
  const [billVendorFilter, setBillVendorFilter] = useState('all');
  const [billStatusFilter, setBillStatusFilter] = useState('all');
  const [billSearchQuery, setBillSearchQuery] = useState('');

  // --- Adjustments Log Filters ---
  const [adjSearchQuery, setAdjSearchQuery] = useState('');

  // ==========================================
  // OPERATING EXPENSES LOGIC (PRESERVED 100%)
  // ==========================================
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;
      const matchesSearch =
        exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.paidTo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [expenses, categoryFilter, searchQuery]);

  // Operating Expenses KPI Calculations (Preserved)
  const todayTotal = useMemo(() => {
    return expenses
      .filter(e => e.date === '2026-09-17' || e.date === new Date().toISOString().split('T')[0])
      .reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const monthTotal = useMemo(() => {
    return expenses.reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const transportTotal = useMemo(() => {
    return expenses
      .filter(e => e.category === 'Transportation' || e.category === 'Fuel')
      .reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const rawMaterialTotal = useMemo(() => {
    return expenses
      .filter(e => e.category === 'Raw Material')
      .reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  // ==========================================
  // VENDOR ADVANCES LOGIC & KPIS
  // ==========================================
  const totalAdvancesDisbursed = useMemo(() => {
    return vendorAdvances.reduce((acc, a) => acc + a.amount, 0);
  }, [vendorAdvances]);

  const totalAdvancesAdjusted = useMemo(() => {
    return vendorAdvances.reduce((acc, a) => acc + a.adjustedAmount, 0);
  }, [vendorAdvances]);

  const totalAvailableAdvanceBalance = useMemo(() => {
    return vendorAdvances.reduce((acc, a) => acc + a.balanceAmount, 0);
  }, [vendorAdvances]);

  const totalVendorBillsPayable = useMemo(() => {
    return vendorBills.reduce((acc, b) => acc + b.balanceAmount, 0);
  }, [vendorBills]);

  // Grouped Vendor Balances Summary
  const vendorSummaries = useMemo(() => {
    const map = new Map<string, {
      supplierId?: string;
      vendorName: string;
      totalAdvances: number;
      adjustedAdvances: number;
      availableAdvanceBalance: number;
      totalBills: number;
      outstandingBillPayable: number;
      advancesCount: number;
      openBillsCount: number;
    }>();

    // Index from suppliers first so registered suppliers are easily identifiable
    suppliers.forEach(sup => {
      map.set(sup.name.toLowerCase().trim(), {
        supplierId: sup.id,
        vendorName: sup.name,
        totalAdvances: 0,
        adjustedAdvances: 0,
        availableAdvanceBalance: 0,
        totalBills: 0,
        outstandingBillPayable: 0,
        advancesCount: 0,
        openBillsCount: 0,
      });
    });

    // Populate advances
    vendorAdvances.forEach(adv => {
      const key = adv.vendorName.toLowerCase().trim();
      let record = map.get(key);
      if (!record) {
        record = {
          supplierId: adv.supplierId,
          vendorName: adv.vendorName,
          totalAdvances: 0,
          adjustedAdvances: 0,
          availableAdvanceBalance: 0,
          totalBills: 0,
          outstandingBillPayable: 0,
          advancesCount: 0,
          openBillsCount: 0,
        };
        map.set(key, record);
      }
      record.totalAdvances += adv.amount;
      record.adjustedAdvances += adv.adjustedAmount;
      record.availableAdvanceBalance += adv.balanceAmount;
      record.advancesCount += 1;
    });

    // Populate bills
    vendorBills.forEach(bill => {
      const key = bill.vendorName.toLowerCase().trim();
      let record = map.get(key);
      if (!record) {
        record = {
          supplierId: bill.supplierId,
          vendorName: bill.vendorName,
          totalAdvances: 0,
          adjustedAdvances: 0,
          availableAdvanceBalance: 0,
          totalBills: 0,
          outstandingBillPayable: 0,
          advancesCount: 0,
          openBillsCount: 0,
        };
        map.set(key, record);
      }
      record.totalBills += bill.totalAmount;
      record.outstandingBillPayable += bill.balanceAmount;
      if (bill.balanceAmount > 0) {
        record.openBillsCount += 1;
      }
    });

    // Only return records that have either advances or bills
    return Array.from(map.values()).filter(
      r => r.totalAdvances > 0 || r.totalBills > 0
    ).sort((a, b) => b.availableAdvanceBalance - a.availableAdvanceBalance);
  }, [suppliers, vendorAdvances, vendorBills]);

  // Filtered Advances List
  const filteredAdvances = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.substring(0, 7); // YYYY-MM

    return vendorAdvances.filter(adv => {
      // Vendor filter
      if (advVendorFilter !== 'all') {
        const matchesSup = adv.supplierId === advVendorFilter;
        const matchesName = adv.vendorName.toLowerCase() === advVendorFilter.toLowerCase();
        if (!matchesSup && !matchesName) return false;
      }

      // Payment Method filter
      if (advPaymentMethodFilter !== 'all' && adv.paymentMethod !== advPaymentMethodFilter) {
        return false;
      }

      // Status filter
      if (advStatusFilter !== 'all') {
        if (advStatusFilter === 'available' && adv.status !== 'available') return false;
        if (advStatusFilter === 'partially_adjusted' && adv.status !== 'partially_adjusted') return false;
        if (advStatusFilter === 'fully_adjusted' && adv.status !== 'fully_adjusted') return false;
        if (advStatusFilter === 'open' && adv.balanceAmount <= 0) return false;
      }

      // Date filter
      if (advDateFilter === 'today' && adv.advanceDate !== todayStr) return false;
      if (advDateFilter === 'week' && adv.advanceDate < sevenDaysAgo) return false;
      if (advDateFilter === 'month' && !adv.advanceDate.startsWith(currentMonthPrefix)) return false;

      // Search Query
      if (advSearchQuery.trim()) {
        const q = advSearchQuery.toLowerCase();
        const matches =
          adv.advanceNumber.toLowerCase().includes(q) ||
          adv.vendorName.toLowerCase().includes(q) ||
          (adv.referenceNumber && adv.referenceNumber.toLowerCase().includes(q)) ||
          (adv.notes && adv.notes.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [vendorAdvances, advVendorFilter, advPaymentMethodFilter, advStatusFilter, advDateFilter, advSearchQuery]);

  // Filtered Bills List
  const filteredBills = useMemo(() => {
    return vendorBills.filter(bill => {
      if (billVendorFilter !== 'all') {
        const matchesSup = bill.supplierId === billVendorFilter;
        const matchesName = bill.vendorName.toLowerCase() === billVendorFilter.toLowerCase();
        if (!matchesSup && !matchesName) return false;
      }

      if (billStatusFilter !== 'all') {
        if (billStatusFilter === 'unpaid' && bill.status !== 'unpaid') return false;
        if (billStatusFilter === 'partially_adjusted' && bill.status !== 'partially_adjusted') return false;
        if (billStatusFilter === 'settled' && bill.status !== 'settled') return false;
        if (billStatusFilter === 'open' && bill.balanceAmount <= 0) return false;
      }

      if (billSearchQuery.trim()) {
        const q = billSearchQuery.toLowerCase();
        const matches =
          bill.billNumber.toLowerCase().includes(q) ||
          bill.vendorName.toLowerCase().includes(q) ||
          bill.category.toLowerCase().includes(q) ||
          (bill.notes && bill.notes.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [vendorBills, billVendorFilter, billStatusFilter, billSearchQuery]);

  // Filtered Adjustments Log
  const filteredAdjustments = useMemo(() => {
    return vendorAdvanceAdjustments.filter(adj => {
      if (adjSearchQuery.trim()) {
        const q = adjSearchQuery.toLowerCase();
        return (
          adj.adjustmentNumber.toLowerCase().includes(q) ||
          adj.vendorName.toLowerCase().includes(q) ||
          adj.advanceNumber.toLowerCase().includes(q) ||
          adj.billNumber.toLowerCase().includes(q) ||
          (adj.notes && adj.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [vendorAdvanceAdjustments, adjSearchQuery]);

  // Helper action triggers
  const handleOpenAdvanceForVendor = (supplierId?: string) => {
    setRecordAdvanceSupplierId(supplierId);
    setIsRecordAdvanceOpen(true);
  };

  const handleOpenAdjustForAdvance = (advance: VendorAdvance) => {
    setAdjustAdvanceId(advance.id);
    setAdjustBillId(undefined);
    setIsAdjustAdvanceOpen(true);
  };

  const handleOpenAdjustForBill = (bill: VendorBill) => {
    setAdjustBillId(bill.id);
    setAdjustAdvanceId(undefined);
    setIsAdjustAdvanceOpen(true);
  };

  const handleOpenCreateBill = (supplierId?: string, vendorName?: string) => {
    setCreateBillSupplierId(supplierId);
    setCreateBillVendorName(vendorName);
    setIsCreateBillOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Dual Action Buttons */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Receipt className="w-4 h-4 text-blue-600" />
            <span>Operations, Procurement & Advance Accounting</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Expenses & Vendor Advance Tracking
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log dairy operating overheads, manage farmer/supplier advances, and adjust advances against procurement bills.
          </p>
        </div>

        {/* Action Buttons: Add Expense AND Advance Payment */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setRecordAdvanceSupplierId(undefined);
              setIsRecordAdvanceOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            title="Disburse an advance payment to a dairy farmer or supplier"
          >
            <CreditCard className="w-4 h-4" />
            <span>+ Advance Payment</span>
          </button>

          <button
            onClick={() => handleOpenCreateBill()}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            title="Register a procurement bill to adjust advances against"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>+ Vendor Bill</span>
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

      {/* Subtabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-3 pt-2 rounded-t-xl gap-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('operating_expenses')}
          className={`py-2.5 px-4 rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'operating_expenses'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Operating Expenses ({expenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('vendor_advances')}
          className={`py-2.5 px-4 rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'vendor_advances'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-600" />
          <span>Vendor & Farmer Advances ({vendorAdvances.length})</span>
          {totalAvailableAdvanceBalance > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono-numbers">
              ₹{totalAvailableAdvanceBalance.toLocaleString('en-IN')} Bal
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('vendor_bills')}
          className={`py-2.5 px-4 rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'vendor_bills'
              ? 'border-purple-600 text-purple-700 bg-purple-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-purple-600" />
          <span>Vendor Bills & Payables ({vendorBills.length})</span>
          {totalVendorBillsPayable > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-mono-numbers">
              ₹{totalVendorBillsPayable.toLocaleString('en-IN')} Open
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('adjustments_log')}
          className={`py-2.5 px-4 rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'adjustments_log'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Scale className="w-4 h-4 text-indigo-600" />
          <span>Adjustment Audit Log ({vendorAdvanceAdjustments.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OPERATING EXPENSES (PRESERVED 100% INTACT)                         */}
      {/* ========================================================================= */}
      {activeTab === 'operating_expenses' && (
        <div className="space-y-6">
          {/* 4 Dashboard Cards as requested in Section 27 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Today's Expenses</span>
              <span className="text-xl font-black text-slate-900 font-mono-numbers mt-1 block">
                ₹{todayTotal.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400">17 Sep 2026</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">This Month's Overhead</span>
              <span className="text-xl font-black text-slate-900 font-mono-numbers mt-1 block">
                ₹{monthTotal.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400">September 2026 MTD</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Transportation & Fuel</span>
              <span className="text-xl font-black text-slate-900 font-mono-numbers mt-1 block">
                ₹{transportTotal.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Refrigerated logistics</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Raw Material Procurement</span>
              <span className="text-xl font-black text-blue-600 font-mono-numbers mt-1 block">
                ₹{rawMaterialTotal.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Farmer milk collections</span>
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
                placeholder="Search description, vendor or voucher..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* Categories */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">All Expense Categories</option>
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

          {/* Operating Expenses Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                    <th className="p-3">Payment Method</th>
                    <th className="p-3">Paid To / Vendor</th>
                    <th className="p-3">Voucher / Ref #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No expenses match your search or filter.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-3 font-mono-numbers text-slate-600">{exp.date}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {exp.category}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-900">{exp.description}</td>
                        <td className="p-3 text-right font-mono-numbers font-bold text-slate-900 text-sm">
                          ₹{exp.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 font-sans uppercase text-[11px] text-slate-600">
                          {exp.paymentMethod.replace('_', ' ')}
                        </td>
                        <td className="p-3 font-semibold text-slate-800">{exp.paidTo}</td>
                        <td className="p-3 font-mono-numbers text-slate-500 text-[11px]">{exp.referenceNumber}</td>
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
      {/* TAB 2: VENDOR & FARMER ADVANCES                                           */}
      {/* ========================================================================= */}
      {activeTab === 'vendor_advances' && (
        <div className="space-y-6">
          {/* Vendor Advances KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Advances Disbursed</span>
              <span className="text-xl font-black text-slate-900 font-mono-numbers mt-1 block">
                ₹{totalAdvancesDisbursed.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400">{vendorAdvances.length} advance vouchers issued</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Adjusted Against Bills</span>
              <span className="text-xl font-black text-slate-700 font-mono-numbers mt-1 block">
                ₹{totalAdvancesAdjusted.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400">Offset on procurement bills</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-emerald-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Available Advance Balance</span>
              <span className="text-xl font-black text-emerald-600 font-mono-numbers mt-1 block">
                ₹{totalAvailableAdvanceBalance.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">Active credit with suppliers</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-amber-200 shadow-sm bg-gradient-to-br from-white to-amber-50/30">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Outstanding Vendor Bills</span>
              <span className="text-xl font-black text-amber-600 font-mono-numbers mt-1 block">
                ₹{totalVendorBillsPayable.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-amber-700 font-medium">Unpaid procurement balance</span>
            </div>
          </div>

          {/* Vendor-Wise Available Balances Card & Summary Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Vendor & Farmer Balance Summary</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Overview of available advance balances and outstanding procurement payables by vendor
                </p>
              </div>
              <button
                onClick={() => {
                  setRecordAdvanceSupplierId(undefined);
                  setIsRecordAdvanceOpen(true);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Advance</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Vendor / Farmer / Society</th>
                    <th className="p-3 text-right">Total Disbursed (₹)</th>
                    <th className="p-3 text-right">Adjusted (₹)</th>
                    <th className="p-3 text-right">Available Advance Bal (₹)</th>
                    <th className="p-3 text-right">Open Bills Payable (₹)</th>
                    <th className="p-3 text-center">Net Position</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendorSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        No vendor advances or bills recorded yet. Click <strong>+ Advance Payment</strong> above to start.
                      </td>
                    </tr>
                  ) : (
                    vendorSummaries.map(item => {
                      const netPosition = item.availableAdvanceBalance - item.outstandingBillPayable;
                      return (
                        <tr key={item.vendorName} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{item.vendorName}</span>
                            <span className="text-[10px] text-slate-400">
                              {item.advancesCount} advances • {item.openBillsCount} open bills
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono-numbers text-slate-700">
                            ₹{item.totalAdvances.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-mono-numbers text-slate-500">
                            ₹{item.adjustedAdvances.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-mono-numbers">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                              item.availableAdvanceBalance > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              ₹{item.availableAdvanceBalance.toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono-numbers text-amber-800 font-semibold">
                            ₹{item.outstandingBillPayable.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-center">
                            {netPosition > 0 ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Advance Credit (+₹{netPosition.toLocaleString('en-IN')})
                              </span>
                            ) : netPosition < 0 ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Net Payable (₹{Math.abs(netPosition).toLocaleString('en-IN')})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                                Settled
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.availableAdvanceBalance > 0 && item.outstandingBillPayable > 0 ? (
                                <button
                                  onClick={() => {
                                    // Find first open advance for this vendor
                                    const adv = vendorAdvances.find(
                                      a => a.balanceAmount > 0 &&
                                      ((a.supplierId && a.supplierId === item.supplierId) ||
                                       a.vendorName.toLowerCase() === item.vendorName.toLowerCase())
                                    );
                                    if (adv) handleOpenAdjustForAdvance(adv);
                                    else setIsAdjustAdvanceOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm"
                                >
                                  <Scale className="w-3 h-3" />
                                  <span>Adjust</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenAdvanceForVendor(item.supplierId)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold"
                                >
                                  + Advance
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

          {/* Filters Bar for Advances Table */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-emerald-600" />
                <span>Filter Vendor Advances</span>
              </span>
              {(advVendorFilter !== 'all' || advPaymentMethodFilter !== 'all' || advStatusFilter !== 'all' || advDateFilter !== 'all' || advSearchQuery) && (
                <button
                  onClick={() => {
                    setAdvVendorFilter('all');
                    setAdvPaymentMethodFilter('all');
                    setAdvStatusFilter('all');
                    setAdvDateFilter('all');
                    setAdvSearchQuery('');
                  }}
                  className="text-blue-600 hover:underline font-semibold text-[11px]"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
              {/* Search text */}
              <div className="relative md:col-span-2">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={advSearchQuery}
                  onChange={e => setAdvSearchQuery(e.target.value)}
                  placeholder="Search advance #, vendor, notes..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-100 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Filter by Vendor */}
              <select
                value={advVendorFilter}
                onChange={e => setAdvVendorFilter(e.target.value)}
                className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-100 focus:outline-none"
              >
                <option value="all">All Vendors / Farmers</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>

              {/* Filter by Payment Method */}
              <select
                value={advPaymentMethodFilter}
                onChange={e => setAdvPaymentMethodFilter(e.target.value)}
                className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-100 focus:outline-none"
              >
                <option value="all">All Payment Methods</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>

              {/* Filter by Date Period */}
              <select
                value={advDateFilter}
                onChange={e => setAdvDateFilter(e.target.value)}
                className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-100 focus:outline-none"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">Past 7 Days</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </div>

          {/* Advances Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Disbursed Advances Ledger</h3>
                <span className="text-[11px] text-slate-400">
                  Showing {filteredAdvances.length} of {vendorAdvances.length} advances
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Advance #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Vendor / Farmer</th>
                    <th className="p-3 text-right">Disbursed (₹)</th>
                    <th className="p-3 text-right">Adjusted (₹)</th>
                    <th className="p-3 text-right">Available Balance (₹)</th>
                    <th className="p-3">Method & Ref</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdvances.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        No vendor advances match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAdvances.map(adv => {
                      const isFullyAdjusted = adv.balanceAmount === 0;
                      return (
                        <tr key={adv.id} className="hover:bg-emerald-50/20 transition-colors">
                          <td className="p-3 font-mono-numbers font-bold text-slate-900">
                            {adv.advanceNumber}
                          </td>
                          <td className="p-3 font-mono-numbers text-slate-600">{adv.advanceDate}</td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{adv.vendorName}</span>
                            {adv.notes && (
                              <span className="text-[10px] text-slate-500 block truncate max-w-[200px]" title={adv.notes}>
                                {adv.notes}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono-numbers font-bold text-slate-800 text-sm">
                            ₹{adv.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-mono-numbers text-slate-500">
                            ₹{adv.adjustedAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-mono-numbers">
                            <span className={`px-2 py-0.5 rounded-full font-black text-xs ${
                              isFullyAdjusted
                                ? 'bg-slate-100 text-slate-400 line-through'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              ₹{adv.balanceAmount.toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                              {adv.paymentMethod.replace('_', ' ')}
                            </span>
                            {adv.referenceNumber && (
                              <span className="block text-[10px] font-mono-numbers text-slate-400 mt-0.5">
                                {adv.referenceNumber}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {adv.status === 'fully_adjusted' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                Fully Adjusted
                              </span>
                            ) : adv.status === 'partially_adjusted' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                Partial
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Available
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {adv.balanceAmount > 0 ? (
                              <button
                                onClick={() => handleOpenAdjustForAdvance(adv)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 ml-auto"
                              >
                                <Scale className="w-3.5 h-3.5" />
                                <span>Adjust Against Bill</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium italic">
                                Fully Adjusted
                              </span>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: VENDOR BILLS & PAYABLES                                            */}
      {/* ========================================================================= */}
      {activeTab === 'vendor_bills' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between text-xs">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={billSearchQuery}
                onChange={e => setBillSearchQuery(e.target.value)}
                placeholder="Search bill #, vendor, category..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-100 focus:border-purple-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <select
                value={billVendorFilter}
                onChange={e => setBillVendorFilter(e.target.value)}
                className="p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-purple-100 focus:outline-none"
              >
                <option value="all">All Vendors</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>

              <select
                value={billStatusFilter}
                onChange={e => setBillStatusFilter(e.target.value)}
                className="p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-purple-100 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open / Unsettled</option>
                <option value="unpaid">Unpaid</option>
                <option value="partially_adjusted">Partially Adjusted</option>
                <option value="settled">Settled</option>
              </select>

              <button
                onClick={() => handleOpenCreateBill()}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Bill</span>
              </button>
            </div>
          </div>

          {/* Bills Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Bill #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Vendor / Farmer</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Total (₹)</th>
                    <th className="p-3 text-right">Adjusted from Advance (₹)</th>
                    <th className="p-3 text-right">Direct Paid (₹)</th>
                    <th className="p-3 text-right">Remaining Payable (₹)</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        No vendor bills recorded or matching the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map(bill => (
                      <tr key={bill.id} className="hover:bg-purple-50/20 transition-colors">
                        <td className="p-3 font-mono-numbers font-bold text-slate-900">{bill.billNumber}</td>
                        <td className="p-3 font-mono-numbers text-slate-600">{bill.billDate}</td>
                        <td className="p-3 font-bold text-slate-900">{bill.vendorName}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                            {bill.category}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono-numbers font-bold text-slate-900 text-sm">
                          ₹{bill.totalAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-mono-numbers text-emerald-700 font-semibold">
                          ₹{bill.adjustedAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-mono-numbers text-slate-500">
                          ₹{bill.paidAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-mono-numbers">
                          <span className={`px-2 py-0.5 rounded-full font-black text-xs ${
                            bill.balanceAmount === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            ₹{bill.balanceAmount.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {bill.status === 'settled' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Settled
                            </span>
                          ) : bill.status === 'partially_adjusted' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Partially Adjusted
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                              Unpaid
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {bill.balanceAmount > 0 ? (
                            <button
                              onClick={() => handleOpenAdjustForBill(bill)}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 ml-auto"
                            >
                              <Scale className="w-3.5 h-3.5" />
                              <span>Adjust Advance</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-bold flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Paid
                            </span>
                          )}
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
      {/* TAB 4: ADVANCE ADJUSTMENT AUDIT LOG                                       */}
      {/* ========================================================================= */}
      {activeTab === 'adjustments_log' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between text-xs">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={adjSearchQuery}
                onChange={e => setAdjSearchQuery(e.target.value)}
                placeholder="Search adjustment #, advance, bill..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <span className="text-[11px] text-slate-400">
              {filteredAdjustments.length} adjustment records
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Adj #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Vendor / Farmer</th>
                    <th className="p-3">Advance Voucher</th>
                    <th className="p-3">Bill Adjusted</th>
                    <th className="p-3 text-right">Adjusted Amount (₹)</th>
                    <th className="p-3">Notes / Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No advance adjustments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredAdjustments.map(adj => (
                      <tr key={adj.id} className="hover:bg-indigo-50/20 transition-colors">
                        <td className="p-3 font-mono-numbers font-bold text-indigo-700">
                          {adj.adjustmentNumber}
                        </td>
                        <td className="p-3 font-mono-numbers text-slate-600">{adj.adjustmentDate}</td>
                        <td className="p-3 font-bold text-slate-900">{adj.vendorName}</td>
                        <td className="p-3 font-mono-numbers font-semibold text-emerald-700">
                          {adj.advanceNumber}
                        </td>
                        <td className="p-3 font-mono-numbers font-semibold text-purple-700">
                          {adj.billNumber}
                        </td>
                        <td className="p-3 text-right font-mono-numbers font-black text-slate-900 text-sm">
                          ₹{adj.adjustedAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-slate-600">{adj.notes || '—'}</td>
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
      <RecordAdvanceModal
        isOpen={isRecordAdvanceOpen}
        onClose={() => {
          setIsRecordAdvanceOpen(false);
          setRecordAdvanceSupplierId(undefined);
        }}
        defaultSupplierId={recordAdvanceSupplierId}
      />

      <CreateVendorBillModal
        isOpen={isCreateBillOpen}
        onClose={() => {
          setIsCreateBillOpen(false);
          setCreateBillSupplierId(undefined);
          setCreateBillVendorName(undefined);
        }}
        defaultSupplierId={createBillSupplierId}
        defaultVendorName={createBillVendorName}
      />

      <AdjustAdvanceModal
        isOpen={isAdjustAdvanceOpen}
        onClose={() => {
          setIsAdjustAdvanceOpen(false);
          setAdjustAdvanceId(undefined);
          setAdjustBillId(undefined);
        }}
        preselectedAdvanceId={adjustAdvanceId}
        preselectedBillId={adjustBillId}
        onOpenCreateBill={(supplierId, vendorName) => {
          setIsAdjustAdvanceOpen(false);
          handleOpenCreateBill(supplierId, vendorName);
        }}
      />
    </div>
  );
};
