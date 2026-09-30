import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { Order, OrderStatus } from '../../types/dairy';
import { ShoppingCart, Search, Filter, ArrowRight, Eye, Calendar, MapPin, Truck } from 'lucide-react';

interface OrdersViewProps {
  onSelectRetailer: (id: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ onSelectRetailer }) => {
  const { orders, retailers, updateOrderStatus } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.retailerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRetailer = selectedRetailer === 'all' || o.retailerId === selectedRetailer;
    const matchesStatus = selectedStatus === 'all' || o.status === selectedStatus;
    return matchesSearch && matchesRetailer && matchesStatus;
  });

  const nextStatusMap: Partial<Record<OrderStatus, OrderStatus>> = {
    pending: 'confirmed',
    confirmed: 'preparing',
    preparing: 'dispatched',
    dispatched: 'delivered',
  };

  const getRetailerAddress = (retailerId: string) => {
    const r = retailers.find(ret => ret.id === retailerId);
    return r ? r.address : 'Registered Delivery Address';
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900">Retailer Sales Orders</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Incoming orders from retailer customer portal and direct dairy telephone bookings
          </p>
        </div>
        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
          {orders.length} Total Orders
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search Order Number or Retailer..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedRetailer}
            onChange={e => setSelectedRetailer(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="all">All Retailers</option>
            {retailers.map(r => (
              <option key={r.id} value={r.id}>{r.businessName}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="dispatched">Dispatched</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Order No.</th>
                <th className="py-3 px-3">Retailer Store</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Items & Batch Allocation</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredOrders.map(order => {
                const nextStatus = nextStatusMap[order.status];

                return (
                  <tr key={order.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4 font-mono-numbers font-bold text-slate-900">
                      {order.orderNumber}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => onSelectRetailer(order.retailerId)}
                        className="font-bold text-slate-900 hover:text-blue-600 hover:underline text-left"
                      >
                        {order.retailerName}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono-numbers">
                      <div>{order.orderDate}</div>
                      {order.deliveryDate && (
                        <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5 mt-0.5" title="Expected Date of Delivery">
                          <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Exp: {order.deliveryDate}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      <div className="space-y-0.5">
                        {order.items.slice(0, 2).map((item, i) => (
                          <div key={i} className="text-[11px]">
                            <span className="font-semibold text-slate-900">{item.quantity}</span> × {item.productName}
                            {item.batchNumber && (
                              <span className="font-mono-numbers text-[9px] text-blue-700 bg-blue-50 px-1 ml-1 rounded font-semibold border border-blue-200">
                                Batch: {item.batchNumber}
                              </span>
                            )}
                          </div>
                        ))}
                        {order.items.length > 2 && (
                          <span className="text-[10px] text-slate-400">
                            +{order.items.length - 2} more items...
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono-numbers font-bold text-slate-900">
                      ₹{order.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={order.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingOrder(order)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 text-[11px] font-medium transition-colors"
                          title="View order details"
                        >
                          Details
                        </button>
                        {nextStatus && (
                          <button
                            onClick={() => updateOrderStatus(order.id, nextStatus)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded text-[11px] font-bold transition-all inline-flex items-center gap-1"
                          >
                            <span>&rarr; {nextStatus.toUpperCase()}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Drawer (Section 17) */}
      <Drawer
        isOpen={Boolean(viewingOrder)}
        onClose={() => setViewingOrder(null)}
        title={viewingOrder ? `Order ${viewingOrder.orderNumber}` : 'Order Details'}
        subtitle={viewingOrder ? `Retailer: ${viewingOrder.retailerName}` : ''}
        width="lg"
      >
        {viewingOrder && (
          <div className="space-y-4 text-xs">
            {/* Order Information Section */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                Order Information
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Customer / Retailer</span>
                  <span className="font-semibold text-slate-900">{viewingOrder.retailerName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Order Date</span>
                  <span className="font-semibold text-slate-900 font-mono-numbers">{viewingOrder.orderDate}</span>
                </div>
                {viewingOrder.deliveryDate && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Expected Delivery</span>
                    <span className="font-bold text-emerald-700 font-mono-numbers flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      {viewingOrder.deliveryDate}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500 block text-[10px]">Fulfillment Status</span>
                  <StatusBadge status={viewingOrder.status} size="sm" />
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Total Order Amount</span>
                  <span className="font-bold text-blue-700 text-sm font-mono-numbers">
                    ₹{viewingOrder.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 block text-[10px]">Delivery Address</span>
                <span className="text-slate-700">{getRetailerAddress(viewingOrder.retailerId)}</span>
              </div>
            </div>

            {/* Order Items with Internal Batch Allocation (Section 17) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                  Order Items & Batch Allocation (Internal View)
                </h4>
                <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium border border-blue-200">
                  FEFO Policy Active
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="p-2.5">Product</th>
                      <th className="p-2.5">Allocated Batch</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Unit Rate</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingOrder.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-2.5 font-semibold text-slate-900">
                          {item.productName}
                          <span className="block text-[10px] text-slate-400 font-normal">{item.unit}</span>
                        </td>
                        <td className="p-2.5">
                          {item.batchNumber ? (
                            <span className="font-mono-numbers font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[11px]">
                              {item.batchNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Pending Allocation</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono-numbers font-bold text-slate-900">
                          {item.quantity}
                        </td>
                        <td className="p-2.5 text-right font-mono-numbers text-slate-600">
                          ₹{item.unitPrice}
                        </td>
                        <td className="p-2.5 text-right font-mono-numbers font-bold text-slate-900">
                          ₹{item.totalPrice.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setViewingOrder(null)}
              >
                Close Drawer
              </Button>
              {nextStatusMap[viewingOrder.status] && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    updateOrderStatus(viewingOrder.id, nextStatusMap[viewingOrder.status]!);
                    setViewingOrder(prev => prev ? { ...prev, status: nextStatusMap[prev.status]! } : null);
                  }}
                >
                  Advance to {nextStatusMap[viewingOrder.status]!.toUpperCase()}
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
