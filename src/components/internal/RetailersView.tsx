import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Users, Search, Phone, MapPin, Eye, ArrowRight, CreditCard, UserPlus, UploadCloud, Trash2, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { AddCustomerModal } from './AddCustomerModal';
import { Modal } from '../common/Modal';
import { Retailer } from '../../types/dairy';

interface RetailersViewProps {
  onSelectRetailer: (id: string) => void;
  onOpenRecordPayment: () => void;
  onOpenImportCustomers?: () => void;
}

export const RetailersView: React.FC<RetailersViewProps> = ({
  onSelectRetailer,
  onOpenRecordPayment,
  onOpenImportCustomers,
}) => {
  const { retailers, salesChannels, deleteCustomer } = useDairy();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // Delete customer modal state
  const [customerToDelete, setCustomerToDelete] = useState<Retailer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cascadeTransactions, setCascadeTransactions] = useState(false);

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCustomer(customerToDelete.id, cascadeTransactions);
      setIsDeleteModalOpen(false);
      setCustomerToDelete(null);
    } catch {
      // Error toast handled in context
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredRetailers = retailers.filter(r => {
    const matchesSearch =
      r.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.area.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel =
      selectedChannel === 'all' ||
      r.salesChannelId === selectedChannel ||
      (!r.salesChannelId && salesChannels.find(c => c.id === selectedChannel)?.code === 'WHOLESALE');
    return matchesSearch && matchesChannel;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Retailer Distribution Network</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Retail Customers & Wholesale Accounts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage authorized grocery, dairy mart, and sweets confectioners retail partnerships.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenImportCustomers && (
            <button
              onClick={onOpenImportCustomers}
              className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4 text-emerald-600" />
              <span>Import Customers</span>
            </button>
          )}
          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Retail Customer</span>
          </button>
          <button
            onClick={onOpenRecordPayment}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4 text-slate-600" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Search & Channel Filter */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by store name, proprietor or area..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <select
            value={selectedChannel}
            onChange={e => setSelectedChannel(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
          >
            <option value="all">All Sales Channels</option>
            {salesChannels.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-slate-500 shrink-0">
          <strong>{filteredRetailers.length}</strong> Registered Retail Partners
        </span>
      </div>

      {/* Retailers Table as specified in Section 24 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Business Name</th>
                <th className="p-3">Sales Channel</th>
                <th className="p-3">Owner / Contact</th>
                <th className="p-3">Area / Route</th>
                <th className="p-3 text-right">Outstanding (₹)</th>
                <th className="p-3 text-right">Credit Limit (₹)</th>
                <th className="p-3">Last Order Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRetailers.map(r => (
                <tr
                  key={r.id}
                  onClick={() => onSelectRetailer(r.id)}
                  className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                >
                  <td className="p-3 font-bold text-slate-900 text-sm">
                    {r.businessName}
                    <span className="block text-[10px] text-slate-400 font-mono-numbers">
                      {r.gstin ? `GSTIN: ${r.gstin}` : 'Unregistered (URP)'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block">
                      {r.salesChannelName || 'Wholesale'}
                    </span>
                  </td>
                  <td className="p-3">
                    <p className="font-semibold text-slate-800">{r.ownerName}</p>
                    <p className="text-[11px] text-slate-500 font-mono-numbers">+91 {r.mobile}</p>
                  </td>
                  <td className="p-3 text-slate-700">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 text-slate-700">
                      {r.area}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono-numbers font-bold text-rose-600">
                    ₹{r.outstandingAmount.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-right font-mono-numbers font-semibold text-slate-700">
                    ₹{r.creditLimit.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 font-mono-numbers text-slate-600">{r.lastOrderDate}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                      Active
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onSelectRetailer(r.id)}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 border border-blue-200 shadow-2xs"
                        title="Open Retailer 360° Profile"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>360° View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerToDelete(r);
                          setCascadeTransactions(false);
                          setIsDeleteModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 border border-rose-200 shadow-2xs cursor-pointer"
                        title={`Delete Customer "${r.businessName}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Customer Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) setIsDeleteModalOpen(false);
        }}
        title="Delete Customer Account"
        subtitle="Permanent customer removal and ledger reconciliation"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-bold text-rose-900 text-sm">Are you sure you want to delete this customer?</p>
              <p className="text-xs text-rose-700 leading-relaxed">
                You are about to permanently delete <strong className="font-bold text-rose-950">{customerToDelete?.businessName}</strong> ({customerToDelete?.customerCode || 'Retailer'}).
                This action will remove the customer directory profile, revoke portal access, and terminate their authentication credentials.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-500">Business Name:</span>
              <span className="font-bold text-slate-900">{customerToDelete?.businessName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Owner Name:</span>
              <span className="font-medium text-slate-800">{customerToDelete?.ownerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Contact Mobile:</span>
              <span className="font-mono-numbers text-slate-800">+91 {customerToDelete?.mobile}</span>
            </div>
            {customerToDelete?.email && (
              <div className="flex justify-between">
                <span className="text-slate-500">Login Email:</span>
                <span className="font-medium text-slate-800">{customerToDelete.email}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Sales Channel:</span>
              <span className="font-medium text-slate-800">{customerToDelete?.salesChannelName || 'Wholesale'}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-slate-200">
              <span className="font-bold text-slate-700">Outstanding Balance:</span>
              <span className={`font-mono-numbers font-bold ${
                (customerToDelete?.outstandingAmount || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                ₹{(customerToDelete?.outstandingAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {(customerToDelete?.outstandingAmount || 0) > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Outstanding Notice:</strong> This customer currently has an unpaid balance of <strong>₹{(customerToDelete?.outstandingAmount || 0).toLocaleString('en-IN')}</strong>. Deleting this account will cancel all pending receivables.
              </p>
            </div>
          )}

          <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
            <input
              type="checkbox"
              checked={cascadeTransactions}
              onChange={e => setCascadeTransactions(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span className="text-[11px] text-slate-600 leading-tight">
              <strong>Cascade Cleanup:</strong> Also delete any draft/test orders, delivery chalans, or submissions associated with this customer.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
      />
    </div>
  );
};
