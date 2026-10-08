import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Order, OrderStatus, Batch } from '../../types/dairy';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Calendar,
  Layers,
  Clock,
  ShieldAlert,
  Search,
  Store,
  MapPin,
  ChevronDown,
  X,
  Sparkles,
  Info,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';
import { calculateDaysRemaining, formatCalendarDate, getTodayDateString } from '../../utils/dateUtils';

interface CreateOrderViewProps {
  orderToEdit?: Order | null;
  onBack: () => void;
}

interface FormItemRow {
  productId: string;
  skuId?: string;
  batchId?: string; // Specific batch selected or undefined for auto-FEFO
  quantity: number;
  unitPrice: number;
}

export const CreateOrderView: React.FC<CreateOrderViewProps> = ({
  orderToEdit,
  onBack,
}) => {
  const {
    retailers,
    products,
    batches,
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

  // Customer Search & Dropdown State
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Close customer dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return retailers;
    const q = customerSearchQuery.toLowerCase();
    return retailers.filter(
      r =>
        r.businessName.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q) ||
        (r.area && r.area.toLowerCase().includes(q)) ||
        (r.mobile && r.mobile.includes(q)) ||
        (r.salesChannelName && r.salesChannelName.toLowerCase().includes(q))
    );
  }, [retailers, customerSearchQuery]);

  // Selected customer & their sales channel details
  const selectedCustomer = useMemo(() => {
    return retailers.find(r => r.id === customerId);
  }, [retailers, customerId]);

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

  // Helper to get active batches for a product / SKU sorted by FIFO / FEFO
  const getProductBatches = (productId: string, skuId?: string): Batch[] => {
    return batches
      .filter(b => {
        if (b.status !== 'active') return false;
        if (skuId && b.skuId === skuId) return true;
        return b.productId === productId;
      })
      .sort((a, b) => {
        // Earliest expiry first (FEFO), then earliest production date (FIFO)
        const expA = new Date(a.expiryDate).getTime();
        const expB = new Date(b.expiryDate).getTime();
        if (expA !== expB) return expA - expB;
        return new Date(a.productionDate).getTime() - new Date(b.productionDate).getTime();
      });
  };

  // Helper to find default FIFO/FEFO batch (earliest expiring with stock > 0, or earliest expiring)
  const getDefaultFefoBatch = (productId: string, skuId?: string): Batch | undefined => {
    const sorted = getProductBatches(productId, skuId);
    const withStock = sorted.find(b => b.availableQty > 0);
    return withStock || sorted[0];
  };

  // Initialize or reset form state
  useEffect(() => {
    setValidationError(null);

    if (orderToEdit) {
      setCustomerId(orderToEdit.retailerId);
      setDeliveryDate(orderToEdit.deliveryDate || '');
      setStatus(orderToEdit.status);
      setNotes(orderToEdit.notes || '');

      if (orderToEdit.items && orderToEdit.items.length > 0) {
        setRows(
          orderToEdit.items.map(it => {
            const initialSku = it.skuId || getInitialSkuId(it.productId);
            return {
              productId: it.productId,
              skuId: initialSku,
              batchId: it.batchId || undefined,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
            };
          })
        );
      } else if (products.length > 0) {
        const p = products[0];
        const initialSkuId = getInitialSkuId(p.id);
        const pricing = getItemPricing(p.id, initialSkuId);
        const rate = pricing ? pricing.standardPrice : p.defaultPrice;
        const defaultBatch = getDefaultFefoBatch(p.id, initialSkuId);
        setRows([{ productId: p.id, skuId: initialSkuId, batchId: defaultBatch?.id, quantity: 10, unitPrice: rate }]);
      }
    } else {
      // Create Mode
      const initialCustId = retailers[0]?.id || '';
      setCustomerId(initialCustId);

      // Default delivery date to tomorrow
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
        const defaultBatch = getDefaultFefoBatch(p.id, initialSkuId);
        setRows([{ productId: p.id, skuId: initialSkuId, batchId: defaultBatch?.id, quantity: 10, unitPrice: rate }]);
      } else {
        setRows([]);
      }
    }
  }, [orderToEdit, retailers, products]);

  // Handle switching customer: re-evaluate channel rates
  const handleCustomerChange = (newCustId: string) => {
    setCustomerId(newCustId);
    setIsCustomerDropdownOpen(false);
    setCustomerSearchQuery('');

    if (!isEditMode && rows.length > 0) {
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

    // Auto assign FEFO batch for newly selected SKU
    const defaultBatch = getDefaultFefoBatch(pId, skuId);

    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      productId: pId,
      skuId,
      batchId: defaultBatch?.id,
      unitPrice: stdPrice,
    };
    setRows(updated);
  };

  const handleBatchSelectChange = (index: number, val: string) => {
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      batchId: val === 'auto_fefo' ? undefined : val,
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
    const defaultBatch = defaultProd ? getDefaultFefoBatch(defaultProd.id, initialSkuId) : undefined;

    setRows(prev => [
      ...prev,
      {
        productId: defaultProd?.id || '',
        skuId: initialSkuId,
        batchId: defaultBatch?.id,
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
          batchId: r.batchId || undefined,
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

      onBack();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 font-sans">
      {/* Top Navigation & Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
            title="Back to Orders"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {isEditMode ? `Edit Sales Order ${orderToEdit?.orderNumber}` : 'Create New Sales Order'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                FIFO Batch Enabled
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Book order with customer search, automated channel pricing, and earliest-expiry (FIFO/FEFO) batch tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || rows.length === 0 || hasFloorViolations}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>
              {isSubmitting
                ? (isEditMode ? 'Updating Order...' : 'Creating Order...')
                : (isEditMode ? 'Save & Update Order' : 'Confirm & Place Order')}
            </span>
          </button>
        </div>
      </div>

      {/* Validation Banners */}
      {validationError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-xs font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
          <div>
            <span className="font-bold block">Validation Error</span>
            <span>{validationError}</span>
          </div>
        </div>
      )}

      {hasFloorViolations && !validationError && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900 text-xs font-semibold">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
          <span>
            One or more item rates are below the channel minimum floor price. Please adjust rates before placing the order.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Customer Selection & Order Schedule */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Searchable Customer Combobox */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-blue-600" />
                <span>Customer / Retail Store Selection</span>
                <span className="text-red-500">*</span>
              </label>

              {selectedCustomer && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                  <span>Channel:</span>
                  <span className="font-extrabold">{customerChannelName}</span>
                  <span className="text-[10px] font-mono text-indigo-400">({customerChannelCode})</span>
                </span>
              )}
            </div>

            {/* Custom Searchable Dropdown */}
            <div className="relative" ref={customerDropdownRef}>
              {/* Trigger Button showing selected customer or placeholder */}
              <div
                onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                className={`p-3 bg-slate-50 hover:bg-slate-100/80 border rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                  isCustomerDropdownOpen ? 'border-blue-600 ring-2 ring-blue-500/20 bg-white' : 'border-slate-300'
                }`}
              >
                {selectedCustomer ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center shrink-0 text-sm">
                      {selectedCustomer.businessName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {selectedCustomer.businessName}
                        </span>
                        {selectedCustomer.area && (
                          <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5 text-slate-400" />
                            <span>{selectedCustomer.area}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-2">
                        <span>Prop: {selectedCustomer.ownerName}</span>
                        {selectedCustomer.mobile && <span>&bull; {selectedCustomer.mobile}</span>}
                        {selectedCustomer.outstandingAmount > 0 && (
                          <span className="text-amber-700 font-bold font-mono-numbers">
                            &bull; Due: ₹{selectedCustomer.outstandingAmount.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    Click to search and select a customer...
                  </span>
                )}

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[11px] font-bold text-blue-600 hover:text-blue-700">
                    {isCustomerDropdownOpen ? 'Close' : 'Change Customer'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Floating Searchable Dropdown Menu */}
              {isCustomerDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                  {/* Search Input Box */}
                  <div className="p-3 border-b border-slate-100 bg-slate-50/70">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoFocus
                        value={customerSearchQuery}
                        onChange={e => setCustomerSearchQuery(e.target.value)}
                        placeholder="Type to search by store name, owner, area, phone or channel..."
                        className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                      {customerSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCustomerSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Customer Options List */}
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 italic">
                        No customers found matching "{customerSearchQuery}".
                      </div>
                    ) : (
                      filteredCustomers.map(cust => {
                        const isSelected = cust.id === customerId;
                        return (
                          <div
                            key={cust.id}
                            onClick={() => handleCustomerChange(cust.id)}
                            className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                              isSelected
                                ? 'bg-blue-50/80 text-blue-900 font-semibold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 truncate">
                                  {cust.businessName}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {cust.salesChannelName || 'Wholesale'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                <span>Owner: {cust.ownerName}</span>
                                {cust.area && <span>&bull; {cust.area}</span>}
                                {cust.mobile && <span>&bull; {cust.mobile}</span>}
                              </div>
                            </div>

                            <div className="text-right shrink-0 ml-3">
                              {cust.outstandingAmount > 0 ? (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono-numbers block">
                                  Due: ₹{cust.outstandingAmount.toLocaleString('en-IN')}
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-medium">Clear</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              Pricing automatically syncs with customer's sales channel tier: <strong>{customerChannelName}</strong>.
            </p>
          </div>

          {/* Schedule & Fulfillment Settings */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Requested Delivery Date</span>
              </label>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono-numbers text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
              <div className="flex gap-1.5 mt-2">
                {[
                  { label: 'Tomorrow', offset: 1 },
                  { label: 'In 2 Days', offset: 2 },
                  { label: 'In 3 Days', offset: 3 },
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + p.offset * 86400000).toISOString().split('T')[0];
                      setDeliveryDate(d);
                    }}
                    className="text-[10px] px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Order Status selector (if in Edit Mode) */}
            {isEditMode && (
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Order Lifecycle Status</span>
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-900 focus:bg-white focus:outline-none"
                >
                  <option value="pending">PENDING (Awaiting Confirmation)</option>
                  <option value="confirmed">CONFIRMED (Ready for Dispatch)</option>
                  <option value="dispatched">DISPATCHED (Out for Delivery)</option>
                  <option value="cancelled">CANCELLED</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Order Line Items with FIFO Batch Selection */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Order Line Items & FIFO Batch Allocation
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                By default, items auto-allocate to the earliest expiring active batch on a FIFO/FEFO basis. Staff may override to a specific batch.
              </p>
            </div>

            <button
              type="button"
              onClick={addRow}
              disabled={products.length === 0}
              className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Product</span>
            </button>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs min-w-[760px]">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-3 text-left w-1/3">Product Family & Child SKU</th>
                  <th className="py-3 px-3 text-left w-1/3">Assigned Batch (FIFO/FEFO Default)</th>
                  <th className="py-3 px-3 text-center w-24">Quantity</th>
                  <th className="py-3 px-3 text-center w-28">Rate (₹)</th>
                  <th className="py-3 px-3 text-right w-28">Line Total</th>
                  <th className="py-3 px-3 text-center w-12">Action</th>
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

                  // Available active batches for this SKU/product
                  const availableBatches = getProductBatches(row.productId, row.skuId);
                  const fefoDefaultBatch = getDefaultFefoBatch(row.productId, row.skuId);

                  // Current assigned batch (either explicit batchId, or fefo default)
                  const selectedBatch = row.batchId
                    ? availableBatches.find(b => b.id === row.batchId)
                    : fefoDefaultBatch;

                  const daysLeft = selectedBatch ? calculateDaysRemaining(selectedBatch.expiryDate) : null;
                  const isLowStock = selectedBatch && row.quantity > selectedBatch.availableQty;

                  return (
                    <tr key={idx} className={`hover:bg-slate-50/60 transition-colors ${isBelowFloor ? 'bg-red-50/30' : ''}`}>
                      {/* Product & SKU Variant Selector */}
                      <td className="py-3 px-3 align-top">
                        <select
                          value={compoundValue}
                          onChange={e => handleItemSelectChange(idx, e.target.value)}
                          className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none transition-all shadow-2xs"
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

                        {/* Price Floor and MRP Guidance */}
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500 font-mono-numbers px-0.5">
                          <span className="font-medium text-slate-600">
                            Std: <strong className="text-slate-900">₹{stdPrice}</strong>
                          </span>
                          <span className="text-slate-300">&bull;</span>
                          <span className={minPrice > 0 ? 'text-amber-800 font-bold' : ''}>
                            Floor: ₹{minPrice}
                          </span>
                          {sku?.mrp && (
                            <>
                              <span className="text-slate-300">&bull;</span>
                              <span className="text-slate-400">MRP ₹{sku.mrp}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Batch Selector (Default FIFO/FEFO) */}
                      <td className="py-3 px-3 align-top">
                        <div className="space-y-1.5">
                          <select
                            value={row.batchId || 'auto_fefo'}
                            onChange={e => handleBatchSelectChange(idx, e.target.value)}
                            className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none shadow-2xs"
                          >
                            <option value="auto_fefo">
                              ⚡ Auto FIFO/FEFO {fefoDefaultBatch ? `(#${fefoDefaultBatch.batchNumber})` : '(No stock)'}
                            </option>
                            {availableBatches.map(b => {
                              const bDays = calculateDaysRemaining(b.expiryDate);
                              return (
                                <option key={b.id} value={b.id}>
                                  Batch #{b.batchNumber} — Exp: {formatCalendarDate(b.expiryDate)} ({bDays}d left) • Stock: {b.availableQty} units
                                </option>
                              );
                            })}
                          </select>

                          {/* Batch Expiry & Stock Chips */}
                          {selectedBatch ? (
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              <span className={`px-2 py-0.5 rounded font-bold ${
                                !row.batchId
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}>
                                {!row.batchId ? '⚡ FIFO Auto' : 'Manual Override'}
                              </span>

                              <span className={`px-2 py-0.5 rounded font-bold font-mono-numbers ${
                                daysLeft !== null && daysLeft <= 3
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : daysLeft !== null && daysLeft <= 5
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                Exp: {formatCalendarDate(selectedBatch.expiryDate)} ({daysLeft}d left)
                              </span>

                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono-numbers">
                                Avail: {selectedBatch.availableQty} units
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-amber-700 italic block">
                              No active batch in stock. FEFO batch will auto-assign at dispatch.
                            </span>
                          )}

                          {isLowStock && (
                            <div className="text-[10px] text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              ⚠️ Ordered {row.quantity} exceeds batch stock ({selectedBatch?.availableQty}).
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Quantity Input Box */}
                      <td className="py-3 px-3 align-top text-center">
                        <div className="w-20 mx-auto">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={row.quantity}
                            onChange={e => handleRowChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs font-mono-numbers text-center font-bold text-slate-900 focus:border-blue-600 focus:outline-none shadow-2xs"
                          />
                          <span className="block text-[10px] text-slate-400 mt-1 font-medium truncate text-center">
                            {sku?.packSize || prod?.unit || 'packs'}
                          </span>
                        </div>
                      </td>

                      {/* Selling Price Input Box */}
                      <td className="py-3 px-3 align-top text-center">
                        <div className="w-24 mx-auto">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                              ₹
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              required
                              value={row.unitPrice}
                              onChange={e => handleRowChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className={`w-full py-1.5 pl-5 pr-1.5 bg-white border rounded-lg text-xs font-mono-numbers text-center font-bold focus:outline-none transition-all shadow-2xs ${
                                isBelowFloor
                                  ? 'border-red-500 text-red-700 bg-red-50/60 focus:ring-1 focus:ring-red-400'
                                  : 'border-slate-300 text-slate-900 focus:border-blue-600'
                              }`}
                            />
                          </div>
                          {minPrice > 0 && (
                            <div className={`text-[10px] mt-1 font-mono-numbers text-center font-semibold ${
                              isBelowFloor ? 'text-red-600 font-bold' : 'text-slate-400'
                            }`}>
                              {isBelowFloor ? `Floor: ₹${minPrice}` : `Min: ₹${minPrice}`}
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

                      {/* Remove Button */}
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

        {/* Section 3: Notes & Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Notes Card */}
          <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              Order Notes / Delivery & Route Directions
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Phone booking from Ramesh. Deliver before 7:00 AM on Morning Route 2."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Live Order Summary Card */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Order Financial Summary
            </h3>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Total Items:</span>
                <span className="font-bold text-slate-900 font-mono-numbers">{rows.length} product(s)</span>
              </div>
              <div className="flex justify-between">
                <span>Total Units:</span>
                <span className="font-bold text-slate-900 font-mono-numbers">{totalUnits} units</span>
              </div>
              <div className="flex justify-between">
                <span>Sales Channel:</span>
                <span className="font-bold text-indigo-700">{customerChannelName}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
              <span className="font-bold text-slate-900 text-sm">Total Order Value:</span>
              <span className="text-2xl font-black text-blue-700 font-mono-numbers">
                ₹{Math.round(totalAmount).toLocaleString('en-IN')}
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || rows.length === 0 || hasFloorViolations}
              className="w-full py-3 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all mt-2"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? (isEditMode ? 'Updating Order...' : 'Creating Order...')
                  : (isEditMode ? 'Save & Update Order' : 'Confirm & Place Order')}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
