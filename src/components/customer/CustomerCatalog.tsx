import React, { useState, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { Product, ProductSku } from '../../types/dairy';
import {
  Search,
  Plus,
  Minus,
  Package,
  ArrowRight,
  ArrowLeft,
  Check,
  ShoppingCart,
  ChevronRight,
  Layers
} from 'lucide-react';

interface CustomerCatalogProps {
  onNavigate: (tab: string) => void;
}

export const CustomerCatalog: React.FC<CustomerCatalogProps> = ({ onNavigate }) => {
  const {
    products,
    cart,
    addToCart,
    updateCartQty,
    cartCount,
    cartTotal,
    currentRetailer,
    channelPrices,
    skuChannelPrices,
    categories: dbCategories,
    isLoading
  } = useDairy();

  const { t } = useTranslation();

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Sync selected product with URL hash for effortless mobile & browser back navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#product-')) {
        const id = hash.replace('#product-', '');
        setSelectedProductId(id);
      } else {
        setSelectedProductId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleOpenProduct = (productId: string) => {
    setSelectedProductId(productId);
    window.location.hash = `#product-${productId}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => {
    setSelectedProductId(null);
    if (window.location.hash.startsWith('#product-')) {
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
  };

  // Dynamic category pills
  const categoriesList = [
    'All',
    ...Array.from(new Set([
      ...dbCategories.filter(c => c.isActive).map(c => c.name),
      ...products.map(p => p.category)
    ])).filter(Boolean)
  ];

  // Resolve customer channel standard selling price for a given SKU (never exposes floor minimum price)
  const getSkuPriceInfo = (prod: Product, sku?: ProductSku) => {
    let price = sku ? (sku.sellingPrice || sku.mrp) : prod.defaultPrice;
    let label = 'Standard Rate';

    if (currentRetailer?.salesChannelId) {
      // 1. First priority: SKU-specific channel price
      const skuCp = sku?.channelPrices?.find(
        c => c.channelId === currentRetailer.salesChannelId && c.isActive
      ) || skuChannelPrices.find(
        c => c.skuId === sku?.id && c.channelId === currentRetailer.salesChannelId && c.isActive
      );

      if (skuCp) {
        price = skuCp.standardPrice;
        label = `${skuCp.channelName || currentRetailer.salesChannelName || 'Wholesale'} Rate`;
      } else {
        // 2. Second priority: Fallback to parent product channel price
        const prodCp = (prod.channelPrices || channelPrices).find(
          c => c.productId === prod.id && c.channelId === currentRetailer.salesChannelId && c.isActive
        );
        if (prodCp) {
          price = prodCp.standardPrice;
          label = `${prodCp.channelName || currentRetailer.salesChannelName || 'Wholesale'} Rate`;
        } else if (currentRetailer.salesChannelName) {
          label = `${currentRetailer.salesChannelName} Rate`;
        }
      }
    } else if (currentRetailer?.salesChannelName) {
      label = `${currentRetailer.salesChannelName} Rate`;
    }

    const mrp = sku?.mrp || prod.mrp || Math.round(price * 1.15);
    const savings = mrp > price ? mrp - price : 0;

    return { price, mrp, savings, label };
  };

  // Check how many items of a given SKU are already in the cart
  const getCartSkuQuantity = (productId: string, skuId?: string) => {
    const item = cart.find(i => i.product.id === productId && (skuId ? i.sku?.id === skuId : !i.sku));
    return item ? item.quantity : 0;
  };

  // Check how many total items of a parent product are across any SKUs in the cart
  const getProductTotalCartQty = (productId: string) => {
    return cart
      .filter(i => i.product.id === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const getCategoryBadgeClass = (cat: string) => {
    const lower = (cat || '').toLowerCase();
    if (lower.includes('milk') || lower.includes('curd')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (lower.includes('paneer') || lower.includes('ghee')) return 'bg-amber-50 text-amber-800 border-amber-200';
    if (lower.includes('sweets') || lower.includes('basundi') || lower.includes('shrikhand')) return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  };

  // Filter parent products based on Category and Search
  const filteredProducts = products.filter(p => {
    if (p.isActive === false) return false;

    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchesCat;

    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.skus || []).some(s =>
        (s.variantName && s.variantName.toLowerCase().includes(q)) ||
        (s.packSize && s.packSize.toLowerCase().includes(q)) ||
        (s.skuCode && s.skuCode.toLowerCase().includes(q))
      );

    return matchesCat && matchesSearch;
  });

  const selectedProduct = selectedProductId
    ? products.find(p => p.id === selectedProductId)
    : null;

  // =========================================================================
  // VIEW 2: PARENT PRODUCT DETAIL & SKU SELECTION PAGE
  // =========================================================================
  if (selectedProductId && selectedProduct) {
    const activeSkus = (selectedProduct.skus || []).filter(s => s.isActive !== false);

    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-36 font-sans animate-in fade-in duration-200">
        {/* Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBackToList}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-blue-700 hover:bg-blue-50 text-sm font-bold shadow-2xs transition-all active:scale-95"
            aria-label="Back to Products"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Back to Products</span>
          </button>

          {cartCount > 0 && (
            <button
              onClick={() => onNavigate('cart')}
              className="inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold text-sm hover:bg-blue-100 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Cart ({cartCount})</span>
            </button>
          )}
        </div>

        {/* Parent Master Product Header Card */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-md border ${getCategoryBadgeClass(selectedProduct.category)}`}>
              {selectedProduct.category}
            </span>
            {selectedProduct.isAvailable ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {t.customer.products.inStock}
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                {t.customer.products.outOfStock}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {selectedProduct.name}
            </h1>
            <span className="text-xs text-slate-500 font-medium block mt-0.5">
              {selectedProduct.brand || 'Madhav Dairy'}
            </span>
          </div>

          {selectedProduct.description && (
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed pt-1 border-t border-slate-100">
              {selectedProduct.description}
            </p>
          )}
        </div>

        {/* Section Heading: Select Pack Size */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Select Pack Size
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Choose your required pack size and quantity
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            {activeSkus.length} {activeSkus.length === 1 ? 'pack size' : 'pack sizes'}
          </span>
        </div>

        {/* Active SKUs List / Grid */}
        {activeSkus.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 text-center space-y-3 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No pack sizes are currently available for this product.</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
              Please check back soon or browse our other fresh dairy products.
            </p>
            <button
              onClick={handleBackToList}
              className="min-h-[44px] px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              Browse Other Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {activeSkus.map(sku => {
              const { price: effectivePrice, mrp, savings, label: rateLabel } = getSkuPriceInfo(selectedProduct, sku);
              const inCartQty = getCartSkuQuantity(selectedProduct.id, sku.id);
              const isSkuAvailable = selectedProduct.isAvailable && sku.isActive !== false;

              return (
                <div
                  key={sku.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between space-y-4"
                >
                  {/* Top: Pack Name & Price */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                          {sku.variantName || sku.packSize}
                        </h3>
                        <span className="text-xs text-slate-500 font-semibold block mt-0.5">
                          {sku.quantity ? `${sku.quantity} ${sku.unit}` : sku.unit} pack
                        </span>
                      </div>

                      {inCartQty > 0 ? (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1 shrink-0">
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                          <span>{inCartQty} in cart</span>
                        </span>
                      ) : !isSkuAvailable ? (
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                          Out of Stock
                        </span>
                      ) : null}
                    </div>

                    {/* Price Block */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono-numbers">
                          ₹{effectivePrice}
                        </span>
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                          {rateLabel}
                        </span>
                      </div>

                      {/* MRP & Savings (Never shows internal minimum price) */}
                      <div className="flex items-center gap-2 mt-1">
                        {mrp > effectivePrice && (
                          <>
                            <span className="text-sm text-slate-400 line-through font-mono-numbers">
                              MRP ₹{mrp}
                            </span>
                            {savings > 0 && (
                              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Save ₹{savings}/pack
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Direct-to-Cart Action / Stepper */}
                  <div className="pt-2">
                    {inCartQty === 0 ? (
                      /* Not in cart yet: 1-click Add to Cart */
                      <button
                        type="button"
                        onClick={() => addToCart(selectedProduct.id, 1, sku.id)}
                        disabled={!isSkuAvailable}
                        className="w-full h-12 min-h-[48px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-sm sm:text-base shadow-2xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                      >
                        <Plus className="w-5 h-5 stroke-[2.5]" />
                        <span>Add to Cart</span>
                      </button>
                    ) : (
                      /* Already in cart: Live Stepper directly synchronizing cart */
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between bg-blue-50/90 border border-blue-200 rounded-xl p-1.5 shadow-2xs">
                          {/* Decrease / Remove from Cart */}
                          <button
                            type="button"
                            onClick={() => updateCartQty(selectedProduct.id, inCartQty - 1, sku.id)}
                            className="min-w-[44px] min-h-[44px] w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white text-slate-800 hover:bg-blue-100 active:bg-blue-200 flex items-center justify-center transition-colors shadow-2xs border border-blue-200"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-5 h-5 stroke-[2.5]" />
                          </button>

                          {/* Live Quantity Display & Subtotal */}
                          <div className="flex-1 text-center px-1">
                            <div className="flex items-baseline justify-center gap-1">
                              <span className="text-xl sm:text-2xl font-black text-blue-950 font-mono-numbers">
                                {inCartQty}
                              </span>
                              <span className="text-xs text-blue-700 font-semibold">
                                {inCartQty === 1 ? 'pack' : 'packs'}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-blue-600 font-mono-numbers block">
                              ₹{(inCartQty * effectivePrice).toLocaleString()}
                            </span>
                          </div>

                          {/* Increase Quantity in Cart */}
                          <button
                            type="button"
                            onClick={() => updateCartQty(selectedProduct.id, inCartQty + 1, sku.id)}
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

        {/* Sticky Bottom Cart Floating Bar */}
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
  }

  // =========================================================================
  // VIEW 1: MAIN CUSTOMER PRODUCT LIST (PARENT PRODUCT ROWS)
  // =========================================================================
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-36 font-sans">
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

      {/* 2. Parent Products List Rows */}
      {isLoading && products.length === 0 ? (
        // Loading Skeleton
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {[1, 2, 3, 4, 5].map(idx => (
            <div key={idx} className="p-5 flex items-center justify-between gap-4 animate-pulse">
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-slate-200 rounded w-1/3" />
                <div className="h-4 bg-slate-100 rounded w-1/4" />
              </div>
              <div className="w-6 h-6 bg-slate-200 rounded-full" />
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3 shadow-2xs">
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {filteredProducts.map(prod => {
            const activeSkus = (prod.skus || []).filter(s => s.isActive !== false);
            const totalInCart = getProductTotalCartQty(prod.id);

            // Compute starting channel price across active SKUs
            const skuPrices = activeSkus.map(s => getSkuPriceInfo(prod, s).price);
            const minPrice = skuPrices.length > 0 ? Math.min(...skuPrices) : prod.defaultPrice;
            const maxPrice = skuPrices.length > 0 ? Math.max(...skuPrices) : prod.defaultPrice;
            const priceDisplay = skuPrices.length > 0
              ? (minPrice === maxPrice ? `₹${minPrice}` : `From ₹${minPrice}`)
              : `₹${prod.defaultPrice}`;

            const packCountText = activeSkus.length === 0
              ? 'No packs available'
              : `${activeSkus.length} ${activeSkus.length === 1 ? 'pack size' : 'pack sizes'}`;

            return (
              <div
                key={prod.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenProduct(prod.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenProduct(prod.id);
                  }
                }}
                className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-blue-50/40 active:bg-blue-100/50 transition-colors cursor-pointer group text-left select-none"
              >
                {/* Left: Product Information */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                      {prod.name}
                    </h2>
                    {prod.brand && (
                      <span className="text-xs text-slate-400 font-normal hidden sm:inline">
                        • {prod.brand}
                      </span>
                    )}
                  </div>

                  {/* Secondary Line: Category + Pack Sizes + Starting Price */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className={`font-bold uppercase px-2 py-0.5 rounded border text-[11px] ${getCategoryBadgeClass(prod.category)}`}>
                      {prod.category}
                    </span>

                    <span className="inline-flex items-center gap-1 font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      <Layers className="w-3 h-3 text-slate-400" />
                      <span>{packCountText}</span>
                    </span>

                    <span className="font-mono-numbers font-bold text-slate-800">
                      {priceDisplay}
                    </span>

                    {totalInCart > 0 && (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                        <span>{totalInCart} in cart</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Touch Arrow Indicator */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
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
