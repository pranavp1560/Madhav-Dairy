import React, { useState, useEffect, useMemo } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { VendorAdvance, VendorBill } from '../../types/dairy';
import {
  IndianRupee,
  Calendar,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Scale,
  Plus,
  Info,
} from 'lucide-react';

interface AdjustAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedAdvanceId?: string;
  preselectedBillId?: string;
  onOpenCreateBill?: (supplierId?: string, vendorName?: string) => void;
}

export const AdjustAdvanceModal: React.FC<AdjustAdvanceModalProps> = ({
  isOpen,
  onClose,
  preselectedAdvanceId,
  preselectedBillId,
  onOpenCreateBill,
}) => {
  const {
    vendorAdvances,
    vendorBills,
    adjustVendorAdvanceAgainstBill,
  } = useDairy();

  const today = new Date().toISOString().split('T')[0];

  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string>(preselectedAdvanceId || '');
  const [selectedBillId, setSelectedBillId] = useState<string>(preselectedBillId || '');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number | ''>('');
  const [adjustmentDate, setAdjustmentDate] = useState<string>(today);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize incoming preselection props
  useEffect(() => {
    if (preselectedAdvanceId) {
      setSelectedAdvanceId(preselectedAdvanceId);
    }
  }, [preselectedAdvanceId]);

  useEffect(() => {
    if (preselectedBillId) {
      setSelectedBillId(preselectedBillId);
    }
  }, [preselectedBillId]);

  // If a bill was preselected but no advance was preselected, try auto-finding an advance for that bill's vendor
  useEffect(() => {
    if (preselectedBillId && !preselectedAdvanceId) {
      const bill = vendorBills.find(b => b.id === preselectedBillId);
      if (bill) {
        const matchingAdvance = vendorAdvances.find(
          a => (a.supplierId && a.supplierId === bill.supplierId) ||
               (a.vendorName.toLowerCase() === bill.vendorName.toLowerCase() && a.balanceAmount > 0)
        );
        if (matchingAdvance) {
          setSelectedAdvanceId(matchingAdvance.id);
        }
      }
    }
  }, [preselectedBillId, preselectedAdvanceId, vendorBills, vendorAdvances]);

  const selectedAdvance: VendorAdvance | undefined = useMemo(() => {
    return vendorAdvances.find(a => a.id === selectedAdvanceId);
  }, [vendorAdvances, selectedAdvanceId]);

  // Filter bills matching the selected advance's vendor with remaining balance > 0
  const eligibleBills: VendorBill[] = useMemo(() => {
    return vendorBills.filter(bill => {
      if (bill.balanceAmount <= 0) return false;
      if (!selectedAdvance) return true;
      if (selectedAdvance.supplierId && bill.supplierId) {
        return selectedAdvance.supplierId === bill.supplierId;
      }
      return selectedAdvance.vendorName.trim().toLowerCase() === bill.vendorName.trim().toLowerCase();
    });
  }, [vendorBills, selectedAdvance]);

  // Auto-select bill if only one eligible bill exists
  useEffect(() => {
    if (selectedAdvance && eligibleBills.length === 1 && !selectedBillId) {
      setSelectedBillId(eligibleBills[0].id);
    }
  }, [selectedAdvance, eligibleBills, selectedBillId]);

  const selectedBill: VendorBill | undefined = useMemo(() => {
    return vendorBills.find(b => b.id === selectedBillId);
  }, [vendorBills, selectedBillId]);

  // Calculate maximum allowable adjustment
  const maxAdjustable: number = useMemo(() => {
    const advBal = selectedAdvance ? selectedAdvance.balanceAmount : 0;
    const billBal = selectedBill ? selectedBill.balanceAmount : 0;
    return Math.max(0, Math.min(advBal, billBal));
  }, [selectedAdvance, selectedBill]);

  // Set default suggested adjustment amount when both are selected
  useEffect(() => {
    if (maxAdjustable > 0 && (adjustmentAmount === '' || Number(adjustmentAmount) > maxAdjustable)) {
      setAdjustmentAmount(maxAdjustable);
    }
  }, [maxAdjustable]);

  const numAmount = Number(adjustmentAmount) || 0;

  // Real-time projections
  const newAdvanceBalance = selectedAdvance
    ? Math.max(0, selectedAdvance.balanceAmount - numAmount)
    : 0;

  const newBillBalance = selectedBill
    ? Math.max(0, selectedBill.balanceAmount - numAmount)
    : 0;

  const isOverAdvanceBalance = selectedAdvance ? numAmount > selectedAdvance.balanceAmount : false;
  const isOverBillBalance = selectedBill ? numAmount > selectedBill.balanceAmount : false;
  const isInvalidAmount = numAmount <= 0 || isOverAdvanceBalance || isOverBillBalance;

  const handleMaxClick = () => {
    setAdjustmentAmount(maxAdjustable);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedAdvanceId) {
      setError('Please select a vendor advance to adjust from.');
      return;
    }
    if (!selectedBillId) {
      setError('Please select a vendor bill to adjust against.');
      return;
    }

    if (numAmount <= 0) {
      setError('Please enter an adjustment amount greater than zero.');
      return;
    }

    if (isOverAdvanceBalance) {
      setError(
        `Adjustment amount (₹${numAmount.toLocaleString('en-IN')}) exceeds available advance balance (₹${selectedAdvance?.balanceAmount.toLocaleString('en-IN')}).`
      );
      return;
    }

    if (isOverBillBalance) {
      setError(
        `Adjustment amount (₹${numAmount.toLocaleString('en-IN')}) exceeds remaining bill payable (₹${selectedBill?.balanceAmount.toLocaleString('en-IN')}).`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await adjustVendorAdvanceAgainstBill({
        advanceId: selectedAdvanceId,
        billId: selectedBillId,
        adjustmentAmount: numAmount,
        adjustmentDate: adjustmentDate || today,
        notes: notes.trim() || undefined,
      });

      // Clear & close
      setAdjustmentAmount('');
      setNotes('');
      setError(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust advance against bill.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Advances with positive balance available for adjustment
  const availableAdvances = vendorAdvances.filter(a => a.balanceAmount > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust Vendor Advance Against Bill"
      subtitle="Offset an active procurement bill using previously disbursed vendor / farmer advance credit"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="font-medium">{error}</div>
          </div>
        )}

        {/* Step 1: Select Advance */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-700">
              1. Select Advance Disbursement <span className="text-red-500">*</span>
            </label>
            <span className="text-[10px] text-slate-400">
              Only advances with available balance are shown
            </span>
          </div>
          <select
            value={selectedAdvanceId}
            onChange={e => {
              setSelectedAdvanceId(e.target.value);
              setSelectedBillId('');
              setAdjustmentAmount('');
            }}
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            required
          >
            <option value="">-- Choose Advance Voucher --</option>
            {availableAdvances.map(adv => (
              <option key={adv.id} value={adv.id}>
                {adv.advanceNumber} • {adv.vendorName} — Disbursed: ₹{adv.amount.toLocaleString('en-IN')} (Available: ₹{adv.balanceAmount.toLocaleString('en-IN')}) [{adv.advanceDate}]
              </option>
            ))}
          </select>
        </div>

        {/* Advance Details Strip */}
        {selectedAdvance && (
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Vendor / Farmer</span>
              <span className="font-bold text-slate-900 block truncate">{selectedAdvance.vendorName}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Disbursed</span>
              <span className="font-bold font-mono-numbers text-slate-800">
                ₹{selectedAdvance.amount.toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Already Adjusted</span>
              <span className="font-bold font-mono-numbers text-slate-600">
                ₹{selectedAdvance.adjustedAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-blue-700 block uppercase font-bold">Available Balance</span>
              <span className="font-black font-mono-numbers text-blue-700">
                ₹{selectedAdvance.balanceAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}

        {/* Step 2: Select Vendor Bill */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-700">
              2. Select Procurement Bill to Adjust <span className="text-red-500">*</span>
            </label>
            {selectedAdvance && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenCreateBill) {
                    onOpenCreateBill(selectedAdvance.supplierId, selectedAdvance.vendorName);
                  }
                }}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Bill for this Vendor</span>
              </button>
            )}
          </div>

          <select
            value={selectedBillId}
            onChange={e => {
              setSelectedBillId(e.target.value);
              setAdjustmentAmount('');
            }}
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            required
            disabled={!selectedAdvanceId}
          >
            <option value="">
              {!selectedAdvanceId
                ? '-- Please select an advance first --'
                : eligibleBills.length === 0
                ? '-- No open bills found for this vendor --'
                : '-- Choose Bill to Settle --'}
            </option>
            {eligibleBills.map(bill => (
              <option key={bill.id} value={bill.id}>
                {bill.billNumber} • {bill.category} — Total: ₹{bill.totalAmount.toLocaleString('en-IN')} (Remaining Payable: ₹{bill.balanceAmount.toLocaleString('en-IN')}) [{bill.billDate}]
              </option>
            ))}
          </select>

          {selectedAdvance && eligibleBills.length === 0 && (
            <div className="mt-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 flex items-center justify-between">
              <span className="text-[11px]">
                No unpaid bills are currently registered for <strong>{selectedAdvance.vendorName}</strong>.
              </span>
              {onOpenCreateBill && (
                <button
                  type="button"
                  onClick={() => onOpenCreateBill(selectedAdvance.supplierId, selectedAdvance.vendorName)}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold"
                >
                  Create Bill Now
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bill Details Strip */}
        {selectedBill && (
          <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Bill # / Category</span>
              <span className="font-bold text-slate-900 block truncate">{selectedBill.billNumber}</span>
              <span className="text-[10px] text-slate-400 block truncate">{selectedBill.category}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Bill Value</span>
              <span className="font-bold font-mono-numbers text-slate-800">
                ₹{selectedBill.totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Settled So Far</span>
              <span className="font-bold font-mono-numbers text-slate-600">
                ₹{(selectedBill.adjustedAmount + selectedBill.paidAmount).toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-purple-700 block uppercase font-bold">Remaining Payable</span>
              <span className="font-black font-mono-numbers text-purple-700">
                ₹{selectedBill.balanceAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}

        {/* Step 3: Adjustment Amount and Date */}
        {selectedAdvance && selectedBill && (
          <>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-blue-600" />
                  <span>3. Enter Adjustment Amount (₹)</span>
                </label>
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-[11px] font-bold transition-colors"
                >
                  Max Adjust (₹{maxAdjustable.toLocaleString('en-IN')})
                </button>
              </div>

              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  max={maxAdjustable}
                  step="any"
                  value={adjustmentAmount}
                  onChange={e => setAdjustmentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className={`w-full pl-9 pr-3 py-2.5 bg-white border rounded-xl text-sm font-bold font-mono-numbers focus:ring-2 focus:outline-none ${
                    isOverAdvanceBalance || isOverBillBalance
                      ? 'border-red-500 text-red-600 focus:ring-red-100'
                      : 'border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-blue-100'
                  }`}
                  required
                />
              </div>

              {isOverAdvanceBalance && (
                <p className="text-red-600 font-medium text-[11px] flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Amount exceeds advance balance (₹{selectedAdvance.balanceAmount.toLocaleString('en-IN')}).
                </p>
              )}
              {isOverBillBalance && !isOverAdvanceBalance && (
                <p className="text-red-600 font-medium text-[11px] flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Amount exceeds bill remaining balance (₹{selectedBill.balanceAmount.toLocaleString('en-IN')}).
                </p>
              )}

              {/* Dynamic Live Balance Projections */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">
                    Advance Balance After Adjustment
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-mono-numbers">
                    <span className="text-slate-400 line-through text-xs">
                      ₹{selectedAdvance.balanceAmount.toLocaleString('en-IN')}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className={`text-xs font-black ${newAdvanceBalance === 0 ? 'text-slate-500' : 'text-emerald-700'}`}>
                      ₹{newAdvanceBalance.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">
                    Bill Balance After Adjustment
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-mono-numbers">
                    <span className="text-slate-400 line-through text-xs">
                      ₹{selectedBill.balanceAmount.toLocaleString('en-IN')}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className={`text-xs font-black ${newBillBalance === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      ₹{newBillBalance.toLocaleString('en-IN')}
                      {newBillBalance === 0 && ' (Settled)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Date & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Adjustment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={adjustmentDate}
                  onChange={e => setAdjustmentDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Adjustment Notes / Remarks
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Adjusted against week 1 procurement"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isInvalidAmount || !selectedAdvanceId || !selectedBillId}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <span>Recording Adjustment...</span>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm Adjustment</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
