import React, { useState, useMemo } from 'react';
import { useDairy } from '../../context/DairyContext';
import { DirectCustomer } from '../../types/dairy';
import { directCustomerService, normalizeMobile } from '../../services/directCustomerService';
import { DirectCustomerDetailModal } from './DirectCustomerDetailModal';
import { 
  Users, 
  Search, 
  Plus, 
  Eye, 
  Edit, 
  Phone, 
  MapPin, 
  ShoppingBag, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Power, 
  X, 
  Filter, 
  UserCheck, 
  Sparkles,
  ArrowRight,
  Clock,
  Mail,
  FileText
} from 'lucide-react';
import { formatCalendarDate } from '../../utils/dateUtils';

interface DirectCustomersViewProps {
  onSelectCustomer?: (customer: DirectCustomer) => void;
  onCreateOrder?: (customer: DirectCustomer) => void;
  onViewOrder?: (orderId: string) => void;
}

type FilterTab = 'all' | 'active' | 'inactive' | 'with_orders' | 'without_orders';

export const DirectCustomersView: React.FC<DirectCustomersViewProps> = ({
  onSelectCustomer,
  onCreateOrder,
  onViewOrder,
}) => {
  const {
    directCustomers,
    createDirectCustomer,
    updateDirectCustomer,
    toggleDirectCustomerStatus,
    setInternalView,
    setSelectedOrderId,
    addToast
  } = useDairy();

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<DirectCustomer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<DirectCustomer | null>(null);

  // Add/Edit Form states
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    address: '',
    alternateMobile: '',
    email: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DirectCustomer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = directCustomers.length;
    const active = directCustomers.filter(c => c.status === 'active').length;
    const withOrders = directCustomers.filter(c => (c.totalOrders ?? 0) > 0).length;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const newThisMonth = directCustomers.filter(c => {
      if (!c.createdAt) return false;
      const d = new Date(c.createdAt);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).length;

    return { total, active, withOrders, newThisMonth };
  }, [directCustomers]);

  // Filtered & Searched Customers
  const filteredCustomers = useMemo(() => {
    return directCustomers.filter(c => {
      // 1. Search Query (Name, Mobile)
      const q = searchQuery.toLowerCase().trim();
      const cleanQ = q.replace(/\D/g, '');
      const matchesSearch =
        q === '' ||
        c.name.toLowerCase().includes(q) ||
        c.customerCode.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        (cleanQ.length >= 3 && normalizeMobile(c.mobile).includes(cleanQ)) ||
        (c.address && c.address.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // 2. Tab Filter
      if (activeTab === 'active') return c.status === 'active';
      if (activeTab === 'inactive') return c.status === 'inactive';
      if (activeTab === 'with_orders') return (c.totalOrders ?? 0) > 0;
      if (activeTab === 'without_orders') return (c.totalOrders ?? 0) === 0;

      return true;
    });
  }, [directCustomers, searchQuery, activeTab]);

  // Handle Form Open for Create
  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      mobile: '',
      address: '',
      alternateMobile: '',
      email: '',
      notes: '',
    });
    setFormError(null);
    setDuplicateWarning(null);
    setIsAddModalOpen(true);
  };

  // Handle Form Open for Edit
  const handleOpenEdit = (customer: DirectCustomer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      mobile: customer.mobile,
      address: customer.address,
      alternateMobile: customer.alternateMobile || '',
      email: customer.email || '',
      notes: customer.notes || '',
    });
    setFormError(null);
    setDuplicateWarning(null);
    setIsAddModalOpen(true);
  };

  // Mobile Duplicate Live Check
  const handleMobileChange = async (val: string) => {
    setFormData(prev => ({ ...prev, mobile: val }));
    const clean = normalizeMobile(val);
    if (clean.length === 10) {
      const dup = await directCustomerService.findDuplicateByMobile(val, editingCustomer?.id);
      setDuplicateWarning(dup);
    } else {
      setDuplicateWarning(null);
    }
  };

  // Submit Add or Edit
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formData.name.trim()) {
      setFormError('Customer Name is required.');
      return;
    }
    const cleanMobile = normalizeMobile(formData.mobile);
    if (cleanMobile.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!formData.address.trim()) {
      setFormError('Customer Address is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingCustomer) {
        await updateDirectCustomer(editingCustomer.id, {
          name: formData.name,
          mobile: formData.mobile,
          address: formData.address,
          alternateMobile: formData.alternateMobile || undefined,
          email: formData.email || undefined,
          notes: formData.notes || undefined,
        });
      } else {
        await createDirectCustomer({
          name: formData.name,
          mobile: formData.mobile,
          address: formData.address,
          alternateMobile: formData.alternateMobile || undefined,
          email: formData.email || undefined,
          notes: formData.notes || undefined,
        });
      }

      setIsAddModalOpen(false);
      setEditingCustomer(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Order for this customer
  const handleCreateOrder = (customer: DirectCustomer) => {
    if (onCreateOrder) {
      onCreateOrder(customer);
    } else {
      // Pass state via sessionStorage or navigate
      sessionStorage.setItem('preselected_direct_customer', JSON.stringify(customer));
      setInternalView('create_order');
    }
  };

  // View order from modal
  const handleViewOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setInternalView('orders');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Direct Customers
              </h1>
              <p className="text-xs text-slate-500">
                Manage individual customers and bulk-order customers who are not registered shops.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Direct Customer</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Direct Customers
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono-numbers">
              {metrics.total}
            </span>
            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              Master
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Active Customers
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600 font-mono-numbers">
              {metrics.active}
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Active
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Customers with Orders
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-600 font-mono-numbers">
              {metrics.withOrders}
            </span>
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              Ordered
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            New This Month
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-600 font-mono-numbers">
              {metrics.newThisMonth}
            </span>
            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              Recent
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'All Customers', count: directCustomers.length },
              { id: 'active', label: 'Active', count: metrics.active },
              { id: 'inactive', label: 'Inactive', count: directCustomers.length - metrics.active },
              { id: 'with_orders', label: 'With Orders', count: metrics.withOrders },
              { id: 'without_orders', label: 'Without Orders', count: directCustomers.length - metrics.withOrders },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as FilterTab)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/80 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or mobile..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Mobile Number</th>
                <th className="py-3.5 px-4">Address</th>
                <th className="py-3.5 px-4 text-center">Total Orders</th>
                <th className="py-3.5 px-4">Last Order Date</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No direct customers found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery
                        ? 'Try modifying your search query or tab filters.'
                        : 'Click "Add Direct Customer" above to create your first direct customer.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Customer Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 font-extrabold flex items-center justify-center shrink-0 text-xs">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <button
                            onClick={() => setViewingCustomer(c)}
                            className="font-bold text-slate-900 hover:text-purple-600 hover:underline text-left truncate block"
                          >
                            {c.name}
                          </button>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {c.customerCode}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Mobile Number */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{c.mobile}</span>
                      </div>
                      {c.email && (
                        <span className="text-[10px] text-slate-400 block truncate max-w-[160px]">
                          {c.email}
                        </span>
                      )}
                    </td>

                    {/* Address */}
                    <td className="py-3.5 px-4 text-slate-600 max-w-[220px]">
                      <div className="flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                        <span className="truncate block" title={c.address}>
                          {c.address}
                        </span>
                      </div>
                    </td>

                    {/* Total Orders */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-extrabold font-mono-numbers text-purple-700 text-xs bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        {c.totalOrders ?? 0}
                      </span>
                    </td>

                    {/* Last Order Date */}
                    <td className="py-3.5 px-4 text-slate-600">
                      {c.lastOrderDate ? (
                        <span className="font-medium">{formatCalendarDate(c.lastOrderDate)}</span>
                      ) : (
                        <span className="text-slate-400 italic">No orders yet</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          c.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Details */}
                        <button
                          onClick={() => setViewingCustomer(c)}
                          title="View Details & Orders"
                          className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Customer */}
                        <button
                          onClick={() => handleOpenEdit(c)}
                          title="Edit Customer Information"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Create Order */}
                        <button
                          onClick={() => handleCreateOrder(c)}
                          title="Create Order"
                          className="px-2 py-1 text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-2xs flex items-center gap-1 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Order</span>
                        </button>

                        {/* Activate / Deactivate Toggle */}
                        <button
                          onClick={() => toggleDirectCustomerStatus(c.id, c.status)}
                          title={c.status === 'active' ? 'Deactivate Customer' : 'Activate Customer'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            c.status === 'active'
                              ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
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

      {/* Add / Edit Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  {editingCustomer ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingCustomer ? 'Edit Direct Customer' : 'Add New Direct Customer'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Master record for individuals, event organizers, and bulk buyers
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Duplicate Mobile Warning */}
              {duplicateWarning && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">
                      Notice: Customer with this mobile number already exists!
                    </p>
                    <p className="text-[11px] text-amber-800">
                      Found: <strong>{duplicateWarning.name}</strong> ({duplicateWarning.customerCode}, {duplicateWarning.mobile})
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setViewingCustomer(duplicateWarning);
                      }}
                      className="text-purple-700 underline font-bold text-[11px] hover:text-purple-900"
                    >
                      View existing customer profile instead &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* Customer Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patil or Royal Banquet Caterers"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              {/* Mobile Number & Alternate Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={formData.mobile}
                    onChange={e => handleMobileChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alternate Mobile <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="Optional second number"
                    value={formData.alternateMobile}
                    onChange={e => setFormData(prev => ({ ...prev, alternateMobile: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              {/* Permanent Customer Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Permanent Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Full residence or office address"
                  value={formData.address}
                  onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Wedding event organizer; requires early morning bulk paneer"
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 rounded-xl shadow-xs"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingCustomer
                    ? 'Update Customer'
                    : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Customer Details Modal */}
      <DirectCustomerDetailModal
        customer={viewingCustomer}
        isOpen={Boolean(viewingCustomer)}
        onClose={() => setViewingCustomer(null)}
        onEdit={c => {
          setViewingCustomer(null);
          handleOpenEdit(c);
        }}
        onCreateOrder={c => {
          setViewingCustomer(null);
          handleCreateOrder(c);
        }}
        onViewOrder={handleViewOrder}
        onToggleStatus={c => toggleDirectCustomerStatus(c.id, c.status)}
      />
    </div>
  );
};
