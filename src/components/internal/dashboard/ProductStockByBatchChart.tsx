import React, { useState, useMemo } from 'react';
import { useDairy } from '../../../context/DairyContext';
import { calculateDaysRemaining, formatCalendarDate } from '../../../utils/dateUtils';
import { StatusBadge } from '../../ui/StatusBadge';
import {
  Package,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  Info
} from 'lucide-react';

interface ProductStockByBatchChartProps {
  onSelectBatch: (batchId: string) => void;
}

export const ProductStockByBatchChart: React.FC<ProductStockByBatchChartProps> = ({
  onSelectBatch,
}) => {
  const { batches, setInternalView } = useDairy();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'urgent' | '30days' | 'active' | 'expired'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Hovered item for custom tooltip
  const [hoveredBatchId, setHoveredBatchId] = useState<string | null>(null);

  // Authoritative remaining stock per product + batch
  const filteredBatches = useMemo(() => {
    return batches
      .filter(b => {
        // Authoritative remaining stock: only include if availableQty > 0 or status is active/near_expiry
        if (b.availableQty <= 0 && b.status === 'exhausted') return false;

        // Search match
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = b.productName.toLowerCase().includes(q);
          const matchBatch = b.batchNumber.toLowerCase().includes(q);
          if (!matchName && !matchBatch) return false;
        }

        // Expiry filter
        const days = calculateDaysRemaining(b.expiryDate);
        if (expiryFilter === 'urgent') {
          return days >= 0 && days <= 7;
        }
        if (expiryFilter === '30days') {
          return days >= 0 && days <= 30;
        }
        if (expiryFilter === 'active') {
          return b.status === 'active' && days > 7;
        }
        if (expiryFilter === 'expired') {
          return days < 0 || b.status === 'expired';
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by expiry date ascending (urgent first)
        const daysA = calculateDaysRemaining(a.expiryDate);
        const daysB = calculateDaysRemaining(b.expiryDate);
        return daysA - daysB;
      });
  }, [batches, searchQuery, expiryFilter]);

  // Max quantity for horizontal bar proportion calculation
  const maxStock = useMemo(() => {
    const max = Math.max(...filteredBatches.map(b => b.availableQty), 1);
    return Math.max(max, 100);
  }, [filteredBatches]);

  // Pagination slice
  const totalPages = Math.ceil(filteredBatches.length / pageSize) || 1;
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBatches.slice(start, start + pageSize);
  }, [filteredBatches, currentPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Product Stock by Batch
              </h3>
              <p className="text-xs text-slate-500">
                Authoritative on-hand quantity per product and batch
              </p>
            </div>
          </div>

          <button
            onClick={() => setInternalView('inventory')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
          >
            <span>Stock Ledger</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {/* Search & Expiry Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter product or batch #..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 text-xs overflow-x-auto pb-0.5 scrollbar-none">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'urgent', label: 'Expiring ≤ 7d' },
                { id: '30days', label: '≤ 30d' },
                { id: 'active', label: 'Healthy' },
                { id: 'expired', label: 'Expired' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setExpiryFilter(tab.id);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  expiryFilter === tab.id
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

      {/* Horizontal Bar Chart Container */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        {paginatedBatches.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
            <Package className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs font-semibold text-slate-600">No batch records match filter</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Try clearing your search query or selecting 'All'</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {paginatedBatches.map(batch => {
              const daysRemaining = calculateDaysRemaining(batch.expiryDate);
              const percentage = Math.min(100, Math.max(4, (batch.availableQty / maxStock) * 100));

              // Determine bar tone based on expiry urgency
              let barColor = 'bg-blue-600 hover:bg-blue-700';
              let badgeStatus = batch.status;

              if (daysRemaining < 0) {
                barColor = 'bg-rose-500 hover:bg-rose-600';
                badgeStatus = 'expired' as any;
              } else if (daysRemaining <= 3) {
                barColor = 'bg-rose-500 hover:bg-rose-600';
                badgeStatus = 'near_expiry';
              } else if (daysRemaining <= 7) {
                barColor = 'bg-amber-500 hover:bg-amber-600';
                badgeStatus = 'near_expiry';
              }

              const isHovered = hoveredBatchId === batch.id;

              return (
                <div
                  key={batch.id}
                  className="group relative cursor-pointer"
                  onClick={() => onSelectBatch(batch.id)}
                  onMouseEnter={() => setHoveredBatchId(batch.id)}
                  onMouseLeave={() => setHoveredBatchId(null)}
                >
                  {/* Row Top Details */}
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-1.5 min-w-0 pr-2">
                      <span className="font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {batch.productName}
                      </span>
                      <span className="font-mono text-[10.5px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded shrink-0">
                        {batch.batchNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-slate-900 font-mono-numbers">
                        {batch.availableQty.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        {batch.unit}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar Track */}
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {/* Subtitle with Expiry and Days Remaining */}
                  <div className="flex items-center justify-between text-[10.5px] text-slate-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                      Expires: {formatCalendarDate(batch.expiryDate)}
                    </span>
                    <span
                      className={`font-medium ${
                        daysRemaining < 0
                          ? 'text-rose-600 font-bold'
                          : daysRemaining <= 7
                          ? 'text-amber-600 font-semibold'
                          : 'text-slate-500'
                      }`}
                    >
                      {daysRemaining < 0
                        ? 'Expired'
                        : daysRemaining === 0
                        ? 'Expires Today'
                        : `${daysRemaining} days left`}
                    </span>
                  </div>

                  {/* Hover Tooltip Overlay */}
                  {isHovered && (
                    <div className="absolute left-1/2 -top-12 -translate-x-1/2 z-30 pointer-events-none shadow-lg bg-slate-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap border border-slate-700 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{batch.productName}</span>
                        <span className="text-blue-300 font-mono">[{batch.batchNumber}]</span>
                        <span className="text-emerald-400 font-mono-numbers font-bold">
                          {batch.availableQty} {batch.unit}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 flex items-center justify-between gap-3 mt-0.5">
                        <span>Expiry: {formatCalendarDate(batch.expiryDate)}</span>
                        <span className="text-amber-300 font-medium">Click to view details</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer with Pagination */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {filteredBatches.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-
            {Math.min(currentPage * pageSize, filteredBatches.length)} of {filteredBatches.length} batches
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] font-semibold text-slate-700 font-mono-numbers">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
