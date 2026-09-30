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
  Sparkles
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
  const ownerName = currentRetailer?.ownerName || currentUser?.fullName || '';
  const outstandingAmount = currentRetailer?.outstandingAmount || 0;
  const paymentTerms = currentRetailer?.paymentTerms || 'Net 15 Days';

  // Find latest order for this customer
  const latestOrder = orders.find(o => currentRetailer && o.retailerId === currentRetailer.id) || orders[0];

  // Unread alerts count
  const unreadAlerts = notifications.filter(n => n.recipientType === 'customer' && !n.read);

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

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-24 font-sans">
      {/* 1. Welcome & Greeting Card */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 mb-1">
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>Retail Partner</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug truncate">
              {t.customer.home.greeting} {businessName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
              What would you like to order today?
              {ownerName && <span className="text-slate-400 ml-1">({ownerName})</span>}
            </p>
          </div>

          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-2xs">
            {businessName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* 2. Primary Actions: Balanced, Touch-Friendly CTA Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Primary Action: Browse Products */}
        <button
          onClick={() => onNavigate('products')}
          className="group relative p-3.5 sm:p-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-2xs hover:shadow-xs flex items-center justify-between text-left transition-all active:scale-[0.99] overflow-hidden min-h-[84px]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-2xs shrink-0 group-hover:bg-white/30 transition-colors">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                {t.customer.home.orderProducts}
              </h3>
              <p className="text-xs text-blue-100 font-normal mt-0.5 truncate">
                Explore milk, curd, paneer & dairy items
              </p>
            </div>
          </div>

          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 ml-2 group-hover:translate-x-1 transition-transform">
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </div>
        </button>

        {/* Secondary Action: Repeat Last Order */}
        <button
          onClick={handleRepeatLastOrder}
          className="group relative p-3.5 sm:p-4 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-900 border border-slate-200 hover:border-blue-300 rounded-xl shadow-2xs hover:shadow-xs flex items-center justify-between text-left transition-all active:scale-[0.99] overflow-hidden min-h-[84px]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs shrink-0 group-hover:bg-blue-100 transition-colors">
              <RotateCcw className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-slate-400 block font-mono-numbers truncate">
                {latestOrder ? latestOrder.orderNumber : 'Quick Reorder'}
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                {t.customer.home.repeatLastOrder}
              </h3>
              <p className="text-xs text-blue-600 font-medium mt-0.5 truncate">
                1-click reorder of previous items
              </p>
            </div>
          </div>

          <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center shrink-0 ml-2 group-hover:translate-x-1 transition-transform">
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
          </div>
        </button>
      </div>

      {/* 3. Essential Retailer Information Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Outstanding Balance */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t.customer.home.outstandingBalance}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {paymentTerms}
            </span>
          </div>

          <div>
            <span className="text-xl sm:text-2xl font-bold text-slate-900 font-mono-numbers tracking-tight block">
              ₹{outstandingAmount.toLocaleString('en-IN')}
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Current pending balance with Madhav Dairy
            </p>
          </div>

          <button
            onClick={() => onNavigate('profile')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 pt-1.5 border-t border-slate-100"
          >
            <span>View Account Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Latest Order Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t.customer.home.myRecentOrders}
              </span>
            </div>
            {latestOrder && (
              <StatusBadge status={latestOrder.status} size="sm" />
            )}
          </div>

          {latestOrder ? (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-sm sm:text-base font-bold text-slate-900 font-mono-numbers">
                  {latestOrder.orderNumber}
                </span>
                <span className="text-base sm:text-lg font-bold text-blue-700 font-mono-numbers">
                  ₹{latestOrder.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-xs text-slate-600 truncate">
                {latestOrder.items.map(i => `${i.productName} (${i.quantity})`).join(', ')}
              </p>
              <p className="text-[11px] text-slate-400 font-mono-numbers">
                Placed on {latestOrder.orderDate}
                {latestOrder.deliveryDate && ` • Expected: ${latestOrder.deliveryDate}`}
              </p>
            </div>
          ) : (
            <div className="py-2 text-center text-xs text-slate-500">
              {t.customer.home.noRecentOrders}
            </div>
          )}

          <button
            onClick={() => onNavigate('orders')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 pt-1.5 border-t border-slate-100"
          >
            <span>View All Past Orders</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. Active Alerts Notice (Only if unread alerts exist) */}
      {unreadAlerts.length > 0 && (
        <div
          onClick={() => onNavigate('alerts')}
          className="p-3.5 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100/70 transition-colors flex items-center justify-between shadow-2xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold text-amber-900 block truncate">
                {unreadAlerts[0].title}
              </span>
              <span className="text-xs text-amber-800 block truncate mt-0.5">
                {unreadAlerts[0].message}
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-900 shrink-0 ml-3 flex items-center gap-1">
            <span>View ({unreadAlerts.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      )}
    </div>
  );
};
