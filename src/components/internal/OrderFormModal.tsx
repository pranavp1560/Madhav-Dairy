import React, { useState, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { Order, OrderStatus } from '../../types/dairy';
import {
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  ShoppingCart,
  Calendar,
  Layers,
  FileText,
  Clock,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderToEdit?: Order | null;
}

interface FormItemRow {
  productId: string;
  skuId?: string;
  quantity: number;
  unitPrice: number;
}

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  isOpen,
  onClose,
  orderToEdit,
}) => {
  const {
    retailers,
    products,
    channelPrices,
    skuChannelPrices,
    salesChannels,
    createInternalOrder,
    editOrder,
    addToast
  } = useDairy();

  const isEditMode = Boolean(orderToEdit);

  // Form states
  const [customerId, setCustomerId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [notes, setNotes] = useState<string>('');
  const [rows, setRows] = useState<FormItemRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Selected customer & their sales channel
  const selectedCustomer = retailers.find(r => r.id === customerId);
  const customerChannelId = selectedCustomer?.salesChannelId || salesChannels.find(c => c.code === 'WHOLESALE')?.id;
  const customerChannelName = selectedCustomer?.salesChannelName || (salesChannels.find(c => c.id === customerChannelId)?.name) || 'Wholesale';
  const customerChannelCode = selectedCustomer?.salesChannelCode || (salesChannels.find(c => c.id === customerChannelId)?.code) || 'WHOLESALE';

  // Helper to fetch channel price for a product or SKU
  const getItemPricing = (productId: string, skuId?: string) => {
    if (!customerChannelId) return null;

    if (skuId) {
      const prod = products.find(p => p.id === productId);
      const sku = prod?.skus?.find(s => s.id === skuId);
      const skuPrice = sku?.channelPrices?.find(
        cp => cp.channelId === customerChannelId && cp.isActive
      ) || skuChannelPrices.find(
        cp => cp.skuId === skuId && cp.channelId === customerChannelId && cp.isActive
      );

      if (skuPrice) {
        return {
          standardPrice: skuPrice.standardPrice,
          minimumPrice: skuPrice.minimumPrice,
        };
      }
    }

    // Fallback to product channel price
    const cp = channelPrices.find(
      c => c.productId === productId && c.channelId === customerChannelId && c.isActive
    );
    if (cp) {
      return {
        standardPrice: cp.standardPrice,
        minimumPrice: cp.minimumPrice,
      };
    }
    return null;
  };

  // Helper to find default SKU or first SKU for a product
  const getInitialSkuId = (prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod || !prod.skus || prod.skus.length === 0) return undefined;
    const def = prod.skus.find(s => s.isDefault);
    return def ? def.id : prod.skus[0].id;
  };

  // Initialize or reset form state when modal opens or orderToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    setValidationError(null);

    if (orderToEdit) {
      setCustomerId(orderToEdit.retailerId);
      setDeliveryDate(orderToEdit.deliveryDate || '');
      setStatus(orderToEdit.status);
      setNotes(orderToEdit.notes || '');

      if (orderToEdit.items && orderToEdit.items.length > 0) {
        setRows(
          orderToEdit.items.map(it => ({
            productId: it.productId,
            skuId: it.skuId || getInitialSkuId(it.productId),
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          }))
        );
      } else if (products.length > 0) {
        const p = products[0];
        const initialSkuId = getInitialSkuId(p.id);
        const pricing = getItemPricing(p.id, initialSkuId);
        const rate = pricing ? pricing.standardPrice : p.defaultPrice;
        setRows([{ productId: p.id, skuId: initialSkuId, quantity: 10, unitPrice: rate }]);
      }
    } else {
      // Create Mode
      const initialCustId = retailers[0]?.id || '';
      setCustomerId(initialCustId);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      setDeliveryDate(tomorrow);
      setStatus('pending');
      setNotes('Telephone / counter booking recorded by staff');

      if (products.length > 0) {
        const p = products[0];
        const initialSkuId = getInitialSkuId(p.id);
        const initialChannel = retailers[0]?.salesChannelId;
        const cp = (initialSkuId
          ? skuChannelPrices.find(s => s.skuId === initialSkuId && s.channelId === initialChannel && s.isActive)
          : null) || channelPrices.find(c => c.productId === p.id && c.channelId === initialChannel && c.isActive);
        const rate = cp ? cp.standardPrice : p.defaultPrice;
        setRows([{ productId: p.id, skuId: initialSkuId, quantity: 10, unitPrice: rate }]);
      } else {
        setRows([]);
      }
    }
  }, [isOpen, orderToEdit, retailers, products]);

  // Handle switching customer on Create mode: re-evaluate channel rates
  const handleCustomerChange = (newCustId: string) => {
    setCustomerId(newCustId);
    if (!isEditMode && rows.length > 0) {
      const targetCust = retailers.find(r => r.id === newCustId);
      const chId = targetCust?.salesChannelId || salesChannels.find(c => c.code === 'WHOLESALE')?.id;

      setRows(prev =>
        prev.map(r => {
          const pricing = getItemPricing(r.productId, r.skuId);
          const prod = products.find(p => p.id === r.productId);
          const sku = prod?.skus?.find(s => s.id === r.skuId);
          const fallbackPrice = sku?.sellingPrice || prod?.defaultPrice || r.unitPrice;
          return {
            ...r,
            unitPrice: pricing ? pricing.standardPrice : fallbackPrice,
          };
        })
      );
    }
  };

  const handleItemSelectChange = (index: number, compoundVal: string) => {
    // Format: "productId::skuId"
    const [pId, sId] = compoundVal.split('::');
    const skuId = sId === 'default' ? undefined : sId;

    const prod = products.find(p => p.id === pId);
    const sku = prod?.skus?.find(s => s.id === skuId);
    const pricing = getItemPricing(pId, skuId);
    const stdPrice = pricing ? pricing.standardPrice : (sku?.sellingPrice || prod?.defaultPrice || 100);

    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      productId: pId,
      skuId,
      unitPrice: stdPrice,
    };
    setRows(updated);
  };

  const handleRowChange = (index: number, field: keyof FormItemRow, val: any) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: val };
    setRows(updated);
  };

  const addRow = () => {
    const defaultProd = products[0];
    const initialSkuId = defaultProd ? getInitialSkuId(defaultProd.id) : undefined;
    const pricing = defaultProd ? getItemPricing(defaultProd.id, initialSkuId) : null;
    const rate = pricing ? pricing.standardPrice : (defaultProd?.defaultPrice || 100);

    setRows(prev => [
      ...prev,
      {
        productId: defaultProd?.id || '',
        skuId: initialSkuId,
        quantity: 5,
        unitPrice: rate,
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, idx) => idx !== index));
  };

  // Calculations
  const totalAmount = rows.reduce((acc, row) => acc + (row.quantity * row.unitPrice), 0);
  const totalUnits = rows.reduce((acc, row) => acc + (Number(row.quantity) || 0), 0);

  // Check for floor violations
  const floorViolations = rows.map((r, idx) => {
    const pricing = getItemPricing(r.productId, r.skuId);
    const prod = products.find(p => p.id === r.productId);
    const sku = prod?.skus?.find(s => s.id === r.skuId);
    const skuLabel = sku?.variantName || sku?.packSize;
    const displayName = skuLabel ? `${prod?.name || 'Product'} (${skuLabel})` : (prod?.name || 'Product');

    const minPrice = pricing ? pricing.minimumPrice : 0;
    const isBelowFloor = minPrice > 0 && r.unitPrice < minPrice;

    return {
      index: idx,
      productName: displayName,
      enteredPrice: r.unitPrice,
      minPrice,
      isBelowFloor,
    };
  }).filter(v => v.isBelowFloor);

  const hasFloorViolations = floorViolations.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!customerId) {
      setValidationError('Please select a customer for this order.');
      return;
    }

    if (rows.length === 0) {
      setValidationError('Please add at least one line item.');
      return;
    }

    // Floor price check
    if (hasFloorViolations) {
      const first = floorViolations[0];
      setValidationError(
        `Rate for "${first.productName}" (₹${first.enteredPrice}) is below the ${customerChannelName} channel minimum price of ₹${first.minPrice}. Selling below channel floor price is strictly prohibited.`
      );
      return;
    }

    // Validate quantities
    const invalidQty = rows.some(r => r.quantity <= 0);
    if (invalidQty) {
      setValidationError('All product quantities must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = rows.map(r => {
        const prod = products.find(p => p.id === r.productId);
        const sku = prod?.skus?.find(s => s.id === r.skuId);
        const skuLabel = sku?.variantName || sku?.packSize;
        const displayName = skuLabel ? `${prod?.name || 'Dairy Product'} (${skuLabel})` : (prod?.name || 'Dairy Product');

        return {
          productId: r.productId,
          skuId: r.skuId,
          productName: displayName,
          quantity: Number(r.quantity),
          unitPrice: Number(r.unitPrice),
        };
      });

      if (isEditMode && orderToEdit) {
        await editOrder(orderToEdit.id, {
          customerId,
          items: itemsPayload,
          deliveryDate: deliveryDate || undefined,
          notes: notes.trim() || undefined,
          status,
        });
      } else {
        await createInternalOrder({
          customerId,
          items: itemsPayload,
          deliveryDate: deliveryDate || undefined,
          notes: notes.trim() || undefined,
        });
      }

      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? `Edit Order ${orderToEdit?.orderNumber}` : 'Create Internal Sales Order'}
      subtitle={
        isEditMode
          ? 'Modify order line items, scheduled delivery date, and order fulfillment status'
          : 'Book an order on behalf of a retailer or customer with automated sales channel pricing rules'
      }
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
        {/* Error / Alert Banners */}
        {validationError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{validationError}</span>
          </div>
        )}

        {hasFloorViolations && !validationError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 font-semibold">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
            <span>
              One or more item rates are below the channel minimum floor price. Please adjust rates before saving.
            </span>
          </div>
        )}

        {/* Customer & Channel Header Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-700">
                Customer / Retail Store <span className="text-red-500">*</span>
              </label>
              {selectedCustomer && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <span>Channel:</span>
                  <span className="font-extrabold">{customerChannelName}</span>
                  <span className="text-[9px] font-mono text-indigo-400">({customerChannelCode})</span>
                </span>
              )}
            </div>

            {retailers.length === 0 ? (
              <p className="text-slate-400 italic">No registered customers found.</p>
            ) : (
              <select
                value={customerId}
                onChange={e => handleCustomerChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                required
              >
                {retailers.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.businessName} &bull; {r.ownerName} ({r.area}) &bull; Channel: {r.salesChannelName || 'Wholesale'}
                  </option>
                ))}
              </select>
            )}
            <span className="text-[10px] text-slate-500 mt-1 block">
              Pricing automatically binds to the customer's sales channel tier.
            </span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Expected Delivery Date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono-numbers text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Order Status selector (if in Edit Mode) */}
        {isEditMode && (
          <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 block text-xs">Fulfillment Status</span>
                <span className="text-[10px] text-slate-600">Update workflow stage for this order</span>
              </div>
            </div>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as OrderStatus)}
              className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-bold text-blue-900 focus:outline-none cursor-pointer"
            >
              <option value="pending">PENDING (Awaiting Review)</option>
              <option value="confirmed">CONFIRMED (Accepted)</option>
              <option value="preparing">PREPARING (Production / Packing)</option>
              <option value="dispatched">DISPATCHED (Out for Delivery)</option>
              <option value="delivered">DELIVERED (Fulfilled)</option>
              <option value="cancelled">CANCELLED</option>
            </select>
          </div>
        )}

        {/* Order Line Items Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                Order Line Items
              </h4>
              <p className="text-[10px] text-slate-500">
                Select sellable SKU pack. Selling price can be anywhere between Channel Standard Price and Floor Price (cannot sell below Floor).
              </p>
            </div>
            <button
              type="button"
              onClick={addRow}
              disabled={products.length === 0}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 text-left">Product Family & Child SKU Variant</th>
                    <th className="py-2.5 px-3 text-center w-28">Quantity</th>
                    <th className="py-2.5 px-3 text-center w-36">Selling Price (₹)</th>
                    <th className="py-2.5 px-3 text-right w-28">Line Total</th>
                    <th className="py-2.5 px-3 text-center w-14">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => {
                    const prod = products.find(p => p.id === row.productId);
                    const sku = prod?.skus?.find(s => s.id === row.skuId);
                    const pricing = getItemPricing(row.productId, row.skuId);
                    const minPrice = pricing ? pricing.minimumPrice : 0;
                    const stdPrice = pricing ? pricing.standardPrice : (sku?.sellingPrice || prod?.defaultPrice || 0);
                    const isBelowFloor = minPrice > 0 && row.unitPrice < minPrice;
                    const lineTotal = (row.quantity || 0) * (row.unitPrice || 0);

                    const compoundValue = `${row.productId}::${row.skuId || 'default'}`;

                    return (
                      <tr key={idx} className={`hover:bg-slate-50/70 transition-colors ${isBelowFloor ? 'bg-red-50/40' : ''}`}>
                        {/* Product & SKU Select */}
                        <td className="py-3 px-3 align-top">
                          <select
                            value={compoundValue}
                            onChange={e => handleItemSelectChange(idx, e.target.value)}
                            className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all shadow-2xs"
                          >
                            {products.map(p => {
                              const skus = p.skus || [];
                              if (skus.length === 0) {
                                return (
                                  <option key={p.id} value={`${p.id}::default`}>
                                    {p.name} ({p.unit})
                                  </option>
                                );
                              }
                              return (
                                <optgroup key={p.id} label={`${p.name} (${p.category})`}>
                                  {skus.map(s => (
                                    <option key={s.id} value={`${p.id}::${s.id}`}>
                                      {p.name} — {s.variantName || s.packSize} [{s.skuCode}] (MRP ₹{s.mrp})
                                    </option>
                                  ))}
                                </optgroup>
                              );
                            })}
                          </select>

                          {/* Price Floor & Standard Guidance */}
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500 font-mono-numbers px-0.5">
                            <span className="font-medium text-slate-600">
                              Channel Std: <strong className="text-slate-900">₹{stdPrice}</strong>
                            </span>
                            <span className="text-slate-300">&bull;</span>
                            <span className={minPrice > 0 ? 'text-amber-800 font-bold' : ''}>
                              Floor Limit: ₹{minPrice}
                            </span>
                            {sku?.mrp && (
                              <>
                                <span className="text-slate-300">&bull;</span>
                                <span className="text-slate-400">MRP ₹{sku.mrp}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Quantity Input Box */}
                        <td className="py-3 px-3 align-top text-center">
                          <div className="w-24 mx-auto">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              required
                              value={row.quantity}
                              onChange={e => handleRowChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs font-mono-numbers text-center font-bold text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all shadow-2xs"
                            />
                            <span className="block text-[10px] text-slate-400 mt-1 font-medium truncate text-center">
                              {sku?.packSize || prod?.unit || 'packs'}
                            </span>
                          </div>
                        </td>

                        {/* Selling Price Input Box */}
                        <td className="py-3 px-3 align-top text-center">
                          <div className="w-28 mx-auto">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                                ₹
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                required
                                value={row.unitPrice}
                                onChange={e => handleRowChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className={`w-full py-1.5 pl-6 pr-2 bg-white border rounded-lg text-xs font-mono-numbers text-center font-bold focus:outline-none transition-all shadow-2xs ${
                                  isBelowFloor
                                    ? 'border-red-500 text-red-700 bg-red-50/60 focus:ring-1 focus:ring-red-400'
                                    : 'border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
                                }`}
                              />
                            </div>
                            {minPrice > 0 && (
                              <div className={`text-[10px] mt-1 font-mono-numbers text-center font-semibold ${
                                isBelowFloor ? 'text-red-600 font-bold' : 'text-slate-500'
                              }`}>
                                {isBelowFloor ? `Below floor ₹${minPrice}!` : `Floor: ₹${minPrice}`}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Line Total */}
                        <td className="py-3 px-3 align-top text-right">
                          <div className="pt-1.5">
                            <div className="font-mono-numbers font-bold text-slate-900 text-sm">
                              ₹{Math.round(lineTotal).toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono-numbers mt-0.5">
                              ₹{row.unitPrice || 0} &times; {row.quantity || 0}
                            </div>
                          </div>
                        </td>

                        {/* Remove Action */}
                        <td className="py-3 px-3 align-top text-center">
                          <div className="pt-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              disabled={rows.length === 1}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Notes & Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Order Notes / Delivery Directions
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Phone booking from Ramesh. Deliver before 7:00 AM on Morning Route 2."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Live Order Summary Card */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Total Unique Items:</span>
              <span className="font-bold text-slate-900 font-mono-numbers">{rows.length} items</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Total Quantity (Packs/Units):</span>
              <span className="font-bold text-slate-900 font-mono-numbers">{totalUnits} units</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
              <span className="font-bold text-slate-900 text-sm">Total Order Value:</span>
              <span className="text-xl font-black text-blue-700 font-mono-numbers">
                ₹{Math.round(totalAmount).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || rows.length === 0 || hasFloorViolations}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>
              {isSubmitting
                ? (isEditMode ? 'Updating Order...' : 'Creating Order...')
                : (isEditMode ? 'Save Changes' : 'Confirm & Place Order')}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
