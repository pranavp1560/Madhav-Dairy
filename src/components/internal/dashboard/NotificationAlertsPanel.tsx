import React, { useState, useMemo, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  CheckCheck,
  ChevronRight,
  Boxes,
  ShoppingCart,
  Calendar,
  Layers
} from 'lucide-react';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface DashboardAlertItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  referenceType: 'batch' | 'order' | 'invoice' | 'material' | 'customer';
  referenceId?: string;
  referenceLabel: string;
  timestamp: string; // e.g. "Today", "2h ago", "08 Oct"
  targetView: string; // e.g. "expiry", "orders", "invoices", "raw_materials"
}

interface NotificationAlertsPanelProps {
  alerts: DashboardAlertItem[];
  onNavigate: (view: string, entityId?: string) => void;
}

export const NotificationAlertsPanel: React.FC<NotificationAlertsPanelProps> = ({
  alerts,
  onNavigate,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical' | 'warning'>('all');
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('madhav_dashboard_read_alerts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Save readIds to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('madhav_dashboard_read_alerts', JSON.stringify(Array.from(readIds)));
    } catch {
      // Ignore storage errors
    }
  }, [readIds]);

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleMarkAllAsRead = () => {
    setReadIds(new Set(alerts.map(a => a.id)));
  };

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      const isRead = readIds.has(a.id);
      if (filter === 'unread') return !isRead;
      if (filter === 'critical') return a.severity === 'critical';
      if (filter === 'warning') return a.severity === 'warning';
      return true; // 'all'
    });
  }, [alerts, filter, readIds]);

  const unreadCount = useMemo(() => {
    return alerts.filter(a => !readIds.has(a.id)).length;
  }, [alerts, readIds]);

  const criticalCount = useMemo(() => {
    return alerts.filter(a => a.severity === 'critical').length;
  }, [alerts]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white font-mono-numbers text-[9px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Operational Alerts</span>
              {criticalCount > 0 && (
                <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded font-semibold">
                  {criticalCount} Critical
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-500">
              Real-time actionable alerts & expiry warnings
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
            title="Mark all notifications as read"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mark All Read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex items-center gap-1 text-[11px]">
        {[
          { id: 'all', label: 'All', count: alerts.length },
          { id: 'unread', label: 'Unread', count: unreadCount },
          { id: 'critical', label: 'Critical', count: criticalCount },
          { id: 'warning', label: 'Warnings', count: alerts.filter(a => a.severity === 'warning').length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              filter === tab.id
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1 text-[10px] font-mono-numbers px-1 rounded-full ${
                tab.id === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alerts List Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[580px] p-2 scrollbar-thin">
        {filteredAlerts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <CheckCircle2 className="w-9 h-9 text-emerald-400 mb-2" />
            <p className="text-xs font-semibold text-slate-700">All Operations Running Smoothly</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
              No active {filter !== 'all' ? filter : ''} alerts found. Cold chain, stocks, and collections are up to date.
            </p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const isRead = readIds.has(alert.id);
            const isCritical = alert.severity === 'critical';
            const isWarning = alert.severity === 'warning';

            return (
              <div
                key={alert.id}
                onClick={() => onNavigate(alert.targetView, alert.referenceId)}
                className={`p-3 rounded-xl transition-all cursor-pointer relative group flex flex-col gap-2 ${
                  !isRead
                    ? isCritical
                      ? 'bg-rose-50/40 hover:bg-rose-50/80 border border-rose-200/60'
                      : isWarning
                      ? 'bg-amber-50/40 hover:bg-amber-50/80 border border-amber-200/60'
                      : 'bg-blue-50/30 hover:bg-blue-50/70 border border-blue-200/50'
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Severity Icon */}
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                      isCritical
                        ? 'bg-rose-100 text-rose-700'
                        : isWarning
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {isCritical ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : isWarning ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <Info className="w-3 h-3" />
                      )}
                    </div>

                    <h4 className={`text-xs font-bold tracking-tight ${
                      isCritical ? 'text-rose-900' : isWarning ? 'text-amber-900' : 'text-slate-900'
                    }`}>
                      {alert.title}
                    </h4>
                  </div>

                  {/* Timestamp & Read Toggle */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {alert.timestamp}
                    </span>
                    {!isRead ? (
                      <button
                        onClick={e => handleMarkAsRead(alert.id, e)}
                        className="w-2 h-2 rounded-full bg-blue-600 hover:ring-2 hover:ring-blue-400 transition-all"
                        title="Mark as read"
                      />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                    )}
                  </div>
                </div>

                {/* Message Body */}
                <p className="text-[11px] text-slate-600 leading-relaxed pl-7">
                  {alert.message}
                </p>

                {/* Reference Tag & Action Link */}
                <div className="flex items-center justify-between text-[10px] pt-1.5 pl-7 border-t border-slate-100/60">
                  <span className="font-semibold text-slate-500 font-mono-numbers bg-slate-100 px-2 py-0.5 rounded">
                    {alert.referenceLabel}
                  </span>

                  <span className="text-blue-600 font-bold group-hover:underline flex items-center gap-0.5">
                    <span>Take Action</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Summary */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>{alerts.length} total operational notices</span>
        <button
          onClick={() => onNavigate('expiry')}
          className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
        >
          <span>Expiry Console</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
