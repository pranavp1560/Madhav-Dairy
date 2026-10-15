import React, { useState, useEffect, useMemo } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { VendorAdvance } from '../../types/dairy';
import {
  IndianRupee,
  Calendar,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Scale,
  PackageCheck,
} from 'lucide-react';

interface AdjustAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  advance: VendorAdvance | null;
}

export const AdjustAdvanceModal: React.FC<AdjustAdvanceModalProps> = ({
  isOpen,
  onClose,
  advance,
}) => {
  const { adjustVendorAdvanceDirect } = useDairy();

  const today = new Date().toISOString().split('T')[0];

  const [adjustmentAmount, setAdjustmentAmount] = useState<number | ''>('');
  const [description, setDescription] = useState<string>('');
  const [adjustmentDate, setAdjustmentDate] = useState<string>(today);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (advance) {
      setAdjustmentAmount(advance.balanceAmount);
      setDescription('');
      setNotes('');
      setError(null);
    }
  }, [advance]);

  const maxAdjustable = advance ? advance.balanceAmount : 0;
  const numAmount = Number(adjustmentAmount) || 0;
  const isOverBalance = numAmount > maxAdjustable;
  const newAdvanceBalance = Math.max(0, maxAdjustable - numAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!advance) return;

    if (numAmount <= 0) {
      setError('Please enter a valid adjustment amount greater than zero.');
      return;
    }

    if (isOverBalance) {
      setError(
        `Adjustment amount (₹${numAmount.toLocaleString('en-IN')}) cannot exceed available advance balance (₹${maxAdjustable.toLocaleString('en-IN')}).`
      );
      return;
    }

    if (!description.trim()) {
      setError('Please specify the goods, raw materials, or expense details being adjusted.');
      return;
    }

    try {
      setIsSubmitting(true);
      await adjustVendorAdvanceDirect({
        advanceId: advance.id,
        adjustmentAmount: numAmount,
        description: description.trim(),
        adjustmentDate: adjustmentDate || today,
        notes: notes.trim() || undefined,
      });

      // Clear & close
      setAdjustmentAmount('');
      setDescription('');
      setNotes('');
      setError(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust advance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!advance) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust Advance with Expense"
      subtitle={`Offset goods or raw material purchases against advance given to ${advance.vendorName}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="font-medium">{error}</div>
          </div>
        )}

        {/* Advance Summary Strip */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-slate-700">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Vendor / Paid To</span>
            <span className="font-bold text-slate-900 block truncate text-xs">{advance.vendorName}</span>
            <span className="text-[10px] text-slate-400 font-mono-numbers">{advance.advanceNumber}</span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Advance Paid</span>
            <span className="font-bold font-mono-numbers text-slate-800 text-xs">
              ₹{advance.amount.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-slate-400 block">
              Adjusted: ₹{advance.adjustedAmount.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <span className="text-[10px] text-blue-700 block uppercase font-bold">Available to Adjust</span>
            <span className="text-base font-black font-mono-numbers text-blue-700">
              ₹{advance.balanceAmount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Adjustment Amount Input */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-blue-600" />
              <span>Adjustment Amount (₹) <span className="text-red-500">*</span></span>
            </label>
            <button
              type="button"
              onClick={() => {
                setAdjustmentAmount(maxAdjustable);
                setError(null);
              }}
              className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-[10px] font-bold transition-colors"
            >
              Full Amount (₹{maxAdjustable.toLocaleString('en-IN')})
            </button>
          </div>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">
              ₹
            </span>
            <input
              type="number"
              min="1"
              max={maxAdjustable}
              step="any"
              value={adjustmentAmount}
              onChange={e => setAdjustmentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="Enter amount to adjust"
              className={`w-full pl-8 pr-3 py-2 bg-white border rounded-xl text-xs font-bold font-mono-numbers focus:ring-2 focus:outline-none ${
                isOverBalance
                  ? 'border-red-500 text-red-600 focus:ring-red-100'
                  : 'border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-blue-100'
              }`}
              required
            />
          </div>

          {isOverBalance && (
            <p className="text-red-600 font-medium text-[11px] flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Amount exceeds available advance balance (₹{maxAdjustable.toLocaleString('en-IN')}).
            </p>
          )}

          {/* Balance projection */}
          <div className="flex items-center justify-between pt-1 text-[11px] font-semibold text-slate-600">
            <span>Remaining Advance Balance after adjustment:</span>
            <span className={`font-mono-numbers font-black ${newAdvanceBalance === 0 ? 'text-slate-400' : 'text-emerald-700'}`}>
              ₹{newAdvanceBalance.toLocaleString('en-IN')}
              {newAdvanceBalance === 0 && ' (Fully Settled)'}
            </span>
          </div>
        </div>

        {/* Goods / Raw Material Details */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Goods / Raw Material Details (Expense Description) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. 100 Litres cow milk procurement / Cattle feed supply"
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            required
          />
        </div>

        {/* Date & Voucher */}
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
              Bill / Voucher # (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. BILL-9823 / Delivery Challan"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono-numbers focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
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
            disabled={isSubmitting || numAmount <= 0 || isOverBalance || !description.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <span>Saving...</span>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save Adjustment</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
