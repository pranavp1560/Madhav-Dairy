import React, { useState, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { Product, ProductSku, SalesChannel, SkuChannelPrice } from '../../types/dairy';
import { Button } from '../ui/Button';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertTriangle,
  IndianRupee,
  Barcode,
  BadgePercent,
  CheckCircle2,
  X,
  Package,
  ShieldCheck,
  Power
} from 'lucide-react';

interface SkuManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

interface SkuFormState {
  skuCode: string;
  variantName: string;
  packSize: string;
  quantity: number;
  unit: string;
  mrp: number;
  sellingPrice: number;
  barcode: string;
  isDefault: boolean;
  isActive: boolean;
  channelPrices: {
    channelId: string;
    channelName: string;
    channelCode: string;
    standardPrice: number;
    minimumPrice: number;
  }[];
}

export const SkuManagerModal: React.FC<SkuManagerModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const {
    salesChannels,
    createSku,
    updateSku,
    toggleSkuActive,
    deleteSku,
    saveMultipleSkuChannelPrices,
    addToast
  } = useDairy();

  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'edit' | 'pricing'>('list');
  const [editingSku, setEditingSku] = useState<ProductSku | null>(null);
  const [selectedSkuForPricing, setSelectedSkuForPricing] = useState<ProductSku | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState<SkuFormState>({
    skuCode: '',
    variantName: '500gm',
    packSize: '500 gm',
    quantity: 500,
    unit: 'gm',
    mrp: 50,
    sellingPrice: 45,
    barcode: '',
    isDefault: false,
    isActive: true,
    channelPrices: [],
  });

  // Dedicated SKU Channel Pricing Form State
  const [pricingForm, setPricingForm] = useState<{
    channelId: string;
    channelName: string;
    channelCode: string;
    standardPrice: number;
    minimumPrice: number;
    isActive: boolean;
  }[]>([]);

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('list');
      setEditingSku(null);
      setSelectedSkuForPricing(null);
      setFormError(null);
    }
  }, [isOpen]);

  // Prepopulate channel prices for Add SKU
  const initChannelPrices = (basePrice: number) => {
    const activeCh = salesChannels.filter(c => c.isActive);
    return activeCh.map(ch => {
      let std = basePrice;
      let min = Math.round(basePrice * 0.93);

      if (ch.code === 'WHOLESALE') {
        std = Math.round(basePrice * 0.90);
        min = Math.round(basePrice * 0.85);
      } else if (ch.code === 'RETAIL') {
        std = basePrice;
        min = Math.round(basePrice * 0.93);
      } else if (ch.code === 'CUSTOMER') {
        std = basePrice;
        min = Math.round(basePrice * 0.97);
      }

      return {
        channelId: ch.id,
        channelName: ch.name,
        channelCode: ch.code,
        standardPrice: std,
        minimumPrice: min,
      };
    });
  };

  const handleStartAdd = () => {
    if (!product) return;
    setFormError(null);

    const prefix = product.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'SKU';
    const suggestedCode = `${prefix}-500`;
    const defaultSellingPrice = 45;

    setForm({
      skuCode: suggestedCode,
      variantName: '500gm',
      packSize: '500 gm',
      quantity: 500,
      unit: 'gm',
      mrp: 50,
      sellingPrice: defaultSellingPrice,
      barcode: '',
      isDefault: (product.skus || []).length === 0,
      isActive: true,
      channelPrices: initChannelPrices(defaultSellingPrice),
    });
    setActiveTab('add');
  };

  const handleStartEdit = (sku: ProductSku) => {
    setEditingSku(sku);
    setFormError(null);
    setForm({
      skuCode: sku.skuCode,
      variantName: sku.variantName || sku.packSize,
      packSize: sku.packSize,
      quantity: sku.quantity || 1,
      unit: sku.unit || 'pack',
      mrp: sku.mrp,
      sellingPrice: sku.sellingPrice || sku.mrp,
      barcode: sku.barcode || '',
      isDefault: Boolean(sku.isDefault),
      isActive: sku.isActive !== false,
      channelPrices: [],
    });
    setActiveTab('edit');
  };

  const handleStartPricing = (sku: ProductSku) => {
    setSelectedSkuForPricing(sku);
    setFormError(null);

    const activeCh = salesChannels.filter(c => c.isActive);
    const existingPrices = sku.channelPrices || [];

    const drafts = activeCh.map(ch => {
      const existing = existingPrices.find(ep => ep.channelId === ch.id);
      let std = existing ? existing.standardPrice : (sku.sellingPrice || sku.mrp);
      let min = existing ? existing.minimumPrice : Math.round(std * 0.92);

      if (!existing) {
        if (ch.code === 'WHOLESALE') {
          std = Math.round((sku.sellingPrice || sku.mrp) * 0.90);
          min = Math.round((sku.sellingPrice || sku.mrp) * 0.85);
        } else if (ch.code === 'RETAIL') {
          std = sku.sellingPrice || sku.mrp;
          min = Math.round((sku.sellingPrice || sku.mrp) * 0.93);
        }
      }

      return {
        channelId: ch.id,
        channelName: ch.name,
        channelCode: ch.code,
        standardPrice: std,
        minimumPrice: min,
        isActive: existing ? existing.isActive : true,
      };
    });

    setPricingForm(drafts);
    setActiveTab('pricing');
  };

  const handleVariantNameChange = (val: string) => {
    const cleanVariant = val.trim();
    setForm(prev => {
      let updatedCode = prev.skuCode;
      if (product) {
        const prefix = product.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'SKU';
        const suffix = cleanVariant.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'V1';
        updatedCode = `${prefix}-${suffix}`;
      }
      return {
        ...prev,
        variantName: val,
        packSize: val,
        skuCode: updatedCode,
      };
    });
  };

  const handleSellingPriceChange = (val: number) => {
    setForm(prev => {
      const updatedChannelPrices = prev.channelPrices.map(cp => {
        let std = val;
        let min = Math.round(val * 0.93);
        if (cp.channelCode === 'WHOLESALE') {
          std = Math.round(val * 0.90);
          min = Math.round(val * 0.85);
        } else if (cp.channelCode === 'RETAIL') {
          std = val;
          min = Math.round(val * 0.93);
        }
        return { ...cp, standardPrice: std, minimumPrice: min };
      });
      return { ...prev, sellingPrice: val, channelPrices: updatedChannelPrices };
    });
  };

  const handleChannelPriceChange = (channelId: string, field: 'standardPrice' | 'minimumPrice', val: number) => {
    setForm(prev => ({
      ...prev,
      channelPrices: prev.channelPrices.map(cp =>
        cp.channelId === channelId ? { ...cp, [field]: val } : cp
      ),
    }));
  };

  const handleDedicatedPricingChange = (channelId: string, field: 'standardPrice' | 'minimumPrice', val: number) => {
    setPricingForm(prev =>
      prev.map(cp => (cp.channelId === channelId ? { ...cp, [field]: val } : cp))
    );
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setFormError(null);

    if (!form.skuCode.trim()) {
      setFormError('SKU Code is required');
      return;
    }
    if (!form.variantName.trim()) {
      setFormError('Variant name is required (e.g. 500gm, 1kg)');
      return;
    }
    if (form.mrp <= 0) {
      setFormError('Valid MRP greater than zero is required');
      return;
    }

    // Validate floor prices
    for (const cp of form.channelPrices) {
      if (cp.minimumPrice > cp.standardPrice) {
        setFormError(`For ${cp.channelName}, Minimum Price (₹${cp.minimumPrice}) cannot exceed Standard Price (₹${cp.standardPrice}).`);
        return;
      }
      if (cp.standardPrice > form.mrp) {
        setFormError(`For ${cp.channelName}, Standard Price (₹${cp.standardPrice}) cannot exceed MRP (₹${form.mrp}).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await createSku({
        productId: product.id,
        skuCode: form.skuCode.trim().toUpperCase(),
        variantName: form.variantName.trim(),
        packSize: form.packSize.trim() || form.variantName.trim(),
        quantity: Number(form.quantity) || 1,
        unit: form.unit || 'pack',
        mrp: Number(form.mrp),
        sellingPrice: Number(form.sellingPrice),
        barcode: form.barcode.trim() || undefined,
        isDefault: form.isDefault,
        isActive: form.isActive,
        channelPrices: form.channelPrices.map(cp => ({
          channelId: cp.channelId,
          standardPrice: Number(cp.standardPrice),
          minimumPrice: Number(cp.minimumPrice),
        })),
      });

      setActiveTab('list');
    } catch (err: any) {
      setFormError(err.message || 'Failed to create child SKU');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSku) return;
    setFormError(null);

    if (!form.skuCode.trim()) {
      setFormError('SKU Code is required');
      return;
    }
    if (!form.variantName.trim()) {
      setFormError('Variant name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateSku(editingSku.id, {
        skuCode: form.skuCode.trim().toUpperCase(),
        variantName: form.variantName.trim(),
        packSize: form.packSize.trim() || form.variantName.trim(),
        quantity: Number(form.quantity) || 1,
        unit: form.unit || 'pack',
        mrp: Number(form.mrp),
        sellingPrice: Number(form.sellingPrice),
        barcode: form.barcode.trim() || undefined,
        isDefault: form.isDefault,
        isActive: form.isActive,
      });

      setActiveTab('list');
      setEditingSku(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update SKU');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDedicatedPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkuForPricing) return;
    setFormError(null);

    for (const cp of pricingForm) {
      if (cp.minimumPrice > cp.standardPrice) {
        setFormError(`For ${cp.channelName}, Minimum Floor Price (₹${cp.minimumPrice}) cannot exceed Standard Price (₹${cp.standardPrice}).`);
        return;
      }
      if (cp.standardPrice > selectedSkuForPricing.mrp) {
        setFormError(`For ${cp.channelName}, Standard Price (₹${cp.standardPrice}) cannot exceed MRP (₹${selectedSkuForPricing.mrp}).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await saveMultipleSkuChannelPrices(
        pricingForm.map(p => ({
          skuId: selectedSkuForPricing.id,
          channelId: p.channelId,
          standardPrice: Number(p.standardPrice),
          minimumPrice: Number(p.minimumPrice),
          isActive: p.isActive,
        }))
      );

      setActiveTab('list');
      setSelectedSkuForPricing(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save channel prices');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSku = async (sku: ProductSku) => {
    const conf = window.confirm(`Are you sure you want to delete SKU "${sku.skuCode}" (${sku.variantName})? This cannot be undone.`);
    if (!conf) return;

    try {
      await deleteSku(sku.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (sku: ProductSku) => {
    try {
      await toggleSkuActive(sku.id, !sku.isActive);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!product) return null;

  const skus = product.skus || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage SKUs: ${product.name}`}
      subtitle={`${product.category} • Brand: ${product.brand || 'Madhav Dairy'} • ${skus.length} Child SKU(s)`}
      maxWidth="4xl"
    >
      <div className="space-y-4 text-xs">
        {/* Navigation / Tab Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('list'); setFormError(null); }}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 ${
                activeTab === 'list'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>SKU List ({skus.length})</span>
            </button>
            {activeTab === 'add' && (
              <span className="px-3 py-1.5 rounded-lg font-bold text-xs bg-emerald-600 text-white flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Child SKU</span>
              </span>
            )}
            {activeTab === 'edit' && editingSku && (
              <span className="px-3 py-1.5 rounded-lg font-bold text-xs bg-amber-600 text-white flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit SKU: {editingSku.skuCode}</span>
              </span>
            )}
            {activeTab === 'pricing' && selectedSkuForPricing && (
              <span className="px-3 py-1.5 rounded-lg font-bold text-xs bg-indigo-600 text-white flex items-center gap-1.5">
                <BadgePercent className="w-3.5 h-3.5" />
                <span>Pricing Matrix: {selectedSkuForPricing.skuCode}</span>
              </span>
            )}
          </div>

          {activeTab === 'list' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleStartAdd}
            >
              + Add Child SKU
            </Button>
          )}
        </div>

        {/* Error Alert */}
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{formError}</span>
          </div>
        )}

        {/* TAB 1: SKU LIST VIEW */}
        {activeTab === 'list' && (
          <div className="space-y-3">
            {skus.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <Package className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm">No child SKUs created for this product family</h4>
                <p className="text-slate-500 max-w-sm mx-auto text-xs">
                  Create specific sellable variants (e.g. 500gm, 1kg, 2kg) with independent MRP, barcodes, and channel-wise standard/floor prices.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={handleStartAdd}
                >
                  Create First Child SKU
                </Button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">SKU Code</th>
                      <th className="py-2.5 px-3">Variant / Size</th>
                      <th className="py-2.5 px-3 text-right">MRP</th>
                      <th className="py-2.5 px-3 text-right">Base Price</th>
                      <th className="py-2.5 px-3">Channel Rates</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {skus.map(sku => {
                      const prices = sku.channelPrices || [];
                      return (
                        <tr key={sku.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-bold">
                                {sku.skuCode}
                              </span>
                              {sku.isDefault && (
                                <span className="bg-blue-100 text-blue-700 font-bold px-1.5 py-0.2 rounded text-[9px]">
                                  Default
                                </span>
                              )}
                            </div>
                            {sku.barcode && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                                <Barcode className="w-3 h-3 text-slate-400" />
                                <span>{sku.barcode}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">{sku.variantName || sku.packSize}</span>
                            <span className="text-[10px] text-slate-500">
                              {sku.quantity ? `${sku.quantity} ${sku.unit || 'pack'}` : sku.packSize}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-medium text-slate-500">
                            ₹{sku.mrp}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-blue-700">
                            ₹{sku.sellingPrice || sku.mrp}
                          </td>
                          <td className="py-3 px-3">
                            {prices.length > 0 ? (
                              <div className="flex flex-wrap gap-1 items-center">
                                {prices.map(cp => (
                                  <span
                                    key={cp.id || cp.channelId}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-50 text-slate-700 border border-slate-200"
                                    title={`${cp.channelName || cp.channelCode}: Std ₹${cp.standardPrice} | Floor ₹${cp.minimumPrice}`}
                                  >
                                    <span className="font-sans font-bold text-slate-500 mr-0.5 text-[9px]">
                                      {cp.channelCode ? cp.channelCode.slice(0, 3) : 'CH'}:
                                    </span>
                                    ₹{cp.standardPrice}
                                    <span className="text-slate-400 text-[9px] ml-1">(min ₹{cp.minimumPrice})</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-amber-600 italic">No channels set</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleToggleActive(sku)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                sku.isActive !== false
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {sku.isActive !== false ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleStartPricing(sku)}
                                className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors flex items-center gap-1 border border-indigo-200"
                                title="Manage Channel Pricing"
                              >
                                <BadgePercent className="w-3 h-3" />
                                <span>Pricing</span>
                              </button>
                              <button
                                onClick={() => handleStartEdit(sku)}
                                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                title="Edit SKU"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSku(sku)}
                                className="p-1.5 rounded bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                                title="Delete SKU"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2 & 3: ADD OR EDIT CHILD SKU FORM */}
        {(activeTab === 'add' || activeTab === 'edit') && (
          <form onSubmit={activeTab === 'add' ? handleSaveAdd : handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Variant / Pack Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.variantName}
                  onChange={e => handleVariantNameChange(e.target.value)}
                  placeholder="e.g. 500gm, 1kg, 200ml"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Sellable pack identifier</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  SKU Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.skuCode}
                  onChange={e => setForm({ ...form, skuCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. BAS-500, MILK-1L"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 uppercase"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Unique across entire inventory</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Barcode / EAN (Optional)
                </label>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={e => setForm({ ...form, barcode: e.target.value })}
                  placeholder="e.g. 8901234567890"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">For barcode scanner / billing</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pack Size Value</label>
                <input
                  type="number"
                  step="any"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Unit of Measure</label>
                <select
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="gm">gm</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="pouch">pouch</option>
                  <option value="bottle">bottle</option>
                  <option value="tin">tin</option>
                  <option value="piece">piece</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  MRP (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={form.mrp}
                  onChange={e => setForm({ ...form, mrp: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Base Selling Rate (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={form.sellingPrice}
                  onChange={e => handleSellingPriceChange(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-blue-700 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="flex items-center gap-6 px-1">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={e => setForm({ ...form, isDefault: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>Set as default product SKU</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>Active for sales catalog</span>
              </label>
            </div>

            {/* If adding: Channel Pricing Inputs */}
            {activeTab === 'add' && form.channelPrices.length > 0 && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Initial Channel Pricing Rules for this SKU</h5>
                    <p className="text-[10px] text-slate-500">
                      Rule: Standard Price is suggested price. Floor / Min Price is absolute minimum threshold.
                    </p>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Sales Channel</th>
                        <th className="py-2 px-3 text-right">Standard Price (₹)</th>
                        <th className="py-2 px-3 text-right">Minimum Price / Floor (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {form.channelPrices.map(cp => {
                        const isInvalid = cp.minimumPrice > cp.standardPrice;
                        return (
                          <tr key={cp.channelId} className={isInvalid ? 'bg-red-50/50' : ''}>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {cp.channelName}
                              <span className="ml-1.5 text-[9px] font-mono text-slate-400">
                                [{cp.channelCode}]
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={cp.standardPrice}
                                onChange={e => handleChannelPriceChange(cp.channelId, 'standardPrice', Number(e.target.value))}
                                className="w-24 text-right px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={cp.minimumPrice}
                                onChange={e => handleChannelPriceChange(cp.channelId, 'minimumPrice', Number(e.target.value))}
                                className={`w-24 text-right px-2 py-1 bg-slate-50 border rounded font-mono font-bold focus:bg-white focus:outline-none ${
                                  isInvalid ? 'border-red-400 text-red-700 bg-red-50' : 'border-slate-200 text-slate-800'
                                }`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setActiveTab('list'); setEditingSku(null); }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving SKU...' : activeTab === 'add' ? 'Create Child SKU' : 'Update SKU Details'}
              </Button>
            </div>
          </form>
        )}

        {/* TAB 4: DEDICATED CHANNEL PRICING MATRIX FOR A SPECIFIC SKU */}
        {activeTab === 'pricing' && selectedSkuForPricing && (
          <form onSubmit={handleSaveDedicatedPricing} className="space-y-4">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-950 text-xs">
                  Channel Pricing Rules for {selectedSkuForPricing.skuCode} ({selectedSkuForPricing.variantName})
                </span>
                <span className="font-mono font-bold text-slate-700">MRP: ₹{selectedSkuForPricing.mrp}</span>
              </div>
              <p className="text-[11px] text-indigo-700">
                Staff booking orders for this SKU will receive the channel standard price automatically. Selling below the channel minimum floor price is rejected by database constraints.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Sales Channel</th>
                    <th className="py-2.5 px-3 text-right">Standard Price (₹)</th>
                    <th className="py-2.5 px-3 text-right">Minimum Floor Price (₹)</th>
                    <th className="py-2.5 px-3 text-right">Allowable Margin</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pricingForm.map(cp => {
                    const diff = cp.standardPrice - cp.minimumPrice;
                    const isInvalid = cp.minimumPrice > cp.standardPrice;
                    return (
                      <tr key={cp.channelId} className={isInvalid ? 'bg-red-50/60' : 'hover:bg-slate-50'}>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {cp.channelName}
                          <span className="ml-1.5 text-[9px] font-mono text-slate-400">
                            [{cp.channelCode}]
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={cp.standardPrice}
                            onChange={e => handleDedicatedPricingChange(cp.channelId, 'standardPrice', Number(e.target.value))}
                            className="w-28 text-right px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                          />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={cp.minimumPrice}
                            onChange={e => handleDedicatedPricingChange(cp.channelId, 'minimumPrice', Number(e.target.value))}
                            className={`w-28 text-right px-2.5 py-1.5 bg-slate-50 border rounded-lg font-mono font-bold focus:bg-white focus:outline-none ${
                              isInvalid ? 'border-red-400 text-red-700 bg-red-50' : 'border-slate-200 text-slate-800'
                            }`}
                          />
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold">
                          {isInvalid ? (
                            <span className="text-red-600 font-bold">Invalid (Min &gt; Std)</span>
                          ) : (
                            <span className="text-emerald-700">₹{diff} range</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setPricingForm(prev =>
                                prev.map(p => p.channelId === cp.channelId ? { ...p, isActive: !p.isActive } : p)
                              );
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              cp.isActive
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {cp.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setActiveTab('list'); setSelectedSkuForPricing(null); }}
              >
                Back to SKUs
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving Prices...' : 'Save SKU Channel Prices'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
