import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import {
  Factory,
  Plus,
  Search,
  Filter,
  Layers,
  Calendar,
  Eye,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface ProductionViewProps {
  onOpenCreateBatch: () => void;
  onSelectBatch: (id: string) => void;
}

export const ProductionView: React.FC<ProductionViewProps> = ({
  onOpenCreateBatch,
  onSelectBatch,
}) => {
  const { batches, products } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const filteredBatches = batches.filter(b => {
    const matchesSearch =
      b.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.productName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProduct = selectedProduct === 'all' || b.productId === selectedProduct;
    const matchesStatus = selectedStatus === 'all' || b.status === selectedStatus;
    return matchesSearch && matchesProduct && matchesStatus;
  });

  const totalUnitsProduced = batches.reduce((acc, b) => acc + b.producedQty, 0);
  const totalAvailableStock = batches.reduce((acc, b) => acc + b.availableQty, 0);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900">Dairy Production & Batches</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every production run creates an immutable batch code linking lot, packaging, and shelf expiry
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={onOpenCreateBatch}
        >
          + Log Production Run
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 block">Total Active Batches</span>
          <p className="text-xl font-bold text-slate-900 font-mono-numbers mt-1">{batches.length}</p>
          <span className="text-[10px] text-blue-600 font-medium">Traceable lifecycle</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 block">Total Units Manufactured</span>
          <p className="text-xl font-bold text-slate-900 font-mono-numbers mt-1">
            {totalUnitsProduced.toLocaleString()}
          </p>
          <span className="text-[10px] text-blue-600 font-medium">Recorded in production log</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 block">Current Cold Room Stock</span>
          <p className="text-xl font-bold text-slate-900 font-mono-numbers mt-1">
            {totalAvailableStock.toLocaleString()}
          </p>
          <span className="text-[10px] text-blue-600 font-medium">Available for retailer dispatch</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Batch code or Product name..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedProduct}
            onChange={e => setSelectedProduct(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="all">All Products</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="near_expiry">Near Expiry</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Production List Table (Section 11) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-3">Product Name</th>
                <th className="py-3 px-3">Production Date</th>
                <th className="py-3 px-3">Expiry Date</th>
                <th className="py-3 px-3 text-right">Produced</th>
                <th className="py-3 px-3 text-right">Available</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredBatches.map(b => (
                <tr key={b.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-mono-numbers font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {b.batchNumber}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900">{b.productName}</td>
                  <td className="py-3 px-3 font-mono-numbers text-slate-600">{b.productionDate}</td>
                  <td className="py-3 px-3 font-mono-numbers text-slate-600">{b.expiryDate}</td>
                  <td className="py-3 px-3 text-right font-mono-numbers font-medium text-slate-700">
                    {b.producedQty.toLocaleString()} <span className="text-[10px] text-slate-400">{b.unit}</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono-numbers font-bold text-slate-900">
                    {b.availableQty.toLocaleString()} <span className="text-[10px] text-slate-400">{b.unit}</span>
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={b.status} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onSelectBatch(b.id)}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-medium text-xs transition-colors inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Trace</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
