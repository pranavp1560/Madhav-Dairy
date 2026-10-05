import React, { useState, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Product, ProductSku, SalesChannel, SkuChannelPrice } from '../../types/dairy';
import { Button } from '../ui/Button';
import {
  BadgePercent,
  Search,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Package,
  Layers,
  HelpCircle,
  TrendingDown,
  Info,
  Check,
  ShieldCheck,
  Table,
  Grid
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
    skuChannelPrices,
    saveMultipleSkuChannelPrices,
    saveMultipleChannelPrices,
    addToast
  } = useDairy();

  const [viewMode, setViewMode] = useState<'editor' | 'matrix'>('editor');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedSkuId, setSelectedSkuId] = useState<string>('');
  const [productSearch, setProductSearch] = useState('');
  const [matrixSearch, setMatrixSearch] = useState('');
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

  // When selected product changes, select its first SKU
  useEffect(() => {
    if (selectedProduct) {
      const skus = selectedProduct.skus || [];
      if (skus.length > 0) {
        const defaultSku = skus.find(s => s.isDefault) || skus[0];
        setSelectedSkuId(defaultSku.id);
      } else {
        setSelectedSkuId('');
      }
    }
  }, [selectedProductId, selectedProduct]);

  const selectedSku = selectedProduct?.skus?.find(s => s.id === selectedSkuId) || selectedProduct?.skus?.[0];

  // When selected SKU or sales channels change, initialize draft prices
  useEffect(() => {
    if (!selectedSku && !selectedProduct) return;

    const drafts: Record<string, ChannelPriceDraft> = {};
    const errors: Record<string, string> = {};

    const activeChannels = salesChannels.filter(c => c.isActive);
    const existingSkuPrices = selectedSku?.channelPrices || skuChannelPrices.filter(sp => sp.skuId === selectedSku?.id);
    const fallbackBasePrice = selectedSku ? (selectedSku.sellingPrice || selectedSku.mrp) : (selectedProduct?.defaultPrice || 50);

    activeChannels.forEach(ch => {
      const existing = existingSkuPrices.find(cp => cp.channelId === ch.id);

      let std = existing ? existing.standardPrice : fallbackBasePrice;
      let min = existing ? existing.minimumPrice : Math.round(fallbackBasePrice * 0.93);

      if (!existing) {
        if (ch.code === 'WHOLESALE') {
          std = Math.round(fallbackBasePrice * 0.90);
          min = Math.round(fallbackBasePrice * 0.85);
        } else if (ch.code === 'RETAIL') {
          std = fallbackBasePrice;
          min = Math.round(fallbackBasePrice * 0.93);
        } else if (ch.code === 'CUSTOMER') {
          std = fallbackBasePrice;
          min = Math.round(fallbackBasePrice * 0.97);
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
  }, [selectedSkuId, selectedSku, selectedProduct, salesChannels, skuChannelPrices]);

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
        errors[channelId] = `Minimum Price (₹${updated.minimumPrice}) cannot exceed Standard Price (₹${updated.standardPrice}).`;
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
    if (!selectedProduct || !selectedSku) return;

    if (hasAnyErrors) {
      addToast('Please resolve validation errors before saving.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = Object.values(draftPrices).map(d => ({
        skuId: selectedSku.id,
        channelId: d.channelId,
        standardPrice: Number(d.standardPrice),
        minimumPrice: Number(d.minimumPrice),
        isActive: d.isActive,
      }));

      await saveMultipleSkuChannelPrices(payload);

      // Also sync fallback product channel prices for backward compatibility
      if (selectedSku.isDefault) {
        await saveMultipleChannelPrices(
          Object.values(draftPrices).map(d => ({
            productId: selectedProduct.id,
            channelId: d.channelId,
            standardPrice: Number(d.standardPrice),
            minimumPrice: Number(d.minimumPrice),
            isActive: d.isActive,
          }))
        ).catch(() => {});
      }

      // Reset change flags
      setDraftPrices(prev => {
        const next: Record<string, ChannelPriceDraft> = {};
        Object.entries(prev).forEach(([k, v]) => {
          next[k] = { ...v, hasChanged: false, isExisting: true };
        });
        return next;
      });

      addToast(`Channel prices saved for ${selectedProduct.name} - ${selectedSku.variantName || selectedSku.packSize}!`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save channel prices', 'error');
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
            <span>Product & SKU Channel Pricing Engine</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Channel-wise Standard & Minimum Price Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Architecture: Product Family → Child SKU Variant → Channel Standard Price & Minimum Floor Price
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'editor'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Variant Editor</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'matrix'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Full Matrix Grid</span>
            </button>
          </div>

          {viewMode === 'editor' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="w-4 h-4" />}
              onClick={handleSaveAll}
              disabled={isSaving || hasAnyErrors || !hasUnsavedChanges}
            >
              {isSaving ? 'Saving Changes...' : 'Save SKU Pricing'}
            </Button>
          )}
        </div>
      </div>

      {/* 2. Informational Guidance Box */}
      <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Production Business Rule:</strong> For every SKU variant and sales channel (Retail, Wholesale, Customer), define a <strong>Standard Price</strong> (default selling rate) and <strong>Minimum Floor Price</strong> (hard lowest limit). Staff can negotiate anywhere between these two prices, but the database will strictly reject orders where the price is below the Minimum Floor Price.
        </div>
      </div>

      {/* 3. VIEW MODE: VARIANT EDITOR */}
      {viewMode === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Product Selector List (4 Cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col max-h-[700px]">
            <div className="p-3 border-b border-slate-200 bg-slate-50">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                1. Select Master Product
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
                const skus = p.skus || [];

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
                          {p.category} &bull; {skus.length} SKU{skus.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        p.pricingStatus === 'configured'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : p.pricingStatus === 'partial'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {skus.length} SKU{skus.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: SKU Selector & Channel Pricing Matrix (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedProduct && (
              <>
                {/* 2. Select Child SKU Variant */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        2. Select Child SKU / Pack Variant
                      </span>
                      <h2 className="text-base font-bold text-slate-900">
                        {selectedProduct.name} ({selectedProduct.category})
                      </h2>
                    </div>

                    <span className="text-xs font-mono font-medium text-slate-500">
                      Brand: {selectedProduct.brand || 'Madhav Dairy'}
                    </span>
                  </div>

                  {/* SKU Chips Selector */}
                  <div className="flex flex-wrap gap-2">
                    {(selectedProduct.skus || []).length === 0 ? (
                      <div className="p-3 text-center text-slate-500 text-xs w-full bg-slate-50 rounded-xl border border-slate-200">
                        No child SKUs created for this product yet. Please create SKUs in the Products Catalog page first.
                      </div>
                    ) : (
                      selectedProduct.skus.map(s => {
                        const isSkuSelected = s.id === selectedSkuId;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSkuId(s.id)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                              isSkuSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span className="font-mono text-[10px] opacity-80">{s.skuCode}</span>
                            <span>{s.variantName || s.packSize}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                              isSkuSelected ? 'bg-blue-700 text-white' : 'bg-white text-slate-700 border border-slate-200'
                            }`}>
                              MRP ₹{s.mrp}
                            </span>
                            {s.isDefault && (
                              <span className={`text-[9px] px-1 rounded ${
                                isSkuSelected ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                Default
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* SKU Details Banner */}
                {selectedSku && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-base shrink-0 border border-blue-100 font-mono">
                        {selectedSku.skuCode.slice(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">
                            {selectedProduct.name} — {selectedSku.variantName || selectedSku.packSize}
                          </h3>
                          <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                            {selectedSku.skuCode}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Pack: <span className="font-semibold text-slate-700">{selectedSku.packSize}</span>
                          {selectedSku.barcode && <> &bull; Barcode: <span className="font-mono">{selectedSku.barcode}</span></>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">SKU MRP</span>
                        <span className="text-sm font-mono-numbers font-black text-slate-900">
                          ₹{selectedSku.mrp}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-slate-200" />
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Base Price</span>
                        <span className="text-sm font-mono-numbers font-bold text-blue-700">
                          ₹{selectedSku.sellingPrice || selectedSku.mrp}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Channel Pricing Cards for Selected SKU */}
                {selectedSku && (
                  <div className="space-y-3">
                    {Object.values(draftPrices).map(draft => {
                      const error = validationErrors[draft.channelId];
                      const margin = draft.standardPrice > 0
                        ? Math.round(((draft.standardPrice - draft.minimumPrice) / draft.standardPrice) * 100)
                        : 0;
                      const isInvalid = draft.minimumPrice > draft.standardPrice;

                      return (
                        <div
                          key={draft.channelId}
                          className={`p-4 rounded-2xl border transition-all ${
                            isInvalid || error
                              ? 'bg-red-50/50 border-red-300 shadow-2xs'
                              : draft.hasChanged
                              ? 'bg-amber-50/30 border-amber-300 shadow-2xs'
                              : 'bg-white border-slate-200 shadow-2xs'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-slate-900">{draft.channelName}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                [{draft.channelCode}]
                              </span>
                              {draft.hasChanged && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Unsaved
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleActive(draft.channelId)}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                                draft.isActive
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {draft.isActive ? 'Active for Channel' : 'Channel Inactive'}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                            {/* Standard Price */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Standard Price (₹)
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={draft.standardPrice}
                                  onChange={e => handlePriceChange(draft.channelId, 'standardPrice', Number(e.target.value))}
                                  className="w-full text-sm font-mono-numbers font-black pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-600 text-slate-900"
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 mt-1 block">Default rate quoted to customer</span>
                            </div>

                            {/* Minimum Floor Price */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Minimum Floor Price (₹)
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={draft.minimumPrice}
                                  onChange={e => handlePriceChange(draft.channelId, 'minimumPrice', Number(e.target.value))}
                                  className={`w-full text-sm font-mono-numbers font-black pl-7 pr-3 py-2 bg-slate-50 border rounded-xl focus:bg-white focus:outline-none ${
                                    isInvalid ? 'border-red-400 text-red-700 bg-red-50' : 'border-slate-200 text-slate-900 focus:border-blue-600'
                                  }`}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 mt-1 block">Hard floor enforced by database</span>
                            </div>

                            {/* Margin Indicator */}
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Negotiation Range</span>
                                <span className="font-mono-numbers font-bold text-emerald-800">
                                  ₹{draft.standardPrice - draft.minimumPrice} allowable discount
                                </span>
                              </div>
                              <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                                {margin}%
                              </span>
                            </div>
                          </div>

                          {/* Error feedback */}
                          {error && (
                            <div className="mt-2 text-xs font-semibold text-red-600 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{error}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 4. VIEW MODE: FULL MATRIX GRID */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Comprehensive Product & SKU Pricing Matrix</h3>
              <p className="text-xs text-slate-500">Live overview of standard and minimum floor prices across all sales channels</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={matrixSearch}
                onChange={e => setMatrixSearch(e.target.value)}
                placeholder="Filter matrix..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 text-slate-900"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-3">Product Family</th>
                  <th className="py-3 px-3">SKU Variant</th>
                  <th className="py-3 px-3 text-right">MRP</th>
                  {salesChannels.filter(c => c.isActive).map(ch => (
                    <th key={ch.id} className="py-3 px-3 text-center border-l border-slate-200">
                      <div>{ch.name}</div>
                      <div className="text-[9px] font-mono text-slate-400">Std / Min</div>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {products
                  .filter(p =>
                    p.name.toLowerCase().includes(matrixSearch.toLowerCase()) ||
                    p.category.toLowerCase().includes(matrixSearch.toLowerCase())
                  )
                  .flatMap((p): { product: Product; sku: ProductSku | null }[] => {
                    const skus = p.skus || [];
                    if (skus.length === 0) {
                      return [{
                        product: p,
                        sku: null,
                      }];
                    }
                    return skus.map(s => ({
                      product: p,
                      sku: s,
                    }));
                  })
                  .map(({ product, sku }, idx) => {
                    return (
                      <tr key={`${product.id}-${sku?.id || idx}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {product.name}
                          <span className="text-[10px] text-slate-400 block font-normal">{product.category}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          {sku ? (
                            <div>
                              <span className="font-bold text-slate-900 block">{sku.variantName || sku.packSize}</span>
                              <span className="font-mono text-[10px] text-slate-500">{sku.skuCode}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No SKUs</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-500">
                          ₹{sku?.mrp || product.mrp || product.defaultPrice}
                        </td>

                        {/* Channel Columns */}
                        {salesChannels.filter(c => c.isActive).map(ch => {
                          const skuPrice = sku?.channelPrices?.find((cp: any) => cp.channelId === ch.id && cp.isActive);
                          const prodFallback = product.channelPrices?.find((cp: any) => cp.channelId === ch.id && cp.isActive);
                          const activePrice = skuPrice || prodFallback;

                          return (
                            <td key={ch.id} className="py-2.5 px-3 text-center border-l border-slate-100 font-mono">
                              {activePrice ? (
                                <div>
                                  <span className="font-bold text-slate-900">₹{activePrice.standardPrice}</span>
                                  <span className="text-slate-400 text-[10px] ml-1">/ min ₹{activePrice.minimumPrice}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px] italic">—</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedProductId(product.id);
                              if (sku) setSelectedSkuId(sku.id);
                              setViewMode('editor');
                            }}
                            className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
