import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { Order } from '../../types/dairy';
import {
  Calendar,
  RotateCcw,
  Clock,
  Search,
  ChevronRight,
  PackageCheck
} from 'lucide-react';

interface CustomerOrdersProps {
  onNavigate: (tab: string) => void;
}

export const CustomerOrders: React.FC<CustomerOrdersProps> = ({ onNavigate }) => {
  const { orders, currentRetailer, reorder, addToast } = useDairy();
  const { t } = useTranslation();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Strict customer isolation: only current retailer's orders
  const retailerOrders = currentRetailer
    ? orders.filter(o => o.retailerId === currentRetailer.id)
    : [];

  const filteredOrders = retailerOrders.filter(o => {
    const matchesFilter = statusFilter === 'all' || o.status === statusFilter;
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handleReorder = (orderId: string) => {
    reorder(orderId);
    onNavigate('cart');
    addToast('Previous order items loaded into your cart with editable quantities!', 'success');
  };

  const statusMap: Record<string, string> = {
    pending: t.customer.orders.status.pending,
    confirmed: t.customer.orders.status.confirmed,
    preparing: t.customer.orders.status.preparing,
    dispatched: t.customer.orders.status.dispatched,
    delivered: t.customer.orders.status.delivered,
    cancelled: t.customer.orders.status.cancelled,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-28 font-sans">
      {/* 1. Header & Filter Bar */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {t.customer.orders.title}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Track live delivery dispatches and repeat past orders in 1 click
            </p>
          </div>
          <span className="text-sm font-bold text-blue-700 bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-200 shrink-0 self-start sm:self-auto">
            {retailerOrders.length} Orders Placed
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.customer.orders.searchPlaceholder}
            className="w-full h-12 min-h-[48px] pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* Status Filter Chips (Min 44px Touch Targets) */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['all', 'pending', 'confirmed', 'dispatched'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 capitalize ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st === 'all' ? 'All Orders' : statusMap[st] || st}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Orders Cards List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">No orders found</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {t.customer.orders.emptyDesc}
          </p>
          <button
            onClick={() => onNavigate('products')}
            className="min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-2xs transition-colors"
          >
            Browse Products Now
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs hover:border-blue-300 transition-all space-y-4"
            >
              {/* Order Header: Order No, Date, Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-base sm:text-lg font-bold text-slate-900 font-mono-numbers">
                      {order.orderNumber}
                    </span>
                    <StatusBadge
                      status={order.status}
                      label={statusMap[order.status] || order.status}
                      size="sm"
                    />
                    {order.invoiceNumber && (
                      <span className="text-xs font-mono-numbers font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {order.invoiceNumber}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500 font-mono-numbers">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{t.customer.orders.orderPlaced} {order.orderDate}</span>
                    </div>

                    {order.deliveryDate && (
                      <div className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Delivery: {order.deliveryDate}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:text-right space-y-0.5">
                  <span className="text-xs font-semibold uppercase text-slate-400 block">
                    Total Bill
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-blue-700 font-mono-numbers">
                    ₹{order.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Items Summary */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-sm text-slate-700">
                <div className="text-xs font-bold uppercase text-slate-500 pb-1">
                  {order.items.length} {order.items.length === 1 ? 'Product Item' : 'Product Items'}
                </div>
                {order.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-0.5">
                    <span className="truncate pr-3 font-medium">
                      <strong className="font-bold text-slate-900 font-mono-numbers">{item.quantity}</strong> × {item.productName}
                    </span>
                    <span className="font-mono-numbers font-bold text-slate-900 shrink-0">
                      ₹{item.totalPrice}
                    </span>
                  </div>
                ))}
                {order.items.length > 3 && (
                  <p className="text-xs text-slate-500 font-semibold pt-1">
                    + {order.items.length - 3} more items in this order...
                  </p>
                )}
              </div>

              {/* Action Buttons (Min 44px Touch Targets) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-bold transition-colors flex items-center gap-1.5"
                >
                  <span>View Details</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleReorder(order.id)}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm border border-blue-200 flex items-center gap-2 transition-all active:scale-95"
                >
                  <RotateCcw className="w-4 h-4 stroke-[2.2]" />
                  <span>{t.customer.orders.reorder}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Order Details Modal */}
      {selectedOrder && (
        <Modal
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          title={`Order ${selectedOrder.orderNumber}`}
          subtitle={`Placed on ${selectedOrder.orderDate}`}
        >
          <div className="space-y-5 text-sm font-sans">
            {/* Summary Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <span className="text-xs font-bold uppercase text-slate-400 block">
                  Status
                </span>
                <span className="font-bold text-slate-900 text-base capitalize mt-1 block">
                  {statusMap[selectedOrder.status] || selectedOrder.status}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold uppercase text-slate-400 block">
                  Total Bill
                </span>
                <span className="font-black text-blue-700 text-xl font-mono-numbers mt-1 block">
                  ₹{selectedOrder.totalAmount.toLocaleString()}
                </span>
              </div>

              {selectedOrder.deliveryDate && (
                <div className="col-span-2 pt-2.5 border-t border-slate-200 flex items-center justify-between text-sm">
                  <span className="text-slate-600 flex items-center gap-1.5 font-semibold">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Expected Delivery:
                  </span>
                  <span className="font-bold text-emerald-800 font-mono-numbers">
                    {selectedOrder.deliveryDate}
                  </span>
                </div>
              )}

              {selectedOrder.invoiceNumber && (
                <div className="col-span-2 pt-2.5 border-t border-slate-200 flex items-center justify-between text-sm">
                  <span className="text-slate-600 font-semibold">
                    Tax Invoice: <span className="font-mono-numbers font-bold text-blue-700">{selectedOrder.invoiceNumber}</span>
                  </span>
                  <button
                    onClick={() => {
                      setSelectedOrder(null);
                      onNavigate('payments');
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View & Pay Now →
                  </button>
                </div>
              )}
            </div>

            {/* Items List */}
            <div>
              <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                Ordered Products
              </h2>

              <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm sm:text-base block">
                        {item.productName}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Unit size: {item.unit}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono-numbers text-xs text-slate-500 block">
                        {item.quantity} × ₹{item.unitPrice}
                      </span>
                      <span className="font-mono-numbers font-bold text-slate-900 text-sm sm:text-base">
                        ₹{item.totalPrice}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleReorder(selectedOrder.id);
                  setSelectedOrder(null);
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center gap-2 shadow-2xs transition-all active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Repeat Order Now</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
