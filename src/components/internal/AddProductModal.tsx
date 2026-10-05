import React, { useState, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { Plus, Check, Package, IndianRupee, Sparkles, AlertTriangle, Layers } from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChannelPriceInput {
  channelId: string;
  channelName: string;
  channelCode: string;
  standardPrice: number;
  minimumPrice: number;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose }) => {
  const { addProduct, categories: dbCategories, salesChannels } = useDairy();

  const [name, setName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [packSize, setPackSize] = useState('500 ml');
  const [unit, setUnit] = useState('pouch');
  const [mrp, setMrp] = useState<number>(35);
  const [sellingPrice, setSellingPrice] = useState<number>(32);
  const [shelfLifeDays, setShelfLifeDays] = useState<number>(3);
  const [description, setDescription] = useState('');
  const [channelPrices, setChannelPrices] = useState<ChannelPriceInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Available categories
  const activeCategories = dbCategories.filter(c => c.isActive);
  const categoryNames = activeCategories.length > 0
    ? activeCategories.map(c => c.name)
    : ['Fresh Milk & Curd', 'Paneer & Ghee', 'Sweets & Desserts', 'Beverages & Other'];

  useEffect(() => {
    if (categoryNames.length > 0 && !categoryName) {
      setCategoryName(categoryNames[0]);
    }
  }, [categoryNames, categoryName]);

  // Synchronize initial channel prices when modal opens or selling price changes
  useEffect(() => {
    if (!isOpen) return;
    const activeCh = salesChannels.filter(c => c.isActive);
    if (activeCh.length === 0) return;

    setChannelPrices(prev => {
      return activeCh.map(ch => {
        const existing = prev.find(p => p.channelId === ch.id);
        if (existing) return existing;

        let std = sellingPrice || 32;
        let min = Math.round(std * 0.95);

        if (ch.code === 'WHOLESALE') {
          std = Math.round(sellingPrice * 0.90);
          min = Math.round(sellingPrice * 0.85);
        } else if (ch.code === 'RETAIL') {
          std = sellingPrice;
          min = Math.round(sellingPrice * 0.93);
        } else if (ch.code === 'CUSTOMER') {
          std = sellingPrice;
          min = Math.round(sellingPrice * 0.97);
        }

        return {
          channelId: ch.id,
          channelName: ch.name,
          channelCode: ch.code,
          standardPrice: std,
          minimumPrice: min,
        };
      });
    });
  }, [isOpen, salesChannels]);

  const handlePriceChange = (channelId: string, field: 'standardPrice' | 'minimumPrice', val: number) => {
    setChannelPrices(prev =>
      prev.map(cp => (cp.channelId === channelId ? { ...cp, [field]: val } : cp))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) return;

    // Check pricing validation
    for (const cp of channelPrices) {
      if (cp.minimumPrice > cp.standardPrice) {
        setFormError(`For ${cp.channelName}, Minimum Price (₹${cp.minimumPrice}) cannot exceed Standard Price (₹${cp.standardPrice}).`);
        return;
      }
      if (cp.standardPrice < 0 || cp.minimumPrice < 0) {
        setFormError(`Prices for ${cp.channelName} must be positive numbers.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await addProduct({
        name: name.trim(),
        categoryName,
        packSize: packSize.trim(),
        unit: unit.trim(),
        mrp: Number(mrp),
        sellingPrice: Number(sellingPrice),
        shelfLifeDays: Number(shelfLifeDays),
        description: description.trim() || undefined,
        channelPrices: channelPrices.map(cp => ({
          channelId: cp.channelId,
          standardPrice: Number(cp.standardPrice),
          minimumPrice: Number(cp.minimumPrice),
        })),
      });

      // Reset form
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasInvalidPricing = channelPrices.some(cp => cp.minimumPrice > cp.standardPrice);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Dairy Product"
      subtitle="Register a new dairy product item, packaging variation, and channel-wise pricing rules"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Product Names */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Product Name <span className="text-red-500">*</span>
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
              {categoryNames.map(c => (
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

        {/* Channel-Wise Pricing Matrix */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="block font-bold text-slate-800 text-xs">
                Sales Channel Pricing Rules
              </span>
              <span className="text-[10px] text-slate-500">
                Define Standard Selling Price & Floor (Minimum) Price per channel. Floor rule: Min Price ≤ Standard Price.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
              {channelPrices.length} Channels
            </span>
          </div>

          {channelPrices.length === 0 ? (
            <p className="text-slate-400 italic text-[11px]">No active sales channels found.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Sales Channel</th>
                    <th className="py-2 px-3 text-right">Standard Price (₹)</th>
                    <th className="py-2 px-3 text-right">Minimum Price (₹)</th>
                    <th className="py-2 px-3 text-center">Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {channelPrices.map(cp => {
                    const isInvalid = cp.minimumPrice > cp.standardPrice;
                    return (
                      <tr key={cp.channelId} className={isInvalid ? 'bg-red-50/50' : 'hover:bg-slate-50/70'}>
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {cp.channelName}
                          <span className="ml-1 text-[9px] font-mono text-slate-400 font-normal">
                            ({cp.channelCode})
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            required
                            value={cp.standardPrice}
                            onChange={e => handlePriceChange(cp.channelId, 'standardPrice', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono-numbers text-right font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            required
                            value={cp.minimumPrice}
                            onChange={e => handlePriceChange(cp.channelId, 'minimumPrice', parseFloat(e.target.value) || 0)}
                            className={`w-24 px-2 py-1 bg-white border rounded text-xs font-mono-numbers text-right font-semibold focus:outline-none ${
                              isInvalid
                                ? 'border-red-500 text-red-700 bg-red-50'
                                : 'border-slate-300 text-slate-800 focus:border-blue-600'
                            }`}
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isInvalid ? (
                            <span className="text-[10px] font-bold text-red-600 inline-flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> Min &gt; Std
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Valid
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
            disabled={isSubmitting || !name.trim() || hasInvalidPricing}
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
