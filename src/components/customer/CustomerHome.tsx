import React from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import {
  ShoppingBag,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
  Bell,
  CreditCard,
  Package
} from 'lucide-react';

interface CustomerHomeProps {
  onNavigate: (tab: string) => void;
}

export const CustomerHome: React.FC<CustomerHomeProps> = ({ onNavigate }) => {
  const {
    currentRetailer,
    orders,
    reorder,
    notifications,
    expiryAlerts,
    addToast,
  } = useDairy();

  const { t } = useTranslation();

  // Find latest order for this retailer
  const latestOrder = orders.find(o => o.retailerId === currentRetailer.id) || orders[0];

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
    <div className="p-4 space-y-4 pb-24">
      {/* 1. Welcome & Greeting */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Retailer Store
            </span>
            <h1 className="text-lg font-bold text-slate-900 mt-1">
              {t.customer.home.greeting} {currentRetailer.businessName}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Proprietor: <span className="text-slate-700 font-medium">{currentRetailer.ownerName}</span>
            </p>
          </div>

          {/* Quick Avatar */}
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
            {currentRetailer.businessName.charAt(0)}
          </div>
        </div>

        {/* Outstanding Balance Bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 block">{t.customer.home.outstandingBalance}</span>
            <span className="text-base font-bold text-slate-900 font-mono-numbers">
              ₹{currentRetailer.outstandingAmount.toLocaleString()}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase">Terms</span>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {currentRetailer.paymentTerms}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Primary Action Buttons (Square Boxes) */}
      <div className="grid grid-cols-2 gap-3">
        {/* New Order Square Box */}
        <button
          onClick={() => onNavigate('products')}
          className="group relative aspect-square p-3.5 sm:p-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl shadow-xs hover:shadow-md flex flex-col justify-between text-left transition-all active:scale-[0.98] overflow-hidden"
        >
          {/* Subtle decorative background circle */}
          <div className="absolute -right-3 -bottom-3 w-20 h-20 rounded-full bg-white/10 pointer-events-none group-hover:scale-110 transition-transform duration-300" />

          {/* Top icon and arrow */}
          <div className="flex items-start justify-between w-full">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-xs group-hover:bg-white/30 transition-colors">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          {/* Text labels at bottom */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">
              Catalog
            </span>
            <h3 className="text-sm sm:text-base font-black leading-tight text-white mt-0.5">
              {t.customer.home.orderProducts}
            </h3>
            <p className="text-[11px] text-blue-100 mt-0.5 line-clamp-1 font-medium">
              Browse 20+ Items
            </p>
          </div>
        </button>

        {/* Repeat Order Square Box */}
        <button
          onClick={handleRepeatLastOrder}
          className="group relative aspect-square p-3.5 sm:p-4 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-900 border border-slate-200 hover:border-blue-400 rounded-2xl shadow-xs hover:shadow-sm flex flex-col justify-between text-left transition-all active:scale-[0.98] overflow-hidden"
        >
          {/* Subtle decorative background circle */}
          <div className="absolute -right-3 -bottom-3 w-20 h-20 rounded-full bg-blue-50/70 pointer-events-none group-hover:scale-110 transition-transform duration-300" />

          {/* Top icon and arrow */}
          <div className="flex items-start justify-between w-full">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs group-hover:bg-blue-100 transition-colors">
              <RotateCcw className="w-5 h-5 text-blue-600" />
            </div>
            <div className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
            </div>
          </div>

          {/* Text labels at bottom */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono-numbers truncate">
              {latestOrder ? latestOrder.orderNumber : 'Previous Order'}
            </span>
            <h3 className="text-sm sm:text-base font-black leading-tight text-slate-900 mt-0.5">
              {t.customer.home.repeatLastOrder}
            </h3>
            <p className="text-[11px] text-blue-600 mt-0.5 line-clamp-1 font-semibold">
              1-Click Reorder
            </p>
          </div>
        </button>
      </div>

      {/* 3. Alerts Notice (Compact Notification Bar) */}
      {unreadAlerts.length > 0 && (
        <div
          onClick={() => onNavigate('alerts')}
          className="p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100/60 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="truncate text-xs">
              <span className="font-semibold text-amber-900 block truncate">
                {unreadAlerts[0].title}
              </span>
              <span className="text-[11px] text-amber-700 block truncate">
                {unreadAlerts[0].message}
              </span>
            </div>
          </div>
          <span className="text-xs text-amber-800 font-bold shrink-0 ml-2">
            View &rarr;
          </span>
        </div>
      )}

      {/* 4. My Orders (Recent Order Card) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>{t.customer.home.myRecentOrders}</span>
          </div>
          <button
            onClick={() => onNavigate('orders')}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
          >
            {t.customer.home.viewAll}
          </button>
        </div>

        {latestOrder ? (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono-numbers font-bold text-xs text-slate-900">
                {latestOrder.orderNumber}
              </span>
              <StatusBadge status={latestOrder.status} size="sm" />
            </div>

            <div className="text-xs text-slate-600">
              <div className="truncate">
                {latestOrder.items.map(i => `${i.productName} (${i.quantity})`).join(', ')}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-mono-numbers text-[11px]">
                {latestOrder.orderDate}
              </span>
              <span className="font-bold text-slate-900 font-mono-numbers">
                ₹{latestOrder.totalAmount.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-2 text-center">
            {t.customer.home.noRecentOrders}
          </p>
        )}
      </div>
    </div>
  );
};
