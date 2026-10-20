import React, { useState, useMemo, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { Order, OrderStatus } from '../../types/dairy';
import { 
  ShoppingCart, Search, Filter, ArrowRight, Eye, Calendar, MapPin, 
  Truck, Plus, Pencil, CheckCircle2, FileText, CheckSquare, Square, AlertCircle, Clock,
  CalendarDays, Sparkles, X, ChevronDown, Check, RefreshCw, XCircle, ChevronRight,
  TrendingUp, AlertTriangle
} from 'lucide-react';
import { 
  getTodayDateString, 
  getTomorrowDateString, 
  getDaysAgoDateString, 
  getMonthBoundsDateStrings,
  cleanDateString,
  formatCalendarDate
} from '../../utils/dateUtils';

interface OrdersViewProps {
  onSelectRetailer: (id: string) => void;
}

export type OrderDateFilterType = 'all' | 'today' | 'tomorrow' | 'last7days' | 'this_month';

export const OrdersView: React.FC<OrdersViewProps> = ({ onSelectRetailer }) => {
  const { 
    orders, 
    retailers, 
    updateOrderStatus, 
    confirmOrder, 
    dispatchOrder, 
    generateInvoiceForOrder,
    bulkGenerateInvoices,
    bulkConfirmOrders, 
    bulkDispatchOrders,
    setInternalView,
    setSelectedInvoiceId,
    selectedOrderId,
    setSelectedOrderId,
    navigateToCreateOrder,
    ordersDateFilter,
    setOrdersDateFilter,
  } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<OrderDateFilterType>(
    (ordersDateFilter as OrderDateFilterType) || 'all'
  );
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  // Bulk selection & operation states
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null);
  const [isGeneratingDrawerInvoice, setIsGeneratingDrawerInvoice] = useState(false);

  // Sync date filter if requested from outside (e.g. Dashboard alert click)
  useEffect(() => {
    if (ordersDateFilter && ['all', 'today', 'tomorrow', 'last7days', 'this_month'].includes(ordersDateFilter)) {
      setDateFilter(ordersDateFilter as OrderDateFilterType);
    }
  }, [ordersDateFilter]);

  // Sync selected order if requested from outside
  useEffect(() => {
    if (selectedOrderId) {
      const match = orders.find(o => o.id === selectedOrderId);
      if (match) {
        setViewingOrder(match);
      }
    }
  }, [selectedOrderId, orders]);

  // Date constants (local timezone YYYY-MM-DD)
  const todayStr = useMemo(() => getTodayDateString(), []);
  const tomorrowStr = useMemo(() => getTomorrowDateString(), []);
  const sevenDaysAgoStr = useMemo(() => getDaysAgoDateString(6), []);
  const { start: monthStartStr, end: monthEndStr } = useMemo(() => getMonthBoundsDateStrings(), []);

  // Helper to extract clean expected delivery date (fallback to orderDate)
  const getOrderExpectedDate = (order: Order): string => {
    return cleanDateString(order.deliveryDate || order.orderDate);
  };

  // Pre-calculate Today's and Tomorrow's expected orders
  const todayOrders = useMemo(() => {
    return orders.filter(o => getOrderExpectedDate(o) === todayStr && o.status !== 'cancelled');
  }, [orders, todayStr]);

  const todayTotalAmount = useMemo(() => {
    return todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  }, [todayOrders]);

  const todayPendingCount = useMemo(() => {
    return todayOrders.filter(o => o.status === 'pending').length;
  }, [todayOrders]);

  const todayConfirmedCount = useMemo(() => {
    return todayOrders.filter(o => o.status === 'confirmed').length;
  }, [todayOrders]);

  const todayDispatchedCount = useMemo(() => {
    return todayOrders.filter(o => o.status === 'dispatched' || o.status === 'delivered').length;
  }, [todayOrders]);

  const tomorrowOrders = useMemo(() => {
    return orders.filter(o => getOrderExpectedDate(o) === tomorrowStr && o.status !== 'cancelled');
  }, [orders, tomorrowStr]);

  const tomorrowTotalAmount = useMemo(() => {
    return tomorrowOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  }, [tomorrowOrders]);

  const tomorrowPendingCount = useMemo(() => {
    return tomorrowOrders.filter(o => o.status === 'pending').length;
  }, [tomorrowOrders]);

  const tomorrowConfirmedCount = useMemo(() => {
    return tomorrowOrders.filter(o => o.status === 'confirmed').length;
  }, [tomorrowOrders]);

  const allPendingCount = useMemo(() => {
    return orders.filter(o => o.status === 'pending').length;
  }, [orders]);

  const handleOpenCreateOrder = () => {
    navigateToCreateOrder(null);
  };

  const handleOpenEditOrder = (order: Order) => {
    navigateToCreateOrder(order);
  };

  // Reset all active filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedRetailer('all');
    setSelectedStatus('all');
    setDateFilter('all');
    if (setOrdersDateFilter) {
      setOrdersDateFilter('all');
    }
  };

  const isAnyFilterActive = searchQuery !== '' || selectedRetailer !== 'all' || selectedStatus !== 'all' || dateFilter !== 'all';

  // Filtered orders collection
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.retailerName.toLowerCase().includes(q);

      // 2. Retailer Filter
      const matchesRetailer = selectedRetailer === 'all' || o.retailerId === selectedRetailer;

      // 3. Status Filter
      const matchesStatus = selectedStatus === 'all' || o.status === selectedStatus;

      // 4. Date Range Filter (Filtered by Expected Delivery Date, with fallback to Order Placement Date)
      const expDate = getOrderExpectedDate(o);
      const placedDate = cleanDateString(o.orderDate);
      let matchesDate = true;

      if (dateFilter === 'today') {
        matchesDate = expDate === todayStr;
      } else if (dateFilter === 'tomorrow') {
        matchesDate = expDate === tomorrowStr;
      } else if (dateFilter === 'last7days') {
        matchesDate = (expDate >= sevenDaysAgoStr && expDate <= todayStr) || 
                      (placedDate >= sevenDaysAgoStr && placedDate <= todayStr);
      } else if (dateFilter === 'this_month') {
        matchesDate = (expDate >= monthStartStr && expDate <= monthEndStr) ||
                      (placedDate >= monthStartStr && placedDate <= monthEndStr);
      }

      return matchesSearch && matchesRetailer && matchesStatus && matchesDate;
    });
  }, [orders, searchQuery, selectedRetailer, selectedStatus, dateFilter, todayStr, tomorrowStr, sevenDaysAgoStr, monthStartStr, monthEndStr]);

  // Bulk selection handling
  const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds.includes(o.id));
  const someFilteredSelected = filteredOrders.some(o => selectedOrderIds.includes(o.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Selected orders grouped by status for bulk actions
  const selectedPendingIds = filteredOrders.filter(o => selectedOrderIds.includes(o.id) && o.status === 'pending').map(o => o.id);
  const selectedConfirmedWithoutInvoiceIds = filteredOrders
    .filter(o => selectedOrderIds.includes(o.id) && o.status === 'confirmed' && !o.invoiceId)
    .map(o => o.id);

  const handleBulkConfirm = async () => {
    if (selectedPendingIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await bulkConfirmOrders(selectedPendingIds);
      setSelectedOrderIds(prev => prev.filter(id => !selectedPendingIds.includes(id)));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkGenerateInvoices = async () => {
    if (selectedConfirmedWithoutInvoiceIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await bulkGenerateInvoices(selectedConfirmedWithoutInvoiceIds);
      setSelectedOrderIds(prev => prev.filter(id => !selectedConfirmedWithoutInvoiceIds.includes(id)));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleViewInvoice = (order: Order) => {
    if (order.invoiceId) {
      setSelectedInvoiceId(order.invoiceId);
    }
    setInternalView('invoices');
  };

  const getRetailerAddress = (retailerId: string) => {
    const r = retailers.find(ret => ret.id === retailerId);
    return r ? r.address : 'Registered Delivery Address';
  };

  return (
    <div className="space-y-4">
      {/* 1. Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Retailer Sales Orders</h2>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {orders.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational Lifecycle: <span className="font-semibold text-amber-700">Pending</span> &rarr; <span className="font-semibold text-blue-700">Confirmed</span> &rarr; <span className="font-semibold text-sky-700">Generate Invoice (Ready)</span> &rarr; <span className="font-semibold text-indigo-700">Trip Dispatch</span> &rarr; <span className="font-semibold text-emerald-700">Delivered</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAnyFilterActive && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              title="Reset all search, date and status filters"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Filters</span>
            </button>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreateOrder}
          >
            Create New Order
          </Button>
        </div>
      </div>

      {/* 2. Interactive KPI & Alert Cards for Today's and Tomorrow's Orders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Today's Orders KPI / Alert Box */}
        <div
          onClick={() => {
            const next = dateFilter === 'today' ? 'all' : 'today';
            setDateFilter(next);
            if (setOrdersDateFilter) setOrdersDateFilter(next);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
            dateFilter === 'today'
              ? 'bg-blue-50/90 border-blue-500 shadow-md ring-2 ring-blue-500/25'
              : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Today&apos;s Orders</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                dateFilter === 'today'
                  ? 'bg-blue-600 text-white font-mono-numbers'
                  : 'bg-blue-100/80 text-blue-800'
              }`}>
                {dateFilter === 'today' ? 'Active Filter' : 'Expected Today'}
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 font-mono-numbers tracking-tight">
                {todayOrders.length}
              </span>
              <span className="text-xs font-bold text-blue-700 font-mono-numbers">
                ₹{todayTotalAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mt-0.5">
              Scheduled for delivery today ({formatCalendarDate(todayStr)})
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            {todayPendingCount > 0 ? (
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>{todayPendingCount} pending confirmation</span>
              </span>
            ) : todayOrders.length > 0 ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{todayConfirmedCount} confirmed • {todayDispatchedCount} on route</span>
              </span>
            ) : (
              <span className="text-slate-400">No deliveries today</span>
            )}
            <span className={`text-[10px] font-bold flex items-center gap-0.5 transition-colors ${
              dateFilter === 'today' ? 'text-blue-700 font-extrabold' : 'text-slate-400 group-hover:text-blue-600'
            }`}>
              <span>{dateFilter === 'today' ? 'Viewing' : 'Click to View'}</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 2: Tomorrow's Orders KPI / Alert Box */}
        <div
          onClick={() => {
            const next = dateFilter === 'tomorrow' ? 'all' : 'tomorrow';
            setDateFilter(next);
            if (setOrdersDateFilter) setOrdersDateFilter(next);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
            dateFilter === 'tomorrow'
              ? 'bg-indigo-50/90 border-indigo-500 shadow-md ring-2 ring-indigo-500/25'
              : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tomorrow&apos;s Orders</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                dateFilter === 'tomorrow'
                  ? 'bg-indigo-600 text-white font-mono-numbers'
                  : 'bg-indigo-100/80 text-indigo-800'
              }`}>
                {dateFilter === 'tomorrow' ? 'Active Filter' : 'Expected Tomorrow'}
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 font-mono-numbers tracking-tight">
                {tomorrowOrders.length}
              </span>
              <span className="text-xs font-bold text-indigo-700 font-mono-numbers">
                ₹{tomorrowTotalAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mt-0.5">
              Advance dispatch planned ({formatCalendarDate(tomorrowStr)})
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            {tomorrowOrders.length > 0 ? (
              <span className="text-indigo-700 font-semibold">
                {tomorrowPendingCount} pending • {tomorrowConfirmedCount} confirmed
              </span>
            ) : (
              <span className="text-slate-400">No advance orders scheduled</span>
            )}
            <span className={`text-[10px] font-bold flex items-center gap-0.5 transition-colors ${
              dateFilter === 'tomorrow' ? 'text-indigo-700 font-extrabold' : 'text-slate-400 group-hover:text-indigo-600'
            }`}>
              <span>{dateFilter === 'tomorrow' ? 'Viewing' : 'Click to View'}</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 3: Pending Approval Box */}
        <div
          onClick={() => setSelectedStatus(prev => prev === 'pending' ? 'all' : 'pending')}
          className={`p-4 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
            selectedStatus === 'pending'
              ? 'bg-amber-50/90 border-amber-500 shadow-md ring-2 ring-amber-500/25'
              : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Pending Approval</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                selectedStatus === 'pending'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {allPendingCount > 0 ? 'Action Needed' : 'All Clear'}
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 font-mono-numbers tracking-tight">
                {allPendingCount}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Awaiting staff verification
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mt-0.5">
              Requires confirmation & batch stock lock
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-600 font-medium">Lifecycle Stage 1</span>
            <span className={`text-[10px] font-bold flex items-center gap-0.5 transition-colors ${
              selectedStatus === 'pending' ? 'text-amber-700 font-extrabold' : 'text-slate-400 group-hover:text-amber-700'
            }`}>
              <span>{selectedStatus === 'pending' ? 'Filtered' : 'Filter Pending'}</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 4: All Orders Total Box */}
        <div
          onClick={handleResetFilters}
          className={`p-4 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
            !isAnyFilterActive
              ? 'bg-slate-50/90 border-slate-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-slate-600" />
                <span>Total Orders</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                All Lifecycle
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 font-mono-numbers tracking-tight">
                {orders.length}
              </span>
              <span className="text-xs font-bold text-slate-700 font-mono-numbers">
                ₹{orders.reduce((sum, o) => sum + o.totalAmount, 0).toLocaleString('en-IN')}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mt-0.5">
              Lifetime sales order repository
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">
              {filteredOrders.length !== orders.length ? `Showing ${filteredOrders.length} of ${orders.length}` : 'All orders visible'}
            </span>
            <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-900 flex items-center gap-0.5">
              <span>View All</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* 3. Comprehensive Filter Bar (Status, Date Range, Retailer, Search) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        {/* Row 1: Search & Retailer Select */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Order No. or Retailer..."
              className="w-full text-xs pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={selectedRetailer}
              onChange={e => setSelectedRetailer(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer w-full md:w-auto font-medium"
            >
              <option value="all">All Retailers ({retailers.length})</option>
              {retailers.map(r => (
                <option key={r.id} value={r.id}>{r.businessName}</option>
              ))}
            </select>

            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1 border border-rose-200 whitespace-nowrap"
                title="Reset all filters"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Date Range Pills & Status Filter Pills */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* Date Range Selection (Today, Tomorrow, Last 7 Days, This Month, All) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Date:</span>
            </span>

            {[
              { id: 'all', label: 'All Dates' },
              { id: 'today', label: 'Today', count: todayOrders.length, highlight: true },
              { id: 'tomorrow', label: 'Tomorrow', count: tomorrowOrders.length, highlight: true },
              { id: 'last7days', label: 'Last 7 Days' },
              { id: 'this_month', label: 'This Month' },
            ].map(tab => {
              const isSelected = dateFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    const next = tab.id as OrderDateFilterType;
                    setDateFilter(next);
                    if (setOrdersDateFilter) setOrdersDateFilter(next);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono-numbers font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : tab.highlight
                        ? 'bg-blue-200 text-blue-900'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Status Selection (All, Pending, Confirmed, Dispatched, Delivered, Cancelled) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Status:</span>
            </span>

            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length, color: 'text-amber-700 bg-amber-100' },
              { id: 'confirmed', label: 'Confirmed', count: orders.filter(o => o.status === 'confirmed').length, color: 'text-blue-700 bg-blue-100' },
              { id: 'dispatched', label: 'Dispatched', count: orders.filter(o => o.status === 'dispatched').length, color: 'text-indigo-700 bg-indigo-100' },
              { id: 'delivered', label: 'Delivered', count: orders.filter(o => (o.status as string) === 'delivered').length, color: 'text-emerald-700 bg-emerald-100' },
              { id: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length, color: 'text-slate-600 bg-slate-200' },
            ].map(st => {
              const isSelected = selectedStatus === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setSelectedStatus(st.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                  }`}
                >
                  <span>{st.label}</span>
                  {st.count !== undefined && st.count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono-numbers font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : st.color || 'bg-slate-200 text-slate-700'
                    }`}>
                      {st.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filters Summary Indicator */}
        {isAnyFilterActive && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-700">Active Filters:</span>
              {dateFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                  Date: {dateFilter === 'today' ? 'Today' : dateFilter === 'tomorrow' ? 'Tomorrow' : dateFilter === 'last7days' ? 'Last 7 Days' : 'This Month'}
                  <button onClick={() => setDateFilter('all')} className="hover:text-blue-950"><X className="w-3 h-3" /></button>
                </span>
              )}
              {selectedStatus !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold uppercase text-[10px]">
                  Status: {selectedStatus}
                  <button onClick={() => setSelectedStatus('all')} className="hover:text-amber-950"><X className="w-3 h-3" /></button>
                </span>
              )}
              {selectedRetailer !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">
                  Retailer: {retailers.find(r => r.id === selectedRetailer)?.businessName || selectedRetailer}
                  <button onClick={() => setSelectedRetailer('all')} className="hover:text-indigo-950"><X className="w-3 h-3" /></button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-semibold">
                  &ldquo;{searchQuery}&rdquo;
                  <button onClick={() => setSearchQuery('')} className="hover:text-slate-950"><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
            <span className="font-mono-numbers font-semibold text-slate-700 shrink-0">
              Showing {filteredOrders.length} of {orders.length} orders
            </span>
          </div>
        )}
      </div>

      {/* 4. Bulk Operations Toolbar */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span>{selectedOrderIds.length} order(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            {selectedPendingIds.length > 0 && (
              <button
                onClick={handleBulkConfirm}
                disabled={isBulkProcessing}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Bulk Confirm ({selectedPendingIds.length})</span>
              </button>
            )}

            {selectedConfirmedWithoutInvoiceIds.length > 0 && (
              <button
                onClick={handleBulkGenerateInvoices}
                disabled={isBulkProcessing}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Bulk Generate Invoices ({selectedConfirmedWithoutInvoiceIds.length})</span>
              </button>
            )}

            <button
              onClick={() => setSelectedOrderIds([])}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* 5. Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-3 w-8">
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
                <th className="py-3 px-3">Order No.</th>
                <th className="py-3 px-3">Retailer Store</th>
                <th className="py-3 px-3">Expected / Order Date</th>
                <th className="py-3 px-3">Items Summary</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">No orders match your filter criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting the date range, status, or search query.
                    </p>
                    {isAnyFilterActive && (
                      <button
                        onClick={handleResetFilters}
                        className="mt-3 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-xs inline-flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Clear All Filters</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  const expDate = getOrderExpectedDate(order);
                  const isExpectedToday = expDate === todayStr;
                  const isExpectedTomorrow = expDate === tomorrowStr;

                  return (
                    <tr 
                      key={order.id} 
                      className={`hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 font-mono-numbers font-bold text-slate-900">
                        {order.orderNumber}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => onSelectRetailer(order.retailerId)}
                          className="font-bold text-slate-900 hover:text-blue-600 hover:underline text-left block truncate max-w-[200px]"
                        >
                          {order.retailerName}
                        </button>
                        {order.retailerChannelName && (
                          <span className="text-[10px] text-slate-400 font-medium block">
                            {order.retailerChannelName}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono-numbers">
                        {/* Expected Delivery Date Alert Pill */}
                        {isExpectedToday ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 mb-0.5">
                            <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>Expected Today</span>
                          </div>
                        ) : isExpectedTomorrow ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 mb-0.5">
                            <Truck className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span>Expected Tomorrow</span>
                          </div>
                        ) : order.deliveryDate ? (
                          <div className="text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Exp: {cleanDateString(order.deliveryDate)}</span>
                          </div>
                        ) : null}

                        <div className="text-[10px] text-slate-400">
                          Placed: {cleanDateString(order.orderDate)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <div className="space-y-0.5">
                          {order.items.slice(0, 2).map((item, i) => (
                            <div key={i} className="text-[11px]">
                              <span className="font-semibold text-slate-900">{item.quantity}</span> × {item.productName}
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              +{order.items.length - 2} more items...
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-numbers font-bold text-slate-900">
                        ₹{order.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={order.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Details Drawer */}
                          <button
                            onClick={() => setViewingOrder(order)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 text-[11px] font-medium transition-colors"
                            title="View order details"
                          >
                            Details
                          </button>

                          {/* Edit button allowed only if not dispatched */}
                          {order.status !== 'dispatched' && order.status !== 'cancelled' && (
                            <button
                              onClick={() => handleOpenEditOrder(order)}
                              className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                              title="Edit order items & pricing"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          )}

                          {/* Forward Action Buttons */}
                          {order.status === 'pending' && (
                            <button
                              onClick={() => confirmOrder(order.id)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded text-[11px] font-bold transition-all inline-flex items-center gap-1"
                              title="Confirm order"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Confirm</span>
                            </button>
                          )}

                          {order.status === 'confirmed' && !order.invoiceId && (
                            <button
                              onClick={async () => {
                                setGeneratingInvoiceId(order.id);
                                try {
                                  await generateInvoiceForOrder(order.id);
                                } finally {
                                  setGeneratingInvoiceId(null);
                                }
                              }}
                              disabled={generatingInvoiceId === order.id}
                              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-600 hover:text-white text-sky-700 border border-sky-200 rounded text-[11px] font-bold transition-all inline-flex items-center gap-1 disabled:opacity-50"
                              title="Generate Invoice in Ready status"
                            >
                              <FileText className="w-3 h-3" />
                              <span>{generatingInvoiceId === order.id ? 'Generating...' : 'Generate Invoice'}</span>
                            </button>
                          )}

                          {order.status === 'confirmed' && order.invoiceId && (
                            <button
                              onClick={() => handleViewInvoice(order)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded text-[11px] font-bold transition-all inline-flex items-center gap-1"
                              title={`View Invoice ${order.invoiceNumber || ''} (Ready)`}
                            >
                              <FileText className="w-3 h-3" />
                              <span>{order.invoiceNumber ? `${order.invoiceNumber} (Ready)` : 'View Invoice'}</span>
                            </button>
                          )}

                          {(order.status === 'dispatched' || (order.status as string) === 'delivered') && (
                            <button
                              onClick={() => handleViewInvoice(order)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold transition-all inline-flex items-center gap-1"
                              title={order.invoiceNumber ? `View Invoice ${order.invoiceNumber}` : 'View Invoices'}
                            >
                              <FileText className="w-3 h-3" />
                              <span>{order.invoiceNumber || 'View Invoice'}</span>
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

      {/* 6. Order Details Drawer */}
      <Drawer
        isOpen={Boolean(viewingOrder)}
        onClose={() => setViewingOrder(null)}
        title={viewingOrder ? `Order ${viewingOrder.orderNumber}` : 'Order Details'}
        subtitle={viewingOrder ? `Retailer: ${viewingOrder.retailerName}` : ''}
        width="lg"
      >
        {viewingOrder && (
          <div className="space-y-4 text-xs">
            {/* Order Information Section */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                Order Information
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Order Date</span>
                  <span className="font-semibold text-slate-900 font-mono-numbers">{cleanDateString(viewingOrder.orderDate)}</span>
                </div>
                {viewingOrder.deliveryDate && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Expected Delivery</span>
                    <span className="font-bold text-emerald-700 font-mono-numbers flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      {cleanDateString(viewingOrder.deliveryDate)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500 block text-[10px]">Operational Status</span>
                  <StatusBadge status={viewingOrder.status} size="sm" />
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Total Order Amount</span>
                  <span className="font-bold text-blue-700 text-sm font-mono-numbers">
                    ₹{viewingOrder.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Audit trail */}
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                {viewingOrder.confirmedAt && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Confirmed At</span>
                    <span className="font-mono-numbers text-slate-700">
                      {new Date(viewingOrder.confirmedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {viewingOrder.dispatchedAt && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Dispatched At</span>
                    <span className="font-mono-numbers text-slate-700">
                      {new Date(viewingOrder.dispatchedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {viewingOrder.invoiceNumber && (
                  <div className="col-span-2 bg-emerald-50 border border-emerald-200 p-2 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-emerald-800 font-bold block text-xs">Generated Invoice</span>
                      <span className="font-mono-numbers text-emerald-700 text-xs">{viewingOrder.invoiceNumber}</span>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<FileText className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setViewingOrder(null);
                        handleViewInvoice(viewingOrder);
                      }}
                    >
                      View Invoice
                    </Button>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 block text-[10px]">Delivery Address</span>
                <span className="text-slate-700">{getRetailerAddress(viewingOrder.retailerId)}</span>
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                Order Items
              </h4>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="p-2.5">Product</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Unit Rate</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingOrder.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-2.5 font-semibold text-slate-900">
                          {item.productName}
                          <span className="block text-[10px] text-slate-400 font-normal">{item.unit}</span>
                        </td>
                        <td className="p-2.5 text-right font-mono-numbers font-bold text-slate-900">
                          {item.quantity}
                        </td>
                        <td className="p-2.5 text-right font-mono-numbers text-slate-600">
                          ₹{item.unitPrice}
                        </td>
                        <td className="p-2.5 text-right font-mono-numbers font-bold text-slate-900">
                          ₹{item.totalPrice.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Drawer Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setViewingOrder(null)}
                >
                  Close Drawer
                </Button>
                {viewingOrder.status !== 'dispatched' && viewingOrder.status !== 'cancelled' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Pencil className="w-3.5 h-3.5" />}
                    onClick={() => {
                      const toEdit = viewingOrder;
                      setViewingOrder(null);
                      handleOpenEditOrder(toEdit);
                    }}
                  >
                    Edit Order
                  </Button>
                )}
              </div>

              {viewingOrder.status === 'pending' && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={async () => {
                    await confirmOrder(viewingOrder.id);
                    setViewingOrder(null);
                  }}
                >
                  Confirm Order
                </Button>
              )}

              {viewingOrder.status === 'confirmed' && !viewingOrder.invoiceId && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<FileText className="w-4 h-4" />}
                  isLoading={isGeneratingDrawerInvoice}
                  onClick={async () => {
                    setIsGeneratingDrawerInvoice(true);
                    try {
                      await generateInvoiceForOrder(viewingOrder.id);
                      setViewingOrder(null);
                    } finally {
                      setIsGeneratingDrawerInvoice(false);
                    }
                  }}
                >
                  Generate Invoice
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
