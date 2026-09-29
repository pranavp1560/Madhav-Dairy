import React from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import {
  TrendingUp,
  ShoppingCart,
  Factory,
  AlertTriangle,
  Clock,
  Layers,
  Boxes,
  ArrowRight,
  Plus,
  CreditCard,
  Package,
  Calendar,
  IndianRupee
} from 'lucide-react';

interface DashboardViewProps {
  onOpenCreateBatch: () => void;
  onOpenCreateInvoice: () => void;
  onOpenRecordPayment: () => void;
  onOpenAddExpense: () => void;
  onSelectBatch: (id: string) => void;
  onSelectRetailer: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenCreateBatch,
  onOpenCreateInvoice,
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
  } = useDairy();

  const { t } = useTranslation();

  // Metrics calculations
  const todaysSales = orders
    .filter(o => o.orderDate === '2026-09-28' || o.status === 'confirmed' || o.status === 'dispatched')
    .slice(0, 5)
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const todaysOrdersCount = orders.filter(o => o.status !== 'cancelled').length;
  const todaysProductionQty = batches
    .filter(b => b.productionDate === '2026-09-28' || b.productionDate === '2026-09-27')
    .reduce((sum, b) => sum + b.producedQty, 0);

  const lowStockCount = rawMaterials.filter(m => m.status === 'low_stock' || m.status === 'out_of_stock').length;
  const expiringSoonCount = expiryAlerts.filter(a => a.daysRemaining <= 5).length;
  const totalOutstanding = retailers.reduce((sum, r) => sum + r.outstandingAmount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Today's production batches (recent 4)
  const recentProductionBatches = batches.slice(0, 4);

  // Recent retailer orders (recent 4)
  const recentOrders = orders.slice(0, 4);

  // Low raw materials
  const lowRawMaterials = rawMaterials.filter(m => m.status !== 'healthy').slice(0, 4);

  // Expiring batches
  const expiringBatches = batches
    .filter(b => b.status === 'near_expiry' || b.status === 'active')
    .slice(0, 4);

  return (
    <div className="space-y-5">
      {/* Top Banner: Context & Role Notice */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              {t.internal.dashboard.title}
            </h2>
            <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-blue-600" />
              28 Sep 2026
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.internal.dashboard.subtitle}
          </p>
        </div>

        {/* Action Shortcuts based on role */}
        <div className="flex items-center gap-2">
          {(internalRole === 'admin' || internalRole === 'production_manager') && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={onOpenCreateBatch}
            >
              + Create Batch
            </Button>
          )}

          {(internalRole === 'admin' || internalRole === 'accountant') && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={onOpenCreateInvoice}
            >
              + New Invoice
            </Button>
          )}

          {internalRole === 'warehouse_manager' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Boxes className="w-3.5 h-3.5" />}
              onClick={() => setInternalView('raw_materials')}
            >
              Add Inward Stock
            </Button>
          )}
        </div>
      </div>

      {/* Top-Level Operational Metrics (6 Core Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Today's Sales (Visible to Admin, Accountant) */}
        {(internalRole === 'admin' || internalRole === 'accountant') && (
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">
              {t.internal.dashboard.todaysSales}
            </span>
            <p className="text-lg font-bold text-slate-900 mt-1 font-mono-numbers">
              ₹{todaysSales.toLocaleString()}
            </p>
            <span className="text-[10px] text-blue-600 font-semibold">Active dispatch</span>
          </div>
        )}

        {/* Metric 2: Orders Count (Visible to Admin, Accountant, Warehouse) */}
        {(internalRole !== 'production_manager') && (
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">
              {t.internal.dashboard.todaysOrders}
            </span>
            <p className="text-lg font-bold text-slate-900 mt-1 font-mono-numbers">
              {todaysOrdersCount} <span className="text-xs font-normal text-slate-400">orders</span>
            </p>
            <span className="text-[10px] text-blue-600 font-semibold">In pipeline</span>
          </div>
        )}

        {/* Metric 3: Today's Production (Visible to Admin, Production, Warehouse) */}
        {(internalRole !== 'accountant') && (
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">
              {t.internal.dashboard.todaysProduction}
            </span>
            <p className="text-lg font-bold text-slate-900 mt-1 font-mono-numbers">
              {todaysProductionQty} <span className="text-xs font-normal text-slate-400">units</span>
            </p>
            <span className="text-[10px] text-blue-600 font-semibold">Batches logged</span>
          </div>
        )}

        {/* Metric 4: Low Stock Alert (Visible to Admin, Production, Warehouse) */}
        {(internalRole !== 'accountant') && (
          <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">
              {t.internal.dashboard.lowStockMaterials}
            </span>
            <p className="text-lg font-bold text-amber-700 mt-1 font-mono-numbers">
              {lowStockCount} <span className="text-xs font-normal text-slate-400">items</span>
            </p>
            <span className="text-[10px] text-amber-600 font-semibold">Raw / packaging</span>
          </div>
        )}

        {/* Metric 5: Expiring Soon (Visible to All) */}
        <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 block truncate">
            {t.internal.dashboard.expiringSoon}
          </span>
          <p className="text-lg font-bold text-rose-700 mt-1 font-mono-numbers">
            {expiringSoonCount} <span className="text-xs font-normal text-slate-400">batches</span>
          </p>
          <span className="text-[10px] text-rose-600 font-semibold">Priority dispatch</span>
        </div>

        {/* Metric 6: Outstanding (Visible to Admin, Accountant) */}
        {(internalRole === 'admin' || internalRole === 'accountant') && (
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">
              {t.internal.dashboard.outstandingAmount}
            </span>
            <p className="text-lg font-bold text-slate-900 mt-1 font-mono-numbers">
              ₹{(totalOutstanding / 1000).toFixed(1)}k
            </p>
            <span className="text-[10px] text-slate-500 font-semibold">Across retailers</span>
          </div>
        )}

        {/* Metric 7: Production Manager Active Batches */}
        {internalRole === 'production_manager' && (
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate">
              Active Batches
            </span>
            <p className="text-lg font-bold text-slate-900 mt-1 font-mono-numbers">
              {batches.filter(b => b.status === 'active').length}
            </p>
            <span className="text-[10px] text-blue-600 font-semibold">In cold chain</span>
          </div>
        )}
      </div>

      {/* Operational Grids (Compact 2x2 layout answering "What is happening today?") */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Section A: Today's Production Runs (Visible to Admin, Production, Warehouse) */}
        {(internalRole !== 'accountant') && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {t.internal.dashboard.todaysProductionList}
                </h3>
              </div>
              <button
                onClick={() => setInternalView('production')}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>{t.internal.dashboard.viewAll}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="p-0 overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3">Batch</th>
                    <th className="py-2 px-3 text-right">Produced Qty</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {recentProductionBatches.map(b => (
                    <tr key={b.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {b.productName}
                      </td>
                      <td className="py-2.5 px-3 font-mono-numbers text-blue-700 font-medium">
                        {b.batchNumber}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-numbers font-bold">
                        {b.producedQty} <span className="text-[10px] text-slate-400 font-normal">{b.unit}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={b.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section B: Recent Retailer Orders (Visible to Admin, Accountant, Warehouse) */}
        {(internalRole !== 'production_manager') && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {t.internal.dashboard.recentOrders}
                </h3>
              </div>
              <button
                onClick={() => setInternalView('orders')}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>{t.internal.dashboard.viewAll}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="p-0 overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Order No.</th>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {recentOrders.map(o => (
                    <tr key={o.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono-numbers font-medium text-slate-900">
                        {o.orderNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {o.retailerName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-slate-900">
                        ₹{o.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={o.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section C: Low Raw Material Stock (Visible to Admin, Production, Warehouse) */}
        {(internalRole !== 'accountant') && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {t.internal.dashboard.lowRawMaterials}
                </h3>
              </div>
              <button
                onClick={() => setInternalView('raw_materials')}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>{t.internal.dashboard.viewAll}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="p-0 overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Material</th>
                    <th className="py-2 px-3 text-right">Current Stock</th>
                    <th className="py-2 px-3 text-right">Safety Min</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {lowRawMaterials.map(m => (
                    <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {m.name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-amber-600">
                        {m.currentStock} {m.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-numbers text-slate-500">
                        {m.minStockThreshold} {m.unit}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={m.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section D: Expiring Batches (Visible to All) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {t.internal.dashboard.expiringBatches}
              </h3>
            </div>
            <button
              onClick={() => setInternalView('expiry')}
              className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>{t.internal.dashboard.viewAll}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-0 overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-2 px-3">Product</th>
                  <th className="py-2 px-3">Batch</th>
                  <th className="py-2 px-3 text-right">Available</th>
                  <th className="py-2 px-3">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {expiringBatches.map(b => (
                  <tr key={b.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {b.productName}
                    </td>
                    <td className="py-2.5 px-3 font-mono-numbers text-blue-700 font-medium">
                      {b.batchNumber}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-slate-900">
                      {b.availableQty} {b.unit}
                    </td>
                    <td className="py-2.5 px-3 font-mono-numbers text-rose-600 font-medium text-[11px]">
                      {b.expiryDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
