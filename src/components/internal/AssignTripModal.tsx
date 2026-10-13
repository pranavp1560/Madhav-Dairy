import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useDairy } from '../../context/DairyContext';
import { Invoice, DeliveryUnit } from '../../types/dairy';
import { deliveryService } from '../../services/deliveryService';
import {
  Truck,
  Hash,
  User,
  Clock,
  Download,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Calendar,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

interface AssignTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedInvoices: Invoice[];
  onAssignmentSuccess: () => void;
}

export const AssignTripModal: React.FC<AssignTripModalProps> = ({
  isOpen,
  onClose,
  selectedInvoices,
  onAssignmentSuccess,
}) => {
  const { deliveryUnits, assignDeliveryTrip, addToast } = useDairy();

  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [outTime, setOutTime] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter to only active units
  const activeUnits = deliveryUnits.filter((u) => u.isActive);

  // Set default selected unit on open
  useEffect(() => {
    if (activeUnits.length > 0 && !selectedUnitId) {
      setSelectedUnitId(activeUnits[0].id);
      setOutTime(activeUnits[0].outTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, [activeUnits, isOpen]);

  // When selected unit changes, sync default departure time
  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId);
    const unit = deliveryUnits.find((u) => u.id === unitId);
    if (unit?.outTime) {
      setOutTime(unit.outTime);
    }
  };

  const selectedUnit = deliveryUnits.find((u) => u.id === selectedUnitId);

  // Invoices summary metrics
  const totalAmount = selectedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const uniqueRetailers = Array.from(new Set(selectedInvoices.map((inv) => inv.retailerName)));
  const totalItemsCount = selectedInvoices.reduce(
    (sum, inv) => sum + (inv.items?.reduce((iSum, it) => iSum + it.quantity, 0) || 0),
    0
  );

  // Ineligibility check
  const ineligibleInvoices = selectedInvoices.filter((i) => i.status !== 'ready');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (ineligibleInvoices.length > 0) {
      setErrorMessage(
        `Cannot assign trip: ${ineligibleInvoices.length} invoice(s) are not in 'Ready' status (${ineligibleInvoices
          .map((i) => i.invoiceNumber)
          .join(', ')}). Only Ready invoices can be assigned to trips.`
      );
      return;
    }

    if (!selectedUnitId) {
      setErrorMessage('Please select a valid delivery unit.');
      return;
    }

    if (!selectedUnit) {
      setErrorMessage('Selected delivery unit not found.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Atomically assign trip in database
      const tripResult = await assignDeliveryTrip({
        deliveryUnitId: selectedUnitId,
        invoiceIds: selectedInvoices.map((i) => i.id),
        outTime: outTime.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      // 2. Fetch full trip details and generate real .xlsx Excel Driver Sheet
      try {
        const fullTrip = await deliveryService.fetchDeliveryTripDetails(tripResult.trip_id);
        await deliveryService.generateDriverSheetExcel({
          tripNumber: fullTrip.tripNumber,
          deliveryUnitName: fullTrip.deliveryUnitName,
          vehicleNumber: fullTrip.vehicleNumber,
          driverName: fullTrip.driverName,
          outTime: fullTrip.outTime,
          invoices: fullTrip.invoices || [],
        });
        addToast('Driver Sheet (.xlsx) downloaded successfully!', 'success');
      } catch (excelErr: any) {
        console.error('Excel generation error:', excelErr);
        addToast(
          'Trip assigned successfully, but automatic Excel download failed. You can re-download it from Driver Management at any time.',
          'warning'
        );
      }

      onAssignmentSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to assign delivery trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Driver Sheet & Assign Delivery Trip"
      subtitle={`Assign ${selectedInvoices.length} ready invoice(s) to a dedicated delivery unit`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="text-xs leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Selected Invoices Summary Banner */}
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">
              Selected Invoices Summary
            </span>
            <span className="text-xs font-bold text-blue-700 font-mono-numbers">
              {selectedInvoices.length} Invoices Selected
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono-numbers text-center bg-white p-2.5 rounded-lg border border-blue-100">
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Total Retailers</span>
              <span className="font-bold text-slate-900 text-xs">{uniqueRetailers.length} Stores</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Total Product Units</span>
              <span className="font-bold text-slate-900 text-xs">{totalItemsCount} Units</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Total Invoiced Amount</span>
              <span className="font-bold text-emerald-700 text-xs">₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-600 flex flex-wrap gap-1 items-center pt-1">
            <span className="font-semibold text-slate-700">Retailers:</span>
            {uniqueRetailers.slice(0, 4).map((r, i) => (
              <span key={i} className="bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                {r}
              </span>
            ))}
            {uniqueRetailers.length > 4 && (
              <span className="text-slate-500 text-[10px]">+{uniqueRetailers.length - 4} more</span>
            )}
          </div>
        </div>

        {/* Delivery Unit Dropdown & Details */}
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Delivery Unit <span className="text-rose-500">*</span>
            </label>
            {activeUnits.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">No active delivery units available</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Please go to Delivery Units management and register an active delivery vehicle and driver first.
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Truck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  required
                  value={selectedUnitId}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="" disabled>
                    -- Choose Active Delivery Unit --
                  </option>
                  {activeUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.vehicleNumber} ({u.driverName})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Unit Details Preview Cards */}
          {selectedUnit && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Chalan #</span>
                <span className="font-mono font-bold text-blue-700">{selectedUnit.chalanNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Vehicle #</span>
                <span className="font-mono font-bold text-slate-900 uppercase">{selectedUnit.vehicleNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Driver Name</span>
                <span className="font-semibold text-slate-900">{selectedUnit.driverName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Driver Phone</span>
                <span className="font-mono text-slate-700">{selectedUnit.driverPhone || '—'}</span>
              </div>
            </div>
          )}

          {/* Out Time & Trip Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Departure Time (Out Time)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={outTime}
                  onChange={(e) => setOutTime(e.target.value)}
                  placeholder="e.g. 06:00 AM or 14:30"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Trip Dispatch Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Morning delivery route with cold packs"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Workflow Info notice */}
        <div className="p-3 bg-amber-50/70 border border-amber-200 text-amber-800 rounded-xl text-[11px] flex items-start gap-2">
          <FileSpreadsheet className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-900">What happens on confirmation:</p>
            <p className="text-[10px] text-amber-800">
              1. A persistent delivery trip is generated with a unique sequence number.
              <br />
              2. Selected invoices transition from <strong>Ready</strong> &rarr; <strong>Dispatched</strong>.
              <br />
              3. A real <strong>.xlsx Excel Driver Sheet</strong> will immediately download to your computer.
            </p>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || activeUnits.length === 0}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <span>Assigning Trip & Generating Sheet...</span>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Assign Trip & Download Driver Sheet</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
