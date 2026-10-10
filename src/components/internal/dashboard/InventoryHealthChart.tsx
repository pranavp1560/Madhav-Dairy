import React from 'react';
import { Boxes, AlertTriangle, CheckCircle2, XCircle, ArrowUpRight } from 'lucide-react';

export interface InventoryHealthData {
  healthyRawMaterials: number;
  lowStockRawMaterials: number;
  outOfStockRawMaterials: number;
  totalRawMaterials: number;

  activeBatches: number;
  nearExpiryBatches: number;
  expiredBatches: number;
  totalBatches: number;
}

interface InventoryHealthChartProps {
  data: InventoryHealthData;
  onNavigateToRawMaterials: () => void;
  onNavigateToBatches: () => void;
}

export const InventoryHealthChart: React.FC<InventoryHealthChartProps> = ({
  data,
  onNavigateToRawMaterials,
  onNavigateToBatches,
}) => {
  const totalItems = data.totalRawMaterials + data.totalBatches;
  const totalHealthy = data.healthyRawMaterials + data.activeBatches;
  const totalWarning = data.lowStockRawMaterials + data.nearExpiryBatches;
  const totalCritical = data.outOfStockRawMaterials + data.expiredBatches;

  const healthScore = totalItems > 0 ? Math.round((totalHealthy / totalItems) * 100) : 100;
  const warningScore = totalItems > 0 ? Math.round((totalWarning / totalItems) * 100) : 0;
  const criticalScore = totalItems > 0 ? Math.round((totalCritical / totalItems) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Inventory & Cold Chain Health
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Buffer safety stocks, packaging materials, and active batch availability
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-800 font-mono-numbers bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
            {healthScore}% Healthy
          </span>
        </div>
      </div>

      {/* Segmented Progress Bar */}
      <div className="space-y-1.5 my-2">
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex shadow-inner">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${healthScore}%` }}
            title={`Healthy: ${healthScore}%`}
          />
          <div
            className="h-full bg-amber-400 transition-all duration-500"
            style={{ width: `${warningScore}%` }}
            title={`Warning / Low: ${warningScore}%`}
          />
          <div
            className="h-full bg-rose-500 transition-all duration-500"
            style={{ width: `${criticalScore}%` }}
            title={`Critical / Stockout: ${criticalScore}%`}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Healthy ({totalHealthy})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Low / Warning ({totalWarning})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Stockout / Expired ({totalCritical})
          </span>
        </div>
      </div>

      {/* 2 Diagnostic Sub-Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2 text-xs">
        {/* Raw Materials Diagnostics */}
        <div
          onClick={onNavigateToRawMaterials}
          className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-blue-600" />
              Raw Materials
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </div>

          <div className="mt-2 space-y-1 font-mono-numbers">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Above Safety Min:</span>
              <span className="font-bold text-emerald-700">{data.healthyRawMaterials}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Low Stock Buffer:</span>
              <span className="font-bold text-amber-700">{data.lowStockRawMaterials}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Zero Stockout:</span>
              <span className="font-bold text-rose-700">{data.outOfStockRawMaterials}</span>
            </div>
          </div>
        </div>

        {/* Product Batches Diagnostics */}
        <div
          onClick={onNavigateToBatches}
          className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              Finished Batches
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </div>

          <div className="mt-2 space-y-1 font-mono-numbers">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Active in Cold Chain:</span>
              <span className="font-bold text-teal-700">{data.activeBatches}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Near Expiry (≤5d):</span>
              <span className="font-bold text-amber-700">{data.nearExpiryBatches}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Expired / Blocked:</span>
              <span className="font-bold text-rose-700">{data.expiredBatches}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2.5 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Total Tracked SKU items: <strong className="text-slate-800 font-mono-numbers">{totalItems}</strong></span>
        <span className="text-blue-600 font-semibold cursor-pointer" onClick={onNavigateToRawMaterials}>
          Manage Stock &rarr;
        </span>
      </div>
    </div>
  );
};
