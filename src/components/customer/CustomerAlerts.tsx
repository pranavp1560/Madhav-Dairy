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

  const customerNotifs = notifications.filter(n => n.recipientType === 'customer');
  const unreadCount = customerNotifs.filter(n => !n.read).length;

  const filteredNotifs = customerNotifs.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'expiry':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'order':
        return <PackageCheck className="w-4 h-4 text-blue-600" />;
      case 'payment':
        return <CreditCard className="w-4 h-4 text-emerald-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-500" />;
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
    <div className="max-w-4xl mx-auto space-y-4 pb-28 font-sans">
      {/* Title & Filter Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">{t.customer.alerts.title}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread notices waiting` : 'All notices have been read'}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={() => markAllNotificationsRead('customer')}
              className="h-8 px-3 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center justify-center gap-1.5 self-start sm:self-auto"
            >
              <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t.customer.alerts.markAllRead}</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.customer.alerts.all} ({customerNotifs.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
              filter === 'unread'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.customer.alerts.unread} ({unreadCount})
          </button>
        </div>
      </div>

      {/* Alerts List */}
      {filteredNotifs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-6 space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No notices found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t.customer.alerts.emptyDesc}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifs.map(item => (
            <div
              key={item.id}
              onClick={() => {
                markNotificationRead(item.id);
                if (onNavigate) {
                  if (item.type === 'order') onNavigate('orders');
                  if (item.type === 'expiry') onNavigate('products');
                }
              }}
              className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
                item.read
                  ? 'bg-white border-slate-200 hover:border-slate-300'
                  : 'bg-blue-50/50 border-blue-300 shadow-2xs hover:border-blue-400'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${getAlertBg(item.type)}`}>
                  {getAlertIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-sm sm:text-base font-bold truncate ${
                      item.read ? 'text-slate-800' : 'text-slate-900 font-extrabold'
                    }`}>
                      {item.title}
                    </h3>
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 ring-3 ring-blue-100" />
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    {item.message}
                  </p>

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-mono-numbers">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.date}
                    </span>
                    <span className="capitalize font-semibold text-blue-600 hover:text-blue-700">
                      View →
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
