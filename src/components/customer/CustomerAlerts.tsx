import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import {
  Bell,
  AlertTriangle,
  PackageCheck,
  CreditCard,
  Sparkles,
  CheckCheck,
  Clock,
  ArrowRight
} from 'lucide-react';

interface CustomerAlertsProps {
  onNavigate?: (tab: string) => void;
}

export const CustomerAlerts: React.FC<CustomerAlertsProps> = ({ onNavigate }) => {
  const { notifications, currentRetailer, markNotificationRead, markAllNotificationsRead } = useDairy();
  const { t } = useTranslation();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const customerNotifs = notifications.filter(
    n => n.recipientType === 'customer' && (!n.recipientId || (currentRetailer && n.recipientId === currentRetailer.id))
  );
  const unreadCount = customerNotifs.filter(n => !n.read).length;

  const filteredNotifs = customerNotifs.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'expiry':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'order':
        return <PackageCheck className="w-5 h-5 text-blue-600" />;
      case 'payment':
        return <CreditCard className="w-5 h-5 text-emerald-600" />;
      default:
        return <Sparkles className="w-5 h-5 text-amber-500" />;
    }
  };

  const getAlertBg = (type: string) => {
    switch (type) {
      case 'expiry':
        return 'bg-red-50 border-red-200';
      case 'order':
        return 'bg-blue-50 border-blue-200';
      case 'payment':
        return 'bg-emerald-50 border-emerald-200';
      default:
        return 'bg-amber-50 border-amber-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28 font-sans">
      {/* Title & Filter Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {t.customer.alerts.title}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              {unreadCount > 0 ? `${unreadCount} unread notices waiting` : 'All notices have been read'}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={() => markAllNotificationsRead('customer')}
              className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center justify-center gap-2 self-start sm:self-auto"
            >
              <CheckCheck className="w-4 h-4 stroke-[2.5]" />
              <span>{t.customer.alerts.markAllRead}</span>
            </button>
          )}
        </div>

        {/* Filter Tabs (Min 44px Touch Targets) */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setFilter('all')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.customer.alerts.all} ({customerNotifs.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              filter === 'unread'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.customer.alerts.unread} ({unreadCount})
          </button>
        </div>

        {/* Freshness Radar Banner */}
        {onNavigate && (
          <div
            onClick={() => onNavigate('expiry')}
            className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl cursor-pointer hover:border-amber-300 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-950 block">Store Shelf Freshness Radar</span>
                <span className="text-[11px] text-amber-800 block">Monitor delivered dairy batches & shelf-life countdowns</span>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1 shrink-0">
              <span>View Tracking</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        )}
      </div>

      {/* Alerts List */}
      {filteredNotifs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Bell className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">No notices found</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {t.customer.alerts.emptyDesc}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotifs.map(item => (
            <div
              key={item.id}
              onClick={() => {
                markNotificationRead(item.id);
                if (onNavigate) {
                  if (item.type === 'order') onNavigate('orders');
                  if (item.type === 'payment') onNavigate('payments');
                  if (item.type === 'expiry') onNavigate('expiry');
                }
              }}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                item.read
                  ? 'bg-white border-slate-200 hover:border-slate-300'
                  : 'bg-blue-50/50 border-blue-300 shadow-2xs hover:border-blue-400'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${getAlertBg(item.type)}`}>
                  {getAlertIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className={`text-base font-bold truncate ${
                      item.read ? 'text-slate-800' : 'text-slate-900 font-extrabold'
                    }`}>
                      {item.title}
                    </h2>
                    {!item.read && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 ring-4 ring-blue-100" />
                    )}
                  </div>

                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    {item.message}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-xs sm:text-sm text-slate-400 font-mono-numbers">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {item.date}
                    </span>
                    <span className="capitalize font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1">
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
