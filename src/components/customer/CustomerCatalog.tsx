import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { ProductCategory } from '../../types/dairy';
import {
  Search,
  Plus,
  Minus,
  Package,
  ArrowRight,
  Check
} from 'lucide-react';

interface CustomerCatalogProps {
  onNavigate: (tab: string) => void;
}

export const CustomerCatalog: React.FC<CustomerCatalogProps> = ({ onNavigate }) => {
  const { products, cart, addToCart, updateCartQty, cartCount, cartTotal } = useDairy();
  const { t, getProductName } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('All');
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  const categories: ProductCategory[] = [
    'All',
    'Fresh Milk & Curd',
    'Paneer & Ghee',
    'Sweets & Desserts',
    'Beverages & Other',
  ];

  const filteredProducts = products.filter(p => {
    const localizedName = getProductName(p).toLowerCase();
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch =
      localizedName.includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getCartQuantity = (productId: string) => {
    const item = cart.find(i => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  const handleAddProduct = (productId: string) => {
    addToCart(productId, 1);
    setRecentlyAddedId(productId);
    setTimeout(() => {
      setRecentlyAddedId(prev => (prev === productId ? null : prev));
    }, 1500);
  };

  const getCategoryColor = (cat: string) => {
    if (cat.includes('Milk') || cat.includes('Curd')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (cat.includes('Paneer') || cat.includes('Ghee')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (cat.includes('Sweets')) return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-28 font-sans">
      {/* 1. Header, Search & Categories */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              {t.customer.products.title}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Wholesale dairy products for verified retailers
            </p>
          </div>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            {filteredProducts.length} Products
          </span>
        </div>

        {/* Compact, Clean Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.customer.products.searchPlaceholder}
            className="w-full h-10 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* Category Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {categories.map(cat => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-xs font-semibold transition-all shrink-0 ${
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

      {/* 2. Product Grid: Balanced, Sleek Cards */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No products found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query or select another category from the filters above.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="px-3.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredProducts.map(prod => {
            const qty = getCartQuantity(prod.id);
            const mrp = prod.mrp || Math.round(prod.defaultPrice * 1.15);
            const savings = mrp > prod.defaultPrice ? mrp - prod.defaultPrice : 0;
            const localizedName = getProductName(prod);

            return (
              <div
                key={prod.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between space-y-3"
              >
                {/* Top Section: Category Badge & Stock Status */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${getCategoryColor(prod.category)}`}>
                      {prod.category}
                    </span>
                    {prod.isAvailable ? (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {t.customer.products.inStock}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {t.customer.products.outOfStock}
                      </span>
                    )}
                  </div>

                  {/* Product Title & Pack Size */}
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {localizedName}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                    <span>{t.customer.products.pack}:</span>
                    <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                      {prod.unit}
                    </span>
                  </div>

                  {/* Price Hierarchy Section */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-baseline justify-between">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono-numbers">
                          ₹{prod.defaultPrice}
                        </span>
                        <span className="text-[11px] font-semibold text-blue-700 uppercase">
                          Your Price
                        </span>
                      </div>

                      {/* MRP & Savings */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-slate-400 line-through font-mono-numbers">
                          MRP ₹{mrp}
                        </span>
                        {savings > 0 && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            Save ₹{savings}
                          </span>
                        )}
                      </div>
                    </div>

                    {qty > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Subtotal</span>
                        <span className="text-xs font-bold text-blue-700 font-mono-numbers">
                          ₹{(qty * prod.defaultPrice).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Section: Quantity / Add to Cart Controls */}
                <div className="pt-1">
                  {qty === 0 ? (
                    <button
                      onClick={() => handleAddProduct(prod.id)}
                      disabled={!prod.isAvailable}
                      className="w-full h-10 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs sm:text-sm shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.99]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t.customer.products.add}</span>
                    </button>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200 rounded-lg p-1">
                        <button
                          onClick={() => updateCartQty(prod.id, qty - 1)}
                          className="w-8 h-8 rounded bg-white text-slate-800 hover:bg-blue-100 active:bg-blue-200 flex items-center justify-center transition-colors shadow-2xs border border-blue-100"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        <span className="text-sm font-extrabold text-blue-900 font-mono-numbers px-2">
                          {qty}
                        </span>
                        <button
                          onClick={() => updateCartQty(prod.id, qty + 1)}
                          className="w-8 h-8 rounded bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 flex items-center justify-center transition-colors shadow-2xs"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>

                      <div className="text-center text-[11px] font-semibold text-emerald-700 flex items-center justify-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>In cart</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Sticky Bottom Cart Summary */}
      {cartCount > 0 && (
        <div className="fixed bottom-16 md:bottom-5 inset-x-0 p-3 max-w-lg mx-auto z-40 pointer-events-none">
          <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-xl border border-slate-700 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-xs font-mono-numbers shadow-xs">
                {cartCount}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  {cartCount} {cartCount === 1 ? 'Product' : 'Products'}
                </span>
                <span className="text-sm font-extrabold text-blue-300 font-mono-numbers">
                  Total: ₹{cartTotal.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('cart')}
              className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
            >
              <span>View Cart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
