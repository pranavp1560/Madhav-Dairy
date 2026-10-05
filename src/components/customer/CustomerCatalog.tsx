import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { Product, ProductCategory } from '../../types/dairy';
import {
  Search,
  Plus,
  Minus,
  Package,
  ArrowRight,
  Check,
  ShoppingCart
} from 'lucide-react';

interface CustomerCatalogProps {
  onNavigate: (tab: string) => void;
}

export const CustomerCatalog: React.FC<CustomerCatalogProps> = ({ onNavigate }) => {
  const { products, cart, addToCart, updateCartQty, cartCount, cartTotal, currentRetailer, channelPrices, categories: dbCategories } = useDairy();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSkuByProduct, setSelectedSkuByProduct] = useState<Record<string, string>>({});

  // Dynamic categories
  const categoriesList = [
    'All',
    ...Array.from(new Set([
      ...dbCategories.filter(c => c.isActive).map(c => c.name),
      ...products.map(p => p.category)
    ])).filter(Boolean)
  ];

  // Resolve customer channel standard price for a specific SKU or fallback to product
  const getSkuPriceInfo = (prod: Product, sku?: any) => {
    let price = sku ? (sku.sellingPrice || sku.mrp) : prod.defaultPrice;
    let label = 'Wholesale Rate';

    if (currentRetailer?.salesChannelId) {
      if (sku?.channelPrices && sku.channelPrices.length > 0) {
        const scp = sku.channelPrices.find(
          (c: any) => c.channelId === currentRetailer.salesChannelId && c.isActive
        );
        if (scp) {
          price = scp.standardPrice;
          label = `${scp.channelName || currentRetailer.salesChannelName || 'Channel'} Rate`;
        }
      } else {
        const cp = (prod.channelPrices || channelPrices).find(
          (c: any) => c.productId === prod.id && c.channelId === currentRetailer.salesChannelId && c.isActive
        );
        if (cp) {
          price = cp.standardPrice;
          label = `${cp.channelName || currentRetailer.salesChannelName || 'Channel'} Rate`;
        } else if (currentRetailer.salesChannelName) {
          label = `${currentRetailer.salesChannelName} Rate`;
        }
      }
    }

    const mrp = sku?.mrp || prod.mrp || Math.round(price * 1.15);
    const savings = mrp > price ? mrp - price : 0;

    return { price, mrp, savings, label };
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getCartQuantity = (productId: string, skuId?: string) => {
    const item = cart.find(i => i.product.id === productId && (skuId ? i.sku?.id === skuId : true));
    return item ? item.quantity : 0;
  };

  const handleAddProduct = (productId: string, skuId?: string) => {
    addToCart(productId, 1, skuId);
  };

  const getCategoryBadgeClass = (cat: string) => {
    if (cat.includes('Milk') || cat.includes('Curd')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (cat.includes('Paneer') || cat.includes('Ghee')) return 'bg-amber-50 text-amber-800 border-amber-200';
    if (cat.includes('Sweets')) return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-36 font-sans">
      {/* 1. Header, Search & Category Filters */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {t.customer.products.title}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Fresh wholesale dairy catalog with live retailer rates
            </p>
          </div>
          <span className="text-sm font-bold text-blue-700 bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-200 shrink-0 self-start sm:self-auto">
            {filteredProducts.length} Products Available
          </span>
        </div>

        {/* Large, Touch-Friendly Search Input */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.customer.products.searchPlaceholder}
            className="w-full h-12 min-h-[48px] pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* Horizontal Category Filter Pills (Min 44px Touch Targets) */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categoriesList.map(cat => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[44px] px-4 py-2.5 rounded-xl whitespace-nowrap text-sm font-bold transition-all shrink-0 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{cat === 'All' ? t.customer.products.allCategories : cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">No products found</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query or clear your category filters.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="min-h-[44px] px-5 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredProducts.map(prod => {
            const activeSkus = (prod.skus || []).filter(s => s.isActive !== false);
            const chosenSkuId = selectedSkuByProduct[prod.id];
            const currentSku = activeSkus.find(s => s.id === chosenSkuId) || activeSkus.find(s => s.isDefault) || activeSkus[0] || null;

            const qty = getCartQuantity(prod.id, currentSku?.id);
            const { price: effectivePrice, mrp, savings, label: rateLabel } = getSkuPriceInfo(prod, currentSku);

            return (
              <div
                key={prod.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between space-y-4"
              >
                {/* Top: Category Tag & Availability */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-md border ${getCategoryBadgeClass(prod.category)}`}>
                      {prod.category}
                    </span>
                    {prod.isAvailable ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {t.customer.products.inStock}
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                        {t.customer.products.outOfStock}
                      </span>
                    )}
                  </div>

                  {/* Product Title */}
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {prod.name}
                  </h2>

                  {/* Brand */}
                  <span className="text-xs text-slate-400 block font-normal">
                    {prod.brand || 'Madhav Dairy'}
                  </span>

                  {/* Child SKU Variant Chips (if multiple variants exist) */}
                  {activeSkus.length > 1 && (
                    <div className="pt-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Select Pack Size:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeSkus.map(s => {
                          const isSelected = s.id === currentSku?.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setSelectedSkuByProduct(prev => ({ ...prev, [prod.id]: s.id }))}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {s.variantName || s.packSize}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pack Size */}
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                    <span className="font-medium">{t.customer.products.pack}:</span>
                    <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md">
                      {currentSku?.packSize || currentSku?.variantName || prod.unit}
                    </span>
                  </div>

                  {/* Price & Savings Display */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono-numbers">
                          ₹{effectivePrice}
                        </span>
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                          {rateLabel}
                        </span>
                      </div>

                      {/* MRP & Savings */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-slate-400 line-through font-mono-numbers">
                          MRP ₹{mrp}
                        </span>
                        {savings > 0 && (
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Save ₹{savings}/pack
                          </span>
                        )}
                      </div>
                    </div>

                    {qty > 0 && (
                      <div className="text-right">
                        <span className="text-xs font-medium text-slate-400 block">Subtotal</span>
                        <span className="text-base sm:text-lg font-black text-blue-700 font-mono-numbers">
                          ₹{(qty * effectivePrice).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom: Large Touch Stepper or Add to Cart Button */}
                <div className="pt-2">
                  {qty === 0 ? (
                    <button
                      onClick={() => handleAddProduct(prod.id, currentSku?.id)}
                      disabled={!prod.isAvailable}
                      className="w-full h-12 min-h-[48px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-sm sm:text-base shadow-2xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                      <span>{t.customer.products.add}</span>
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      {/* Big, Touch-Friendly Stepper Control (Min 44px Hit Targets) */}
                      <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 rounded-xl p-1.5 shadow-2xs">
                        <button
                          onClick={() => updateCartQty(prod.id, qty - 1, currentSku?.id)}
                          className="min-w-[44px] min-h-[44px] w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white text-slate-800 hover:bg-blue-100 active:bg-blue-200 flex items-center justify-center transition-colors shadow-2xs border border-blue-200"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-5 h-5 stroke-[2.5]" />
                        </button>

                        <div className="flex-1 text-center">
                          <span className="text-xl sm:text-2xl font-black text-blue-950 font-mono-numbers">
                            {qty}
                          </span>
                          <span className="text-xs text-blue-600 block font-semibold">packs</span>
                        </div>

                        <button
                          onClick={() => updateCartQty(prod.id, qty + 1, currentSku?.id)}
                          className="min-w-[44px] min-h-[44px] w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 flex items-center justify-center transition-colors shadow-2xs"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-5 h-5 stroke-[2.5]" />
                        </button>
                      </div>

                      <div className="text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-1">
                        <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                        <span>In your cart</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Sticky Bottom Cart Summary Floating Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-20 md:bottom-6 inset-x-0 p-3 max-w-xl mx-auto z-40 pointer-events-none">
          <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-base font-mono-numbers shadow-sm">
                {cartCount}
              </div>
              <div>
                <span className="text-sm font-bold text-white block">
                  {cartCount} {cartCount === 1 ? 'Product Selected' : 'Products Selected'}
                </span>
                <span className="text-base sm:text-lg font-black text-blue-300 font-mono-numbers">
                  Total: ₹{cartTotal.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('cart')}
              className="min-h-[48px] px-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm sm:text-base flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <span>Review Cart</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
