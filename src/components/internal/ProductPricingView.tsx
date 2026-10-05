import React, { useState, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Product, SalesChannel, ProductChannelPrice } from '../../types/dairy';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import {
  BadgePercent,
  Search,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Package,
  Network,
  IndianRupee,
  Layers,
  HelpCircle,
  TrendingDown,
  Info
} from 'lucide-react';

interface ChannelPriceDraft {
  channelId: string;
  channelName: string;
  channelCode: string;
  standardPrice: number;
  minimumPrice: number;
  isActive: boolean;
  isExisting: boolean;
  hasChanged: boolean;
}

export const ProductPricingView: React.FC = () => {
  const {
    products,
    salesChannels,
    channelPrices,
    saveMultipleChannelPrices,
    addToast
  } = useDairy();

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState('');
  const [draftPrices, setDraftPrices] = useState<Record<string, ChannelPriceDraft>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize selected product when products load
  useEffect(() => {
    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // When selected product or channel prices change, initialize draft prices
  useEffect(() => {
    if (!selectedProduct) return;

    const drafts: Record<string, ChannelPriceDraft> = {};
    const errors: Record<string, string> = {};

    const activeChannels = salesChannels.filter(c => c.isActive);

    activeChannels.forEach(ch => {
      // Find existing price
      const existing = (selectedProduct.channelPrices || channelPrices).find(
        cp => cp.productId === selectedProduct.id && cp.channelId === ch.id
      );

      let std = existing ? existing.standardPrice : selectedProduct.defaultPrice;
      let min = existing ? existing.minimumPrice : Math.round(selectedProduct.defaultPrice * 0.90);

      // Channel-based smart heuristics if no pricing existed
      if (!existing) {
        if (ch.code === 'WHOLESALE') {
          std = Math.round(selectedProduct.defaultPrice * 0.90);
          min = Math.round(selectedProduct.defaultPrice * 0.85);
        } else if (ch.code === 'RETAIL') {
          std = selectedProduct.defaultPrice;
          min = Math.round(selectedProduct.defaultPrice * 0.93);
        } else if (ch.code === 'CUSTOMER') {
          std = selectedProduct.defaultPrice;
          min = Math.round(selectedProduct.defaultPrice * 0.96);
        }
      }

      drafts[ch.id] = {
        channelId: ch.id,
        channelName: ch.name,
        channelCode: ch.code,
        standardPrice: std,
        minimumPrice: min,
        isActive: existing ? existing.isActive : true,
        isExisting: !!existing,
        hasChanged: false,
      };
    });

    setDraftPrices(drafts);
    setValidationErrors(errors);
  }, [selectedProductId, selectedProduct, salesChannels, channelPrices]);

  const handlePriceChange = (channelId: string, field: 'standardPrice' | 'minimumPrice', value: number) => {
    setDraftPrices(prev => {
      const current = prev[channelId];
      if (!current) return prev;

      const updated = {
        ...current,
        [field]: value,
        hasChanged: true,
      };

      // Validate: Minimum Price must never exceed Standard Price
      const errors = { ...validationErrors };
      if (updated.minimumPrice > updated.standardPrice) {
        errors[channelId] = `Minimum Price (₹${updated.minimumPrice}) cannot be higher than Standard Price (₹${updated.standardPrice}).`;
      } else if (updated.standardPrice < 0 || updated.minimumPrice < 0) {
        errors[channelId] = 'Prices must be greater than or equal to ₹0.';
      } else {
        delete errors[channelId];
      }
      setValidationErrors(errors);

      return {
        ...prev,
        [channelId]: updated,
      };
    });
  };

  const handleToggleActive = (channelId: string) => {
    setDraftPrices(prev => {
      const current = prev[channelId];
      if (!current) return prev;
      return {
        ...prev,
        [channelId]: {
          ...current,
          isActive: !current.isActive,
          hasChanged: true,
        },
      };
    });
  };

  const hasAnyErrors = Object.keys(validationErrors).length > 0;
  const hasUnsavedChanges = Object.values(draftPrices).some(d => d.hasChanged);

  const handleSaveAll = async () => {
    if (!selectedProduct) return;

    if (hasAnyErrors) {
      addToast('Please resolve validation errors before saving.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = Object.values(draftPrices).map(d => ({
        productId: selectedProduct.id,
        channelId: d.channelId,
        standardPrice: Number(d.standardPrice),
        minimumPrice: Number(d.minimumPrice),
        isActive: d.isActive,
      }));

      await saveMultipleChannelPrices(payload);

      // Reset change flags
      setDraftPrices(prev => {
        const next: Record<string, ChannelPriceDraft> = {};
        Object.entries(prev).forEach(([k, v]) => {
          next[k] = { ...v, hasChanged: false, isExisting: true };
        });
        return next;
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-5 font-sans">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <BadgePercent className="w-4 h-4 text-blue-600" />
            <span>Multi-Channel Pricing Engine</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Channel-wise Product Pricing Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Set Standard Selling Price and Minimum Floor Price per sales channel. Selling price must never go below Minimum Price.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Save className="w-4 h-4" />}
            onClick={handleSaveAll}
            disabled={isSaving || hasAnyErrors || !hasUnsavedChanges}
          >
            {isSaving ? 'Saving Changes...' : 'Save Channel Pricing'}
          </Button>
        </div>
      </div>

      {/* 2. Main Two-Column Layout: Product Selector on Left, Channel Price Config on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Product Selector List (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col max-h-[700px]">
          <div className="p-3 border-b border-slate-200 bg-slate-50">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Select Dairy Product
            </span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 text-slate-900"
              />
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
            {filteredProducts.map(p => {
              const isSelected = p.id === selectedProductId;
              const configuredCount = (p.channelPrices || []).filter(cp => cp.isActive).length;

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProductId(p.id)}
                  className={`w-full text-left p-3.5 flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-blue-50 border-l-4 border-blue-600 pl-3'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      isSelected ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {p.name.charAt(0)}
                    </div>
                    <div className="truncate">
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                        {p.name}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {p.category} &bull; {p.unit}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <span className="text-[11px] font-mono-numbers font-bold text-slate-700 block">
                      MRP ₹{p.mrp || Math.round(p.defaultPrice * 1.15)}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                      configuredCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {configuredCount} Channels
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Pricing Rules Matrix for Selected Product (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedProduct ? (
            <>
              {/* Product Info Banner */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-base shrink-0 border border-blue-100">
                    {selectedProduct.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {selectedProduct.name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Category: <span className="font-semibold text-slate-700">{selectedProduct.category}</span> &bull; Pack: <span className="font-semibold text-slate-700">{selectedProduct.unit}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Maximum Retail Price</span>
                    <span className="text-sm font-mono-numbers font-black text-slate-900">
                      ₹{selectedProduct.mrp || Math.round(selectedProduct.defaultPrice * 1.15)}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Catalog Base Price</span>
                    <span className="text-sm font-mono-numbers font-bold text-blue-700">
                      ₹{selectedProduct.defaultPrice}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informational Guidance Box */}
              <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Business Rule:</strong> For every sales channel, define a <strong>Standard Price</strong> (default rate) and <strong>Minimum Price</strong> (hard price floor). Orders can be negotiated anywhere between these two values, but the selling price will be rejected if set below Minimum Price.
                </div>
              </div>

              {/* Channel Pricing Cards / Matrix */}
              <div className="space-y-3">
                {Object.values(draftPrices).map(draft => {
                  const error = validationErrors[draft.channelId];
                  const margin = draft.standardPrice > 0
                    ? Math.round(((draft.standardPrice - draft.minimumPrice) / draft.standardPrice) * 100)
                    : 0;

                  return (
                    <div
                      key={draft.channelId}
                      className={`p-4 rounded-2xl border transition-all ${
                        error
                          ? 'bg-red-50/50 border-red-300 shadow-2xs'
                          : draft.hasChanged
                          ? 'bg-amber-50/30 border-amber-300 shadow-2xs'
                          : 'bg-white border-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                            <Network className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-sm block">
                              {draft.channelName} Channel
                            </span>
                            <span className="text-[10px] font-mono-numbers font-semibold text-slate-500">
                              CODE: {draft.channelCode}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {draft.hasChanged && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Unsaved edits
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(draft.channelId)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                              draft.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            <span>{draft.isActive ? 'Active Channel Price' : 'Disabled'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Input Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3.5">
                        {/* Standard Price */}
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Standard Selling Price (₹) <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={draft.standardPrice}
                              onChange={e => handlePriceChange(draft.channelId, 'standardPrice', parseFloat(e.target.value) || 0)}
                              className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono-numbers font-bold text-blue-700 focus:bg-white focus:border-blue-600 focus:outline-none"
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Default price applied when a {draft.channelName} customer creates an order.
                          </p>
                        </div>

                        {/* Minimum Price */}
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Minimum Allowed Floor Price (₹) <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={draft.minimumPrice}
                              onChange={e => handlePriceChange(draft.channelId, 'minimumPrice', parseFloat(e.target.value) || 0)}
                              className={`w-full pl-7 pr-3 py-2 bg-slate-50 border rounded-xl text-xs font-mono-numbers font-bold focus:bg-white focus:outline-none ${
                                error
                                  ? 'border-red-400 text-red-700 focus:border-red-600'
                                  : 'border-slate-200 text-slate-900 focus:border-blue-600'
                              }`}
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Absolute floor. Internal staff cannot sell below this rate.
                          </p>
                        </div>
                      </div>

                      {/* Validation Error Alert */}
                      {error && (
                        <div className="mt-3 p-2.5 bg-red-100/80 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          <span className="font-medium">{error}</span>
                        </div>
                      )}

                      {/* Price Range Summary Bar */}
                      {!error && draft.standardPrice >= draft.minimumPrice && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <div className="flex items-center gap-2">
                            <span>Allowed Selling Range:</span>
                            <strong className="font-mono-numbers text-slate-800">
                              ₹{draft.minimumPrice} &rarr; ₹{draft.standardPrice}
                            </strong>
                          </div>
                          <span className="text-emerald-700 font-medium">
                            Negotiation buffer: ₹{draft.standardPrice - draft.minimumPrice} ({margin}%)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Save Bar */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  {hasUnsavedChanges
                    ? 'You have unsaved pricing updates.'
                    : 'All channel prices are up-to-date in the database.'}
                </span>

                <Button
                  variant="primary"
                  size="sm"
                  icon={<Save className="w-4 h-4" />}
                  onClick={handleSaveAll}
                  disabled={isSaving || hasAnyErrors || !hasUnsavedChanges}
                >
                  {isSaving ? 'Saving...' : 'Save Channel Pricing'}
                </Button>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-800">No Product Selected</p>
              <p className="text-xs text-slate-400 mt-1">Choose a product from the left menu to view channel pricing.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
