import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { StatusBadge } from '../ui/StatusBadge';
import { RawMaterialsView } from './RawMaterialsView';
import { StockMovementsView } from './StockMovementsView';
import {
  Boxes,
  Package,
  ScrollText,
  Search,
  ChevronDown,
  Layers,
  AlertTriangle
} from 'lucide-react';

interface InventoryViewProps {
  onSelectBatch: (id: string) => void;
  initialTab?: 'finished' | 'raw' | 'movements';
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  onSelectBatch,
  initialTab = 'finished',
}) => {
  const { products, batches } = useDairy();

  const [activeTab, setActiveTab] = useState<'finished' | 'raw' | 'movements'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // Finished Goods Calculations
  const totalAvailableQty = batches.reduce((acc, b) => acc + b.availableQty, 0);
  const totalReservedQty = batches.reduce((acc, b) => acc + (b.items?.reduce((s, i) => s + i.reservedQty, 0) || 0), 0);
  const nearExpiryCount = batches.filter(b => b.status === 'near_expiry').length;

  const filteredBatches = batches.filter(b => {
    return b.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           b.batchNumber.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* Top Tab Sub-Navigation (Section 13) */}
      <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1">
        <button
          onClick={() => setActiveTab('finished')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'finished'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Finished Goods</span>
        </button>

        <button
          onClick={() => setActiveTab('raw')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'raw'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Raw Materials</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'movements'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ScrollText className="w-4 h-4" />
          <span>Stock Movements</span>
        </button>
      </div>

      {/* Render selected sub-module */}
      {activeTab === 'raw' && <RawMaterialsView />}
      {activeTab === 'movements' && <StockMovementsView onSelectBatch={onSelectBatch} />}

      {activeTab === 'finished' && (
        <div className="space-y-4">
          {/* Header & Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-medium text-slate-500 block">Total Available In Stock</span>
              <p className="text-xl font-bold text-slate-900 font-mono-numbers mt-1">
                {totalAvailableQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">units</span>
              </p>
              <span className="text-[10px] text-blue-600 font-medium">Refrigerated warehouse</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-medium text-slate-500 block">Reserved For Dispatch</span>
              <p className="text-xl font-bold text-slate-900 font-mono-numbers mt-1">
                {totalReservedQty.toLocaleString()} <span className="text-xs font-normal text-slate-400">units</span>
              </p>
              <span className="text-[10px] text-slate-500 font-medium">Locked against retailer orders</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
              <span className="text-[11px] font-medium text-slate-500 block">Near Expiry Batches</span>
              <p className="text-xl font-bold text-amber-700 font-mono-numbers mt-1">
                {nearExpiryCount} <span className="text-xs font-normal text-slate-400">batches</span>
              </p>
              <span className="text-[10px] text-amber-600 font-medium">Within 5-day dispatch horizon</span>
            </div>
          </div>

          {/* Search bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search finished stock by product or batch..."
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Finished Goods Table (Section 14) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-3">Batch Number</th>
                    <th className="py-3 px-3">Expiry Date</th>
                    <th className="py-3 px-3 text-right">Available Qty</th>
                    <th className="py-3 px-3 text-right">Reserved Qty</th>
                    <th className="py-3 px-3">Stock Status</th>
                    <th className="py-3 px-4 text-right">Batch Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredBatches.map(b => {
                    const statusLabel = 
                      b.status === 'active' ? 'Healthy' :
                      b.status === 'near_expiry' ? 'Expiring Soon' :
                      b.status === 'expired' ? 'Expired' : 'Out of Stock';

                    return (
                      <tr key={b.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {b.productName}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono-numbers font-semibold text-blue-700">
                            {b.batchNumber}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono-numbers text-slate-600">
                          {b.expiryDate}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-numbers font-bold text-slate-900">
                          {b.availableQty.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{b.unit}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono-numbers text-slate-500">
                          {Math.round(b.producedQty * 0.15)} {b.unit}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge
                            status={b.status}
                            label={statusLabel}
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onSelectBatch(b.id)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-medium text-xs transition-colors"
                          >
                            Trace Batch &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
