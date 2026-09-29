import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { ExpenseCategory } from '../../types/dairy';
import { Receipt, Plus, Search, Filter, Fuel, Truck, Zap, Users, Wrench } from 'lucide-react';

interface ExpensesViewProps {
  onOpenAddExpense: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({ onOpenAddExpense }) => {
  const { expenses } = useDairy();

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredExpenses = expenses.filter(exp => {
    const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;
    const matchesSearch =
      exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.paidTo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // KPI Calculations
  const todayTotal = expenses
    .filter(e => e.date === '2026-09-17')
    .reduce((acc, e) => acc + e.amount, 0);

  const monthTotal = expenses.reduce((acc, e) => acc + e.amount, 0);

  const transportTotal = expenses
    .filter(e => e.category === 'Transportation' || e.category === 'Fuel')
    .reduce((acc, e) => acc + e.amount, 0);

  const rawMaterialTotal = expenses
    .filter(e => e.category === 'Raw Material')
    .reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Receipt className="w-4 h-4 text-blue-600" />
            <span>Operations & Overhead Accounting</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Dairy Operating Expenses
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log raw milk procurement, cold storage electricity, fuel, packaging consumables, and maintenance.
          </p>
        </div>

        <button
          onClick={onOpenAddExpense}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Expense</span>
        </button>
      </div>

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

      {/* Table as specified in Section 27 */}
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
              {filteredExpenses.map(exp => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
