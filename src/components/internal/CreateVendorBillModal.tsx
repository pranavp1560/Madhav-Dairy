import React, { useState, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { Supplier } from '../../types/dairy';
import { FileSpreadsheet, Calendar, UserCheck, AlertCircle, Plus } from 'lucide-react';

interface CreateVendorBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSupplierId?: string;
  defaultVendorName?: string;
}

export const CreateVendorBillModal: React.FC<CreateVendorBillModalProps> = ({
  isOpen,
  onClose,
  defaultSupplierId,
  defaultVendorName,
}) => {
  const { suppliers, createVendorBill } = useDairy();

  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(defaultSupplierId || '');
  const [customVendorName, setCustomVendorName] = useState<string>(defaultVendorName || '');
  const [billNumber, setBillNumber] = useState<string>('');
  const [category, setCategory] = useState<string>('Raw Milk Procurement');
  const [totalAmount, setTotalAmount] = useState<number | ''>(10000);
  const [billDate, setBillDate] = useState<string>(today);
  const [dueDate, setDueDate] = useState<string>(nextWeek);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultSupplierId) {
      setSelectedSupplierId(defaultSupplierId);
    }
    if (defaultVendorName) {
      setCustomVendorName(defaultVendorName);
    }
  }, [defaultSupplierId, defaultVendorName]);

  const selectedSupplier: Supplier | undefined = suppliers.find(s => s.id === selectedSupplierId);
  const effectiveVendorName = selectedSupplier ? selectedSupplier.name : customVendorName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericAmount = Number(totalAmount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid total bill amount greater than 0.');
      return;
    }

    if (!effectiveVendorName.trim()) {
      setError('Please select or specify a vendor / farmer name.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createVendorBill({
        supplierId: selectedSupplierId || undefined,
        vendorName: effectiveVendorName.trim(),
        billNumber: billNumber.trim() || undefined,
        billDate: billDate || today,
        dueDate: dueDate || undefined,
        category: category.trim() || 'Raw Milk Procurement',
        totalAmount: numericAmount,
        notes: notes.trim() || undefined,
      });

      // Reset
      setBillNumber('');
      setNotes('');
      setError(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create vendor bill.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Vendor / Procurement Bill"
      subtitle="Register an invoice or payable bill against which advances and direct payments can be settled"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="font-medium">{error}</div>
          </div>
        )}

        {/* Vendor Selection */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Vendor / Supplier / Farmer <span className="text-red-500">*</span>
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
            <option value="">-- Select Registered Supplier / Farmer Society --</option>
            {suppliers.map(sup => (
              <option key={sup.id} value={sup.id}>
                {sup.name} {sup.supplierCode ? `(${sup.supplierCode})` : ''}
              </option>
            ))}
            <option value="other">Other / Manual Vendor Entry</option>
          </select>
        </div>

        {selectedSupplierId === 'other' && (
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Vendor / Farmer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customVendorName}
              onChange={e => setCustomVendorName(e.target.value)}
              placeholder="e.g. Shirwal Village Dairy Union"
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              required
            />
          </div>
        )}

        {/* Bill Number & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Bill / Invoice Number
            </label>
            <input
              type="text"
              value={billNumber}
              onChange={e => setBillNumber(e.target.value)}
              placeholder="Auto-generated if left blank"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono-numbers focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Procurement Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            >
              <option value="Raw Milk Procurement">Raw Milk Procurement</option>
              <option value="Packaging Materials">Packaging Materials</option>
              <option value="Cattle Feed & Minerals">Cattle Feed & Minerals</option>
              <option value="Dairy Processing Consumables">Dairy Processing Consumables</option>
              <option value="Transportation & Logistics">Transportation & Logistics</option>
              <option value="Cold Chain Equipment & Spares">Cold Chain Equipment & Spares</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Amount, Bill Date & Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Bill Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">
                ₹
              </span>
              <input
                type="number"
                min="1"
                step="any"
                value={totalAmount}
                onChange={e => setTotalAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 font-mono-numbers focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Bill Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={billDate}
              onChange={e => setBillDate(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Notes / Description
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. 520 Litres buffalo milk delivery @ ₹46.50/L with 6.5% fat"
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          />
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
            disabled={isSubmitting || !totalAmount || Number(totalAmount) <= 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <span>Saving...</span>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Save Vendor Bill</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
