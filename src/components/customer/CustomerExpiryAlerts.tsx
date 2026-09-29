import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { ExpiryAlertItem } from '../../types/dairy';
import { AlertTriangle, Clock, Calendar, ShieldAlert, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';

export const CustomerExpiryAlerts: React.FC = () => {
  const { expiryAlerts, currentRetailer, addToast } = useDairy();
  const [selectedAlert, setSelectedAlert] = useState<ExpiryAlertItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const retailerAlerts = expiryAlerts.filter(
    a => a.retailerId === currentRetailer.id || (!a.retailerId && a.location === 'warehouse' && a.daysRemaining <= 5)
  );

  const filtered = retailerAlerts.filter(a => {
    if (activeFilter === 'all') return true;
    return a.severity === activeFilter;
  });

  const handleRequestPickup = (batchNumber: string) => {
    setSelectedAlert(null);
    addToast(`Pickup / Return request logged for batch ${batchNumber}. Dairy cold-logistics notified.`, 'info');
  };

  const handleClearanceOffer = (batchNumber: string) => {
    setSelectedAlert(null);
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
              <span>Smart Expiry Surveillance</span>
            </div>
            <h1 className="text-base font-extrabold text-slate-900 mt-1">
              Store Expiry Alerts
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated batch tracking to prevent dairy wastage at your retail shelves.
            </p>
          </div>
          <span className="text-xs font-bold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-300">
            {retailerAlerts.length} Alerts
          </span>
        </div>

        {/* Severity Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          {[
            { id: 'all', label: 'All Alerts' },
            { id: 'urgent', label: '🔴 Urgent (≤3d)' },
            { id: 'soon', label: '🟠 Soon (≤5d)' },
            { id: 'upcoming', label: '🟡 Upcoming (≤7d)' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`text-xs px-3 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all ${
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
        {filtered.map(alert => {
          const isUrgent = alert.severity === 'urgent';
          const isSoon = alert.severity === 'soon';

          return (
            <div
              key={alert.id}
              className={`bg-white rounded-2xl border p-4 shadow-subtle transition-all space-y-3 ${
                isUrgent
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
                      {alert.productName}
                    </h3>
                    <StatusBadge status={alert.severity} type="expiry" size="sm" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="font-mono-numbers font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                      Batch: {alert.batchNumber}
                    </span>
                    <span>•</span>
                    <span>Qty: <strong>{alert.quantity} units</strong></span>
                  </div>
                </div>

                {/* Days remaining badge */}
                <div className="text-right">
                  <div
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg font-mono-numbers ${
                      alert.daysRemaining <= 2
                        ? 'bg-red-100 text-red-800'
                        : alert.daysRemaining <= 5
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-yellow-100 text-yellow-900'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{alert.daysRemaining > 0 ? `${alert.daysRemaining} days left` : 'Expired'}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Exp: {alert.expiryDate}
                  </p>
                </div>
              </div>

              {/* Progress Shelf Life Bar */}
              <div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      alert.daysRemaining <= 2
                        ? 'bg-red-500 w-1/6'
                        : alert.daysRemaining <= 5
                        ? 'bg-amber-500 w-1/3'
                        : 'bg-yellow-500 w-2/3'
                    }`}
                  ></div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <button
                  onClick={() => setSelectedAlert(alert)}
                  className="text-xs font-bold text-slate-700 hover:text-blue-600 flex items-center gap-1"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRequestPickup(alert.batchNumber)}
                    className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors"
                  >
                    Return Pickup
                  </button>
                  <button
                    onClick={() => handleClearanceOffer(alert.batchNumber)}
                    className="px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs"
                  >
                    Discount Offer
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            All your store stock is currently fresh with ample shelf life.
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedAlert && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAlert(null)}
          title={`Expiry Traceability: ${selectedAlert.productName}`}
          subtitle={`Batch Code: ${selectedAlert.batchNumber}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Stock Location:</span>
                <span className="font-bold text-slate-800 capitalize">
                  {selectedAlert.location} ({currentRetailer.businessName})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Production Date:</span>
                <span className="font-semibold text-slate-800">{selectedAlert.productionDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expiry Date:</span>
                <span className="font-bold text-red-700">{selectedAlert.expiryDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Units in Store:</span>
                <span className="font-bold text-slate-900">{selectedAlert.quantity} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Days Remaining:</span>
                <span className="font-extrabold text-amber-700 font-mono-numbers">
                  {selectedAlert.daysRemaining} days remaining
                </span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-blue-950 text-xs">
              <p className="font-bold mb-1">Madhav Dairy Freshness Guarantee:</p>
              <p className="text-[11px] text-blue-900 leading-relaxed">
                Products within 2 days of expiry are eligible for refrigerated reverse logistics pickup or a 15% markdown credit note.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleRequestPickup(selectedAlert.batchNumber)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-colors"
              >
                Schedule Return Pickup
              </button>
              <button
                onClick={() => handleClearanceOffer(selectedAlert.batchNumber)}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-xs"
              >
                Apply Clearance Offer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
