import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { StatusBadge } from '../ui/StatusBadge';
import {
  Bell,
  AlertTriangle,
  PackageCheck,
  CreditCard,
  Sparkles,
  CheckCheck,
  Clock
} from 'lucide-react';

interface CustomerAlertsProps {
  onNavigate?: (tab: string) => void;
}

export const CustomerAlerts: React.FC<CustomerAlertsProps> = ({ onNavigate }) => {
  const { notifications, expiryAlerts, currentRetailer, markNotificationRead, markAllNotificationsRead, addToast } = useDairy();
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
        return <CreditCard className="w-4 h-4 text-green-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Title & Filter Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">{t.customer.alerts.title}</h2>
          <p className="text-xs text-slate-500">
            {unreadCount > 0 ? `${unreadCount} unread notices` : 'All caught up'}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllNotificationsRead('customer')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{t.customer.alerts.markAllRead}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {t.customer.alerts.all} ({customerNotifs.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'unread'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {t.customer.alerts.unread} ({unreadCount})
        </button>
      </div>

      {/* Alerts List */}
      {filteredNotifs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-6">
          <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-900">No alerts found</p>
          <p className="text-xs text-slate-500 mt-0.5">{t.customer.alerts.emptyDesc}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifs.map(item => (
            <div
              key={item.id}
              onClick={() => markNotificationRead(item.id)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                item.read
                  ? 'bg-white border-slate-200'
                  : 'bg-blue-50/50 border-blue-200 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  {getAlertIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-xs font-semibold truncate ${
                      item.read ? 'text-slate-800' : 'text-slate-900 font-bold'
                    }`}>
                      {item.title}
                    </h4>
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    )}
                  </div>

                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {item.message}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-400 font-mono-numbers">
                    <span>{item.date}</span>
                    <span className="capitalize">{item.type} update</span>
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
