import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { PaymentMethod } from '../../types/dairy';
import { IndianRupee, AlertCircle, ArrowUpRight } from 'lucide-react';

interface RecordAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecordAdvanceModal: React.FC<RecordAdvanceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { recordVendorAdvance } = useDairy();

  const today = new Date().toISOString().split('T')[0];

  const [vendorName, setVendorName] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>(5000);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [advanceDate, setAdvanceDate] = useState<string>(today);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid advance amount greater than 0.');
      return;
    }

    if (!vendorName.trim()) {
      setError('Please enter the vendor / farmer name.');
      return;
    }

    try {
      setIsSubmitting(true);
      await recordVendorAdvance({
        vendorName: vendorName.trim(),
        amount: numericAmount,
        paymentMethod,
        advanceDate: advanceDate || today,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      // Reset form
      setVendorName('');
      setAmount(5000);
      setReferenceNumber('');
      setNotes('');
      setError(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record advance payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Advance Payment"
      subtitle="Disburse an advance to a vendor or farmer. This row will appear in your Expenses table and can be adjusted later against goods."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="font-medium">{error}</div>
          </div>
        )}

        {/* Paid To / Vendor Name as a simple text input */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Vendor / Farmer Name (Paid To) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={vendorName}
            onChange={e => setVendorName(e.target.value)}
            placeholder="e.g. Ramesh Patil / Shirwal Milk Centre"
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            required
            autoFocus
          />
        </div>

        {/* Amount & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Advance Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">
                ₹
              </span>
              <input
                type="number"
                min="1"
                step="any"
                value={amount}
                onChange={e => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 font-mono-numbers focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={advanceDate}
              onChange={e => setAdvanceDate(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              required
            />
          </div>
        </div>

        {/* Payment Method & Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            >
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="upi">UPI / Online</option>
              <option value="cash">Cash in Hand</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Voucher / Ref #
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              placeholder="e.g. UTR-98234 / CHQ-10442"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono-numbers focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
          </div>
        </div>

        {/* Description / Notes */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Description / Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Advance payment against upcoming raw milk procurement"
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          />
        </div>

        {/* Informative Preview Card */}
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900">
          <div>
            <span className="font-bold text-emerald-800 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              Advance Outflow & Available Credit
            </span>
            <span className="text-[11px] text-emerald-700 mt-0.5 block">
              Counted in your expense totals. You can adjust it later when goods/milk are delivered.
            </span>
          </div>
          <span className="text-base font-black font-mono-numbers text-emerald-700">
            ₹{Number(amount || 0).toLocaleString('en-IN')}
          </span>
        </div>

        {/* Buttons */}
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
            disabled={isSubmitting || !amount || Number(amount) <= 0 || !vendorName.trim()}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <span>Recording...</span>
            ) : (
              <>
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Save Advance Payment</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
