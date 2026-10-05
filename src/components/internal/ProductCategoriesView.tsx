import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { CategoryItem } from '../../types/dairy';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { Modal } from '../common/Modal';
import {
  Tags,
  Plus,
  Search,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Package,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';

export const ProductCategoriesView: React.FC = () => {
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryActive,
    addToast
  } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [name, setName] = useState('');
  const [nameMr, setNameMr] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Warning / Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredCategories = categories.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && c.isActive) ||
      (statusFilter === 'inactive' && !c.isActive);

    return matchesSearch && matchesStatus;
  });

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setNameMr('');
    setNameHi('');
    setDescription('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: CategoryItem) => {
    setEditingCategory(c);
    setName(c.name);
    setNameMr(c.nameMr || '');
    setNameHi(c.nameHi || '');
    setDescription(c.description || '');
    setIsActive(c.isActive);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Category name is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: name.trim(),
          nameMr: nameMr.trim() || undefined,
          nameHi: nameHi.trim() || undefined,
          description: description.trim() || undefined,
          isActive,
        });
      } else {
        await addCategory({
          name: name.trim(),
          nameMr: nameMr.trim() || undefined,
          nameHi: nameHi.trim() || undefined,
          description: description.trim() || undefined,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (c: CategoryItem) => {
    setDeleteTarget(c);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    // Guard against deleting referenced category
    if ((deleteTarget.productCount || 0) > 0) {
      addToast(`Cannot delete category assigned to ${deleteTarget.productCount} products. Deactivate it instead.`, 'error');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteCategory(deleteTarget.id);
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeactivateInstead = async () => {
    if (!deleteTarget) return;
    try {
      await toggleCategoryActive(deleteTarget.id, false);
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-5 font-sans">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Tags className="w-4 h-4 text-blue-600" />
            <span>Catalog Hierarchy</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Product Category Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize dairy products, milk variations, and sweets into business categories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            + Add Category
          </Button>
        </div>
      </div>

      {/* 2. Filters & Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search categories by name or description..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white text-slate-900 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({categories.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({categories.filter(c => c.isActive).length})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-white text-slate-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inactive ({categories.filter(c => !c.isActive).length})
            </button>
          </div>
        </div>
      </div>

      {/* 3. Categories Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-center">Assigned Products</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No categories found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {searchQuery ? 'Try clearing your search query.' : 'Click "+ Add Category" to create your first category.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCategories.map(cat => (
                  <tr key={cat.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                          {cat.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{cat.name}</span>
                          {(cat.nameMr || cat.nameHi) && (
                            <span className="text-[10px] text-slate-500 block">
                              {[cat.nameMr, cat.nameHi].filter(Boolean).join(' • ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 max-w-xs truncate">
                      {cat.description || <span className="text-slate-400 italic">No description</span>}
                    </td>
                    <td className="py-3.5 px-3">
                      <button
                        onClick={() => toggleCategoryActive(cat.id, !cat.isActive)}
                        className="inline-flex items-center gap-1.5 cursor-pointer group"
                        title={cat.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <StatusBadge
                          status={cat.isActive ? 'active' : 'inactive'}
                          label={cat.isActive ? 'Active' : 'Inactive'}
                        />
                      </button>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        (cat.productCount || 0) > 0
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Package className="w-3 h-3 mr-1 inline" />
                        {cat.productCount || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(cat)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(cat)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Add / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Product Category' : 'Add New Category'}
        subtitle="Categories classify your dairy catalog for reporting and catalog display"
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sweets & Desserts"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Name in Marathi (मराठी)
              </label>
              <input
                type="text"
                value={nameMr}
                onChange={e => setNameMr(e.target.value)}
                placeholder="उदा. मिठाई व मिष्टान्न"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Name in Hindi (हिंदी)
              </label>
              <input
                type="text"
                value={nameHi}
                onChange={e => setNameHi(e.target.value)}
                placeholder="उदा. मिठाई और मिष्ठान"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Artisanal khoa pedha, shrikhand, basundi and milk fudge items"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          {editingCategory && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="font-bold text-slate-900 block">Category Status</span>
                <span className="text-[11px] text-slate-500">
                  Inactive categories are hidden from retail customer catalog
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isActive ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>{isSubmitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* 5. Delete Guard & Confirmation Modal (Section 5 Compliance) */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={deleteTarget && (deleteTarget.productCount || 0) > 0 ? 'Cannot Delete Category' : 'Confirm Category Deletion'}
        maxWidth="md"
      >
        {deleteTarget && (
          <div className="space-y-4 text-xs">
            {(deleteTarget.productCount || 0) > 0 ? (
              // Case A: Products are assigned -> PREVENT hard delete and suggest deactivation!
              <div className="space-y-3">
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-amber-900 text-xs">
                      Active Product Dependencies Detected
                    </h3>
                    <p className="text-amber-800 mt-1 leading-relaxed">
                      This category is currently assigned to <strong>{deleteTarget.productCount}</strong> product{deleteTarget.productCount !== 1 ? 's' : ''}. Deactivate it instead of deleting it to preserve catalog integrity and prevent orphaned products.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
                  <span className="font-semibold text-slate-900 block mb-1">Target Category:</span>
                  <p className="font-bold text-slate-800">{deleteTarget.name}</p>
                  <p className="text-[11px] text-slate-500">{deleteTarget.description || 'No description provided'}</p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeactivateInstead}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors"
                  >
                    Deactivate Category Instead
                  </button>
                </div>
              </div>
            ) : (
              // Case B: 0 products assigned -> Safe deletion
              <div className="space-y-3">
                <p className="text-slate-600 leading-relaxed">
                  Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>? This category has no products assigned to it and can be safely removed.
                </p>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Category'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
