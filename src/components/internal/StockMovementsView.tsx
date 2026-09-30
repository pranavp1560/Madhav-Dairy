import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { StatusBadge } from '../ui/StatusBadge';
import { MovementType } from '../../types/dairy';
import { Button } from '../ui/Button';
import { ArrowLeftRight, Search, Download, Layers } from 'lucide-react';

interface StockMovementsViewProps {
  onSelectBatch?: (id: string) => void;
}

export const StockMovementsView: React.FC<StockMovementsViewProps> = ({ onSelectBatch }) => {
  const { stockMovements, addToast } = useDairy();

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMovements = stockMovements.filter(m => {
    const matchesType = typeFilter === 'all' || m.type === typeFilter;
    const matchesSearch =
      m.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.fromLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.toLocation.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const filterTabs = [
    { id: 'all', label: 'All Movements' },
    { id: 'production', label: 'Production' },
    { id: 'sale', label: 'Sales Outward' },
    { id: 'reservation', label: 'Reservation' },
    { id: 'return', label: 'Customer Return' },
    { id: 'damage', label: 'Damage / Scrap' },
    { id: 'adjustment', label: 'Stock Adjustment' },
  ];

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900">Stock Movements Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable physical audit trail tracking production inward, sales dispatch, and returns
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="w-3.5 h-3.5" />}
          onClick={() => addToast('Exporting stock movements to CSV', 'info')}
        >
          Export Ledger
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Product, Batch, Reference, User..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {filterTabs.map(f => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              className={`text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                typeFilter === f.id
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Product Name</th>
                <th className="py-3 px-3">Batch No.</th>
                <th className="py-3 px-3 text-right">Quantity</th>
                <th className="py-3 px-3">Route / Location</th>
                <th className="py-3 px-3">Reference</th>
                <th className="py-3 px-4">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredMovements.map(m => (
                <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4 font-mono-numbers">
                    <span className="font-semibold text-slate-900 block">{m.date}</span>
                    <span className="text-[10px] text-slate-400">{m.time}</span>
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge
                      status={m.type}
                      label={m.type.replace('_', ' ')}
                      size="sm"
                    />
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900">{m.productName}</td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => onSelectBatch && onSelectBatch(m.batchNumber)}
                      className="font-mono-numbers text-blue-700 hover:text-blue-900 font-semibold underline underline-offset-2"
                    >
                      {m.batchNumber}
                    </button>
                  </td>
                  <td className={`py-3 px-3 text-right font-mono-numbers font-bold ${
                    m.quantity > 0 ? 'text-green-600' : 'text-rose-600'
                  }`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="py-3 px-3 text-slate-600 text-[11px]">
                    {m.fromLocation} &rarr; {m.toLocation}
                  </td>
                  <td className="py-3 px-3 font-mono-numbers font-medium text-slate-700">
                    {m.reference}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">{m.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
