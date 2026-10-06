import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { PaymentMethod } from '../../types/dairy';
import { CreditCard, Check, Banknote } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRetailerId?: string;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  defaultRetailerId,
}) => {
  const { retailers, invoices, recordPayment } = useDairy();

  const [retailerId, setRetailerId] = useState<string>(defaultRetailerId || retailers[0]?.id || '');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('INV-1021');
  const [amount, setAmount] = useState<number>(5000);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [reference, setReference] = useState<string>('UPI/260917-8891');
  const [notes, setNotes] = useState<string>('Direct settlement via retail payment counter');

  const selectedRetailer = retailers.find(r => r.id === retailerId);
  const retailerInvoices = invoices.filter(i => i.retailerId === retailerId && i.outstandingAmount > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!retailerId || amount <= 0) return;

    recordPayment({
      retailerId,
      invoiceNumber,
      amount,
      paymentMethod,
      reference,
      notes,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment Collection"
      subtitle="Reconciles customer dues and instantly updates ledger statement"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Retailer <span className="text-red-500">*</span>
          </label>
          <select
            value={retailerId}
            onChange={e => {
              setRetailerId(e.target.value);
              const inv = invoices.find(i => i.retailerId === e.target.value);
              if (inv) setInvoiceNumber(inv.invoiceNumber);
            }}
            className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            required
          >
            {retailers.map(r => (
              <option key={r.id} value={r.id}>
                {r.businessName} (Outstanding: ₹{r.outstandingAmount.toLocaleString('en-IN')})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Against Invoice
            </label>
            <select
              value={invoiceNumber}
              onChange={e => {
                setInvoiceNumber(e.target.value);
                const inv = retailerInvoices.find(i => i.invoiceNumber === e.target.value);
                if (inv) setAmount(inv.outstandingAmount);
              }}
              className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-mono-numbers focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none cursor-pointer"
            >
              <option value="Direct Payment">Direct Payment (Unallocated)</option>
              {retailerInvoices.map(i => (
                <option key={i.id} value={i.invoiceNumber}>
                  {i.invoiceNumber} (Dues: ₹{i.outstandingAmount.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Amount Received (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-mono-numbers font-bold text-green-600 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-semibold uppercase focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            >
              <option value="upi">UPI (PhonePe / GPay)</option>
              <option value="cash">Cash Collection</option>
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
              <option value="cheque">Bank Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Reference / UTR / Cheque #
            </label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g. UPI/2099381 or CHQ-449"
              className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs font-mono-numbers focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full p-2.5 bg-slate-50/50 border border-slate-300 rounded-lg text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
          />
        </div>

        {selectedRetailer && (
          <div className="bg-green-50/70 p-3 rounded-lg border border-green-200 text-xs">
            <div className="flex justify-between">
              <span className="text-green-950 font-medium">Current Outstanding:</span>
              <span className="font-mono-numbers font-bold text-red-600">
                ₹{selectedRetailer.outstandingAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-green-200 mt-1">
              <span className="text-green-950 font-semibold">New Balance After Payment:</span>
              <span className="font-mono-numbers font-extrabold text-green-700">
                ₹{Math.max(0, selectedRetailer.outstandingAmount - amount).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}

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
            <span>Record Payment</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
