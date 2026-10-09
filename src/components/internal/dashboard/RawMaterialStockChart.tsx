import React, { useState, useMemo } from 'react';
import { useDairy } from '../../../context/DairyContext';
import { RawMaterial } from '../../../types/dairy';
import { StatusBadge } from '../../ui/StatusBadge';
import { RawMaterialDetailModal } from './RawMaterialDetailModal';
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  Search,
  Filter
} from 'lucide-react';

export const RawMaterialStockChart: React.FC = () => {
  const { rawMaterials, setInternalView } = useDairy();

  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'low_stock' | 'healthy' | 'out_of_stock'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMaterials = useMemo(() => {
    return rawMaterials
      .filter(m => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          if (!m.name.toLowerCase().includes(q) && !m.category.toLowerCase().includes(q)) {
            return false;
          }
        }
        if (statusFilter !== 'all' && m.status !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Show out-of-stock and low-stock first
        const weight = { out_of_stock: 0, low_stock: 1, healthy: 2 };
        const diff = (weight[a.status] ?? 3) - (weight[b.status] ?? 3);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      });
  }, [rawMaterials, searchQuery, statusFilter]);

  // Status counts
  const healthyCount = rawMaterials.filter(m => m.status === 'healthy').length;
  const lowCount = rawMaterials.filter(m => m.status === 'low_stock').length;
  const outCount = rawMaterials.filter(m => m.status === 'out_of_stock').length;

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Raw Material Stock
                </h3>
                <p className="text-xs text-slate-500">
                  Current quantity compared against minimum safety stock
                </p>
              </div>
            </div>

            <button
              onClick={() => setInternalView('raw_materials')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              <span>Manage Inventory</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search raw material..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 text-xs overflow-x-auto pb-0.5 scrollbar-none">
              {(
                [
                  { id: 'all', label: `All (${rawMaterials.length})` },
                  { id: 'low_stock', label: `Low (${lowCount})` },
                  { id: 'out_of_stock', label: `Out (${outCount})` },
                  { id: 'healthy', label: `Healthy (${healthyCount})` },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area with Horizontal Comparative Bars */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto max-h-[460px] space-y-4">
          {filteredMaterials.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
              <Boxes className="w-8 h-8 mb-2 opacity-50" />
              <span className="text-xs font-semibold text-slate-600">No raw materials found</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Use Raw Materials screen to record purchases or stock inwards.
              </p>
            </div>
          ) : (
            filteredMaterials.map(m => {
              // Scale bar proportionally to accommodate both current stock and min threshold
              const maxScale = Math.max(m.currentStock, m.minStockThreshold, 1) * 1.15;
              const currentPercent = Math.min(100, Math.max(0, (m.currentStock / maxScale) * 100));
              const thresholdPercent = Math.min(100, Math.max(0, (m.minStockThreshold / maxScale) * 100));

              let barColor = 'bg-emerald-500';
              let statusLabel = 'Healthy';
              if (m.status === 'out_of_stock') {
                barColor = 'bg-rose-500';
                statusLabel = 'Out of Stock';
              } else if (m.status === 'low_stock') {
                barColor = 'bg-amber-500';
                statusLabel = 'Low Stock';
              }

              const coveragePercent = m.minStockThreshold > 0
                ? Math.round((m.currentStock / m.minStockThreshold) * 100)
                : 100;

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMaterial(m)}
                  className="group bg-slate-50/60 hover:bg-blue-50/40 p-3 rounded-xl border border-slate-200/80 hover:border-blue-300 transition-all cursor-pointer relative"
                >
                  {/* Title & Status Badges */}
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                        {m.name}
                      </span>
                      <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.2 rounded font-medium shrink-0">
                        {m.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={m.status} label={statusLabel} size="sm" />
                    </div>
                  </div>

                  {/* Quantitative Comparison Header */}
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <div className="flex items-baseline gap-1 text-slate-700">
                      <span className="text-slate-400 text-[10px]">Current:</span>
                      <span className={`font-bold font-mono-numbers text-xs ${
                        m.status === 'out_of_stock'
                          ? 'text-rose-600'
                          : m.status === 'low_stock'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}>
                        {m.currentStock.toLocaleString()}
                      </span>
                      <span className="text-[10.5px] text-slate-500 font-normal">{m.unit}</span>
                    </div>

                    <div className="flex items-baseline gap-1 text-slate-500">
                      <span className="text-slate-400 text-[10px]">Safety Min:</span>
                      <span className="font-semibold font-mono-numbers text-slate-800 text-xs">
                        {m.minStockThreshold.toLocaleString()}
                      </span>
                      <span className="text-[10.5px] text-slate-500 font-normal">{m.unit}</span>
                    </div>
                  </div>

                  {/* Comparative Horizontal Bar with Safety Min Marker */}
                  <div className="relative h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                    {/* Current Stock Bar */}
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${currentPercent}%` }}
                    />

                    {/* Minimum Safety Stock Marker */}
                    {thresholdPercent > 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10 shadow-xs"
                        style={{ left: `${thresholdPercent}%` }}
                        title={`Safety threshold: ${m.minStockThreshold} ${m.unit}`}
                      />
                    )}
                  </div>

                  {/* Subtle Contextual Comparison Footer */}
                  <div className="flex items-center justify-between text-[10.5px] mt-1.5 text-slate-500">
                    <div>
                      {m.status === 'out_of_stock' ? (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-500" />
                          Zero balance • Critical purchase required
                        </span>
                      ) : m.status === 'low_stock' ? (
                        <span className="text-amber-600 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          Shortfall of {(m.minStockThreshold - m.currentStock).toLocaleString()} {m.unit} ({coveragePercent}% of safety)
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Adequate buffer (+{(m.currentStock - m.minStockThreshold).toLocaleString()} {m.unit} above safety)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Ledger</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detail Modal Drawer */}
      <RawMaterialDetailModal
        material={selectedMaterial}
        onClose={() => setSelectedMaterial(null)}
      />
    </>
  );
};
