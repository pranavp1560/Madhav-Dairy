import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useDairy } from '../../context/DairyContext';
import { DeliveryTrip } from '../../types/dairy';
import { deliveryService } from '../../services/deliveryService';
import { StatusBadge } from '../common/StatusBadge';
import {
  Truck,
  Download,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  MapPin,
  FileSpreadsheet,
  AlertCircle,
  Hash,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TripDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string | null;
  onTripCompleted?: () => void;
}

export const TripDetailsModal: React.FC<TripDetailsModalProps> = ({
  isOpen,
  onClose,
  tripId,
  onTripCompleted,
}) => {
  const { completeDeliveryTrip, addToast } = useDairy();

  const [trip, setTrip] = useState<DeliveryTrip | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Mark completed state
  const [isConfirmingComplete, setIsConfirmingComplete] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

  // Accordion expanded rows for invoice line items
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && tripId) {
      let isMounted = true;
      setIsLoading(true);
      setLoadError(null);
      setIsConfirmingComplete(false);

      deliveryService
        .fetchDeliveryTripDetails(tripId)
        .then((data) => {
          if (isMounted) setTrip(data);
        })
        .catch((err) => {
          if (isMounted) setLoadError(err.message || 'Failed to load trip details');
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });

      return () => {
        isMounted = false;
      };
    } else {
      setTrip(null);
    }
  }, [isOpen, tripId]);

  const toggleExpandInvoice = (invId: string) => {
    setExpandedInvoiceIds((prev) =>
      prev.includes(invId) ? prev.filter((id) => id !== invId) : [...prev, invId]
    );
  };

  const handleDownloadExcel = async () => {
    if (!trip) return;
    setIsDownloadingExcel(true);
    try {
      await deliveryService.generateDriverSheetExcel({
        tripNumber: trip.tripNumber,
        deliveryUnitName: trip.deliveryUnitName,
        vehicleNumber: trip.vehicleNumber,
        driverName: trip.driverName,
        outTime: trip.outTime,
        invoices: trip.invoices || [],
      });
      addToast('Driver Sheet (.xlsx) downloaded!', 'success');
    } catch (err: any) {
      addToast(`Download failed: ${err.message}`, 'error');
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const handleCompleteTrip = async () => {
    if (!trip) return;
    setIsCompleting(true);
    try {
      await completeDeliveryTrip(trip.id);
      setIsConfirmingComplete(false);
      // Reload trip details to show updated delivered state
      const reloaded = await deliveryService.fetchDeliveryTripDetails(trip.id);
      setTrip(reloaded);
      if (onTripCompleted) onTripCompleted();
    } catch (err: any) {
      addToast(`Completion failed: ${err.message}`, 'error');
    } finally {
      setIsCompleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={trip ? `Trip Details: ${trip.tripNumber}` : 'Delivery Trip Details'}
      subtitle={
        trip
          ? `Driver: ${trip.driverName} | Vehicle: ${trip.vehicleNumber} | Status: ${trip.status}`
          : 'Loading trip...'
      }
      maxWidth="2xl"
    >
      <div className="space-y-4 text-xs font-sans">
        {isLoading && (
          <div className="py-12 text-center text-slate-500">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p>Loading full trip details & line items...</p>
          </div>
        )}

        {loadError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {trip && !isLoading && (
          <>
            {/* Top Info Banner */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Trip / Chalan #</span>
                <span className="font-mono font-bold text-blue-700">{trip.tripNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Vehicle Number</span>
                <span className="font-mono font-bold text-slate-900 uppercase">{trip.vehicleNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Driver Name</span>
                <span className="font-semibold text-slate-900">{trip.driverName}</span>
                {trip.driverPhone && <span className="text-[10px] text-slate-500 block">{trip.driverPhone}</span>}
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Departure (Out Time)</span>
                <span className="font-mono-numbers text-slate-700">{trip.outTime || '—'}</span>
              </div>
            </div>

            {/* Timestamps & Status Strip */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-semibold">Status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    trip.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {trip.status}
                </span>
                {trip.completedAt && (
                  <span className="text-slate-500 text-[10px]">
                    Completed at: {new Date(trip.completedAt).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadExcel}
                  disabled={isDownloadingExcel}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded-lg font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{isDownloadingExcel ? 'Downloading...' : 'Download Driver Sheet (.xlsx)'}</span>
                </button>
              </div>
            </div>

            {/* Invoices List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                  Assigned Invoices ({trip.invoices?.length || 0})
                </span>
                <span className="font-mono-numbers font-bold text-emerald-700 text-xs">
                  Total Value: ₹{(trip.totalAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
                {(!trip.invoices || trip.invoices.length === 0) ? (
                  <div className="p-4 text-center text-slate-400">No invoices assigned to this trip.</div>
                ) : (
                  trip.invoices.map((inv) => {
                    const isExpanded = expandedInvoiceIds.includes(inv.id);

                    return (
                      <div key={inv.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                        <div
                          onClick={() => toggleExpandInvoice(inv.id)}
                          className="p-3 flex items-center justify-between cursor-pointer select-none"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</span>
                              <StatusBadge status={inv.status} type="invoice" size="sm" />
                            </div>
                            <div className="font-bold text-slate-800">{inv.retailerName}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{inv.retailerAddress}</span>
                            </div>
                          </div>

                          <div className="text-right flex items-center gap-3">
                            <div className="font-mono-numbers">
                              <div className="font-bold text-slate-900">₹{inv.totalAmount.toLocaleString('en-IN')}</div>
                              <div className="text-[10px] text-slate-500">{inv.items?.length || 0} line item(s)</div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Line Items Table */}
                        {isExpanded && inv.items && inv.items.length > 0 && (
                          <div className="px-3 pb-3 bg-slate-50/60 pt-1">
                            <table className="w-full text-left text-[11px] font-mono-numbers">
                              <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                                <tr>
                                  <th className="pb-1 font-sans">Product Item</th>
                                  <th className="pb-1 text-center">Quantity</th>
                                  <th className="pb-1 text-right">Rate</th>
                                  <th className="pb-1 text-right">Line Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {inv.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="py-1 font-sans text-slate-800">
                                      {item.productName} {item.packSize && `(${item.packSize})`}
                                    </td>
                                    <td className="py-1 text-center font-bold text-slate-900">
                                      {item.quantity} {item.unit}
                                    </td>
                                    <td className="py-1 text-right text-slate-600">₹{item.rate}</td>
                                    <td className="py-1 text-right font-bold text-slate-900">
                                      ₹{item.lineTotal.toLocaleString('en-IN')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Complete Trip Confirmation Box */}
            {isConfirmingComplete && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Confirm Trip Completion</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Marking trip <strong>{trip.tripNumber}</strong> as completed will update all{' '}
                  <strong>{trip.invoices?.length || 0} assigned invoices</strong> from <strong>Dispatched</strong> &rarr;{' '}
                  <strong>Delivered</strong>, and record your staff ID as completion author.
                </p>
                <div className="pt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingComplete(false)}
                    disabled={isCompleting}
                    className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCompleteTrip}
                    disabled={isCompleting}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition-colors"
                  >
                    {isCompleting ? 'Completing...' : 'Yes, Mark Trip Completed'}
                  </button>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                {trip.status === 'completed' ? (
                  <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Trip Completed & All Invoices Delivered</span>
                  </span>
                ) : !isConfirmingComplete ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingComplete(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark Trip Completed</span>
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
