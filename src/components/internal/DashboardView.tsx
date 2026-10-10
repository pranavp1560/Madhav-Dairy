import React, { useState, useMemo, useCallback } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import {
  DateRangePreset,
  DateRangeBounds,
  getDateRangeBounds,
  toLocalDateString,
  parseLocalDate,
} from './dashboard/dashboardUtils';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { DashboardKpiGrid, DashboardKpiData } from './dashboard/DashboardKpiGrid';
import { SalesTrendChart, SalesDataPoint } from './dashboard/SalesTrendChart';
import { OrderStatusDonutChart, OrderStatusCount } from './dashboard/OrderStatusDonutChart';
import { ProductionByProductChart, ProductProductionItem } from './dashboard/ProductionByProductChart';
import { InventoryHealthChart, InventoryHealthData } from './dashboard/InventoryHealthChart';
import { OutstandingPaymentsChart, CustomerOutstandingItem } from './dashboard/OutstandingPaymentsChart';
import { NotificationAlertsPanel, DashboardAlertItem } from './dashboard/NotificationAlertsPanel';
import { RecentActivityFeed, ActivityEvent } from './dashboard/RecentActivityFeed';
import { DashboardExportModal } from './dashboard/DashboardExportModal';
import { OrderStatus } from '../../types/dairy';

interface DashboardViewProps {
  onOpenCreateBatch: () => void;
  onOpenRecordPayment: () => void;
  onOpenAddExpense: () => void;
  onSelectBatch: (id: string) => void;
  onSelectRetailer: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenCreateBatch,
  onOpenRecordPayment,
  onOpenAddExpense,
  onSelectBatch,
  onSelectRetailer,
}) => {
  const {
    internalRole,
    setInternalView,
    batches,
    orders,
    retailers,
    expiryAlerts,
    rawMaterials,
    expenses,
    payments,
    invoices,
    refreshData,
    addToast,
    setSelectedOrderId,
    setSelectedBatchId,
  } = useDairy();

  const { t } = useTranslation();

  // State: Date Filtering
  const [datePreset, setDatePreset] = useState<DateRangePreset>('this_month');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return toLocalDateString(d);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => toLocalDateString(new Date()));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Computed Date Bounds
  const dateBounds = useMemo(() => {
    return getDateRangeBounds(datePreset, customStart, customEnd);
  }, [datePreset, customStart, customEnd]);

  const todayStr = useMemo(() => toLocalDateString(new Date()), []);

  // Handle Refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
      addToast('ERP operational data refreshed from live database', 'success');
    } catch {
      addToast('Failed to refresh data', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshData, addToast]);

  // Handle Navigation
  const handleNavigate = useCallback((view: string, entityId?: string) => {
    if (view === 'orders' && entityId) {
      setSelectedOrderId(entityId);
    } else if ((view === 'batches' || view === 'expiry') && entityId) {
      setSelectedBatchId(entityId);
      onSelectBatch(entityId);
    } else if (view === 'customers' && entityId) {
      onSelectRetailer(entityId);
    }
    setInternalView(view);
  }, [setInternalView, setSelectedOrderId, setSelectedBatchId, onSelectBatch, onSelectRetailer]);

  // ===========================================================================
  // 1. FILTERED DATASETS
  // ===========================================================================

  // Current Period Orders
  const currentOrders = useMemo(() => {
    return orders.filter(o => o.orderDate >= dateBounds.startStr && o.orderDate <= dateBounds.endStr);
  }, [orders, dateBounds]);

  // Previous Period Orders
  const prevOrders = useMemo(() => {
    return orders.filter(o => o.orderDate >= dateBounds.prevStartStr && o.orderDate <= dateBounds.prevEndStr);
  }, [orders, dateBounds]);

  // Current Period Batches
  const currentBatches = useMemo(() => {
    return batches.filter(b => b.productionDate >= dateBounds.startStr && b.productionDate <= dateBounds.endStr);
  }, [batches, dateBounds]);

  // Previous Period Batches
  const prevBatches = useMemo(() => {
    return batches.filter(b => b.productionDate >= dateBounds.prevStartStr && b.productionDate <= dateBounds.prevEndStr);
  }, [batches, dateBounds]);

  // Current Period Invoices
  const currentInvoices = useMemo(() => {
    return invoices.filter(inv => inv.date >= dateBounds.startStr && inv.date <= dateBounds.endStr);
  }, [invoices, dateBounds]);

  const prevInvoices = useMemo(() => {
    return invoices.filter(inv => inv.date >= dateBounds.prevStartStr && inv.date <= dateBounds.prevEndStr);
  }, [invoices, dateBounds]);

  // ===========================================================================
  // 2. KPI CALCULATIONS
  // ===========================================================================

  const kpiData: DashboardKpiData = useMemo(() => {
    // Current Sales: prefer invoices total, fallback to non-cancelled orders
    const totalSales = currentInvoices.length > 0
      ? currentInvoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.totalAmount, 0)
      : currentOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0);

    const prevSales = prevInvoices.length > 0
      ? prevInvoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.totalAmount, 0)
      : prevOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0);

    // Orders
    const totalOrders = currentOrders.length;
    const prevOrdersCount = prevOrders.length;
    const pendingOrdersCount = currentOrders.filter(o => o.status === 'pending').length;
    const dispatchedOrdersCount = currentOrders.filter(o => o.status === 'dispatched' || o.status === 'confirmed').length;

    // Production
    const totalProductionQty = currentBatches.reduce((s, b) => s + b.producedQty, 0);
    const prevProductionQty = prevBatches.reduce((s, b) => s + b.producedQty, 0);
    const batchesLoggedCount = currentBatches.length;

    // Low Stock Alerts
    const lowStockItemsCount = rawMaterials.filter(m => m.status === 'low_stock').length;
    const outOfStockItemsCount = rawMaterials.filter(m => m.status === 'out_of_stock' || m.currentStock <= 0).length;

    // Expiring Batches: active batches with expiry date within 5 days
    const activeBatches = batches.filter(b => b.status === 'active' || b.status === 'near_expiry');
    let expiringBatchesCount = 0;
    let criticalExpiringCount = 0;

    activeBatches.forEach(b => {
      const expDate = parseLocalDate(b.expiryDate);
      const currDate = parseLocalDate(todayStr);
      const diffDays = Math.ceil((expDate.getTime() - currDate.getTime()) / 86400000);
      if (diffDays <= 5) {
        expiringBatchesCount++;
        if (diffDays <= 2) {
          criticalExpiringCount++;
        }
      }
    });

    // Outstanding Payments: sum of unpaid invoices / customer balances
    const totalOutstandingAmount = retailers.reduce((s, r) => s + (r.outstandingAmount || 0), 0);
    const overdueAmount = invoices
      .filter(i => i.dueDate < todayStr && i.status !== 'settled' && i.status !== 'cancelled')
      .reduce((s, i) => s + i.outstandingAmount, 0);

    return {
      totalSales,
      prevSales,
      totalOrders,
      prevOrders: prevOrdersCount,
      pendingOrdersCount,
      dispatchedOrdersCount,
      totalProductionQty,
      prevProductionQty,
      batchesLoggedCount,
      lowStockItemsCount,
      outOfStockItemsCount,
      expiringBatchesCount,
      criticalExpiringCount,
      totalOutstandingAmount,
      overdueAmount,
    };
  }, [
    currentInvoices,
    prevInvoices,
    currentOrders,
    prevOrders,
    currentBatches,
    prevBatches,
    rawMaterials,
    batches,
    retailers,
    invoices,
    todayStr,
  ]);

  // ===========================================================================
  // 3. CHART 1: SALES TREND
  // ===========================================================================

  const salesTrendData: SalesDataPoint[] = useMemo(() => {
    const sDate = parseLocalDate(dateBounds.startStr);
    const eDate = parseLocalDate(dateBounds.endStr);
    const dayCount = Math.min(60, Math.max(1, Math.ceil((eDate.getTime() - sDate.getTime()) / 86400000) + 1));

    const points: SalesDataPoint[] = [];
    const salesMap: Record<string, { sales: number; count: number }> = {};

    // Group invoices or orders by date
    const sourceRecords = currentInvoices.length > 0 ? currentInvoices : currentOrders;
    sourceRecords.forEach((item: any) => {
      if (item.status === 'cancelled') return;
      const d = item.date || item.orderDate;
      if (!d) return;
      if (!salesMap[d]) salesMap[d] = { sales: 0, count: 0 };
      salesMap[d].sales += item.totalAmount;
      salesMap[d].count += 1;
    });

    for (let i = 0; i < dayCount; i++) {
      const cur = new Date(sDate);
      cur.setDate(cur.getDate() + i);
      const str = toLocalDateString(cur);
      const dayNum = cur.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = monthNames[cur.getMonth()];

      const recorded = salesMap[str] || { sales: 0, count: 0 };
      points.push({
        dateStr: str,
        label: `${dayNum} ${monthName}`,
        sales: recorded.sales,
        orderCount: recorded.count,
      });
    }

    return points;
  }, [dateBounds, currentInvoices, currentOrders]);

  // ===========================================================================
  // 4. CHART 2: ORDER STATUS DONUT
  // ===========================================================================

  const orderStatusCounts: OrderStatusCount[] = useMemo(() => {
    const source = currentOrders.length > 0 ? currentOrders : orders;
    const map: Record<OrderStatus, number> = {
      pending: 0,
      confirmed: 0,
      dispatched: 0,
      delivered: 0,
      cancelled: 0,
    };

    source.forEach(o => {
      if (map[o.status] !== undefined) {
        map[o.status]++;
      }
    });

    return [
      { status: 'pending', label: 'Pending', count: map.pending, color: '#f59e0b', hoverColor: '#d97706' },
      { status: 'confirmed', label: 'Confirmed', count: map.confirmed, color: '#3b82f6', hoverColor: '#1d4ed8' },
      { status: 'dispatched', label: 'Dispatched', count: map.dispatched, color: '#8b5cf6', hoverColor: '#7c3aed' },
      { status: 'delivered', label: 'Delivered', count: map.delivered, color: '#10b981', hoverColor: '#059669' },
      { status: 'cancelled', label: 'Cancelled', count: map.cancelled, color: '#94a3b8', hoverColor: '#64748b' },
    ];
  }, [currentOrders, orders]);

  // ===========================================================================
  // 5. CHART 3: PRODUCTION BY PRODUCT
  // ===========================================================================

  const productionByProduct: ProductProductionItem[] = useMemo(() => {
    const source = currentBatches.length > 0 ? currentBatches : batches;
    const map: Record<string, ProductProductionItem> = {};

    source.forEach(b => {
      const key = b.productId || b.productName;
      if (!map[key]) {
        map[key] = {
          productId: b.productId || key,
          productName: b.productName || 'Dairy Product',
          producedQty: 0,
          unit: b.unit || 'unit',
          batchCount: 0,
        };
      }
      map[key].producedQty += b.producedQty;
      map[key].batchCount += 1;
    });

    return Object.values(map).sort((a, b) => b.producedQty - a.producedQty);
  }, [currentBatches, batches]);

  // ===========================================================================
  // 6. CHART 4: INVENTORY HEALTH
  // ===========================================================================

  const inventoryHealth: InventoryHealthData = useMemo(() => {
    const healthyRM = rawMaterials.filter(m => m.status === 'healthy').length;
    const lowRM = rawMaterials.filter(m => m.status === 'low_stock').length;
    const outRM = rawMaterials.filter(m => m.status === 'out_of_stock' || m.currentStock <= 0).length;

    let activeB = 0;
    let nearExpB = 0;
    let expB = 0;

    batches.forEach(b => {
      const expDate = parseLocalDate(b.expiryDate);
      const currDate = parseLocalDate(todayStr);
      const diffDays = Math.ceil((expDate.getTime() - currDate.getTime()) / 86400000);

      if (diffDays < 0 || b.status === 'expired') {
        expB++;
      } else if (diffDays <= 5 || b.status === 'near_expiry') {
        nearExpB++;
      } else {
        activeB++;
      }
    });

    return {
      healthyRawMaterials: healthyRM,
      lowStockRawMaterials: lowRM,
      outOfStockRawMaterials: outRM,
      totalRawMaterials: rawMaterials.length,
      activeBatches: activeB,
      nearExpiryBatches: nearExpB,
      expiredBatches: expB,
      totalBatches: batches.length,
    };
  }, [rawMaterials, batches, todayStr]);

  // ===========================================================================
  // 7. CHART 5: OUTSTANDING RECEIVABLES
  // ===========================================================================

  const customerReceivables: CustomerOutstandingItem[] = useMemo(() => {
    return retailers
      .filter(r => r.outstandingAmount > 0)
      .map(r => {
        const custInvoices = invoices.filter(i => i.retailerId === r.id && i.status !== 'settled');
        const overdue = custInvoices
          .filter(i => i.dueDate < todayStr)
          .reduce((s, i) => s + i.outstandingAmount, 0);

        return {
          customerId: r.id,
          businessName: r.businessName,
          outstandingAmount: r.outstandingAmount,
          creditLimit: r.creditLimit || 50000,
          overdueAmount: overdue,
          lastInvoiceDate: r.lastOrderDate,
        };
      })
      .sort((a, b) => b.outstandingAmount - a.outstandingAmount);
  }, [retailers, invoices, todayStr]);

  // ===========================================================================
  // 8. SECTION D: OPERATIONAL ALERTS
  // ===========================================================================

  const operationalAlerts: DashboardAlertItem[] = useMemo(() => {
    const list: DashboardAlertItem[] = [];

    // Alert Group 1: Near-Expiry & Expired Batches
    batches.forEach(b => {
      if (b.status === 'exhausted' || b.availableQty <= 0) return;
      const expDate = parseLocalDate(b.expiryDate);
      const currDate = parseLocalDate(todayStr);
      const diffDays = Math.ceil((expDate.getTime() - currDate.getTime()) / 86400000);

      if (diffDays <= 2 && diffDays >= 0) {
        list.push({
          id: `batch-crit-${b.id}`,
          severity: 'critical',
          title: `Critical Expiry Warning: ${b.productName}`,
          message: `Batch #${b.batchNumber} has ${b.availableQty} ${b.unit} expiring in ${diffDays === 0 ? 'today' : `${diffDays} day(s)`}. Requires immediate dispatch.`,
          referenceType: 'batch',
          referenceId: b.id,
          referenceLabel: `Batch ${b.batchNumber}`,
          timestamp: diffDays === 0 ? 'Today' : `${diffDays}d left`,
          targetView: 'expiry',
        });
      } else if (diffDays <= 5 && diffDays > 2) {
        list.push({
          id: `batch-warn-${b.id}`,
          severity: 'warning',
          title: `Near Expiry Alert: ${b.productName}`,
          message: `Batch #${b.batchNumber} enters threshold window (${diffDays} days remaining). Priority allocation recommended.`,
          referenceType: 'batch',
          referenceId: b.id,
          referenceLabel: `Batch ${b.batchNumber}`,
          timestamp: `${diffDays}d left`,
          targetView: 'expiry',
        });
      }
    });

    // Alert Group 2: Out of Stock & Low Stock Raw Materials
    rawMaterials.forEach(m => {
      if (m.status === 'out_of_stock' || m.currentStock <= 0) {
        list.push({
          id: `mat-crit-${m.id}`,
          severity: 'critical',
          title: `Out of Stock: ${m.name}`,
          message: `Current inventory is 0 ${m.unit} (Safety min: ${m.minStockThreshold} ${m.unit}). May block ongoing milk packaging or processing.`,
          referenceType: 'material',
          referenceId: m.id,
          referenceLabel: m.name,
          timestamp: 'Zero stock',
          targetView: 'raw_materials',
        });
      } else if (m.status === 'low_stock' || m.currentStock <= m.minStockThreshold) {
        list.push({
          id: `mat-warn-${m.id}`,
          severity: 'warning',
          title: `Low Safety Stock: ${m.name}`,
          message: `Current stock (${m.currentStock} ${m.unit}) is below safety threshold (${m.minStockThreshold} ${m.unit}). Initiate inward purchase PO.`,
          referenceType: 'material',
          referenceId: m.id,
          referenceLabel: m.name,
          timestamp: 'Low buffer',
          targetView: 'raw_materials',
        });
      }
    });

    // Alert Group 3: Overdue Customer Invoices
    invoices.forEach(inv => {
      if (inv.dueDate < todayStr && inv.status !== 'settled' && inv.status !== 'cancelled' && inv.outstandingAmount > 0) {
        list.push({
          id: `inv-overdue-${inv.id}`,
          severity: 'critical',
          title: `Overdue Invoice: ${inv.invoiceNumber}`,
          message: `₹${inv.outstandingAmount.toLocaleString('en-IN')} due from ${inv.retailerName} was due on ${inv.dueDate}. Follow up for collection.`,
          referenceType: 'invoice',
          referenceId: inv.id,
          referenceLabel: inv.invoiceNumber,
          timestamp: 'Overdue',
          targetView: 'invoices',
        });
      }
    });

    // Alert Group 4: Orders Waiting for Fulfillment Action
    orders.forEach(o => {
      if (o.status === 'pending') {
        list.push({
          id: `ord-pending-${o.id}`,
          severity: 'info',
          title: `New Order Pending Confirmation: ${o.orderNumber}`,
          message: `Order for ₹${o.totalAmount.toLocaleString('en-IN')} by ${o.retailerName} requires staff confirmation.`,
          referenceType: 'order',
          referenceId: o.id,
          referenceLabel: o.orderNumber,
          timestamp: o.orderDate === todayStr ? 'Today' : o.orderDate,
          targetView: 'orders',
        });
      } else if (o.status === 'confirmed') {
        list.push({
          id: `ord-confirmed-${o.id}`,
          severity: 'info',
          title: `Order Ready to Dispatch: ${o.orderNumber}`,
          message: `Confirmed order (${o.items.length} items) for ${o.retailerName} is waiting for batch dispatch & invoice creation.`,
          referenceType: 'order',
          referenceId: o.id,
          referenceLabel: o.orderNumber,
          timestamp: o.orderDate === todayStr ? 'Today' : o.orderDate,
          targetView: 'orders',
        });
      }
    });

    // Sort by severity (critical first) then newest
    return list.sort((a, b) => {
      const weight = { critical: 0, warning: 1, info: 2 };
      return weight[a.severity] - weight[b.severity];
    });
  }, [batches, rawMaterials, invoices, orders, todayStr]);

  // ===========================================================================
  // 9. SECTION E: RECENT ACTIVITY TIMELINE
  // ===========================================================================

  const recentActivityEvents: ActivityEvent[] = useMemo(() => {
    const list: ActivityEvent[] = [];

    // Recent Orders
    orders.slice(0, 5).forEach(o => {
      list.push({
        id: `act-ord-${o.id}`,
        type: 'order',
        title: `Order ${o.orderNumber}`,
        subtitle: `${o.retailerName} · ${o.items.length} items`,
        timestamp: o.orderDate,
        amount: o.totalAmount,
        statusBadge: o.status,
        targetView: 'orders',
        entityId: o.id,
      });
    });

    // Recent Batches
    batches.slice(0, 5).forEach(b => {
      list.push({
        id: `act-batch-${b.id}`,
        type: 'batch',
        title: `Batch ${b.batchNumber}`,
        subtitle: `${b.productName} · Produced ${b.producedQty} ${b.unit}`,
        timestamp: b.productionDate,
        statusBadge: b.status,
        targetView: 'production',
        entityId: b.id,
      });
    });

    // Recent Invoices
    invoices.slice(0, 5).forEach(i => {
      list.push({
        id: `act-inv-${i.id}`,
        type: 'invoice',
        title: `Invoice ${i.invoiceNumber}`,
        subtitle: `${i.retailerName} · Billed`,
        timestamp: i.date,
        amount: i.totalAmount,
        statusBadge: i.status,
        targetView: 'invoices',
        entityId: i.id,
      });
    });

    // Recent Payments
    payments.slice(0, 5).forEach(p => {
      list.push({
        id: `act-pay-${p.id}`,
        type: 'payment',
        title: `Payment ${p.paymentNumber}`,
        subtitle: `${p.retailerName || 'Customer'} · ${p.paymentMethod.toUpperCase()}`,
        timestamp: p.date,
        amount: p.amount,
        statusBadge: p.isAccounted ? 'accounted' : 'received',
        targetView: 'payments',
        entityId: p.id,
      });
    });

    // Sort by timestamp descending
    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8);
  }, [orders, batches, invoices, payments]);

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
      {/* 1. Header with Title, Controls, Date Range, & Quick Actions */}
      <DashboardHeader
        internalRole={internalRole}
        dateBounds={dateBounds}
        onChangePreset={preset => setDatePreset(preset)}
        customStartDate={customStart}
        customEndDate={customEnd}
        onChangeCustomDates={(s, e) => {
          setCustomStart(s);
          setCustomEnd(e);
        }}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onOpenCreateBatch={onOpenCreateBatch}
        onNavigateToInvoices={() => setInternalView('invoices')}
        onNavigateToRawMaterials={() => setInternalView('raw_materials')}
        onExportReport={() => setIsExportOpen(true)}
      />

      {/* 2. Top-Level 6 Compact KPI Cards */}
      <DashboardKpiGrid
        kpi={kpiData}
        internalRole={internalRole}
        onNavigate={handleNavigate}
      />

      {/* 3. Main Operational Hub: 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Left & Center: Interactive Charts & Activity Feed (2 Cols on Desktop) */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-5">
          {/* Chart 1: Sales Revenue Trend */}
          <SalesTrendChart
            data={salesTrendData}
            isLoading={isRefreshing}
          />

          {/* Row 2: Production by Product & Order Status Distribution (Side-by-Side) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Chart 3: Production by Product */}
            <ProductionByProductChart
              products={productionByProduct}
              totalQuantity={kpiData.totalProductionQty}
              onNavigateToProduction={() => setInternalView('production')}
            />

            {/* Chart 2: Order Fulfillment Pipeline */}
            <OrderStatusDonutChart
              statusCounts={orderStatusCounts}
              totalOrders={currentOrders.length > 0 ? currentOrders.length : orders.length}
              onSelectStatus={st => {
                setInternalView('orders');
              }}
            />
          </div>

          {/* Row 3: Inventory Health & Customer Receivables (Side-by-Side) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Chart 4: Inventory & Cold Chain Health */}
            <InventoryHealthChart
              data={inventoryHealth}
              onNavigateToRawMaterials={() => setInternalView('raw_materials')}
              onNavigateToBatches={() => setInternalView('production')}
            />

            {/* Chart 5: Customer Receivables & Aging */}
            <OutstandingPaymentsChart
              customers={customerReceivables}
              totalOutstanding={kpiData.totalOutstandingAmount}
              totalOverdue={kpiData.overdueAmount}
              onNavigateToInvoices={() => setInternalView('invoices')}
              onSelectCustomer={id => {
                onSelectRetailer(id);
                setInternalView('customers');
              }}
            />
          </div>

          {/* Section E: Operational Activity Timeline */}
          <RecentActivityFeed
            activities={recentActivityEvents}
            onNavigate={handleNavigate}
          />
        </div>

        {/* Right Column on Desktop: Dedicated Notification & Operational Alerts Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <NotificationAlertsPanel
              alerts={operationalAlerts}
              onNavigate={handleNavigate}
            />
          </div>
        </div>
      </div>

      {/* Export Report Modal */}
      <DashboardExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        dateBounds={dateBounds}
        kpi={kpiData}
        salesData={salesTrendData}
        productionData={productionByProduct}
        customerData={customerReceivables}
      />
    </div>
  );
};
