import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { SalesChannel } from '../../types/dairy';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { Modal } from '../common/Modal';
import {
  Network,
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  BadgePercent,
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react';

export const SalesChannelsView: React.FC = () => {
  const {
    salesChannels,
    addSalesChannel,
    updateSalesChannel,
    deleteSalesChannel,
    toggleSalesChannelActive,
    addToast,
    setInternalView
  } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<SalesChannel | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Warning / Modal State
  const [deleteTarget, setDeleteTarget] = useState<SalesChannel | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredChannels = salesChannels.filter(ch => {
    const matchesSearch =
      ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ch.description && ch.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && ch.isActive) ||
      (statusFilter === 'inactive' && !ch.isActive);

    return matchesSearch && matchesStatus;
  });

  const handleOpenAdd = () => {
    setEditingChannel(null);
    setName('');
    setCode('');
    setDescription('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ch: SalesChannel) => {
    setEditingChannel(ch);
    setName(ch.name);
    setCode(ch.code);
    setDescription(ch.description || '');
    setIsActive(ch.isActive);
    setIsModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingChannel) {
      // Auto-generate code from name for new channels
      const genCode = val.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
      setCode(genCode);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Channel name is required', 'error');
      return;
    }
    if (!code.trim()) {
      addToast('Channel code is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingChannel) {
        await updateSalesChannel(editingChannel.id, {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim() || undefined,
          isActive,
        });
      } else {
        await addSalesChannel({
          name: name.trim(),
          code: code.trim().toUpperCase(),
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

  const handleOpenDelete = (ch: SalesChannel) => {
    setDeleteTarget(ch);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    const totalRefs = (deleteTarget.customerCount || 0) + (deleteTarget.pricingCount || 0);
    if (totalRefs > 0) {
      addToast(`Cannot delete channel referenced by active customers or prices. Deactivate it instead.`, 'error');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteSalesChannel(deleteTarget.id);
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
      await toggleSalesChannelActive(deleteTarget.id, false);
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
            <Network className="w-4 h-4 text-blue-600" />
            <span>Commercial Pricing Channels</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Sales Channels Master
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Define customer sales channels (Retail, Wholesale, Direct Customer, Institutions) with dedicated pricing rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<BadgePercent className="w-4 h-4" />}
            onClick={() => setInternalView('pricing')}
          >
            Manage Channel Pricing
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAdd}
          >
            + Add Sales Channel
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
            placeholder="Search channels by name, code or description..."
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
              All ({salesChannels.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({salesChannels.filter(c => c.isActive).length})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-white text-slate-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inactive ({salesChannels.filter(c => !c.isActive).length})
            </button>
          </div>
        </div>
      </div>

      {/* 3. Channels Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Sales Channel</th>
                <th className="py-3 px-3">Channel Code</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-center">Customers Mapped</th>
                <th className="py-3 px-3 text-center">Prices Configured</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredChannels.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    <Network className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No sales channels found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {searchQuery ? 'Try clearing your search query.' : 'Click "+ Add Sales Channel" to create a new channel.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredChannels.map(ch => (
                  <tr key={ch.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-100">
                          {ch.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-900 block">{ch.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-md font-mono-numbers text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {ch.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 max-w-xs truncate">
                      {ch.description || <span className="text-slate-400 italic">No description</span>}
                    </td>
                    <td className="py-3.5 px-3">
                      <button
                        onClick={() => toggleSalesChannelActive(ch.id, !ch.isActive)}
                        className="inline-flex items-center gap-1.5 cursor-pointer group"
                        title={ch.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <StatusBadge
                          status={ch.isActive ? 'active' : 'inactive'}
                          label={ch.isActive ? 'Active' : 'Inactive'}
                        />
                      </button>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        (ch.customerCount || 0) > 0
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Users className="w-3 h-3 mr-1 inline" />
                        {ch.customerCount || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        (ch.pricingCount || 0) > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        <BadgePercent className="w-3 h-3 mr-1 inline" />
                        {ch.pricingCount || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(ch)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit Channel"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(ch)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete Channel"
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

      {/* 4. Add / Edit Channel Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingChannel ? 'Edit Sales Channel' : 'Add New Sales Channel'}
        subtitle="Sales channels categorize your customer accounts for tiered wholesale and retail pricing"
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Channel Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. Retail, Wholesale, Institutions, Online"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Channel Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
              placeholder="e.g. RETAIL, WHOLESALE, INSTITUTION"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono-numbers font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none uppercase"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Unique identifier used in system rules and document generation.
            </p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. B2B wholesale buyers, supermarket retailers or direct consumers..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          {editingChannel && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="font-bold text-slate-900 block">Channel Status</span>
                <span className="text-[11px] text-slate-500">
                  Inactive channels will not be selectable for new customer registrations
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
              disabled={isSubmitting || !name.trim() || !code.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
            >
              <span>{isSubmitting ? 'Saving...' : editingChannel ? 'Update Channel' : 'Create Channel'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* 5. Delete Guard & Confirmation Modal (Section 8 Compliance) */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={deleteTarget && ((deleteTarget.customerCount || 0) > 0 || (deleteTarget.pricingCount || 0) > 0) ? 'Cannot Delete Sales Channel' : 'Confirm Channel Deletion'}
        maxWidth="md"
      >
        {deleteTarget && (
          <div className="space-y-4 text-xs">
            {((deleteTarget.customerCount || 0) > 0 || (deleteTarget.pricingCount || 0) > 0) ? (
              // Guard: References exist -> prevent deletion!
              <div className="space-y-3">
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-amber-900 text-xs">
                      Channel is in Active Business Use
                    </h3>
                    <p className="text-amber-800 mt-1 leading-relaxed">
                      This channel cannot be deleted because it is mapped to{' '}
                      <strong>{deleteTarget.customerCount || 0} customer(s)</strong> and has{' '}
                      <strong>{deleteTarget.pricingCount || 0} product pricing rule(s)</strong> configured. Deactivate this channel instead of deleting it.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
                  <span className="font-semibold text-slate-900 block mb-1">Target Channel:</span>
                  <p className="font-bold text-slate-800">{deleteTarget.name} ({deleteTarget.code})</p>
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
                    Deactivate Channel Instead
                  </button>
                </div>
              </div>
            ) : (
              // Safe deletion
              <div className="space-y-3">
                <p className="text-slate-600 leading-relaxed">
                  Are you sure you want to delete sales channel <strong>"{deleteTarget.name}" ({deleteTarget.code})</strong>? No customers or pricing rules are associated with this channel.
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
                    {isDeleting ? 'Deleting...' : 'Delete Channel'}
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
