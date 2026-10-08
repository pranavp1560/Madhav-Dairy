import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { CustomerProductBatch } from '../../types/dairy';
import { AlertTriangle, Clock, Calendar, ShieldAlert, ArrowRight, CheckCircle2, RefreshCw, Package } from 'lucide-react';
import { formatCalendarDate } from '../../utils/dateUtils';

interface CustomerExpiryAlertsProps {
  onNavigate?: (tab: string) => void;
}

export const CustomerExpiryAlerts: React.FC<CustomerExpiryAlertsProps> = ({ onNavigate }) => {
  const { customerExpiryTracking, currentRetailer, addToast } = useDairy();
  const [selectedItem, setSelectedItem] = useState<CustomerProductBatch | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Customer expiry tracking strictly scoped to current retailer
  const retailerBatches = customerExpiryTracking.filter(
    b => (currentRetailer ? b.customerId === currentRetailer.id : true) && b.isCurrent
  );

  const filtered = retailerBatches.filter(b => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'expired') return b.daysRemaining < 0;
    if (activeFilter === 'urgent') return b.daysRemaining >= 0 && b.daysRemaining <= 3;
    if (activeFilter === 'soon') return b.daysRemaining > 3 && b.daysRemaining <= 5;
    if (activeFilter === 'upcoming') return b.daysRemaining > 5 && b.daysRemaining <= 10;
    return true;
  });

  const handleRequestPickup = (batchNumber: string) => {
    setSelectedItem(null);
    addToast(`Pickup / Return request logged for batch ${batchNumber}. Cold-logistics notified.`, 'info');
  };

  const handleClearanceOffer = (batchNumber: string) => {
    setSelectedItem(null);
    addToast(`15% Clearance discount applied to batch ${batchNumber} in your store app!`, 'success');
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Smart Freshness Surveillance</span>
            </div>
            <h1 className="text-base font-extrabold text-slate-900 mt-1">
              Store Shelf Expiry Tracking
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated batch tracking on products delivered to your retail store shelves.
            </p>
          </div>
          <span className="text-xs font-bold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-300">
            {retailerBatches.length} Batches Tracked
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar text-xs">
          {[
            { id: 'all', label: 'All Products' },
            { id: 'urgent', label: '🔴 Urgent (≤3d)' },
            { id: 'soon', label: '🟠 Soon (≤5d)' },
            { id: 'upcoming', label: '🟡 Upcoming (≤10d)' },
            { id: 'expired', label: '⚪ Expired' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all ${
                activeFilter === f.id
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filtered.map(item => {
          const isExpired = item.daysRemaining < 0;
          const isUrgent = item.daysRemaining >= 0 && item.daysRemaining <= 3;
          const isSoon = item.daysRemaining > 3 && item.daysRemaining <= 5;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border p-4 shadow-subtle transition-all space-y-3 ${
                isExpired
                  ? 'border-slate-300 bg-slate-50/50'
                  : isUrgent
                  ? 'border-red-200 bg-gradient-to-r from-white to-red-50/40'
                  : isSoon
                  ? 'border-amber-200 bg-gradient-to-r from-white to-amber-50/30'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {item.productName}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isExpired
                        ? 'bg-slate-200 text-slate-800'
                        : isUrgent
                        ? 'bg-red-100 text-red-800'
                        : isSoon
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {isExpired ? 'Expired' : item.daysRemaining === 0 ? 'Today' : `${item.daysRemaining} days left`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <span>Batch: <strong className="font-mono-numbers text-slate-800">{item.batchNumber}</strong></span>
                    <span>&bull;</span>
                    <span>Store Stock: <strong className="font-mono-numbers text-slate-900">{item.quantityRemaining} units</strong></span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-lg font-black font-mono-numbers block ${
                    isExpired ? 'text-slate-500' : isUrgent ? 'text-rose-600' : 'text-amber-600'
                  }`}>
                    {isExpired ? 'EXPIRED' : `${item.daysRemaining}d`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Expiry: {formatCalendarDate(item.expiryDate)}
                  </span>
                </div>
              </div>

              {/* Delivery traceability info */}
              <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-[11px] text-slate-600 border border-slate-100">
                <span className="flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                  <span>Delivered on: <strong>{formatCalendarDate(item.deliveredAt)}</strong></span>
                </span>
                {item.invoiceNumber && (
                  <span className="text-slate-500">Invoice: {item.invoiceNumber}</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => setSelectedItem(item)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>Action Options</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
            <p className="text-xs font-semibold text-slate-700">All retail stock fresh!</p>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              No products delivered to your store are approaching expiry within the selected filter range.
            </p>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {selectedItem && (
        <Modal
          isOpen={Boolean(selectedItem)}
          onClose={() => setSelectedItem(null)}
          title={`Freshness Action — ${selectedItem.productName}`}
          subtitle={`Batch: ${selectedItem.batchNumber} &bull; Expiry: ${formatCalendarDate(selectedItem.expiryDate)}`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
              <span className="font-bold block">Shelf Clearance Advisory</span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                This batch has <strong>{selectedItem.daysRemaining} days</strong> remaining. Take proactive steps to prevent unsold inventory wastage.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleClearanceOffer(selectedItem.batchNumber)}
                className="w-full p-3 bg-white border border-slate-200 hover:border-blue-400 rounded-xl text-left flex items-center justify-between group transition-all"
              >
                <div>
                  <span className="font-bold text-slate-900 block">Apply Clearance Discount</span>
                  <span className="text-[11px] text-slate-500">Run an instant 15% promotional discount on store billing</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </button>

              <button
                onClick={() => handleRequestPickup(selectedItem.batchNumber)}
                className="w-full p-3 bg-white border border-slate-200 hover:border-amber-400 rounded-xl text-left flex items-center justify-between group transition-all"
              >
                <div>
                  <span className="font-bold text-slate-900 block">Log Return / Pickup Request</span>
                  <span className="text-[11px] text-slate-500">Notify dairy cold-logistics team for stock replenishment</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
              </button>

              {onNavigate && (
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    onNavigate('products');
                  }}
                  className="w-full p-3 bg-blue-50 border border-blue-200 hover:border-blue-400 rounded-xl text-left flex items-center justify-between group transition-all"
                >
                  <div>
                    <span className="font-bold text-blue-900 block">Order Fresh Replenishment Batch</span>
                    <span className="text-[11px] text-blue-700">Browse catalogue to order fresh inventory now</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
