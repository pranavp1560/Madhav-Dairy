import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Product, ProductCategory } from '../../types/dairy';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import {
  PackagePlus,
  Plus,
  Search,
  Filter,
  Layers,
  Edit2,
  Trash2,
  Calendar,
  IndianRupee,
  CheckCircle2,
  BadgePercent,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Package
} from 'lucide-react';
import { AddProductModal } from './AddProductModal';
import { SkuManagerModal } from './SkuManagerModal';
import { EditProductModal } from './EditProductModal';

export const ProductsAdminView: React.FC = () => {
  const {
    products,
    addToast,
    setInternalView,
    categories: dbCategories,
    toggleParentProductActive,
    deleteParentProduct
  } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  // SKU Manager and Edit Master Modals
  const [skuModalProduct, setSkuModalProduct] = useState<Product | null>(null);
  const [editModalProduct, setEditModalProduct] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Dynamic categories combined from master category table and products
  const categoryOptions = [
    'All',
    ...Array.from(new Set([
      ...dbCategories.filter(c => c.isActive).map(c => c.name),
      ...products.map(p => p.category)
    ])).filter(Boolean)
  ];

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleOpenDetail = (p: Product) => {
    setSelectedProduct(p);
    setIsDrawerOpen(true);
  };

  const handleToggleActive = async (p: Product) => {
    try {
      await toggleParentProductActive(p.id, !p.isActive);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    setDeleteError(null);
    const skuCount = (p.skus || []).length;
    const msg = skuCount > 0
      ? `Are you sure you want to delete master product "${p.name}" and its ${skuCount} child SKU(s)? This will only be allowed if there are NO historical orders or production batches recorded.`
      : `Are you sure you want to delete product "${p.name}"?`;

    const conf = window.confirm(msg);
    if (!conf) return;

    try {
      await deleteParentProduct(p.id);
    } catch (err: any) {
      setDeleteError(err.message || 'Cannot delete product.');
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900">Products & SKU Master Catalog</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Architecture: Category → Parent Product → Child SKU / Pack Variants → Channel-wise Standard & Floor Prices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<BadgePercent className="w-4 h-4" />}
            onClick={() => setInternalView('pricing')}
          >
            Channel Pricing Matrix
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddProductOpen(true)}
          >
            + Add Master Product
          </Button>
        </div>
      </div>

      {/* Delete / Safety Error Banner */}
      {deleteError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs font-semibold">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{deleteError}</span>
          </div>
          <button
            onClick={() => setDeleteError(null)}
            className="text-red-500 hover:text-red-700 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Category Filter */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by product, brand or category..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white text-slate-900 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categoryOptions.map(c => (
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

      {/* Parent Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Master Product</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Child SKUs / Variants</th>
                <th className="py-3 px-3 text-right">MRP Range</th>
                <th className="py-3 px-3 text-right">Base Price</th>
                <th className="py-3 px-3">Pricing Rules</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold">No products found matching your search</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const skus = p.skus || [];
                  const skuMrps = skus.map(s => s.mrp).filter(m => m > 0);
                  const minMrp = skuMrps.length > 0 ? Math.min(...skuMrps) : (p.mrp || p.defaultPrice);
                  const maxMrp = skuMrps.length > 0 ? Math.max(...skuMrps) : (p.mrp || p.defaultPrice);

                  const skuPrices = skus.map(s => s.sellingPrice || s.mrp).filter(m => m > 0);
                  const minPrice = skuPrices.length > 0 ? Math.min(...skuPrices) : p.defaultPrice;
                  const maxPrice = skuPrices.length > 0 ? Math.max(...skuPrices) : p.defaultPrice;

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                      {/* Product Family */}
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                            {p.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              Brand: {p.brand || 'Madhav Dairy'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {p.category}
                        </span>
                      </td>

                      {/* Child SKUs / Variants */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setSkuModalProduct(p)}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1"
                            title="Click to manage SKUs"
                          >
                            <Layers className="w-3 h-3" />
                            <span>{skus.length} SKU{skus.length === 1 ? '' : 's'}</span>
                          </button>
                          {skus.slice(0, 3).map(s => (
                            <span
                              key={s.id}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-50 text-slate-600 border border-slate-200"
                              title={`${s.skuCode}: ${s.variantName || s.packSize}`}
                            >
                              {s.variantName || s.packSize}
                            </span>
                          ))}
                          {skus.length > 3 && (
                            <span className="text-[10px] text-slate-400">+{skus.length - 3}</span>
                          )}
                        </div>
                      </td>

                      {/* MRP Range */}
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-500">
                        {minMrp === maxMrp ? `₹${minMrp}` : `₹${minMrp} - ₹${maxMrp}`}
                      </td>

                      {/* Base Selling Price Range */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-blue-700">
                        {minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice} - ₹${maxPrice}`}
                      </td>

                      {/* Channel Rates Status */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          {p.pricingStatus === 'configured' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Configured</span>
                            </span>
                          ) : p.pricingStatus === 'partial' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Partial Rates
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 italic">
                              Not Set
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                            p.isActive !== false
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {p.isActive !== false ? 'Active' : 'Disabled'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Manage SKUs */}
                          <button
                            onClick={() => setSkuModalProduct(p)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-colors flex items-center gap-1 shadow-2xs"
                            title="Manage Variants & Child SKUs"
                          >
                            <Layers className="w-3 h-3" />
                            <span>SKUs ({skus.length})</span>
                          </button>

                          {/* Edit Master Product */}
                          <button
                            onClick={() => setEditModalProduct(p)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title="Edit Master Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Details Drawer */}
                          <button
                            onClick={() => handleOpenDetail(p)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title="View Full Details"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          {/* Safe Delete Master */}
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                            title="Delete Master Product (If no transactions exist)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Detail Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedProduct ? selectedProduct.name : 'Product Details'}
        subtitle={selectedProduct ? `${selectedProduct.category} • Brand: ${selectedProduct.brand || 'Madhav Dairy'}` : ''}
        width="md"
      >
        {selectedProduct && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase">Product Family</span>
                <span className="text-base font-bold text-slate-900">
                  {selectedProduct.name}
                </span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase">Child SKUs</span>
                <span className="text-base font-bold text-blue-600 font-mono-numbers">
                  {(selectedProduct.skus || []).length} Variants
                </span>
              </div>
            </div>

            {/* Child SKUs List */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                  Child SKU Variants
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setSkuModalProduct(selectedProduct);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
                >
                  <span>Manage in SKU Drawer</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {((selectedProduct.skus || []).length === 0) ? (
                <div className="py-2 text-center text-slate-400 italic bg-slate-50 rounded border border-slate-100">
                  No child SKUs configured yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium text-[10px]">
                      <tr>
                        <th className="py-1.5 px-2.5">SKU Code</th>
                        <th className="py-1.5 px-2">Variant</th>
                        <th className="py-1.5 px-2 text-right">MRP</th>
                        <th className="py-1.5 px-2 text-right">Base Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedProduct.skus.map(s => (
                        <tr key={s.id}>
                          <td className="py-2 px-2.5 font-mono font-bold text-slate-900">{s.skuCode}</td>
                          <td className="py-2 px-2 text-slate-700">{s.variantName || s.packSize}</td>
                          <td className="py-2 px-2 text-right font-mono text-slate-500">₹{s.mrp}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-blue-700">₹{s.sellingPrice || s.mrp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">Description</span>
              <p className="text-slate-600 leading-relaxed">{selectedProduct.description || 'No description entered.'}</p>
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
                  setSkuModalProduct(selectedProduct);
                }}
              >
                Manage SKUs & Pricing
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Add Master Product Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
      />

      {/* Child SKU Manager Modal */}
      {skuModalProduct && (
        <SkuManagerModal
          isOpen={Boolean(skuModalProduct)}
          onClose={() => setSkuModalProduct(null)}
          product={products.find(p => p.id === skuModalProduct.id) || skuModalProduct}
        />
      )}

      {/* Edit Master Product Modal */}
      {editModalProduct && (
        <EditProductModal
          isOpen={Boolean(editModalProduct)}
          onClose={() => setEditModalProduct(null)}
          product={products.find(p => p.id === editModalProduct.id) || editModalProduct}
        />
      )}
    </div>
  );
};
