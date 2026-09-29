import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { ExpenseCategory, PaymentMethod } from '../../types/dairy';
import { Receipt, Check } from 'lucide-react';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ isOpen, onClose }) => {
  const { addExpense } = useDairy();

  const [category, setCategory] = useState<ExpenseCategory>('Raw Material');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number>(15000);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [paidTo, setPaidTo] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('EXP-2026-09');

  const categories: ExpenseCategory[] = [
    'Raw Material',
    'Packaging',
    'Transportation',
    'Electricity',
    'Salary',
    'Maintenance',
    'Fuel',
    'Rent',
    'Marketing',
    'Other',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || amount <= 0 || !paidTo) return;

    addExpense({
      category,
      description,
      amount,
      paymentMethod,
      paidTo,
      referenceNumber,
    });

    onClose();
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
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Expense Category <span className="text-red-500">*</span>
          </label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as ExpenseCategory)}
            className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-semibold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Raw cow milk procurement (450 Litres)"
            className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-mono-numbers font-bold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Paid To (Vendor / Staff) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={paidTo}
              onChange={e => setPaidTo(e.target.value)}
              placeholder="e.g. Shirwal Dairy Society"
              className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Invoice / Voucher Ref #
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              placeholder="e.g. VCH-8821"
              className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-mono-numbers focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
