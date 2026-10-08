import React, { useState, useMemo, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Button } from '../ui/Button';
import {
  BookOpen,
  Printer,
  Search,
  Filter,
  ArrowLeft,
  ArrowUpRight,
  User,
  Phone,
  Building,
  CreditCard,
  PlusCircle,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileText,
  DollarSign,
  ChevronRight,
  Shield,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Retailer, LedgerEntry } from '../../types/dairy';

interface LedgerViewProps {
  onOpenRecordPayment?: (customerId?: string) => void;
  onOpenCreateOrder?: (customerId?: string) => void;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  onOpenRecordPayment,
  onOpenCreateOrder,
}) => {
  const {
    ledger,
    retailers,
    salesChannels,
    selectedRetailerId,
    setSelectedRetailerId,
    setInternalView,
    addToast,
  } = useDairy();

  // If a retailer was pre-selected from another screen, start in detail view; otherwise start in list view
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(() => {
    return selectedRetailerId && retailers.some(r => r.id === selectedRetailerId)
      ? selectedRetailerId
      : null;
  });

  // Keep synced if selectedRetailerId changes from outside
  useEffect(() => {
    if (selectedRetailerId && retailers.some(r => r.id === selectedRetailerId)) {
      setSelectedCustomerId(selectedRetailerId);
    }
  }, [selectedRetailerId, retailers]);

  // Directory List Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('All');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'outstanding' | 'settled'>('all');

  // Statement Detail Filters
  const [statementSearch, setStatementSearch] = useState('');
  const [statementTypeFilter, setStatementTypeFilter] = useState<'all' | 'debit' | 'credit'>('all');
  const [statementDateFilter, setStatementDateFilter] = useState<'all' | 'month' | '30days'>('all');

  // ---------------------------------------------------------------------------
  // Calculations for Customer Directory Table
  // ---------------------------------------------------------------------------
  const customerFinancials = useMemo(() => {
    const map: Record<string, { debits: number; credits: number; count: number }> = {};
    for (const r of retailers) {
      map[r.id] = { debits: 0, credits: 0, count: 0 };
    }
    for (const entry of ledger) {
      if (map[entry.retailerId]) {
        map[entry.retailerId].debits += entry.debit || 0;
        map[entry.retailerId].credits += entry.credit || 0;
        map[entry.retailerId].count += 1;
      }
    }
    return map;
  }, [retailers, ledger]);

  const totalOutstandingAll = useMemo(() => {
    return retailers.reduce((acc, r) => acc + (r.outstandingAmount || 0), 0);
  }, [retailers]);

  const totalDebitsAll = useMemo(() => {
    return ledger.reduce((acc, l) => acc + (l.debit || 0), 0);
  }, [ledger]);

  const totalCreditsAll = useMemo(() => {
    return ledger.reduce((acc, l) => acc + (l.credit || 0), 0);
  }, [ledger]);

  const customersWithBalanceCount = useMemo(() => {
    return retailers.filter(r => (r.outstandingAmount || 0) > 0).length;
  }, [retailers]);

  // Filtered customer list
  const filteredRetailers = useMemo(() => {
    return retailers.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.businessName.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q) ||
        (r.area && r.area.toLowerCase().includes(q)) ||
        (r.mobile && r.mobile.includes(q)) ||
        (r.gstin && r.gstin.toLowerCase().includes(q)) ||
        (r.customerCode && r.customerCode.toLowerCase().includes(q));

      const matchesChannel = channelFilter === 'All' || r.salesChannelName === channelFilter;

      const outstanding = r.outstandingAmount || 0;
      let matchesBalance = true;
      if (balanceFilter === 'outstanding') {
        matchesBalance = outstanding > 0;
      } else if (balanceFilter === 'settled') {
        matchesBalance = outstanding <= 0;
      }

      return matchesSearch && matchesChannel && matchesBalance;
    });
  }, [retailers, searchQuery, channelFilter, balanceFilter]);

  // ---------------------------------------------------------------------------
  // Calculations for Specific Customer Statement
  // ---------------------------------------------------------------------------
  const activeRetailer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return retailers.find(r => r.id === selectedCustomerId) || null;
  }, [selectedCustomerId, retailers]);

  const customerLedgerEntries = useMemo(() => {
    if (!selectedCustomerId) return [];
    return ledger.filter(l => l.retailerId === selectedCustomerId);
  }, [selectedCustomerId, ledger]);

  const totalCustomerDebits = useMemo(() => {
    return customerLedgerEntries.reduce((acc, l) => acc + (l.debit || 0), 0);
  }, [customerLedgerEntries]);

  const totalCustomerCredits = useMemo(() => {
    return customerLedgerEntries.reduce((acc, l) => acc + (l.credit || 0), 0);
  }, [customerLedgerEntries]);

  const closingBalance = activeRetailer?.outstandingAmount ?? 0;
  const openingBalance = Math.max(0, closingBalance - totalCustomerDebits + totalCustomerCredits);

  // Compute chronologically sorted statement transactions with dynamic running balances
  const statementTransactions = useMemo(() => {
    if (!activeRetailer) return [];

    // Sort chronologically ascending
    const chronological = [...customerLedgerEntries].sort((a, b) => {
      const d1 = new Date(a.date).getTime();
      const d2 = new Date(b.date).getTime();
      if (d1 !== d2) return d1 - d2;
      return a.id.localeCompare(b.id);
    });

    let currentRunning = openingBalance;
    const computed = chronological.map(entry => {
      const debit = entry.debit || 0;
      const credit = entry.credit || 0;
      currentRunning = currentRunning + debit - credit;
      return {
        ...entry,
        runningBalance: currentRunning,
      };
    });

    // Apply statement filters
    return computed.filter(entry => {
      const q = statementSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        entry.particular.toLowerCase().includes(q) ||
        (entry.reference && entry.reference.toLowerCase().includes(q));

      let matchesType = true;
      if (statementTypeFilter === 'debit') matchesType = (entry.debit || 0) > 0;
      if (statementTypeFilter === 'credit') matchesType = (entry.credit || 0) > 0;

      let matchesDate = true;
      if (statementDateFilter === '30days') {
        const d = new Date(entry.date).getTime();
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        matchesDate = d >= thirtyDaysAgo;
      } else if (statementDateFilter === 'month') {
        const now = new Date();
        const entryDate = new Date(entry.date);
        matchesDate =
          entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [
    activeRetailer,
    customerLedgerEntries,
    openingBalance,
    statementSearch,
    statementTypeFilter,
    statementDateFilter,
  ]);

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setSelectedRetailerId(customerId);
    setStatementSearch('');
    setStatementTypeFilter('all');
    setStatementDateFilter('all');
  };

  const handleBackToList = () => {
    setSelectedCustomerId(null);
    setSelectedRetailerId('');
  };

  const handlePrint = () => {
    window.print();
    addToast('Printing statement...', 'info');
  };

  // ---------------------------------------------------------------------------
  // VIEW 1: CUSTOMER LEDGER DIRECTORY (TABLE FORM)
  // ---------------------------------------------------------------------------
  if (!selectedCustomerId || !activeRetailer) {
    return (
      <div className="space-y-5">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Customer Account Ledgers</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Double-Entry Accounting
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any customer retailer to inspect detailed invoice debits, payment credits, and running balance statements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={handlePrint}
            >
              Print Directory
            </Button>
          </div>
        </div>

        {/* Executive Metrics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Total Accounts
            </span>
            <span className="text-lg font-black text-slate-900 font-mono-numbers mt-1 block">
              {retailers.length} Customers
            </span>
            <span className="text-[11px] text-slate-500">
              {customersWithBalanceCount} with open balance
            </span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Total Invoiced (Debits)
            </span>
            <span className="text-lg font-black text-slate-900 font-mono-numbers mt-1 block">
              ₹{totalDebitsAll.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-slate-500">Cumulative sales charges</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider">
              Total Collected (Credits)
            </span>
            <span className="text-lg font-black text-emerald-600 font-mono-numbers mt-1 block">
              ₹{totalCreditsAll.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-emerald-700">Accounted receipts</span>
          </div>

          <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">
              Net Outstanding Receivables
            </span>
            <span className="text-lg font-black text-rose-600 font-mono-numbers mt-1 block">
              ₹{totalOutstandingAll.toLocaleString('en-IN')} Dr
            </span>
            <span className="text-[11px] text-rose-600 font-medium">Pending settlement</span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by customer, code, owner, area..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Sales Channel Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 whitespace-nowrap">Channel:</span>
              <select
                value={channelFilter}
                onChange={e => setChannelFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="All">All Channels</option>
                {salesChannels.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Balance Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 whitespace-nowrap">Balance:</span>
              <select
                value={balanceFilter}
                onChange={e => setBalanceFilter(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="all">All Accounts</option>
                <option value="outstanding">Outstanding (&gt; ₹0)</option>
                <option value="settled">Settled / Nil (₹0)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Customer Directory Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Customer &amp; Code</th>
                  <th className="py-3 px-3">Owner / Contact</th>
                  <th className="py-3 px-3">Channel Tier</th>
                  <th className="py-3 px-3 text-right">Credit Limit</th>
                  <th className="py-3 px-3 text-right">Total Invoiced</th>
                  <th className="py-3 px-3 text-right">Total Paid</th>
                  <th className="py-3 px-3 text-right">Outstanding (Dr)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredRetailers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-700">No customer accounts found</p>
                        <p className="text-[11px] text-slate-400">
                          Try clearing your search term or adjusting channel and balance filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRetailers.map(r => {
                    const fin = customerFinancials[r.id] || { debits: 0, credits: 0, count: 0 };
                    const hasOutstanding = (r.outstandingAmount || 0) > 0;
                    const exceedsLimit = r.creditLimit > 0 && (r.outstandingAmount || 0) > r.creditLimit;

                    return (
                      <tr
                        key={r.id}
                        onClick={() => handleSelectCustomer(r.id)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                      >
                        {/* Customer & Code */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              {r.businessName.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                  {r.businessName}
                                </span>
                                {r.customerCode && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                                    {r.customerCode}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 font-normal block">
                                {r.area || 'All Areas'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Owner / Contact */}
                        <td className="py-3.5 px-3">
                          <div className="space-y-0.5">
                            <span className="font-medium text-slate-800 block">{r.ownerName}</span>
                            <span className="text-[11px] text-slate-500 font-mono-numbers block">
                              {r.mobile ? `+91 ${r.mobile}` : '—'}
                            </span>
                          </div>
                        </td>

                        {/* Channel Tier */}
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {r.salesChannelName || 'Retail'}
                          </span>
                        </td>

                        {/* Credit Limit */}
                        <td className="py-3.5 px-3 text-right font-mono-numbers text-slate-600">
                          ₹{r.creditLimit.toLocaleString('en-IN')}
                        </td>

                        {/* Total Invoiced */}
                        <td className="py-3.5 px-3 text-right font-mono-numbers font-medium text-slate-800">
                          ₹{fin.debits.toLocaleString('en-IN')}
                        </td>

                        {/* Total Paid */}
                        <td className="py-3.5 px-3 text-right font-mono-numbers font-medium text-emerald-600">
                          ₹{fin.credits.toLocaleString('en-IN')}
                        </td>

                        {/* Outstanding Balance */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex flex-col items-end">
                            <span
                              className={`font-mono-numbers font-bold text-xs ${
                                hasOutstanding ? 'text-rose-600' : 'text-emerald-700'
                              }`}
                            >
                              ₹{(r.outstandingAmount || 0).toLocaleString('en-IN')}
                              {hasOutstanding && <span className="ml-1 text-[10px] text-rose-500 font-normal">Dr</span>}
                            </span>
                            {exceedsLimit && (
                              <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1 rounded border border-amber-200 mt-0.5">
                                Over Limit
                              </span>
                            )}
                            {!hasOutstanding && (
                              <span className="text-[10px] text-emerald-700 font-medium">
                                Settled
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCustomer(r.id);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-semibold text-xs transition-colors shadow-2xs"
                          >
                            <span>View Ledger</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Summary */}
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Showing <strong>{filteredRetailers.length}</strong> of <strong>{retailers.length}</strong> customer accounts
            </span>
            <div className="flex items-center gap-4 text-xs font-mono-numbers">
              <span>
                Total Outstanding: <strong className="text-rose-600 font-bold">₹{totalOutstandingAll.toLocaleString('en-IN')} Dr</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: DETAILED CUSTOMER STATEMENT PAGE
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToList}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs flex items-center gap-1.5 text-xs font-semibold"
            title="Return to customer accounts list"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Back to Customer List</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{activeRetailer.businessName}</h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Account Statement
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Formal running statement showing invoice debits, payment credits, and dynamic closing balance
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onOpenCreateOrder && (
            <Button
              variant="outline"
              size="sm"
              icon={<PlusCircle className="w-3.5 h-3.5" />}
              onClick={() => onOpenCreateOrder(activeRetailer.id)}
            >
              New Order
            </Button>
          )}

          {onOpenRecordPayment && closingBalance > 0 && (
            <Button
              variant="primary"
              size="sm"
              icon={<CreditCard className="w-3.5 h-3.5" />}
              onClick={() => onOpenRecordPayment(activeRetailer.id)}
            >
              Record Payment
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={<Printer className="w-3.5 h-3.5" />}
            onClick={handlePrint}
          >
            Print Statement
          </Button>
        </div>
      </div>

      {/* Customer Account Details Card & Quick Switcher */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-black text-sm flex items-center justify-center border border-blue-200">
              {activeRetailer.businessName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">{activeRetailer.businessName}</span>
                {activeRetailer.customerCode && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                    {activeRetailer.customerCode}
                  </span>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {activeRetailer.salesChannelName || 'Retail'}
                </span>
              </div>
              <span className="text-slate-500 text-[11px]">
                Prop: <strong>{activeRetailer.ownerName}</strong> • {activeRetailer.area || 'All Areas'}
              </span>
            </div>
          </div>

          {/* Quick Customer Switcher */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-slate-500 text-xs whitespace-nowrap">Switch Customer:</span>
            <select
              value={selectedCustomerId}
              onChange={e => handleSelectCustomer(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer w-full sm:w-64"
            >
              {retailers.map(r => (
                <option key={r.id} value={r.id}>
                  {r.businessName} (₹{(r.outstandingAmount || 0).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Customer Meta Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600 pt-1 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Contact Phone</span>
            <span className="font-semibold text-slate-800 font-mono-numbers">
              {activeRetailer.mobile ? `+91 ${activeRetailer.mobile}` : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">GSTIN Registration</span>
            <span className="font-semibold text-slate-800 font-mono-numbers">
              {activeRetailer.gstin || 'Unregistered'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Credit Limit</span>
            <span className="font-semibold text-slate-800 font-mono-numbers">
              ₹{activeRetailer.creditLimit.toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Payment Terms</span>
            <span className="font-semibold text-slate-800">{activeRetailer.paymentTerms}</span>
          </div>
        </div>
      </div>

      {/* Financial Statement Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Opening Balance
          </span>
          <span className="text-base font-bold text-slate-900 font-mono-numbers mt-1 block">
            ₹{openingBalance.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-400">Statement period b/f</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Total Invoiced (Debit)
          </span>
          <span className="text-base font-bold text-slate-900 font-mono-numbers mt-1 block">
            ₹{totalCustomerDebits.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-500">Goods dispatched &amp; billed</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider">
            Total Paid (Credit)
          </span>
          <span className="text-base font-bold text-emerald-600 font-mono-numbers mt-1 block">
            ₹{totalCustomerCredits.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-emerald-700">Accounted payment receipts</span>
        </div>

        <div className="p-3.5 bg-rose-50/70 rounded-xl border-2 border-rose-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">
            Current Outstanding
          </span>
          <span className="text-lg font-black text-rose-600 font-mono-numbers mt-1 block">
            ₹{closingBalance.toLocaleString('en-IN')} {closingBalance > 0 ? '(Dr)' : ''}
          </span>
          <span className="text-[10px] text-rose-600 font-medium">
            {closingBalance > 0 ? 'Pending Settlement' : 'Account Settled'}
          </span>
        </div>
      </div>

      {/* Statement Filters Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={statementSearch}
            onChange={e => setStatementSearch(e.target.value)}
            placeholder="Search statement particulars, ref..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Type:</span>
            <select
              value={statementTypeFilter}
              onChange={e => setStatementTypeFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="all">All Entries</option>
              <option value="debit">Debits (Invoices)</option>
              <option value="credit">Credits (Payments)</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Period:</span>
            <select
              value={statementDateFilter}
              onChange={e => setStatementDateFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="month">This Month</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Double-Entry Statement Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4 w-28">Date</th>
                <th className="py-3 px-4">Particulars / Description</th>
                <th className="py-3 px-3 w-32">Voucher Ref</th>
                <th className="py-3 px-3 text-right w-32">Debit (₹)</th>
                <th className="py-3 px-3 text-right w-32">Credit (₹)</th>
                <th className="py-3 px-4 text-right w-36">Running Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {/* Opening Balance Row */}
              <tr className="bg-slate-50/80 font-semibold text-slate-700">
                <td className="py-2.5 px-4 font-mono-numbers text-slate-500">—</td>
                <td className="py-2.5 px-4 text-slate-800 font-bold" colSpan={2}>
                  Opening Balance b/f
                </td>
                <td className="py-2.5 px-3 text-right font-mono-numbers text-slate-400">—</td>
                <td className="py-2.5 px-3 text-right font-mono-numbers text-slate-400">—</td>
                <td className="py-2.5 px-4 text-right font-mono-numbers font-black text-slate-900">
                  ₹{openingBalance.toLocaleString('en-IN')}
                </td>
              </tr>

              {/* Transactions */}
              {statementTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No ledger transactions matching the selected filters.
                  </td>
                </tr>
              ) : (
                statementTransactions.map(entry => (
                  <tr key={entry.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4 font-mono-numbers text-slate-600 whitespace-nowrap">
                      {entry.date ? entry.date.split('T')[0] : '—'}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {entry.particular}
                    </td>
                    <td className="py-3 px-3 font-mono-numbers text-slate-500">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono">
                        {entry.reference || 'Ledger'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono-numbers font-semibold text-slate-900">
                      {entry.debit ? `₹${entry.debit.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-numbers font-bold text-emerald-600">
                      {entry.credit ? `₹${entry.credit.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-numbers font-bold text-slate-900">
                      ₹{entry.runningBalance.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
              <tr>
                <td className="py-3 px-4" colSpan={3}>
                  Statement Closing Totals
                </td>
                <td className="py-3 px-3 text-right font-mono-numbers font-bold text-slate-900">
                  ₹{totalCustomerDebits.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-3 text-right font-mono-numbers font-bold text-emerald-600">
                  ₹{totalCustomerCredits.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-4 text-right font-mono-numbers font-black text-rose-600">
                  ₹{closingBalance.toLocaleString('en-IN')} Dr
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
