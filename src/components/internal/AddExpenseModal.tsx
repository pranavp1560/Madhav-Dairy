import React, { useState, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { ExpenseCategory, PaymentMethod } from '../../types/dairy';
import { expenseService } from '../../services/expenseService';
import { Check, Plus, Loader2, Calendar } from 'lucide-react';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  'Raw Material',
  'Packaging',
  'Transportation',
  'Electricity',
  'Salary',
  'Maintenance',
  'Fuel',
  'Rent',
  'Marketing',
  'Office & Admin',
  'Other',
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ isOpen, onClose }) => {
  const { addExpense } = useDairy();

  const [availableCategories, setAvailableCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [category, setCategory] = useState<string>('Raw Material');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [paidTo, setPaidTo] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load existing categories from DB
  useEffect(() => {
    if (isOpen) {
      expenseService.fetchCategories().then(cats => {
        if (cats && cats.length > 0) {
          const names = cats.map(c => c.name);
          // Merge with default categories to make sure standard ones always exist
          const merged = Array.from(new Set([...names, ...DEFAULT_CATEGORIES]));
          setAvailableCategories(merged);
        }
      }).catch(err => {
        console.warn('Could not load categories from DB:', err);
      });
      // Reset form on open
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setCategory('Raw Material');
      setCustomCategory('');
      setIsCustomCategory(false);
      setDescription('');
      setAmount('');
      setPaidTo('');
      setReferenceNumber('');
      setFormError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const finalCategory = isCustomCategory ? customCategory.trim() : category.trim();
    if (!finalCategory) {
      setFormError('Please select or specify an expense category.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setFormError('Please enter a valid positive expense amount.');
      return;
    }

    if (!description.trim()) {
      setFormError('Expense description is required.');
      return;
    }

    if (!paidTo.trim()) {
      setFormError('Paid To (Vendor, Staff, or Recipient) is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addExpense({
        category: finalCategory as ExpenseCategory,
        description: description.trim(),
        amount: numAmount,
        paymentMethod,
        paidTo: paidTo.trim(),
        referenceNumber: referenceNumber.trim() || undefined,
        date: expenseDate,
      });

      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record expense. Please check input and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Operating Expense"
      subtitle="Log procurement, processing, logistics, and dairy plant operational overheads"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Expense Date */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Expense Date</span> <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={expenseDate}
              onChange={e => setExpenseDate(e.target.value)}
              className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-semibold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              required
            />
          </div>

          {/* Expense Category */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-700">
                Expense Category <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCustomCategory(!isCustomCategory);
                  setCustomCategory('');
                }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
              >
                {isCustomCategory ? 'Choose from list' : '+ Custom Category'}
              </button>
            </div>

            {isCustomCategory ? (
              <input
                type="text"
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                placeholder="Enter custom category name..."
                className="w-full p-2.5 bg-white border border-blue-400 rounded-lg text-xs font-semibold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                required
                autoFocus
              />
            ) : (
              <select
                value={category}
                onChange={e => {
                  if (e.target.value === '__custom__') {
                    setIsCustomCategory(true);
                    setCustomCategory('');
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-semibold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              >
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__custom__">+ Add Custom Category...</option>
              </select>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Description / Item Details <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Raw milk procurement (450 Litres) or Boiler diesel fuel"
            className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            required
          />
        </div>

        {/* Amount & Payment Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-bold">
                ₹
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-mono-numbers font-bold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            >
              <option value="upi">UPI / GPay / PhonePe</option>
              <option value="bank_transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Paid To & Reference Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Paid To (Vendor / Beneficiary) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={paidTo}
              onChange={e => setPaidTo(e.target.value)}
              placeholder="e.g. Shirwal Dairy Society / Bharat Petroleum"
              className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Bill / Voucher Ref # <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              placeholder="Auto-generated if left blank"
              className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-mono-numbers focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Expense...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Expense</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
