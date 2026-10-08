import React, { useState, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { Layers, Calendar, Package, Sparkles, Check, Hash, AlertCircle } from 'lucide-react';
import { generateBatchNumber } from '../../utils/batchNumber';
import { addShelfLifeDays, getTodayDateString, calculateDaysRemaining } from '../../utils/dateUtils';

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateBatchModal: React.FC<CreateBatchModalProps> = ({ isOpen, onClose }) => {
  const { products, createProductionBatch, addToast } = useDairy();

  const [productId, setProductId] = useState<string>(products[0]?.id || '');
  const [producedQty, setProducedQty] = useState<number>(200);
  const [productionDate, setProductionDate] = useState<string>(getTodayDateString());
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');

  const selectedProduct = products.find(p => p.id === productId) || products[0];

  // Calendar-date calculation for default expiry
  useEffect(() => {
    if (selectedProduct && productionDate && !isManualOverride) {
      const calcExp = addShelfLifeDays(productionDate, selectedProduct.shelfLifeDays || 10);
      setExpiryDate(calcExp);
      setValidationError('');
    }
  }, [productId, productionDate, selectedProduct, isManualOverride]);

  const previewBatchNumber = generateBatchNumber(productionDate);

  const handleExpiryChange = (newVal: string) => {
    setExpiryDate(newVal);
    setIsManualOverride(true);

    if (newVal < productionDate) {
      setValidationError('Expiry date cannot precede production date.');
    } else {
      setValidationError('');
    }
  };

  const handleResetToStandard = () => {
    if (selectedProduct && productionDate) {
      const calcExp = addShelfLifeDays(productionDate, selectedProduct.shelfLifeDays || 10);
      setExpiryDate(calcExp);
      setIsManualOverride(false);
      setValidationError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || producedQty <= 0) return;

    if (expiryDate < productionDate) {
      setValidationError('Expiry date cannot be earlier than production date.');
      return;
    }

    const auditNotes = isManualOverride
      ? `${notes ? `${notes} | ` : ''}[Quality Audit: Expiry manually adjusted to ${expiryDate}]`
      : notes || `Batch created in Plant 1. Quality verified standard fat/SNF specs.`;

    createProductionBatch({
      productId,
      producedQty,
      productionDate,
      expiryDate,
      notes: auditNotes,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Production Batch"
      subtitle="Generates a traceable batch record linked to stock, invoices and expiry monitoring"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Product selection */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Dairy Product <span className="text-red-500">*</span>
          </label>
          {products.length === 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              No products registered in catalog yet. Please add a product first from the Products screen.
            </div>
          ) : (
            <select
              value={productId}
              onChange={e => {
                setProductId(e.target.value);
                setIsManualOverride(false);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:bg-white focus:outline-none"
              required
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit}) — Shelf Life: {p.shelfLifeDays} days
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Quantity & Production Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Quantity Produced (Units) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={producedQty}
              onChange={e => setProducedQty(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono-numbers font-bold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:bg-white focus:outline-none"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Unit packaging: {selectedProduct?.unit}
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Production Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={productionDate}
              onChange={e => {
                setProductionDate(e.target.value);
                if (!isManualOverride && selectedProduct) {
                  setExpiryDate(addShelfLifeDays(e.target.value, selectedProduct.shelfLifeDays || 10));
                }
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:bg-white focus:outline-none"
              required
            />
          </div>
        </div>

        {/* Expiry Date */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block font-bold text-slate-700">
              Expiry Date <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              {isManualOverride ? (
                <button
                  type="button"
                  onClick={handleResetToStandard}
                  className="text-[10px] text-blue-600 font-bold hover:underline"
                >
                  Reset to {selectedProduct?.shelfLifeDays}-Day Standard
                </button>
              ) : (
                <span className="text-[10px] text-emerald-700 font-bold">
                  Standard {selectedProduct?.shelfLifeDays}-Day Shelf Life
                </span>
              )}
            </div>
          </div>
          <input
            type="date"
            value={expiryDate}
            onChange={e => handleExpiryChange(e.target.value)}
            className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none font-bold ${
              validationError
                ? 'border-red-500 focus:ring-2 focus:ring-red-100'
                : isManualOverride
                ? 'border-amber-400 bg-amber-50/30 text-amber-900 focus:border-amber-600 focus:ring-2 focus:ring-amber-100'
                : 'border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-slate-900'
            }`}
            required
          />
          {validationError && (
            <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {validationError}
            </p>
          )}
          {isManualOverride && !validationError && (
            <p className="text-[10px] text-amber-700 font-medium mt-1">
              Manual date override active ({calculateDaysRemaining(expiryDate, productionDate)} days shelf life). Will be recorded in batch audit logs.
            </p>
          )}
        </div>

        {/* Batch Notes */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Batch Manufacturing Notes & Milk Source
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Morning lot from Shirwal collection center. FAT: 6.5%, SNF: 9.1%. Sealed at 4°C."
            rows={2}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Live Batch Preview Card */}
        <div className="bg-gradient-to-br from-blue-50/70 via-white to-sky-50/30 p-4 rounded-2xl border-2 border-blue-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-100/80 px-2.5 py-0.5 rounded-md border border-blue-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-600" />
              Batch Traceability Preview
            </span>
            <span className="text-xs font-mono-numbers font-black text-white bg-blue-600 px-2.5 py-0.5 rounded-md shadow-xs">
              ID: {previewBatchNumber}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[10px] text-slate-500">Product & Quantity:</p>
              <p className="font-bold text-slate-900 text-sm">
                {selectedProduct?.name} — {producedQty} {selectedProduct?.unit}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Traceability Timeline:</p>
              <p className="text-[11px] font-semibold text-slate-700">
                Prod: <strong className="text-slate-900">{productionDate}</strong> &bull; Exp:{' '}
                <strong className={isManualOverride ? 'text-amber-800' : 'text-slate-900'}>{expiryDate}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={products.length === 0 || Boolean(validationError)}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Create Batch</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
