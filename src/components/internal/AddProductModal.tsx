import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { Plus, Check, Package, IndianRupee, Sparkles } from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose }) => {
  const { addProduct } = useDairy();

  const [name, setName] = useState('');
  const [nameMr, setNameMr] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [categoryName, setCategoryName] = useState('Fresh Milk & Curd');
  const [packSize, setPackSize] = useState('500 ml');
  const [unit, setUnit] = useState('pouch');
  const [mrp, setMrp] = useState<number>(35);
  const [sellingPrice, setSellingPrice] = useState<number>(32);
  const [shelfLifeDays, setShelfLifeDays] = useState<number>(3);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    'Fresh Milk & Curd',
    'Paneer & Ghee',
    'Sweets & Desserts',
    'Beverages & Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await addProduct({
        name: name.trim(),
        nameMr: nameMr.trim() || undefined,
        nameHi: nameHi.trim() || undefined,
        categoryName,
        packSize: packSize.trim(),
        unit: unit.trim(),
        mrp: Number(mrp),
        sellingPrice: Number(sellingPrice),
        shelfLifeDays: Number(shelfLifeDays),
        description: description.trim() || undefined,
      });

      // Reset form
      setName('');
      setNameMr('');
      setNameHi('');
      setDescription('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Dairy Product"
      subtitle="Register a new dairy product item and SKU into the production & sales catalog"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Product Names (Multilingual) */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Product Name (English) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Standard Cow Milk"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Marathi Title (मराठी)
            </label>
            <input
              type="text"
              value={nameMr}
              onChange={e => setNameMr(e.target.value)}
              placeholder="e.g. स्टँडर्ड गायीचे दूध"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Hindi Title (हिंदी)
            </label>
            <input
              type="text"
              value={nameHi}
              onChange={e => setNameHi(e.target.value)}
              placeholder="e.g. स्टैंडर्ड गाय का दूध"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Category & Shelf Life */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryName}
              onChange={e => setCategoryName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Shelf Life (Days) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              required
              value={shelfLifeDays}
              onChange={e => setShelfLifeDays(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Packaging Variation & Unit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Pack Size <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={packSize}
              onChange={e => setPackSize(e.target.value)}
              placeholder="e.g. 500 ml, 1 Litre, 200 g"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Packaging Container <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={unit}
              onChange={e => setUnit(e.target.value)}
              placeholder="e.g. pouch, bottle, tub, box"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Maximum Retail Price (MRP ₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              required
              value={mrp}
              onChange={e => setMrp(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono-numbers font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Retailer Selling Price (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              required
              value={sellingPrice}
              onChange={e => setSellingPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono-numbers font-bold text-blue-700 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Description / Notes</label>
          <textarea
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Pasteurized and homogenized fresh cow milk, 3.5% Fat, 8.5% SNF."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
          />
        </div>

        {/* Live Preview Card */}
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-xs">
                {name || 'Product Preview'}
              </p>
              <p className="text-[10px] text-slate-500">
                {categoryName} &bull; {packSize} {unit} &bull; Shelf Life: {shelfLifeDays} days
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 line-through mr-1">₹{mrp}</span>
            <span className="text-xs font-bold text-blue-700 font-mono-numbers">₹{sellingPrice}</span>
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
            disabled={isSubmitting || !name.trim()}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-xl shadow-xs flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? 'Saving...' : 'Save Product'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
