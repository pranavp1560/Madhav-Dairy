import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { Order } from '../../types/dairy';
import { Calendar, Package, RotateCcw, Clock, ArrowRight } from 'lucide-react';

interface CustomerOrdersProps {
  onNavigate: (tab: string) => void;
}

export const CustomerOrders: React.FC<CustomerOrdersProps> = ({ onNavigate }) => {
  const { orders, currentRetailer, reorder, addToast } = useDairy();
  const { t } = useTranslation();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const retailerOrders = orders.filter(o => o.retailerId === currentRetailer.id);

  const filteredOrders = retailerOrders.filter(o => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  const handleReorder = (orderId: string) => {
    reorder(orderId);
    onNavigate('cart');
    addToast('Previous order items loaded into cart with editable quantities!', 'success');
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
    <div className="p-4 space-y-3 pb-24">
      {/* Header & Status Filters */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{t.customer.orders.title}</h2>
            <p className="text-xs text-slate-500">
              {retailerOrders.length} orders on file
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {['all', 'confirmed', 'dispatched', 'delivered'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`text-xs px-3 py-1 rounded-lg capitalize font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st === 'all' ? 'All Orders' : statusMap[st] || st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-6">
          <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-900">No orders found</p>
          <p className="text-xs text-slate-500 mt-0.5">{t.customer.orders.emptyDesc}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-blue-300 transition-colors space-y-2.5"
            >
              {/* Order Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 font-mono-numbers">
                      {order.orderNumber}
                    </span>
                    <StatusBadge
                      status={order.status}
                      label={statusMap[order.status] || order.status}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 font-mono-numbers">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.customer.orders.orderPlaced} {order.orderDate}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold text-blue-700 font-mono-numbers">
                    ₹{order.totalAmount.toLocaleString()}
                  </span>
                  <span className="block text-[10px] text-slate-400 capitalize">
                    {order.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Items Summary */}
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
                {order.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px]">
                    <span className="truncate pr-2">
                      <strong className="font-mono-numbers">{item.quantity}</strong> × {item.productName}
                    </span>
                    <span className="font-mono-numbers text-slate-500 shrink-0">
                      ₹{item.totalPrice}
                    </span>
                  </div>
                ))}
                {order.items.length > 3 && (
                  <p className="text-[10px] text-slate-400 italic pt-0.5">
                    + {order.items.length - 3} more items...
                  </p>
                )}
              </div>

              {/* Action Buttons: [ Reorder ] & [ Details ] */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                >
                  View Order Details
                </button>

                <button
                  onClick={() => handleReorder(order.id)}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t.customer.orders.reorder}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <Modal
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          title={`Order ${selectedOrder.orderNumber}`}
          subtitle={`Placed on ${selectedOrder.orderDate}`}
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[10px]">Status</span>
                <span className="font-bold text-slate-900 capitalize">
                  {statusMap[selectedOrder.status] || selectedOrder.status}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[10px]">Total Amount</span>
                <span className="font-bold text-blue-700 text-sm font-mono-numbers">
                  ₹{selectedOrder.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
              Ordered Items
            </h4>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900 block">{item.productName}</span>
                    <span className="text-[11px] text-slate-500">{item.unit}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono-numbers font-medium text-slate-700 block">
                      {item.quantity} × ₹{item.unitPrice}
                    </span>
                    <span className="font-mono-numbers font-bold text-slate-900">
                      ₹{item.totalPrice}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleReorder(selectedOrder.id);
                  setSelectedOrder(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
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
