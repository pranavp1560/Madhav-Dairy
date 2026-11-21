import React, { useState, useEffect } from 'react';
import { DirectCustomer, Order } from '../../types/dairy';
import { directCustomerService } from '../../services/directCustomerService';
import { 
  X, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  ShoppingBag, 
  Plus, 
  ExternalLink, 
  Clock, 
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Edit,
  Power
} from 'lucide-react';
import { formatCalendarDate } from '../../utils/dateUtils';

interface DirectCustomerDetailModalProps {
  customer: DirectCustomer | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (customer: DirectCustomer) => void;
  onCreateOrder: (customer: DirectCustomer) => void;
  onViewOrder: (orderId: string) => void;
  onToggleStatus: (customer: DirectCustomer) => void;
}

export const DirectCustomerDetailModal: React.FC<DirectCustomerDetailModalProps> = ({
  customer,
  isOpen,
  onClose,
  onEdit,
  onCreateOrder,
  onViewOrder,
  onToggleStatus,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  useEffect(() => {
    if (customer && isOpen) {
      setIsLoadingOrders(true);
      directCustomerService.fetchOrdersForCustomer(customer.id)
        .then(data => setOrders(data))
        .catch(err => {
          console.error('Failed to load customer orders:', err);
          setOrders([]);
        })
        .finally(() => setIsLoadingOrders(false));
    }
  }, [customer, isOpen]);

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 font-extrabold flex items-center justify-center shrink-0 text-base shadow-xs">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 truncate">
                  {customer.name}
                </h2>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                  {customer.customerCode}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                    customer.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {customer.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Direct / Bulk Customer Master Profile
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onCreateOrder(customer)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Order</span>
            </button>
            <button
              onClick={() => onEdit(customer)}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-all"
            >
              <Edit className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Customer Profile Details Grid */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-600" />
              <span>Customer Information</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Mobile Number</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {customer.mobile}
                </span>
              </div>

              {customer.alternateMobile && (
                <div>
                  <span className="text-slate-400 block mb-0.5">Alternate Mobile</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {customer.alternateMobile}
                  </span>
                </div>
              )}

              {customer.email && (
                <div>
                  <span className="text-slate-400 block mb-0.5">Email Address</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {customer.email}
                  </span>
                </div>
              )}

              <div>
                <span className="text-slate-400 block mb-0.5">Permanent Address</span>
                <span className="font-semibold text-slate-800 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span>{customer.address}</span>
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Registered On</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {customer.createdAt ? formatCalendarDate(customer.createdAt) : 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Total Orders Placed</span>
                <span className="font-extrabold text-purple-700 flex items-center gap-1.5 text-sm">
                  <ShoppingBag className="w-4 h-4 text-purple-500" />
                  {customer.totalOrders ?? orders.length} orders
                </span>
              </div>
            </div>

            {customer.notes && (
              <div className="mt-4 pt-3 border-t border-slate-200/80 text-xs">
                <span className="text-slate-400 block mb-1">Customer Notes</span>
                <p className="text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 italic">
                  "{customer.notes}"
                </p>
              </div>
            )}
          </div>

          {/* Order History Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-purple-600" />
                <span>Customer Order History</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  {orders.length}
                </span>
              </h3>

              <button
                onClick={() => onCreateOrder(customer)}
                className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Direct Order</span>
              </button>
            </div>

            {isLoadingOrders ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                <span className="text-xs">Loading customer orders...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-12 px-4 border border-dashed border-slate-300 rounded-2xl text-center bg-slate-50/50">
                <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No orders placed yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  This direct customer does not have any order history. You can create a new order directly below.
                </p>
                <button
                  onClick={() => onCreateOrder(customer)}
                  className="mt-4 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Place First Order</span>
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="py-3 px-3.5">Order Number</th>
                        <th className="py-3 px-3.5">Order Date</th>
                        <th className="py-3 px-3.5">Delivery Date</th>
                        <th className="py-3 px-3.5">Delivery Address</th>
                        <th className="py-3 px-3.5 text-right">Order Amount</th>
                        <th className="py-3 px-3.5 text-center">Payment</th>
                        <th className="py-3 px-3.5 text-center">Status</th>
                        <th className="py-3 px-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map(o => (
                        <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3.5 font-bold font-mono text-slate-900">
                            {o.orderNumber}
                          </td>
                          <td className="py-3 px-3.5 text-slate-600">
                            {formatCalendarDate(o.orderDate)}
                          </td>
                          <td className="py-3 px-3.5 text-slate-600">
                            {o.deliveryDate ? formatCalendarDate(o.deliveryDate) : 'Not specified'}
                          </td>
                          <td className="py-3 px-3.5 text-slate-600 max-w-[180px] truncate" title={o.deliveryAddress || customer.address}>
                            {o.deliveryAddress || customer.address}
                          </td>
                          <td className="py-3 px-3.5 text-right font-extrabold text-slate-900 font-mono-numbers">
                            ₹{o.totalAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                o.paymentStatus === 'paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : o.paymentStatus === 'partial'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {o.paymentStatus}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                o.status === 'delivered'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : o.status === 'dispatched'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : o.status === 'confirmed'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : o.status === 'cancelled'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <button
                              onClick={() => {
                                onClose();
                                onViewOrder(o.id);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg inline-flex items-center gap-1 transition-colors"
                            >
                              <span>View</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={() => onToggleStatus(customer)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all ${
              customer.status === 'active'
                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200'
                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{customer.status === 'active' ? 'Deactivate Customer' : 'Activate Customer'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
