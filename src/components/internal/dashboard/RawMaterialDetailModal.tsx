import React from 'react';
import { RawMaterial } from '../../../types/dairy';
import { useDairy } from '../../../context/DairyContext';
import { StatusBadge } from '../../ui/StatusBadge';
import { Drawer } from '../../ui/Drawer';
import { Button } from '../../ui/Button';
import {
  Boxes,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Building2,
  Tag,
  IndianRupee,
  Layers,
  ExternalLink
} from 'lucide-react';

interface RawMaterialDetailModalProps {
  material: RawMaterial | null;
  onClose: () => void;
}

export const RawMaterialDetailModal: React.FC<RawMaterialDetailModalProps> = ({
  material,
  onClose,
}) => {
  const { rawMaterialMovements, setInternalView } = useDairy();

  if (!material) return null;

  const movements = rawMaterialMovements
    .filter(m => m.materialId === material.id)
    .slice(0, 10);

  const stockPercent = material.minStockThreshold > 0
    ? Math.round((material.currentStock / material.minStockThreshold) * 100)
    : 100;

  return (
    <Drawer
      isOpen={Boolean(material)}
      onClose={onClose}
      title={`${material.name} - Stock Details`}
      subtitle={`Category: ${material.category} • Code: ${material.id.slice(0, 8)}`}
      width="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            onClick={() => {
              onClose();
              setInternalView('raw_materials');
            }}
          >
            Open in Raw Materials View
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-xs">
        {/* Top Summary Card */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              Stock Safety Health
            </span>
            <StatusBadge status={material.status} size="sm" />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[10.5px] text-slate-500 block">Current Balance</span>
              <p className="text-lg font-black text-slate-900 font-mono-numbers mt-0.5">
                {material.currentStock.toLocaleString()} <span className="text-xs font-normal text-slate-400">{material.unit}</span>
              </p>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[10.5px] text-slate-500 block">Safety Min Threshold</span>
              <p className="text-lg font-black text-slate-700 font-mono-numbers mt-0.5">
                {material.minStockThreshold.toLocaleString()} <span className="text-xs font-normal text-slate-400">{material.unit}</span>
              </p>
            </div>
          </div>

          {/* Safety Gauge Bar */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-600 font-medium">Safety Coverage</span>
              <span
                className={`font-bold font-mono-numbers ${
                  material.status === 'out_of_stock'
                    ? 'text-rose-600'
                    : material.status === 'low_stock'
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {stockPercent}% of Minimum
              </span>
            </div>
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  material.status === 'out_of_stock'
                    ? 'bg-rose-500'
                    : material.status === 'low_stock'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, stockPercent))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Material Specification details */}
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          <div className="p-3 flex items-center justify-between">
            <span className="text-slate-500">Unit of Measurement</span>
            <span className="font-semibold text-slate-900">{material.unit}</span>
          </div>
          <div className="p-3 flex items-center justify-between">
            <span className="text-slate-500">Cost Per Unit</span>
            <span className="font-semibold text-slate-900 font-mono-numbers">₹{material.costPerUnit}</span>
          </div>
          <div className="p-3 flex items-center justify-between">
            <span className="text-slate-500">Default Supplier</span>
            <span className="font-semibold text-slate-900">{material.supplier || 'Standard Dairy Society'}</span>
          </div>
          <div className="p-3 flex items-center justify-between">
            <span className="text-slate-500">Last Stock Audit Date</span>
            <span className="font-semibold text-slate-900">{material.lastRestockedDate || 'Recent'}</span>
          </div>
        </div>

        {/* Recent Ledger Transactions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Recent Inventory Transactions</span>
            </h4>
            <span className="text-[11px] text-slate-400">Latest 10 logs</span>
          </div>

          {movements.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
              No recent movements logged for this material
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10.5px] text-slate-500 uppercase font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {movements.map(m => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-slate-500 text-[11px] font-mono-numbers">
                          {m.date}
                        </td>
                        <td className="py-2 px-3 capitalize">
                          <span className="inline-flex items-center gap-1">
                            {isPositive ? (
                              <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 text-amber-600" />
                            )}
                            <span className="text-[11px] font-medium text-slate-800">
                              {m.type.replace(/_/g, ' ')}
                            </span>
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-right font-mono-numbers font-bold ${
                          isPositive ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {isPositive ? `+${m.quantity}` : m.quantity} {m.unit}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-[120px]">
                          {m.reference}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};
