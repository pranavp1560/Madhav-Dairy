import React from 'react';
import { useDairy } from '../../context/DairyContext';
import { Bell, CheckCheck, Clock, ShieldAlert, Package, Sparkles, CreditCard, ChevronRight } from 'lucide-react';
import { NotificationItem } from '../../types/dairy';

interface CustomerNotificationsProps {
  onNavigate: (tab: string) => void;
}

export const CustomerNotifications: React.FC<CustomerNotificationsProps> = ({ onNavigate }) => {
  const { notifications, currentRetailer, markNotificationRead, markAllNotificationsRead } = useDairy();

  const customerNotifs = notifications.filter(
    n => n.recipientType === 'customer' && (!n.recipientId || (currentRetailer && n.recipientId === currentRetailer.id))
  );

  const todayNotifs = customerNotifs.filter(n => n.timeGroup === 'today');
  const yesterdayNotifs = customerNotifs.filter(n => n.timeGroup === 'yesterday');
  const earlierNotifs = customerNotifs.filter(n => n.timeGroup === 'earlier');

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'expiry':
        return <ShieldAlert className="w-4 h-4 text-amber-600" />;
      case 'order':
        return <Package className="w-4 h-4 text-blue-600" />;
      case 'product':
        return <Sparkles className="w-4 h-4 text-amber-600" />;
      case 'payment':
        return <CreditCard className="w-4 h-4 text-green-600" />;
    }
  };

  const renderGroup = (title: string, items: NotificationItem[]) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
          {title}
        </h3>
        <div className="space-y-2">
          {items.map(notif => (
            <div
              key={notif.id}
              onClick={() => {
                markNotificationRead(notif.id);
                if (notif.type === 'expiry') onNavigate('expiry');
                if (notif.type === 'order') onNavigate('orders');
              }}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 ${
                notif.read
                  ? 'bg-white border-slate-200 text-slate-600'
                  : 'bg-white border-blue-300 shadow-xs ring-1 ring-blue-500/20'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  notif.type === 'expiry'
                    ? 'bg-amber-50 border border-amber-200'
                    : notif.type === 'order'
                    ? 'bg-blue-50 border border-blue-200'
                    : notif.type === 'payment'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-amber-50 border border-amber-200'
                }`}
              >
                {getIcon(notif.type)}
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-1">
                  <h4 className={`text-xs font-bold ${notif.read ? 'text-slate-800' : 'text-slate-950'}`}>
                    {notif.title}
                  </h4>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1"></span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  {notif.message}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                  <span>{notif.date}</span>
                  <span>•</span>
                  <span className="uppercase font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    {notif.channel.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900">Notifications</h1>
            <p className="text-xs text-slate-500">
              Dispatches, shelf-life alerts & ledger updates
            </p>
          </div>
        </div>

        <button
          onClick={() => markAllNotificationsRead('customer')}
          className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Mark Read</span>
        </button>
      </div>

      {/* Grouped lists */}
      {renderGroup('Today', todayNotifs)}
      {renderGroup('Yesterday', yesterdayNotifs)}
      {renderGroup('Earlier', earlierNotifs)}

      {customerNotifs.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
          No notifications at this time.
        </div>
      )}
    </div>
  );
};
