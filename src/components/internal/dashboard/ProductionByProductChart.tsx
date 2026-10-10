import React, { useState } from 'react';
import { Factory, ArrowUpRight } from 'lucide-react';
import { formatCompactNumber } from './dashboardUtils';

export interface ProductProductionItem {
  productId: string;
  productName: string;
  producedQty: number;
  unit: string;
  batchCount: number;
}

interface ProductionByProductChartProps {
  products: ProductProductionItem[];
  totalQuantity: number;
  onNavigateToProduction: () => void;
}

export const ProductionByProductChart: React.FC<ProductionByProductChartProps> = ({
  products,
  totalQuantity,
  onNavigateToProduction,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const maxQty = Math.max(...products.map(p => p.producedQty), 1);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Production Output by Product
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Volume manufactured in period across dairy SKUs
          </p>
        </div>
        <button
          onClick={onNavigateToProduction}
          className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 transition-colors"
        >
          <span>View Runs</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {products.length === 0 || totalQuantity === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
          No manufacturing runs logged for this date range.
        </div>
      ) : (
        <div className="space-y-3 my-1 overflow-y-auto max-h-56 pr-1 scrollbar-thin">
          {products.map(prod => {
            const percentOfMax = Math.round((prod.producedQty / maxQty) * 100);
            const percentOfTotal = totalQuantity > 0 ? Math.round((prod.producedQty / totalQuantity) * 100) : 0;
            const isHovered = hoveredId === prod.productId;

            return (
              <div
                key={prod.productId}
                onMouseEnter={() => setHoveredId(prod.productId)}
                onMouseLeave={() => setHoveredId(null)}
                className={`p-2 rounded-xl transition-all cursor-default ${
                  isHovered ? 'bg-slate-50' : ''
                }`}
              >
                {/* Product Name & Quantity */}
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2 truncate max-w-[65%]">
                    <span className="font-semibold text-slate-800 truncate">
                      {prod.productName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono-numbers bg-slate-100 px-1.5 py-0.2 rounded">
                      {prod.batchCount} batch{prod.batchCount !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <div className="text-right font-mono-numbers">
                    <span className="font-bold text-slate-900">
                      {formatCompactNumber(prod.producedQty)}
                    </span>{' '}
                    <span className="text-[10px] text-slate-400 font-normal">
                      {prod.unit}
                    </span>
                    <span className="text-[10px] text-teal-600 font-semibold ml-1.5">
                      ({percentOfTotal}%)
                    </span>
                  </div>
                </div>

                {/* Horizontal Progress Bar */}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-teal-500 to-emerald-500"
                    style={{ width: `${percentOfMax}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="pt-2.5 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Cumulative manufactured: <strong className="font-mono-numbers text-slate-800">{formatCompactNumber(totalQuantity)} units</strong></span>
        <span className="text-teal-700 font-semibold">{products.length} Products active</span>
      </div>
    </div>
  );
};
