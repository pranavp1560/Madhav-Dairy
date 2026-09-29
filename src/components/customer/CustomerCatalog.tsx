import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { ProductCategory } from '../../types/dairy';
import { StatusBadge } from '../ui/StatusBadge';
import {
  Search,
  Plus,
  Minus,
  ShoppingBag,
  Package,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface CustomerCatalogProps {
  onNavigate: (tab: string) => void;
}

export const CustomerCatalog: React.FC<CustomerCatalogProps> = ({ onNavigate }) => {
  const { products, cart, addToCart, updateCartQty, cartCount, cartTotal } = useDairy();
  const { t, getProductName } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('All');

  const categories: ProductCategory[] = [
    'All',
    'Sweets & Desserts',
    'Fresh Milk & Curd',
    'Paneer & Ghee',
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

  return (
    <div className="p-4 space-y-3 pb-28">
      {/* Search & Categories Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">{t.customer.products.title}</h2>
          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            {filteredProducts.length} items
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.customer.products.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
          />
        </div>

        {/* Categories Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1 rounded-lg whitespace-nowrap font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat === 'All' ? t.customer.products.allCategories : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Cards List (Section 32 & 33) */}
      <div className="space-y-2.5">
        {filteredProducts.map(prod => {
          const qty = getCartQuantity(prod.id);
          const mrp = prod.mrp || Math.round(prod.defaultPrice * 1.15);
          const localizedName = getProductName(prod);

          return (
            <div
              key={prod.id}
              className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-blue-300 transition-colors flex gap-3 items-center"
            >
              {/* Product Thumbnail / Category Icon */}
              <div className="w-14 h-14 rounded-xl bg-blue-50/70 border border-blue-100 flex flex-col items-center justify-center shrink-0 text-blue-600">
                <Package className="w-6 h-6 stroke-[1.5]" />
                <span className="text-[8px] font-bold uppercase tracking-wider text-blue-700 mt-0.5">
                  {prod.category.split(' ')[0]}
                </span>
              </div>

              {/* Product Details (Zero Internal Leaks) */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-slate-900 truncate">
                    {localizedName}
                  </h3>
                  {prod.isAvailable ? (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-green-50 text-green-700 border border-green-200 shrink-0 font-medium">
                      {t.customer.products.inStock}
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 shrink-0 font-medium">
                      {t.customer.products.outOfStock}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t.customer.products.pack}: <span className="text-slate-700 font-medium">{prod.unit}</span>
                </p>

                {/* Price Display: MRP & Rate */}
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xs font-bold text-blue-600 font-mono-numbers">
                    ₹{prod.defaultPrice}
                  </span>
                  <span className="text-[10px] text-slate-400 line-through font-mono-numbers">
                    ₹{mrp}
                  </span>
                </div>
              </div>

              {/* Direct Touch-Friendly [-] Quantity [+] Control */}
              <div className="shrink-0">
                {qty === 0 ? (
                  <button
                    onClick={() => addToCart(prod.id, 1)}
                    disabled={!prod.isAvailable}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 text-white font-bold text-xs shadow-xs flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.customer.products.add}</span>
                  </button>
                ) : (
                  <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg overflow-hidden shadow-xs">
                    <button
                      onClick={() => updateCartQty(prod.id, qty - 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-blue-100 active:bg-blue-200 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-bold text-xs text-blue-900 font-mono-numbers">
                      {qty}
                    </span>
                    <button
                      onClick={() => updateCartQty(prod.id, qty + 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-blue-100 active:bg-blue-200 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Action Bar when Cart has items */}
      {cartCount > 0 && (
        <div className="fixed bottom-16 inset-x-0 p-3 max-w-md mx-auto z-20 pointer-events-none">
          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs font-mono-numbers">
                {cartCount}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  {cartCount} items in cart
                </span>
                <span className="text-[11px] text-slate-300 font-mono-numbers">
                  Total: ₹{cartTotal.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('cart')}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all"
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
