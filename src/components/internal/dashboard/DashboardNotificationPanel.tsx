import React, { useState, useMemo, useEffect } from 'react';
import { useDairy } from '../../../context/DairyContext';
import { calculateDaysRemaining, formatCalendarDate, getTodayDateString } from '../../../utils/dateUtils';
import { StatusBadge } from '../../ui/StatusBadge';
import { Button } from '../../ui/Button';
import {
  Bell,
  AlertTriangle,
  Clock,
  Boxes,
  FileText,
  ShoppingCart,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Filter,
  Eye,
  Flame,
  Info
} from 'lucide-react';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory = 'all' | 'expiry' | 'stock' | 'finance' | 'orders';

export interface DashboardAlertItem {
  id: string; // Stable deterministic ID
  dbId?: string; // If sourced from notifications table
  title: string;
  message: string;
  severity: AlertSeverity;
  category: 'expiry' | 'stock' | 'finance' | 'orders' | 'system';
  timestamp: string; // ISO date string
  formattedDate: string;
  recordReference: string; // e.g. "Batch #SE302026", "Raw Material: Sugar", "Invoice #INV-2026-0001"
  recordType: 'batch' | 'material' | 'invoice' | 'order' | 'system';
  recordId?: string;
  isRead: boolean;
}

interface DashboardNotificationPanelProps {
  onSelectBatch: (batchId: string) => void;
  onSelectMaterial?: (materialId: string) => void;
}

const LOCAL_STORAGE_KEY = 'madhav_dashboard_read_alerts_v1';

export const DashboardNotificationPanel: React.FC<DashboardNotificationPanelProps> = ({
  onSelectBatch,
  onSelectMaterial,
}) => {
  const {
    batches,
    rawMaterials,
    invoices,
    orders,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    setSelectedInvoiceId,
    setInternalView,
    addToast,
  } = useDairy();

  const [activeCategory, setActiveCategory] = useState<AlertCategory>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);

  // Local storage for read alert IDs to ensure deterministic, persistent read states without duplicate generation
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    return new Set<string>();
  });

  // Keep local storage in sync
  const saveReadAlerts = (newSet: Set<string>) => {
    setReadAlertIds(newSet);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(newSet)));
    } catch {
      // ignore
    }
  };

  // Synthesize alerts deterministically
  const allAlerts = useMemo(() => {
    const alerts: DashboardAlertItem[] = [];
    const todayStr = getTodayDateString();

    // Map of DB notifications to check if an entity is already acknowledged in DB
    const dbNotifMap = new Map<string, any>();
    notifications
      .filter(n => n.recipientType === 'internal')
      .forEach(n => {
        if (n.referenceId) {
          dbNotifMap.set(n.referenceId, n);
        }
      });

    // 1. Expiring Batch Alerts (Batches expiring <= 7 days or status near_expiry/expired)
    batches.forEach(b => {
      if (b.availableQty <= 0 && b.status === 'exhausted') return;
      const days = calculateDaysRemaining(b.expiryDate);
      if (days <= 7 || b.status === 'near_expiry' || b.status === 'expired') {
        const alertId = `expiring-batch-${b.id}`;
        const dbCounterpart = dbNotifMap.get(b.id);
        const isRead = readAlertIds.has(alertId) || Boolean(dbCounterpart?.read);

        const severity: AlertSeverity = days < 0 ? 'critical' : days <= 3 ? 'critical' : 'warning';
        const formattedDate = formatCalendarDate(b.expiryDate);

        alerts.push({
          id: alertId,
          dbId: dbCounterpart?.id,
          title: days < 0
            ? `Expired Batch: ${b.productName} (${b.batchNumber})`
            : `Expiring Batch: ${b.productName} (${b.batchNumber})`,
          message: `${b.availableQty.toLocaleString()} ${b.unit} remaining in cold storage. ${
            days < 0
              ? 'Past expiry date. Quarantine or dispose immediately.'
              : days === 0
              ? 'Expires today. Prioritize immediate dispatch.'
              : `Expires in ${days} days (${formattedDate}). Priority dispatch.`
          }`,
          severity,
          category: 'expiry',
          timestamp: b.productionDate ? `${b.productionDate}T12:00:00Z` : new Date().toISOString(),
          formattedDate,
          recordReference: `Batch #${b.batchNumber}`,
          recordType: 'batch',
          recordId: b.id,
          isRead,
        });
      }
    });

    // 2. Low-Stock and Out-of-Stock Alerts
    rawMaterials.forEach(m => {
      if (m.status === 'out_of_stock' || m.status === 'low_stock') {
        const alertId = `stock-rm-${m.id}`;
        const isRead = readAlertIds.has(alertId);
        const isOut = m.status === 'out_of_stock';

        alerts.push({
          id: alertId,
          title: isOut
            ? `Out of Stock: ${m.name}`
            : `Low Safety Stock: ${m.name}`,
          message: isOut
            ? `Zero stock remaining. Minimum safety threshold is ${m.minStockThreshold} ${m.unit}. Production may stall.`
            : `Current balance (${m.currentStock} ${m.unit}) is below safety threshold of ${m.minStockThreshold} ${m.unit}. Reorder required.`,
          severity: isOut ? 'critical' : 'warning',
          category: 'stock',
          timestamp: m.lastRestockedDate ? `${m.lastRestockedDate}T12:00:00Z` : new Date().toISOString(),
          formattedDate: formatCalendarDate(m.lastRestockedDate || todayStr),
          recordReference: `Raw Material: ${m.name}`,
          recordType: 'material',
          recordId: m.id,
          isRead,
        });
      }
    });

    // 3. Overdue Invoices and Outstanding Payments
    invoices.forEach(inv => {
      if (inv.status !== 'settled' && inv.status !== 'cancelled') {
        const daysToDue = calculateDaysRemaining(inv.dueDate);
        if (daysToDue < 0) {
          const alertId = `overdue-invoice-${inv.id}`;
          const isRead = readAlertIds.has(alertId);
          const daysOverdue = Math.abs(daysToDue);
          const severity: AlertSeverity = daysOverdue > 7 ? 'critical' : 'warning';

          alerts.push({
            id: alertId,
            title: `Overdue Invoice: ${inv.invoiceNumber} (${inv.retailerName})`,
            message: `Outstanding payment of ₹${inv.outstandingAmount?.toLocaleString('en-IN')} was due on ${formatCalendarDate(inv.dueDate)} (${daysOverdue} days overdue).`,
            severity,
            category: 'finance',
            timestamp: inv.dueDate ? `${inv.dueDate}T12:00:00Z` : new Date().toISOString(),
            formattedDate: formatCalendarDate(inv.dueDate),
            recordReference: `Invoice #${inv.invoiceNumber}`,
            recordType: 'invoice',
            recordId: inv.id,
            isRead,
          });
        }
      }
    });

    // 4. Orders Requiring Action (pending or confirmed awaiting processing)
    orders.forEach(ord => {
      if (ord.status === 'pending' || ord.status === 'confirmed') {
        const alertId = `order-action-${ord.id}`;
        const isRead = readAlertIds.has(alertId);

        alerts.push({
          id: alertId,
          title: ord.status === 'pending'
            ? `New Order Awaiting Confirmation: ${ord.orderNumber}`
            : `Order Confirmed • Pending Dispatch: ${ord.orderNumber}`,
          message: `Order for ${ord.retailerName} (₹${ord.totalAmount?.toLocaleString('en-IN')}) requires action at dispatch desk.`,
          severity: ord.status === 'pending' ? 'warning' : 'info',
          category: 'orders',
          timestamp: ord.orderDate ? `${ord.orderDate}T12:00:00Z` : new Date().toISOString(),
          formattedDate: formatCalendarDate(ord.orderDate),
          recordReference: `Order ${ord.orderNumber}`,
          recordType: 'order',
          recordId: ord.id,
          isRead,
        });
      }
    });

    // 5. Stored Database Notifications not covered above
    notifications
      .filter(n => n.recipientType === 'internal')
      .forEach(n => {
        // Skip if already synthesized by referenceId
        if (n.referenceId && (
          alerts.some(a => a.recordId === n.referenceId)
        )) {
          return;
        }

        const alertId = `db-notif-${n.id}`;
        const isRead = n.read || readAlertIds.has(alertId);

        let cat: DashboardAlertItem['category'] = 'system';
        if (n.type === 'expiry') cat = 'expiry';
        else if (n.type === 'order') cat = 'orders';
        else if (n.type === 'payment') cat = 'finance';

        alerts.push({
          id: alertId,
          dbId: n.id,
          title: n.title,
          message: n.message,
          severity: n.type === 'expiry' ? 'warning' : 'info',
          category: cat,
          timestamp: new Date().toISOString(),
          formattedDate: n.date || 'Recent',
          recordReference: n.referenceType ? `${n.referenceType}: ${n.referenceId?.slice(0, 8)}` : 'System Advisory',
          recordType: 'system',
          recordId: n.referenceId,
          isRead,
        });
      });

    // Prioritize: Most important alerts first (Unread first, then Critical > Warning > Info, then newest)
    return alerts.sort((a, b) => {
      // 1. Unread first
      if (!a.isRead && b.isRead) return -1;
      if (a.isRead && !b.isRead) return 1;

      // 2. Severity weight
      const weight: Record<AlertSeverity, number> = { critical: 3, warning: 2, info: 1 };
      const sevDiff = weight[b.severity] - weight[a.severity];
      if (sevDiff !== 0) return sevDiff;

      // 3. Timestamp newest first
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [batches, rawMaterials, invoices, orders, notifications, readAlertIds]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return allAlerts.filter(a => {
      if (onlyUnread && a.isRead) return false;
      if (activeCategory === 'all') return true;
      return a.category === activeCategory;
    });
  }, [allAlerts, activeCategory, onlyUnread]);

  // Unread count
  const unreadCount = useMemo(() => {
    return allAlerts.filter(a => !a.isRead).length;
  }, [allAlerts]);

  // Actions
  const handleMarkAsRead = async (alert: DashboardAlertItem) => {
    const newSet = new Set(readAlertIds);
    newSet.add(alert.id);
    saveReadAlerts(newSet);

    if (alert.dbId) {
      try {
        await markNotificationRead(alert.dbId);
      } catch (err) {
        console.warn('Could not mark DB notification read:', err);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    const newSet = new Set(readAlertIds);
    allAlerts.forEach(a => {
      newSet.add(a.id);
    });
    saveReadAlerts(newSet);

    try {
      await markAllNotificationsRead('internal');
    } catch (err) {
      console.warn('Could not mark all DB notifications read:', err);
    }
    addToast('All operational alerts marked as read', 'success');
  };

  const handleViewDetails = (alert: DashboardAlertItem) => {
    // Mark as read when viewing details
    handleMarkAsRead(alert);

    if (alert.recordType === 'batch' && alert.recordId) {
      onSelectBatch(alert.recordId);
    } else if (alert.recordType === 'material') {
      if (onSelectMaterial && alert.recordId) {
        onSelectMaterial(alert.recordId);
      } else {
        setInternalView('raw_materials');
      }
    } else if (alert.recordType === 'invoice' && alert.recordId) {
      setSelectedInvoiceId(alert.recordId);
    } else if (alert.recordType === 'order') {
      setInternalView('orders');
    } else if (alert.category === 'expiry') {
      setInternalView('expiry');
    } else {
      setInternalView('dashboard');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Panel Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Operational Alerts & Notifications
                </h3>
                {unreadCount > 0 ? (
                  <span className="text-[11px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full border border-rose-200">
                    {unreadCount} Unread
                  </span>
                ) : (
                  <span className="text-[11px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                    All caught up
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time critical notices across expiry safety, safety stock thresholds, dues, and pending orders
              </p>
            </div>
          </div>
        </div>

        {/* Global Panel Actions */}
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              icon={<CheckCheck className="w-3.5 h-3.5 text-blue-600" />}
              onClick={handleMarkAllAsRead}
            >
              Mark All as Read
            </Button>
          )}

          <button
            onClick={() => setOnlyUnread(!onlyUnread)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              onlyUnread
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {onlyUnread ? 'Showing Unread' : 'Show Only Unread'}
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
        <span className="text-slate-500 font-medium text-[11px] mr-1 hidden sm:inline">
          Filter:
        </span>
        {(
          [
            { id: 'all', label: `All Alerts (${allAlerts.length})` },
            { id: 'expiry', label: 'Expiring Batches' },
            { id: 'stock', label: 'Low Stock' },
            { id: 'finance', label: 'Overdue Dues' },
            { id: 'orders', label: 'Actionable Orders' },
          ] as const
        ).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`px-3 py-1 rounded-md font-semibold text-[11px] whitespace-nowrap transition-colors ${
              activeCategory === tab.id
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <CheckCircle2 className="w-9 h-9 text-emerald-500 mb-2 opacity-80" />
            <h4 className="text-xs font-bold text-slate-800">
              No alerts in this category
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Everything is operating within safe parameters.
            </p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const isCritical = alert.severity === 'critical';
            const isWarning = alert.severity === 'warning';

            return (
              <div
                key={alert.id}
                className={`p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition-colors ${
                  !alert.isRead ? 'bg-blue-50/20' : 'bg-white hover:bg-slate-50/60'
                }`}
              >
                {/* Left Side: Severity Badge & Details */}
                <div className="flex items-start gap-3 min-w-0">
                  {/* Severity Icon Indicator */}
                  <div
                    className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5 border ${
                      isCritical
                        ? 'bg-rose-50 text-rose-600 border-rose-200'
                        : isWarning
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}
                  >
                    {alert.category === 'expiry' ? (
                      <Clock className="w-3.5 h-3.5" />
                    ) : alert.category === 'stock' ? (
                      <Boxes className="w-3.5 h-3.5" />
                    ) : alert.category === 'finance' ? (
                      <FileText className="w-3.5 h-3.5" />
                    ) : alert.category === 'orders' ? (
                      <ShoppingCart className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className={`text-xs font-bold ${
                        !alert.isRead ? 'text-slate-900' : 'text-slate-700'
                      }`}>
                        {alert.title}
                      </h4>

                      {/* Severity Pill */}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider border ${
                          isCritical
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isWarning
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {alert.severity}
                      </span>

                      {!alert.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {alert.message}
                    </p>

                    {/* Metadata & Record Reference Footer */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                      <span className="font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[10.5px]">
                        {alert.recordReference}
                      </span>
                      <span>•</span>
                      <span>Ref Date: {alert.formattedDate}</span>
                    </div>
                  </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-start sm:pt-0.5">
                  {!alert.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(alert)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                      title="Mark as read"
                    >
                      Mark as Read
                    </button>
                  )}

                  <button
                    onClick={() => handleViewDetails(alert)}
                    className="px-3 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-blue-600 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all"
                  >
                    <span>View Details</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
