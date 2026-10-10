import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Factory,
  AlertTriangle,
  Clock,
  IndianRupee,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { formatINR, formatCompactNumber, calculatePercentChange } from './dashboardUtils';
import { InternalRole } from '../../../types/dairy';

export interface DashboardKpiData {
  // Sales
  totalSales: number;
  prevSales: number;
  // Orders
  totalOrders: number;
  prevOrders: number;
  pendingOrdersCount: number;
  dispatchedOrdersCount: number;
  // Production
  totalProductionQty: number;
  prevProductionQty: number;
  batchesLoggedCount: number;
  // Stock Alerts
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  // Expiry
  expiringBatchesCount: number;
  criticalExpiringCount: number;
  // Outstanding
  totalOutstandingAmount: number;
  overdueAmount: number;
}

interface DashboardKpiGridProps {
  kpi: DashboardKpiData;
  internalRole: InternalRole;
  onNavigate: (view: string) => void;
}

export const DashboardKpiGrid: React.FC<DashboardKpiGridProps> = ({
  kpi,
  internalRole,
  onNavigate,
}) => {
  const salesChange = calculatePercentChange(kpi.totalSales, kpi.prevSales);
  const ordersChange = calculatePercentChange(kpi.totalOrders, kpi.prevOrders);
  const productionChange = calculatePercentChange(kpi.totalProductionQty, kpi.prevProductionQty);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      {/* 1. Total Sales */}
      <div
        onClick={() => onNavigate('orders')}
        className="group relative bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-blue-400 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
            Total Sales
          </span>
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <IndianRupee className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="my-2">
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-numbers tracking-tight">
            {formatINR(kpi.totalSales, true)}
          </div>
          <p className="text-[10px] text-slate-400 font-mono-numbers truncate">
            {formatINR(kpi.totalSales, false)}
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
          <span className={`inline-flex items-center gap-0.5 font-bold ${
            salesChange.isZero
              ? 'text-slate-400'
              : salesChange.isPositive
              ? 'text-emerald-600'
              : 'text-rose-600'
          }`}>
            {!salesChange.isZero && (
              salesChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
            )}
            {salesChange.isZero ? '0%' : `${salesChange.isPositive ? '+' : '-'}${salesChange.percent}%`}
          </span>
          <span className="text-[10px] text-slate-400">vs prev period</span>
        </div>
      </div>

      {/* 2. Total Orders */}
      <div
        onClick={() => onNavigate('orders')}
        className="group relative bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-blue-400 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
            Total Orders
          </span>
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <ShoppingCart className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="my-2">
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-numbers tracking-tight">
            {formatCompactNumber(kpi.totalOrders)}
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            {kpi.pendingOrdersCount} pending · {kpi.dispatchedOrdersCount} dispatched
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
          <span className={`inline-flex items-center gap-0.5 font-bold ${
            ordersChange.isZero
              ? 'text-slate-400'
              : ordersChange.isPositive
              ? 'text-emerald-600'
              : 'text-rose-600'
          }`}>
            {!ordersChange.isZero && (
              ordersChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
            )}
            {ordersChange.isZero ? '0%' : `${ordersChange.isPositive ? '+' : '-'}${ordersChange.percent}%`}
          </span>
          <span className="text-[10px] text-slate-400">vs prev</span>
        </div>
      </div>

      {/* 3. Production Output */}
      <div
        onClick={() => onNavigate('production')}
        className="group relative bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-blue-400 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
            Production Output
          </span>
          <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
            <Factory className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="my-2">
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-numbers tracking-tight">
            {formatCompactNumber(kpi.totalProductionQty)}{' '}
            <span className="text-xs font-normal text-slate-400">units</span>
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            {kpi.batchesLoggedCount} batch{kpi.batchesLoggedCount !== 1 ? 'es' : ''} logged
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
          <span className={`inline-flex items-center gap-0.5 font-bold ${
            productionChange.isZero
              ? 'text-slate-400'
              : productionChange.isPositive
              ? 'text-emerald-600'
              : 'text-rose-600'
          }`}>
            {!productionChange.isZero && (
              productionChange.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
            )}
            {productionChange.isZero ? '0%' : `${productionChange.isPositive ? '+' : '-'}${productionChange.percent}%`}
          </span>
          <span className="text-[10px] text-slate-400">vs prev</span>
        </div>
      </div>

      {/* 4. Low Stock Alerts */}
      <div
        onClick={() => onNavigate('raw_materials')}
        className={`group relative bg-white p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
          kpi.outOfStockItemsCount > 0
            ? 'border-rose-300 hover:border-rose-400 bg-rose-50/20'
            : kpi.lowStockItemsCount > 0
            ? 'border-amber-300 hover:border-amber-400 bg-amber-50/20'
            : 'border-slate-200/80 hover:border-blue-400'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
            Low Stock Alerts
          </span>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            kpi.outOfStockItemsCount > 0
              ? 'bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white'
              : kpi.lowStockItemsCount > 0
              ? 'bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white'
              : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="my-2">
          <div className={`text-xl sm:text-2xl font-black font-mono-numbers tracking-tight ${
            kpi.outOfStockItemsCount > 0 ? 'text-rose-700' : kpi.lowStockItemsCount > 0 ? 'text-amber-700' : 'text-slate-900'
          }`}>
            {kpi.lowStockItemsCount + kpi.outOfStockItemsCount}{' '}
            <span className="text-xs font-normal text-slate-400">items</span>
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            {kpi.outOfStockItemsCount} out of stock · {kpi.lowStockItemsCount} low stock
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
          <span className={`font-semibold text-[10px] ${
            kpi.outOfStockItemsCount > 0 ? 'text-rose-600' : kpi.lowStockItemsCount > 0 ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            {kpi.outOfStockItemsCount > 0 ? 'Action required' : kpi.lowStockItemsCount > 0 ? 'Reorder soon' : 'Healthy inventory'}
          </span>
          <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
        </div>
      </div>

      {/* 5. Expiring Batches */}
      <div
        onClick={() => onNavigate('expiry')}
        className={`group relative bg-white p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
          kpi.criticalExpiringCount > 0
            ? 'border-rose-300 hover:border-rose-400 bg-rose-50/20'
            : kpi.expiringBatchesCount > 0
            ? 'border-amber-300 hover:border-amber-400 bg-amber-50/20'
            : 'border-slate-200/80 hover:border-blue-400'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
            Expiring Batches
          </span>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            kpi.criticalExpiringCount > 0
              ? 'bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white'
              : kpi.expiringBatchesCount > 0
              ? 'bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white'
              : 'bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white'
          }`}>
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="my-2">
          <div className={`text-xl sm:text-2xl font-black font-mono-numbers tracking-tight ${
            kpi.criticalExpiringCount > 0 ? 'text-rose-700' : kpi.expiringBatchesCount > 0 ? 'text-amber-700' : 'text-slate-900'
          }`}>
            {kpi.expiringBatchesCount}{' '}
            <span className="text-xs font-normal text-slate-400">batches</span>
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            {kpi.criticalExpiringCount > 0 ? `${kpi.criticalExpiringCount} critical (≤2d)` : 'Within 5-day warning'}
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
          <span className={`font-semibold text-[10px] ${
            kpi.criticalExpiringCount > 0 ? 'text-rose-600' : kpi.expiringBatchesCount > 0 ? 'text-amber-600' : 'text-slate-400'
          }`}>
            {kpi.expiringBatchesCount > 0 ? 'Priority dispatch' : 'No near-expiry'}
          </span>
          <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
        </div>
      </div>

      {/* 6. Outstanding Payments */}
      <div
        onClick={() => onNavigate('invoices')}
        className="group relative bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-blue-400 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
            Outstanding Due
          </span>
          <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
            <Layers className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="my-2">
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-numbers tracking-tight">
            {formatINR(kpi.totalOutstandingAmount, true)}
          </div>
          <p className="text-[10px] text-slate-500 truncate">
            {kpi.overdueAmount > 0 ? `${formatINR(kpi.overdueAmount, true)} overdue` : 'Across all retailers'}
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
          <span className="font-semibold text-[10px] text-orange-600">
            Open receivables
          </span>
          <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
        </div>
      </div>
    </div>
  );
};
