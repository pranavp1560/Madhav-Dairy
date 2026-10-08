import React from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { StatusBadge } from '../ui/StatusBadge';
import {
  ShoppingBag,
  RotateCcw,
  ArrowRight,
  Clock,
  Bell,
  CreditCard,
  ChevronRight,
  Sparkles,
  Calendar
} from 'lucide-react';

interface CustomerHomeProps {
  onNavigate: (tab: string) => void;
}

export const CustomerHome: React.FC<CustomerHomeProps> = ({ onNavigate }) => {
  const {
    currentRetailer,
    currentUser,
    orders,
    reorder,
    notifications,
    addToast,
  } = useDairy();

  const { t } = useTranslation();

  const businessName = currentRetailer?.businessName || currentUser?.fullName || 'Retailer Partner';
  const ownerName = currentRetailer?.ownerName || '';
  const outstandingAmount = currentRetailer?.outstandingAmount || 0;
  const paymentTerms = currentRetailer?.paymentTerms || 'Net 15 Days';
  const creditLimit = currentRetailer?.creditLimit || 50000;

  // Strict customer isolation: only orders belonging to current logged-in retailer
  const customerOrders = currentRetailer
    ? orders.filter(o => o.retailerId === currentRetailer.id)
    : [];

  const latestOrder = customerOrders[0] || null;

  // Unread customer alerts isolated to current retailer
  const unreadAlerts = notifications.filter(
    n => n.recipientType === 'customer' && (!n.recipientId || (currentRetailer && n.recipientId === currentRetailer.id)) && !n.read
  );

  const handleRepeatLastOrder = () => {
    if (!latestOrder) {
      addToast('No previous orders found. Please select products to order.', 'info');
      onNavigate('products');
      return;
    }
    reorder(latestOrder.id);
    onNavigate('products');
    addToast(`Added items from ${latestOrder.orderNumber} to cart!`, 'success');
  };

  const statusMap: Record<string, string> = {
    pending: t.customer.orders.status.pending,
    confirmed: t.customer.orders.status.confirmed,
    preparing: t.customer.orders.status.preparing,
    dispatched: t.customer.orders.status.dispatched,
    delivered: t.customer.orders.status.delivered,
    cancelled: t.customer.orders.status.cancelled,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-28 font-sans">
      {/* 1. Welcome Greeting Banner */}
      <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs sm:text-sm font-bold border border-blue-200">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Verified Retail Partner</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
            {t.customer.home.greeting} {businessName}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-normal">
            Fresh wholesale dairy stock delivered directly to your store
            {ownerName && <span className="text-slate-500 ml-1.5">• {ownerName}</span>}
          </p>
        </div>
      </div>

      {/* 2. Primary Action Buttons (Square Boxes) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Main CTA: Order Products (Square Card) */}
        <button
          onClick={() => onNavigate('products')}
          className="group relative p-4 sm:p-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl shadow-sm flex flex-col justify-between text-left transition-all active:scale-[0.98] aspect-square overflow-hidden"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="space-y-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
              {t.customer.home.orderProducts}
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 font-medium line-clamp-2">
              Browse milk, curd, paneer & ghee
            </p>
          </div>
        </button>

        {/* Secondary CTA: Repeat Last Order (Square Card) */}
        <button
          onClick={handleRepeatLastOrder}
          className="group relative p-4 sm:p-5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-900 border border-slate-200 hover:border-blue-400 rounded-2xl shadow-2xs flex flex-col justify-between text-left transition-all active:scale-[0.98] aspect-square overflow-hidden"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <RotateCcw className="w-6 h-6 text-blue-600" />
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            </div>
          </div>

          <div className="space-y-1 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block font-mono-numbers truncate">
              {latestOrder ? `Last: ${latestOrder.orderNumber}` : 'Quick Reorder'}
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {t.customer.home.repeatLastOrder}
            </h2>
            <p className="text-xs sm:text-sm text-blue-700 font-semibold truncate">
              {latestOrder ? 'Load previous items' : 'Start first order'}
            </p>
          </div>
        </button>
      </div>

      {/* 3. Essential Retailer Overview Cards: Outstanding & Latest Order */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Outstanding Balance Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-bold uppercase tracking-wider text-slate-500">
                {t.customer.home.outstandingBalance}
              </span>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              {paymentTerms}
            </span>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono-numbers tracking-tight">
              ₹{outstandingAmount.toLocaleString('en-IN')}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {outstandingAmount > 0
                ? 'Current balance payable to Madhav Dairy'
                : 'All statement dues are fully settled'}
            </p>
          </div>

          <button
            onClick={() => onNavigate('payments')}
            className="min-h-[44px] w-full text-sm font-bold text-blue-700 hover:text-blue-800 bg-blue-50/70 hover:bg-blue-100/70 rounded-xl px-4 py-2.5 flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>View Payments & Invoices</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Latest Order Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-bold uppercase tracking-wider text-slate-500">
                {t.customer.home.myRecentOrders}
              </span>
            </div>
            {latestOrder && (
              <StatusBadge
                status={latestOrder.status}
                label={statusMap[latestOrder.status] || latestOrder.status}
                size="sm"
              />
            )}
          </div>

          {latestOrder ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-base sm:text-lg font-bold text-slate-900 font-mono-numbers">
                  {latestOrder.orderNumber}
                </span>
                <span className="text-xl sm:text-2xl font-black text-blue-700 font-mono-numbers">
                  ₹{latestOrder.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-sm text-slate-700 font-medium truncate">
                {latestOrder.items.map(i => `${i.productName} (${i.quantity})`).join(', ')}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-500 font-mono-numbers pt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Placed: {latestOrder.orderDate}
                </span>
                {latestOrder.deliveryDate && (
                  <span className="text-emerald-700 font-bold">
                    Delivery: {latestOrder.deliveryDate}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-slate-500">
              {t.customer.home.noRecentOrders}
            </div>
          )}

          <button
            onClick={() => onNavigate('orders')}
            className="min-h-[44px] w-full text-sm font-bold text-blue-700 hover:text-blue-800 bg-blue-50/70 hover:bg-blue-100/70 rounded-xl px-4 py-2.5 flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>View All Past Orders</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4. Active Alerts Banner (If unread alerts exist) */}
      {unreadAlerts.length > 0 && (
        <div
          onClick={() => onNavigate('alerts')}
          className="p-4 sm:p-5 bg-amber-50 border border-amber-200 rounded-2xl cursor-pointer hover:bg-amber-100/70 transition-colors flex items-center justify-between shadow-2xs min-h-[64px]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-sm sm:text-base font-bold text-amber-950 block truncate">
                {unreadAlerts[0].title}
              </span>
              <span className="text-xs sm:text-sm text-amber-800 block truncate mt-0.5">
                {unreadAlerts[0].message}
              </span>
            </div>
          </div>
          <span className="text-sm font-bold text-amber-900 shrink-0 ml-3 flex items-center gap-1">
            <span>View All ({unreadAlerts.length})</span>
            <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      )}
    </div>
  );
};
