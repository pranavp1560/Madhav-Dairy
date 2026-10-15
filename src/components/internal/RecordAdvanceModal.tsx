import React, { useState, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { PaymentMethod, Supplier } from '../../types/dairy';
import { IndianRupee, Calendar, CreditCard, UserCheck, FileText, AlertCircle, ArrowUpRight } from 'lucide-react';

interface RecordAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSupplierId?: string;
}

export const RecordAdvanceModal: React.FC<RecordAdvanceModalProps> = ({
  isOpen,
  onClose,
  defaultSupplierId,
}) => {
  const { suppliers, recordVendorAdvance } = useDairy();

  const today = new Date().toISOString().split('T')[0];

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(defaultSupplierId || '');
  const [customVendorName, setCustomVendorName] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>(5000);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [advanceDate, setAdvanceDate] = useState<string>(today);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultSupplierId) {
      setSelectedSupplierId(defaultSupplierId);
    }
  }, [defaultSupplierId]);

  // Derive vendor display name
  const selectedSupplier: Supplier | undefined = suppliers.find(s => s.id === selectedSupplierId);
  const effectiveVendorName = selectedSupplier ? selectedSupplier.name : customVendorName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid advance amount greater than 0.');
      return;
    }

    if (!effectiveVendorName.trim()) {
      setError('Please select or specify a vendor / farmer name.');
      return;
    }

    try {
      setIsSubmitting(true);
      await recordVendorAdvance({
        supplierId: selectedSupplierId || undefined,
        vendorName: effectiveVendorName.trim(),
        amount: numericAmount,
        paymentMethod,
        advanceDate: advanceDate || today,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      // Reset form
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
      title="Record Vendor / Farmer Advance"
      subtitle="Disburse advance payments to milk farmers and suppliers to be adjusted against future collection bills"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="font-medium">{error}</div>
          </div>
        )}

        {/* Vendor / Farmer Selection */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Select Vendor / Farmer <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedSupplierId}
            onChange={e => {
              setSelectedSupplierId(e.target.value);
              if (e.target.value) {
                setCustomVendorName('');
              }
            }}
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          >
            <option value="">-- Choose from Registered Suppliers / Societies --</option>
            {suppliers.map(sup => (
              <option key={sup.id} value={sup.id}>
                {sup.name} {sup.supplierCode ? `(${sup.supplierCode})` : ''} {sup.mobile ? `• ${sup.mobile}` : ''}
              </option>
            ))}
            <option value="other">Other / One-off Vendor or Farmer (Manual Entry)</option>
          </select>
        </div>

        {/* Manual Vendor Name if "other" or no match */}
        {selectedSupplierId === 'other' && (
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Vendor / Farmer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customVendorName}
              onChange={e => setCustomVendorName(e.target.value)}
              placeholder="e.g. Ramesh Patil (Village Milk Centre)"
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              required
            />
          </div>
        )}

        {selectedSupplier && (
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-slate-700">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <div>
                <span className="font-bold text-slate-900">{selectedSupplier.name}</span>
                {selectedSupplier.contactPerson && (
                  <span className="text-slate-500 ml-1.5 font-normal">Contact: {selectedSupplier.contactPerson}</span>
                )}
              </div>
            </div>
            {selectedSupplier.mobile && (
              <span className="font-mono-numbers text-slate-600">{selectedSupplier.mobile}</span>
            )}
          </div>
        )}

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
              Disbursement Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={advanceDate}
                onChange={e => setAdvanceDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                required
              />
            </div>
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
              Reference / Voucher #
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              placeholder="e.g. UTR-982347 / CHQ-10442"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono-numbers focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Notes / Purpose
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Weekly milk procurement advance for morning collection cycle."
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          />
        </div>

        {/* Informative Preview Card */}
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900">
          <div>
            <span className="font-bold text-emerald-800 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              Available Advance Credit Created
            </span>
            <span className="text-[11px] text-emerald-700 mt-0.5 block">
              This balance can be manually adjusted against incoming procurement bills at any time.
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
            disabled={isSubmitting || !amount || Number(amount) <= 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <span>Recording...</span>
            ) : (
              <>
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Confirm Advance Disbursement</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
