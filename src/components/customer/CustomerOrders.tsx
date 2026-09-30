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
  ChevronRight
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

  const retailerOrders = currentRetailer ? orders.filter(o => o.retailerId === currentRetailer.id) : orders;

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
    <div className="max-w-5xl mx-auto space-y-4 pb-28 font-sans">
      {/* 1. Header & Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              {t.customer.orders.title}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Track and repeat your dairy stock orders
            </p>
          </div>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            {retailerOrders.length} Orders
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.customer.orders.searchPlaceholder}
            className="w-full h-10 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {['all', 'confirmed', 'dispatched', 'delivered'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 capitalize ${
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

      {/* 2. Orders Scannable Cards List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-6 space-y-2.5">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No orders found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t.customer.orders.emptyDesc}
          </p>
          <button
            onClick={() => onNavigate('products')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
          >
            Browse Products Now
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className="bg-white rounded-xl border border-slate-200 p-4 sm:p-4.5 shadow-2xs hover:border-blue-300 transition-all space-y-3"
            >
              {/* Order Header: Order No, Date, Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base font-bold text-slate-900 font-mono-numbers">
                      {order.orderNumber}
                    </span>
                    <StatusBadge
                      status={order.status}
                      label={statusMap[order.status] || order.status}
                      size="sm"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <div className="flex items-center gap-1 font-mono-numbers">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.customer.orders.orderPlaced} {order.orderDate}</span>
                    </div>

                    {order.deliveryDate && (
                      <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200 text-[11px] font-bold font-mono-numbers">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>Delivery: {order.deliveryDate}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:text-right">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                    Total Bill
                  </span>
                  <span className="text-base sm:text-lg font-bold text-blue-700 font-mono-numbers">
                    ₹{order.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Items Summary */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-xs text-slate-700">
                <div className="text-[10px] font-bold uppercase text-slate-400 pb-0.5">
                  {order.items.length} {order.items.length === 1 ? 'Product Item' : 'Product Items'}
                </div>
                {order.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="truncate pr-2 font-medium">
                      <strong className="font-semibold text-slate-900 font-mono-numbers">{item.quantity}</strong> × {item.productName}
                    </span>
                    <span className="font-mono-numbers font-semibold text-slate-800 shrink-0">
                      ₹{item.totalPrice}
                    </span>
                  </div>
                ))}
                {order.items.length > 3 && (
                  <p className="text-[11px] text-slate-500 font-medium pt-0.5">
                    + {order.items.length - 3} more items in this order...
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-semibold transition-colors flex items-center gap-1"
                >
                  <span>View Details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleReorder(order.id)}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t.customer.orders.reorder}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Order Detail Modal */}
      {selectedOrder && (
        <Modal
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          title={`Order ${selectedOrder.orderNumber}`}
          subtitle={`Placed on ${selectedOrder.orderDate}`}
        >
          <div className="space-y-4 text-xs sm:text-sm font-sans">
            {/* Summary Grid */}
            <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Status
                </span>
                <span className="font-bold text-slate-900 text-sm capitalize mt-0.5 block">
                  {statusMap[selectedOrder.status] || selectedOrder.status}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Total Bill
                </span>
                <span className="font-bold text-blue-700 text-base font-mono-numbers mt-0.5 block">
                  ₹{selectedOrder.totalAmount.toLocaleString()}
                </span>
              </div>

              {selectedOrder.deliveryDate && (
                <div className="col-span-2 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600 flex items-center gap-1 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    Expected Delivery:
                  </span>
                  <span className="font-bold text-emerald-700 font-mono-numbers">
                    {selectedOrder.deliveryDate}
                  </span>
                </div>
              )}
            </div>

            {/* Items List */}
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5">
                Ordered Products
              </h4>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                        {item.productName}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Unit size: {item.unit}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono-numbers text-[11px] text-slate-500 block">
                        {item.quantity} × ₹{item.unitPrice}
                      </span>
                      <span className="font-mono-numbers font-bold text-slate-900 text-xs sm:text-sm">
                        ₹{item.totalPrice}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleReorder(selectedOrder.id);
                  setSelectedOrder(null);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Repeat Order Now</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
