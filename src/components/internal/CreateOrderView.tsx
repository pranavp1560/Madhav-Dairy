import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Order, OrderStatus, Batch, DirectCustomer } from '../../types/dairy';
import { directCustomerService, normalizeMobile } from '../../services/directCustomerService';
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
  PackageCheck,
  UserCheck,
  User,
  Phone,
  Edit,
  Mail,
  Building2
} from 'lucide-react';
import { calculateDaysRemaining, formatCalendarDate, getTodayDateString } from '../../utils/dateUtils';
import { 
  getSkuWeightInKg, 
  calculatePouchesFromKg, 
  calculateKgFromPouches, 
  formatSkuPackLabel 
} from '../../utils/weightCalculator';

interface CreateOrderViewProps {
  orderToEdit?: Order | null;
  onBack: () => void;
}

interface FormItemRow {
  productId: string;
  skuId?: string;
  batchId?: string;
  quantity: number; // in pouches / packs
  targetKg?: number; // total bulk kg
  unitPrice: number;
}

export const CreateOrderView: React.FC<CreateOrderViewProps> = ({
  orderToEdit,
  onBack,
}) => {
  const {
    retailers,
    directCustomers,
    createDirectCustomer,
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

  // Order Type selector: 'shop' vs 'direct_customer'
  const [orderType, setOrderType] = useState<'shop' | 'direct_customer'>(
    orderToEdit?.orderType === 'direct_customer' ? 'direct_customer' : 'shop'
  );

  // Shop Customer Form states
  const [customerId, setCustomerId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [notes, setNotes] = useState<string>('');
  const [rows, setRows] = useState<FormItemRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Direct Customer States
  const [directCustomerId, setDirectCustomerId] = useState<string>('');
  const [isDirectDropdownOpen, setIsDirectDropdownOpen] = useState(false);
  const [directSearchQuery, setDirectSearchQuery] = useState('');
  const directDropdownRef = useRef<HTMLDivElement>(null);

  // Direct Order Delivery Information
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [isSameAddress, setIsSameAddress] = useState<boolean>(true);
  const [deliveryInstructions, setDeliveryInstructions] = useState<string>('');
  const [deliveryContactPerson, setDeliveryContactPerson] = useState<string>('');
  const [deliveryContactNumber, setDeliveryContactNumber] = useState<string>('');
  const [eventName, setEventName] = useState<string>('');
  const [eventType, setEventType] = useState<string>('');

  // Inline Add New Direct Customer Modal
  const [isInlineAddCustomerOpen, setIsInlineAddCustomerOpen] = useState(false);
  const [inlineNewCustomer, setInlineNewCustomer] = useState({
    name: '',
    mobile: '',
    address: '',
    alternateMobile: '',
    email: '',
    notes: '',
  });
  const [inlineDuplicateWarning, setInlineDuplicateWarning] = useState<DirectCustomer | null>(null);
  const [isSavingInlineCustomer, setIsSavingInlineCustomer] = useState(false);

  // Shop Customer Search & Dropdown State
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
      if (directDropdownRef.current && !directDropdownRef.current.contains(event.target as Node)) {
        setIsDirectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered Shop customers based on search
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

  // Selected Shop customer
  const selectedCustomer = useMemo(() => {
    return retailers.find(r => r.id === customerId);
  }, [retailers, customerId]);

  // Selected Direct Customer
  const selectedDirectCustomer = useMemo(() => {
    return directCustomers.find(c => c.id === directCustomerId);
  }, [directCustomers, directCustomerId]);

  // Filtered Direct Customers
  const filteredDirectCustomers = useMemo(() => {
    if (!directSearchQuery.trim()) return directCustomers;
    const q = directSearchQuery.toLowerCase();
    const cleanQ = q.replace(/\D/g, '');
    return directCustomers.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.customerCode.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        (cleanQ.length >= 3 && normalizeMobile(c.mobile).includes(cleanQ)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [directCustomers, directSearchQuery]);

  // Auto-sync delivery address when direct customer changes and isSameAddress is true
  useEffect(() => {
    if (selectedDirectCustomer && isSameAddress) {
      setDeliveryAddress(selectedDirectCustomer.address);
    }
  }, [selectedDirectCustomer, isSameAddress]);

  // Preselected Direct Customer from navigation
  useEffect(() => {
    try {
      const pre = sessionStorage.getItem('preselected_direct_customer');
      if (pre) {
        const parsed = JSON.parse(pre);
        setOrderType('direct_customer');
        setDirectCustomerId(parsed.id);
        setDeliveryAddress(parsed.address || '');
        setIsSameAddress(true);
        sessionStorage.removeItem('preselected_direct_customer');
      }
    } catch (e) {
      console.warn('Error reading preselected_direct_customer:', e);
    }
  }, []);

  // Determine active channel pricing rules
  const customerChannelId = orderType === 'shop'
    ? (selectedCustomer?.salesChannelId || salesChannels.find(c => c.code === 'WHOLESALE')?.id)
    : (salesChannels.find(c => c.code === 'WHOLESALE')?.id || salesChannels[0]?.id);

  const customerChannelName = orderType === 'shop'
    ? (selectedCustomer?.salesChannelName || (salesChannels.find(c => c.id === customerChannelId)?.name) || 'Wholesale')
    : 'Direct / Bulk';

  const customerChannelCode = orderType === 'shop'
    ? (selectedCustomer?.salesChannelCode || (salesChannels.find(c => c.id === customerChannelId)?.code) || 'WHOLESALE')
    : 'DIRECT';

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
    const p = products.find(prod => prod.id === prodId);
    if (!p || !p.skus || p.skus.length === 0) return undefined;
    const def = p.skus.find(s => s.isDefault && s.isActive);
    if (def) return def.id;
    const firstActive = p.skus.find(s => s.isActive);
    return firstActive?.id || p.skus[0].id;
  };

  // Helper to find earliest-expiring active batch with available stock (FIFO/FEFO default)
  const getDefaultFefoBatch = (productId: string, skuId?: string): Batch | undefined => {
    const matchingBatches = batches.filter(b => {
      if (b.status !== 'active' || b.availableQty <= 0) return false;
      if (skuId && b.skuId) {
        return b.skuId === skuId;
      }
      return b.productId === productId;
    });

    if (matchingBatches.length === 0) return undefined;

    return [...matchingBatches].sort((a, b) => {
      if (a.expiryDate && b.expiryDate) {
        const expA = new Date(a.expiryDate).getTime();
        const expB = new Date(b.expiryDate).getTime();
        if (expA !== expB) return expA - expB;
      }
      return new Date(a.productionDate).getTime() - new Date(b.productionDate).getTime();
    })[0];
  };

  // Initialize or reset form state
  useEffect(() => {
    setValidationError(null);

    if (orderToEdit) {
      if (orderToEdit.orderType === 'direct_customer') {
        setOrderType('direct_customer');
        setDirectCustomerId(orderToEdit.directCustomerId || '');
        setDeliveryAddress(orderToEdit.deliveryAddress || '');
        setDeliveryInstructions(orderToEdit.deliveryInstructions || '');
        setDeliveryContactPerson(orderToEdit.deliveryContactPerson || '');
        setDeliveryContactNumber(orderToEdit.deliveryContactNumber || '');
        setEventName(orderToEdit.eventName || '');
        setEventType(orderToEdit.eventType || '');
        setIsSameAddress(false);
      } else {
        setOrderType('shop');
        setCustomerId(orderToEdit.retailerId || '');
      }

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
              batchId: it.batchId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
            };
          })
        );
      } else if (products.length > 0) {
        const p = products[0];
        const initialSkuId = getInitialSkuId(p.id);
        const sku = p.skus?.find(s => s.id === initialSkuId);
        const pricing = getItemPricing(p.id, initialSkuId);
        const rate = pricing ? pricing.standardPrice : p.defaultPrice;
        const weightInKg = getSkuWeightInKg(sku || p);
        const initialPouches = 10;
        setRows([{ 
          productId: p.id, 
          skuId: initialSkuId, 
          quantity: initialPouches, 
          targetKg: calculateKgFromPouches(initialPouches, weightInKg), 
          unitPrice: rate 
        }]);
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
        const sku = p.skus?.find(s => s.id === initialSkuId);
        const initialChannel = retailers[0]?.salesChannelId;
        const cp = (initialSkuId
          ? skuChannelPrices.find(s => s.skuId === initialSkuId && s.channelId === initialChannel && s.isActive)
          : null) || channelPrices.find(c => c.productId === p.id && c.channelId === initialChannel && c.isActive);

        const rate = cp ? cp.standardPrice : p.defaultPrice;
        const weightInKg = getSkuWeightInKg(sku || p);
        const initialPouches = 10;
        setRows([{ 
          productId: p.id, 
          skuId: initialSkuId, 
          quantity: initialPouches, 
          targetKg: calculateKgFromPouches(initialPouches, weightInKg), 
          unitPrice: rate 
        }]);
      } else {
        setRows([]);
      }
    }
  }, [orderToEdit, retailers, products]);

  // Handle switching shop customer: re-evaluate channel rates
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

  // Inline Direct Customer Mobile Duplicate Check
  const handleInlineMobileChange = async (val: string) => {
    setInlineNewCustomer(prev => ({ ...prev, mobile: val }));
    const clean = normalizeMobile(val);
    if (clean.length === 10) {
      const dup = await directCustomerService.findDuplicateByMobile(val);
      setInlineDuplicateWarning(dup);
    } else {
      setInlineDuplicateWarning(null);
    }
  };

  // Save Inline Direct Customer
  const handleSaveInlineCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineNewCustomer.name.trim()) {
      addToast('Customer Name is required', 'error');
      return;
    }
    const cleanMobile = normalizeMobile(inlineNewCustomer.mobile);
    if (cleanMobile.length < 10) {
      addToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }
    if (!inlineNewCustomer.address.trim()) {
      addToast('Customer Address is required', 'error');
      return;
    }

    try {
      setIsSavingInlineCustomer(true);
      const newCust = await createDirectCustomer({
        name: inlineNewCustomer.name,
        mobile: inlineNewCustomer.mobile,
        address: inlineNewCustomer.address,
        alternateMobile: inlineNewCustomer.alternateMobile || undefined,
        email: inlineNewCustomer.email || undefined,
        notes: inlineNewCustomer.notes || undefined,
      });

      // Auto-select this newly created customer!
      setDirectCustomerId(newCust.id);
      if (isSameAddress) {
        setDeliveryAddress(newCust.address);
      }
      setIsInlineAddCustomerOpen(false);
      setInlineNewCustomer({
        name: '',
        mobile: '',
        address: '',
        alternateMobile: '',
        email: '',
        notes: '',
      });
      setInlineDuplicateWarning(null);
    } catch (err: any) {
      addToast(err.message || 'Failed to create direct customer', 'error');
    } finally {
      setIsSavingInlineCustomer(false);
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
    const weightInKg = getSkuWeightInKg(sku || prod);

    const currentRow = rows[index];
    let qty = currentRow.quantity || 10;
    let targetKg = currentRow.targetKg;

    // If user previously set targetKg (e.g. 10 kg), recompute pouches for new SKU (e.g. 500gm -> 20 pouches)
    if (targetKg && targetKg > 0) {
      qty = calculatePouchesFromKg(targetKg, weightInKg);
    } else {
      targetKg = calculateKgFromPouches(qty, weightInKg);
    }

    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      productId: pId,
      skuId,
      targetKg,
      quantity: qty > 0 ? qty : 1,
      unitPrice: stdPrice,
    };
    setRows(updated);
  };

  const handleTargetKgChange = (index: number, kgVal: number) => {
    const row = rows[index];
    const prod = products.find(p => p.id === row.productId);
    const sku = prod?.skus?.find(s => s.id === row.skuId);
    const weightInKg = getSkuWeightInKg(sku || prod);
    const pouches = calculatePouchesFromKg(kgVal, weightInKg);

    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      targetKg: kgVal,
      quantity: pouches > 0 ? pouches : (kgVal > 0 ? 1 : 0),
    };
    setRows(updated);
  };

  const handleQuantityChange = (index: number, qtyVal: number) => {
    const row = rows[index];
    const prod = products.find(p => p.id === row.productId);
    const sku = prod?.skus?.find(s => s.id === row.skuId);
    const weightInKg = getSkuWeightInKg(sku || prod);
    const totalKg = calculateKgFromPouches(qtyVal, weightInKg);

    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      quantity: qtyVal,
      targetKg: totalKg,
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
    const sku = defaultProd?.skus?.find(s => s.id === initialSkuId);
    const pricing = defaultProd ? getItemPricing(defaultProd.id, initialSkuId) : null;
    const rate = pricing ? pricing.standardPrice : (defaultProd?.defaultPrice || 100);
    const weightInKg = getSkuWeightInKg(sku || defaultProd);
    const initialPouches = 10;
    const initialKg = calculateKgFromPouches(initialPouches, weightInKg);

    setRows(prev => [
      ...prev,
      {
        productId: defaultProd?.id || '',
        skuId: initialSkuId,
        targetKg: initialKg,
        quantity: initialPouches,
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

    // Validation
    if (orderType === 'direct_customer') {
      if (!selectedDirectCustomer) {
        setValidationError('Please search and select or add a direct customer.');
        return;
      }
      if (!deliveryAddress.trim()) {
        setValidationError('Delivery Destination Address is required for direct customer orders.');
        return;
      }
      if (!deliveryDate) {
        setValidationError('Requested Delivery Date is required.');
        return;
      }
    } else {
      if (!customerId) {
        setValidationError('Please select a retail shop customer for this order.');
        return;
      }
      if (!deliveryDate) {
        setValidationError('Requested Delivery Date is required.');
        return;
      }
    }

    if (rows.length === 0) {
      setValidationError('Please add at least one line item to the order.');
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
          customerId: orderType === 'shop' ? customerId : undefined,
          items: itemsPayload,
          deliveryDate: deliveryDate || undefined,
          notes: notes.trim() || undefined,
          status,
        });
      } else if (orderType === 'direct_customer' && selectedDirectCustomer) {
        await createInternalOrder({
          orderType: 'direct_customer',
          directCustomerId: selectedDirectCustomer.id,
          directCustomerName: selectedDirectCustomer.name,
          directCustomerMobile: selectedDirectCustomer.mobile,
          directCustomerAddress: selectedDirectCustomer.address,
          deliveryAddress: deliveryAddress.trim(),
          deliveryInstructions: deliveryInstructions.trim() || undefined,
          deliveryContactPerson: deliveryContactPerson.trim() || undefined,
          deliveryContactNumber: deliveryContactNumber.trim() || undefined,
          eventName: eventName.trim() || undefined,
          eventType: eventType.trim() || undefined,
          deliveryDate: deliveryDate || undefined,
          items: itemsPayload,
          notes: notes.trim() || undefined,
        });
      } else {
        await createInternalOrder({
          orderType: 'shop',
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
            className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              orderType === 'direct_customer'
                ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
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

      {/* Option A vs Option B Order Type Selector (New Order Only) */}
      {!isEditMode && (
        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOrderType('shop')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              orderType === 'shop'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Option A: Create New Order (Shop)</span>
          </button>
          <button
            type="button"
            onClick={() => setOrderType('direct_customer')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              orderType === 'direct_customer'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Option B: Create New Order (Direct Customer)</span>
          </button>
        </div>
      )}

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
        {/* OPTION A: SHOP CUSTOMER WORKFLOW */}
        {orderType === 'shop' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Searchable Shop Customer Combobox */}
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

                {isCustomerDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
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
        )}

        {/* OPTION B: DIRECT CUSTOMER WORKFLOW */}
        {orderType === 'direct_customer' && (
          <div className="space-y-6">
            {/* Direct Customer Selection Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-purple-600" />
                  <span>Direct Customer Selection (Master Record)</span>
                  <span className="text-red-500">*</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setInlineNewCustomer({
                      name: '',
                      mobile: '',
                      address: '',
                      alternateMobile: '',
                      email: '',
                      notes: '',
                    });
                    setInlineDuplicateWarning(null);
                    setIsInlineAddCustomerOpen(true);
                  }}
                  className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add New Direct Customer</span>
                </button>
              </div>

              {/* Searchable Dropdown for Direct Customers */}
              <div className="relative" ref={directDropdownRef}>
                <div
                  onClick={() => setIsDirectDropdownOpen(!isDirectDropdownOpen)}
                  className={`p-3 bg-slate-50 hover:bg-slate-100/80 border rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                    isDirectDropdownOpen ? 'border-purple-600 ring-2 ring-purple-500/20 bg-white' : 'border-slate-300'
                  }`}
                >
                  {selectedDirectCustomer ? (
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 font-extrabold flex items-center justify-center shrink-0 text-sm">
                        {selectedDirectCustomer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs truncate">
                            {selectedDirectCustomer.name}
                          </span>
                          <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            {selectedDirectCustomer.customerCode}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full capitalize ${
                              selectedDirectCustomer.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {selectedDirectCustomer.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-2">
                          <span>
                            <Phone className="w-2.5 h-2.5 inline mr-1 text-slate-400" />
                            {selectedDirectCustomer.mobile}
                          </span>
                          {selectedDirectCustomer.address && (
                            <span className="truncate">&bull; {selectedDirectCustomer.address}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      Click to search and select an existing direct customer...
                    </span>
                  )}

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[11px] font-bold text-purple-600 hover:text-purple-700">
                      {isDirectDropdownOpen ? 'Close' : 'Choose Customer'}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isDirectDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Floating Menu */}
                {isDirectDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/70">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          autoFocus
                          value={directSearchQuery}
                          onChange={e => setDirectSearchQuery(e.target.value)}
                          placeholder="Search by customer name, phone number, address, or code..."
                          className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                        />
                        {directSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setDirectSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {filteredDirectCustomers.length === 0 ? (
                        <div className="p-6 text-center text-slate-400">
                          <p className="italic">No direct customers found matching "{directSearchQuery}".</p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsDirectDropdownOpen(false);
                              setInlineNewCustomer(prev => ({ ...prev, name: directSearchQuery }));
                              setIsInlineAddCustomerOpen(true);
                            }}
                            className="mt-2 text-xs font-bold text-purple-600 hover:text-purple-800 underline"
                          >
                            + Create "{directSearchQuery}" as New Direct Customer
                          </button>
                        </div>
                      ) : (
                        filteredDirectCustomers.map(cust => {
                          const isSelected = cust.id === directCustomerId;
                          return (
                            <div
                              key={cust.id}
                              onClick={() => {
                                setDirectCustomerId(cust.id);
                                if (isSameAddress) {
                                  setDeliveryAddress(cust.address);
                                }
                                setIsDirectDropdownOpen(false);
                              }}
                              className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                                isSelected
                                  ? 'bg-purple-50 text-purple-900 font-semibold'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 truncate">
                                    {cust.name}
                                  </span>
                                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                    {cust.customerCode}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                  <span>{cust.mobile}</span>
                                  {cust.address && <span className="truncate">&bull; {cust.address}</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-3">
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  {cust.totalOrders ?? 0} orders
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Direct Customer Details Display */}
              {selectedDirectCustomer && (
                <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{selectedDirectCustomer.name}</span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="font-semibold text-purple-700">{selectedDirectCustomer.mobile}</span>
                    </div>
                    <p className="text-slate-600 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                      <span>Permanent: {selectedDirectCustomer.address}</span>
                    </p>
                  </div>
                  <div className="text-[11px] text-purple-700 shrink-0 font-medium">
                    Master Code: <span className="font-mono font-bold">{selectedDirectCustomer.customerCode}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Delivery Information Section */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-purple-600" />
                  <span>Delivery Information</span>
                </h3>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isSameAddress}
                    onChange={e => {
                      const checked = e.target.checked;
                      setIsSameAddress(checked);
                      if (checked && selectedDirectCustomer) {
                        setDeliveryAddress(selectedDirectCustomer.address);
                      }
                    }}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Delivery address is same as customer address</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Delivery Destination Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Delivery Destination Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={deliveryAddress}
                    onChange={e => {
                      setDeliveryAddress(e.target.value);
                      if (isSameAddress && selectedDirectCustomer && e.target.value !== selectedDirectCustomer.address) {
                        setIsSameAddress(false);
                      }
                    }}
                    placeholder="Destination hall, venue, residence, or function hall..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-purple-600 resize-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Destination where this specific order must be delivered. Does not change customer master address.
                  </span>
                </div>

                {/* Delivery Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span>Delivery Date <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono-numbers text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none"
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
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Event Name & Event Type */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Event / Function Name <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={eventName}
                      onChange={e => setEventName(e.target.value)}
                      placeholder="e.g. Wedding Reception"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-purple-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Event Type <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <select
                      value={eventType}
                      onChange={e => setEventType(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-purple-600"
                    >
                      <option value="">Select Event Type</option>
                      <option value="Wedding">Wedding</option>
                      <option value="Birthday / Party">Birthday / Party</option>
                      <option value="Catering Service">Catering Service</option>
                      <option value="Corporate Event">Corporate Event</option>
                      <option value="Religious Function">Religious Function</option>
                      <option value="Family Function">Family Function</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Contact Person */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Delivery Contact Person <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryContactPerson}
                    onChange={e => setDeliveryContactPerson(e.target.value)}
                    placeholder="On-site contact name"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-purple-600"
                  />
                </div>

                {/* Contact Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Delivery Contact Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={deliveryContactNumber}
                    onChange={e => setDeliveryContactNumber(e.target.value)}
                    placeholder="On-site phone number"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-purple-600"
                  />
                </div>

                {/* Delivery Instructions */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Delivery Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryInstructions}
                    onChange={e => setDeliveryInstructions(e.target.value)}
                    placeholder="e.g. Call before arrival; unload at back gate kitchen entrance"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Order Line Items with Bulk Weight & SKU Pouch Calculator */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Layers className={`w-4 h-4 ${orderType === 'direct_customer' ? 'text-purple-600' : 'text-blue-600'}`} />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Product Selection & Bulk Weight Calculator
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter bulk weight in KG and select SKU size (e.g., 10 KG of 500 GM = 20 Pouches). Batches will be assigned on a FIFO basis when the order is confirmed.
              </p>
            </div>

            <button
              type="button"
              onClick={addRow}
              disabled={products.length === 0}
              className={`px-3.5 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-colors ${
                orderType === 'direct_customer'
                  ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Product</span>
            </button>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs min-w-[780px]">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-3 text-left w-2/5">Product & SKU Variant</th>
                  <th className="py-3 px-3 text-center w-28">Weight (KG)</th>
                  <th className="py-3 px-3 text-center w-24">Pack Size</th>
                  <th className="py-3 px-3 text-center w-36">Pouches / Packs</th>
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
                  const weightInKg = getSkuWeightInKg(sku || prod);
                  const packLabel = formatSkuPackLabel(sku || prod);

                  const compoundValue = `${row.productId}::${row.skuId || 'default'}`;

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isBelowFloor ? 'bg-red-50/40' : ''
                      }`}
                    >
                      {/* Product & SKU Picker */}
                      <td className="py-2.5 px-3">
                        <select
                          value={compoundValue}
                          onChange={e => handleItemSelectChange(idx, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                        >
                          {products.map(p => {
                            if (p.skus && p.skus.length > 0) {
                              return (
                                <optgroup key={p.id} label={p.name}>
                                  {p.skus.map(s => (
                                    <option key={s.id} value={`${p.id}::${s.id}`}>
                                      {p.name} — {s.variantName || s.packSize} (MRP ₹{s.mrp})
                                    </option>
                                  ))}
                                </optgroup>
                              );
                            }
                            return (
                              <option key={p.id} value={`${p.id}::default`}>
                                {p.name} (Base Unit: {p.unit})
                              </option>
                            );
                          })}
                        </select>
                      </td>

                      {/* Weight (KG) Input */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="relative">
                          <input
                            type="number"
                            min="0.1"
                            step="0.5"
                            placeholder="e.g. 10"
                            value={row.targetKg ?? ''}
                            onChange={e => handleTargetKgChange(idx, parseFloat(e.target.value) || 0)}
                            className="w-full pr-7 pl-2 py-1.5 text-center font-bold font-mono-numbers text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-slate-900"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-slate-400 pointer-events-none">
                            KG
                          </span>
                        </div>
                      </td>

                      {/* Pack Size Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-1 bg-slate-100 text-slate-800 font-bold rounded-md text-[11px] border border-slate-200">
                          {packLabel}
                        </span>
                      </td>

                      {/* Quantity in Pouches / Packs */}
                      <td className="py-2.5 px-3 text-center">
                        <div>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={row.quantity || ''}
                              onChange={e => handleQuantityChange(idx, Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className="w-full pr-12 pl-2 py-1.5 text-center font-black font-mono-numbers text-xs bg-white border border-blue-300 text-blue-900 rounded-lg focus:outline-none focus:border-blue-600"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-600 pointer-events-none">
                              pouches
                            </span>
                          </div>
                          {row.targetKg && row.targetKg > 0 && (
                            <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                              {row.targetKg} KG ÷ {packLabel} = {row.quantity}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Unit Price Rate */}
                      <td className="py-2.5 px-3 text-center">
                        <div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unitPrice}
                            onChange={e => handleRowChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className={`w-24 px-2 py-1.5 text-center font-bold font-mono-numbers text-xs rounded-lg border focus:outline-none ${
                              isBelowFloor
                                ? 'bg-red-50 border-red-500 text-red-900 focus:border-red-600'
                                : 'bg-white border-slate-300 text-slate-900 focus:border-blue-600'
                            }`}
                          />
                          {minPrice > 0 && (
                            <span
                              className={`text-[9px] block mt-0.5 font-medium ${
                                isBelowFloor ? 'text-red-600 font-bold' : 'text-slate-400'
                              }`}
                            >
                              Min floor: ₹{minPrice}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Line Total */}
                      <td className="py-2.5 px-3 text-right font-extrabold font-mono-numbers text-slate-900 text-xs">
                        ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          disabled={rows.length === 1}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg transition-colors"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Section 3: Summary Totals & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Order & Dispatch Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add special packaging, dispatch guidelines, or delivery comments..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-blue-600 resize-none"
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Total Items:</span>
                <span className="font-semibold text-slate-900">{rows.length} product(s)</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Total Units / Quantity:</span>
                <span className="font-semibold text-slate-900 font-mono-numbers">{totalUnits} units</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900 font-mono-numbers">
                  ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-extrabold text-slate-900">Grand Order Total:</span>
                <span className={`text-xl font-black font-mono-numbers ${orderType === 'direct_customer' ? 'text-purple-700' : 'text-blue-700'}`}>
                  ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Inline Modal: Add New Direct Customer */}
      {isInlineAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add New Direct Customer</h3>
                  <p className="text-[11px] text-slate-500">
                    Saved permanently in Direct Customer Master for reuse
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInlineAddCustomerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInlineCustomer} className="p-6 space-y-4">
              {inlineDuplicateWarning && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">
                      Notice: Customer with this phone number already exists!
                    </p>
                    <p className="text-[11px] text-amber-800">
                      Existing: <strong>{inlineDuplicateWarning.name}</strong> ({inlineDuplicateWarning.customerCode}, {inlineDuplicateWarning.mobile})
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setDirectCustomerId(inlineDuplicateWarning.id);
                        if (isSameAddress) {
                          setDeliveryAddress(inlineDuplicateWarning.address);
                        }
                        setIsInlineAddCustomerOpen(false);
                      }}
                      className="text-purple-700 underline font-bold text-[11px] hover:text-purple-900"
                    >
                      Use existing customer for this order &rarr;
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Ramesh Patil or Royal Catering Services"
                  value={inlineNewCustomer.name}
                  onChange={e => setInlineNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={inlineNewCustomer.mobile}
                    onChange={e => handleInlineMobileChange(e.target.value)}
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
                    value={inlineNewCustomer.alternateMobile}
                    onChange={e => setInlineNewCustomer(prev => ({ ...prev, alternateMobile: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={inlineNewCustomer.email}
                  onChange={e => setInlineNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Permanent Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Customer permanent residence or office address"
                  value={inlineNewCustomer.address}
                  onChange={e => setInlineNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Special instructions or notes"
                  value={inlineNewCustomer.notes}
                  onChange={e => setInlineNewCustomer(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsInlineAddCustomerOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingInlineCustomer}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 rounded-xl shadow-xs"
                >
                  {isSavingInlineCustomer ? 'Saving & Selecting...' : 'Save & Select Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
