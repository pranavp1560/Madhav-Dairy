import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { Order, OrderStatus } from '../../types/dairy';
import { 
  ShoppingCart, Search, Filter, ArrowRight, Eye, Calendar, MapPin, 
  Truck, Plus, Pencil, CheckCircle2, FileText, CheckSquare, Square, AlertCircle, Clock
} from 'lucide-react';

interface OrdersViewProps {
  onSelectRetailer: (id: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ onSelectRetailer }) => {
  const { 
    orders, 
    retailers, 
    updateOrderStatus, 
    confirmOrder, 
    dispatchOrder, 
    bulkConfirmOrders, 
    bulkDispatchOrders,
    setInternalView,
    setSelectedInvoiceId,
    navigateToCreateOrder,
  } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  // Bulk selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const handleOpenCreateOrder = () => {
    navigateToCreateOrder(null);
  };

  const handleOpenEditOrder = (order: Order) => {
    navigateToCreateOrder(order);
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.retailerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRetailer = selectedRetailer === 'all' || o.retailerId === selectedRetailer;
    const matchesStatus = selectedStatus === 'all' || o.status === selectedStatus;
    return matchesSearch && matchesRetailer && matchesStatus;
  });

  const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds.includes(o.id));
  const someFilteredSelected = filteredOrders.some(o => selectedOrderIds.includes(o.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Selected orders grouped by status for bulk actions
  const selectedPendingIds = filteredOrders.filter(o => selectedOrderIds.includes(o.id) && o.status === 'pending').map(o => o.id);
  const selectedConfirmedIds = filteredOrders.filter(o => selectedOrderIds.includes(o.id) && o.status === 'confirmed').map(o => o.id);

  const handleBulkConfirm = async () => {
    if (selectedPendingIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await bulkConfirmOrders(selectedPendingIds);
      setSelectedOrderIds(prev => prev.filter(id => !selectedPendingIds.includes(id)));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDispatch = async () => {
    if (selectedConfirmedIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await bulkDispatchOrders(selectedConfirmedIds);
      setSelectedOrderIds(prev => prev.filter(id => !selectedConfirmedIds.includes(id)));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleViewInvoice = (order: Order) => {
    if (order.invoiceId) {
      setSelectedInvoiceId(order.invoiceId);
    }
    setInternalView('invoices');
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
            Operational Lifecycle: <span className="font-semibold text-amber-700">Pending</span> &rarr; <span className="font-semibold text-blue-700">Confirmed</span> &rarr; <span className="font-semibold text-sky-700">Dispatched</span> (Auto-Generates Invoice)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200">
            {orders.length} Total Orders
          </span>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreateOrder}
          >
            Create New Order
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
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
            <option value="dispatched">Dispatched</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Bulk Operations Toolbar */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span>{selectedOrderIds.length} order(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            {selectedPendingIds.length > 0 && (
              <button
                onClick={handleBulkConfirm}
                disabled={isBulkProcessing}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Bulk Confirm ({selectedPendingIds.length})</span>
              </button>
            )}

            {selectedConfirmedIds.length > 0 && (
              <button
                onClick={handleBulkDispatch}
                disabled={isBulkProcessing}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Bulk Dispatch & Invoice ({selectedConfirmedIds.length})</span>
              </button>
            )}

            <button
              onClick={() => setSelectedOrderIds([])}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={input => {
                      if (input) input.indeterminate = someFilteredSelected && !allFilteredSelected;
                    }}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">Order No.</th>
                <th className="py-3 px-3">Retailer Store</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Items</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No orders match your search or filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const isSelected = selectedOrderIds.includes(order.id);

                  return (
                    <tr 
                      key={order.id} 
                      className={`hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 font-mono-numbers font-bold text-slate-900">
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
                          {/* Details Drawer */}
                          <button
                            onClick={() => setViewingOrder(order)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 text-[11px] font-medium transition-colors"
                            title="View order details"
                          >
                            Details
                          </button>

                          {/* Edit button allowed only if not dispatched */}
                          {order.status !== 'dispatched' && order.status !== 'cancelled' && (
                            <button
                              onClick={() => handleOpenEditOrder(order)}
                              className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                              title="Edit order items & pricing"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          )}

                          {/* Forward Action Buttons */}
                          {order.status === 'pending' && (
                            <button
                              onClick={() => confirmOrder(order.id)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded text-[11px] font-bold transition-all inline-flex items-center gap-1"
                              title="Confirm order"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Confirm</span>
                            </button>
                          )}

                          {order.status === 'confirmed' && (
                            <button
                              onClick={() => dispatchOrder(order.id)}
                              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-600 hover:text-white text-sky-700 border border-sky-200 rounded text-[11px] font-bold transition-all inline-flex items-center gap-1"
                              title="Dispatch order and automatically generate invoice"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Dispatch & Invoice</span>
                            </button>
                          )}

                          {order.status === 'dispatched' && (
                            <button
                              onClick={() => handleViewInvoice(order)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold transition-all inline-flex items-center gap-1"
                              title={order.invoiceNumber ? `View Invoice ${order.invoiceNumber}` : 'View Invoices'}
                            >
                              <FileText className="w-3 h-3" />
                              <span>{order.invoiceNumber || 'View Invoice'}</span>
                            </button>
                          )}
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

      {/* Order Details Drawer */}
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
                  <span className="text-slate-500 block text-[10px]">Operational Status</span>
                  <StatusBadge status={viewingOrder.status} size="sm" />
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Total Order Amount</span>
                  <span className="font-bold text-blue-700 text-sm font-mono-numbers">
                    ₹{viewingOrder.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Audit trail */}
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                {viewingOrder.confirmedAt && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Confirmed At</span>
                    <span className="font-mono-numbers text-slate-700">
                      {new Date(viewingOrder.confirmedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {viewingOrder.dispatchedAt && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Dispatched At</span>
                    <span className="font-mono-numbers text-slate-700">
                      {new Date(viewingOrder.dispatchedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {viewingOrder.invoiceNumber && (
                  <div className="col-span-2 bg-emerald-50 border border-emerald-200 p-2 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-emerald-800 font-bold block text-xs">Generated Invoice</span>
                      <span className="font-mono-numbers text-emerald-700 text-xs">{viewingOrder.invoiceNumber}</span>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<FileText className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setViewingOrder(null);
                        handleViewInvoice(viewingOrder);
                      }}
                    >
                      View Invoice
                    </Button>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 block text-[10px]">Delivery Address</span>
                <span className="text-slate-700">{getRetailerAddress(viewingOrder.retailerId)}</span>
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                Order Items
              </h4>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="p-2.5">Product</th>
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

            {/* Drawer Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setViewingOrder(null)}
                >
                  Close Drawer
                </Button>
                {viewingOrder.status !== 'dispatched' && viewingOrder.status !== 'cancelled' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Pencil className="w-3.5 h-3.5" />}
                    onClick={() => {
                      const toEdit = viewingOrder;
                      setViewingOrder(null);
                      handleOpenEditOrder(toEdit);
                    }}
                  >
                    Edit Order
                  </Button>
                )}
              </div>

              {viewingOrder.status === 'pending' && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  onClick={async () => {
                    await confirmOrder(viewingOrder.id);
                    setViewingOrder(prev => prev ? { ...prev, status: 'confirmed' } : null);
                  }}
                >
                  Confirm Order
                </Button>
              )}

              {viewingOrder.status === 'confirmed' && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Truck className="w-3.5 h-3.5" />}
                  onClick={async () => {
                    const res = await dispatchOrder(viewingOrder.id);
                    setViewingOrder(prev => prev ? { 
                      ...prev, 
                      status: 'dispatched',
                      invoiceId: res.invoiceId,
                      invoiceNumber: res.invoiceNumber 
                    } : null);
                  }}
                >
                  Dispatch & Generate Invoice
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
