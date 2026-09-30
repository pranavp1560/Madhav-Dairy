import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Product, ProductCategory } from '../../types/dairy';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { Input } from '../ui/Input';
import {
  PackagePlus,
  Plus,
  Search,
  Filter,
  Layers,
  Edit2,
  Calendar,
  IndianRupee,
  CheckCircle2
} from 'lucide-react';
import { AddProductModal } from './AddProductModal';

export const ProductsAdminView: React.FC = () => {
  const { products, addToast } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory>('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  const categories: ProductCategory[] = [
    'All',
    'Sweets & Desserts',
    'Fresh Milk & Curd',
    'Paneer & Ghee',
    'Beverages & Other',
  ];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.nameMr && p.nameMr.includes(searchQuery)) ||
                          (p.nameHi && p.nameHi.includes(searchQuery)) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleOpenDetail = (p: Product) => {
    setSelectedProduct(p);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900">Products & SKU Master Catalog</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage dairy product lines, pack variations, MRP rates, and localized titles
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddProductOpen(true)}
        >
          Add New Product
        </Button>
      </div>

      {/* Search and Category Filter */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by English, Marathi, or Hindi..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white text-slate-900 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                categoryFilter === c
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Standard Pack</th>
                <th className="py-3 px-3 text-right">MRP</th>
                <th className="py-3 px-3 text-right">Retailer Price</th>
                <th className="py-3 px-3 text-right">Shelf Life</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block">{p.name}</span>
                        <div className="text-[10px] text-slate-500 font-normal flex gap-2">
                          <span>मराठी: {p.nameMr || '—'}</span>
                          <span>हिंदी: {p.nameHi || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{p.category}</td>
                  <td className="py-3 px-3 font-medium text-slate-700">{p.unit}</td>
                  <td className="py-3 px-3 text-right font-mono-numbers text-slate-500">
                    ₹{p.mrp || Math.round(p.defaultPrice * 1.15)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-numbers font-bold text-blue-700">
                    ₹{p.defaultPrice}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-numbers text-slate-700">
                    {p.shelfLifeDays} days
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge
                      status={p.isAvailable ? 'active' : 'inactive'}
                      label={p.isAvailable ? 'In Catalog' : 'Disabled'}
                    />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleOpenDetail(p)}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors flex items-center gap-1 ml-auto"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Detail Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedProduct ? selectedProduct.name : 'Product Details'}
        subtitle={selectedProduct ? `${selectedProduct.category} • ${selectedProduct.unit}` : ''}
        width="md"
      >
        {selectedProduct && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                Multilingual Translations
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">English:</span>
                  <span className="font-semibold text-slate-900">{selectedProduct.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Marathi (मराठी):</span>
                  <span className="font-semibold text-slate-900">{selectedProduct.nameMr || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Hindi (हिंदी):</span>
                  <span className="font-semibold text-slate-900">{selectedProduct.nameHi || '—'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase">Standard MRP</span>
                <span className="text-base font-bold text-slate-900 font-mono-numbers">
                  ₹{selectedProduct.mrp || Math.round(selectedProduct.defaultPrice * 1.15)}
                </span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase">Retailer Rate</span>
                <span className="text-base font-bold text-blue-600 font-mono-numbers">
                  ₹{selectedProduct.defaultPrice}
                </span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                Shelf Life & Expiry Auto-Calculation Rule
              </span>
              <p className="text-slate-700">
                Default shelf life is configured as <strong className="font-mono-numbers">{selectedProduct.shelfLifeDays} days</strong>.
                When a new production batch is created, expiry date will default to today + {selectedProduct.shelfLifeDays} days.
              </p>
            </div>

            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Description</span>
              <p className="text-slate-600 leading-relaxed">{selectedProduct.description}</p>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsDrawerOpen(false)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setIsDrawerOpen(false);
                  addToast('Product pricing rules updated', 'success');
                }}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
      />
    </div>
  );
};
