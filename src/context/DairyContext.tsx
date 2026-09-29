import React, { createContext, useContext, useState, useMemo } from 'react';
import {
  Product,
  Batch,
  Retailer,
  Order,
  Invoice,
  Payment,
  LedgerEntry,
  Expense,
  StockMovement,
  ExpiryAlertItem,
  NotificationItem,
  ExpiryRule,
  InternalRole,
  ProductCategory,
  OrderStatus,
  RawMaterial,
  RawMaterialMovement,
  User,
  RolePermission
} from '../types/dairy';
import {
  INITIAL_PRODUCTS,
  INITIAL_BATCHES,
  INITIAL_RETAILERS,
  INITIAL_ORDERS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_LEDGER,
  INITIAL_EXPENSES,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_EXPIRY_ALERTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_EXPIRY_RULES,
  INITIAL_RAW_MATERIALS,
  INITIAL_RAW_MATERIAL_MOVEMENTS,
  INITIAL_USERS,
  INITIAL_ROLE_PERMISSIONS,
} from '../data/mockData';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

interface DairyContextType {
  // Navigation & Session
  portal: 'customer' | 'internal' | 'customer_login' | 'internal_login';
  setPortal: (p: 'customer' | 'internal' | 'customer_login' | 'internal_login') => void;
  internalRole: InternalRole;
  setInternalRole: (role: InternalRole) => void;
  internalView: string;
  setInternalView: (view: string) => void;
  customerViewMode: 'device_frame' | 'fluid';
  setCustomerViewMode: (mode: 'device_frame' | 'fluid') => void;
  selectedBatchId: string | null;
  setSelectedBatchId: (id: string | null) => void;
  selectedRetailerId: string | null;
  setSelectedRetailerId: (id: string | null) => void;
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  selectedInvoiceId: string | null;
  setSelectedInvoiceId: (id: string | null) => void;

  // Active Retailer
  currentRetailer: Retailer;
  setCurrentRetailer: (r: Retailer) => void;

  // Data
  products: Product[];
  batches: Batch[];
  retailers: Retailer[];
  orders: Order[];
  invoices: Invoice[];
  payments: Payment[];
  ledger: LedgerEntry[];
  expenses: Expense[];
  stockMovements: StockMovement[];
  expiryAlerts: ExpiryAlertItem[];
  notifications: NotificationItem[];
  expiryRules: ExpiryRule[];
  rawMaterials: RawMaterial[];
  rawMaterialMovements: RawMaterialMovement[];
  users: User[];
  rolePermissions: RolePermission[];

  // Cart
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  addToCart: (productId: string, qty?: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  placeOrder: (notes?: string) => Order;
  reorder: (orderId: string) => void;

  // Business Actions
  createProductionBatch: (data: {
    productId: string;
    producedQty: number;
    productionDate: string;
    expiryDate: string;
    notes?: string;
  }) => Batch;

  createInvoice: (data: {
    retailerId: string;
    items: {
      productId: string;
      batchNumber: string;
      quantity: number;
      rate: number;
      taxPercent: number;
      discount?: number;
    }[];
  }) => Invoice;

  recordPayment: (data: {
    retailerId: string;
    invoiceNumber: string;
    amount: number;
    paymentMethod: Payment['paymentMethod'];
    reference: string;
    notes?: string;
  }) => Payment;

  addExpense: (data: {
    category: Expense['category'];
    description: string;
    amount: number;
    paymentMethod: Payment['paymentMethod'];
    paidTo: string;
    referenceNumber: string;
  }) => Expense;

  addRawMaterialStock: (materialId: string, qty: number, reference: string, notes?: string) => void;
  addRawMaterialPurchase: (data: {
    materialId?: string;
    newMaterialName?: string;
    category?: string;
    unit?: string;
    qty: number;
    costPerUnit?: number;
    supplier?: string;
    reference?: string;
    notes?: string;
  }) => void;
  recordRawMaterialUsage: (data: {
    materialId: string;
    qty: number;
    purpose?: string;
    batchNumber?: string;
    reference?: string;
    notes?: string;
  }) => boolean;
  updateUserStatus: (userId: string, status: 'active' | 'inactive') => void;
  updateUserRole: (userId: string, role: InternalRole) => void;
  registerRetailer: (data: { businessName: string; ownerName: string; mobile: string; address: string }) => Retailer;

  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  toggleExpiryRule: (ruleId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (recipientType: 'customer' | 'internal') => void;

  // Toasts
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

const DairyContext = createContext<DairyContextType | undefined>(undefined);

export const DairyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation
  const [portal, setPortal] = useState<'customer' | 'internal' | 'customer_login' | 'internal_login'>('customer_login');
  const [internalRole, setInternalRole] = useState<InternalRole>('admin');
  const [internalView, setInternalView] = useState<string>('dashboard');
  const [customerViewMode, setCustomerViewMode] = useState<'device_frame' | 'fluid'>('device_frame');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedRetailerId, setSelectedRetailerId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Entities
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [batches, setBatches] = useState<Batch[]>(INITIAL_BATCHES);
  const [retailers, setRetailers] = useState<Retailer[]>(INITIAL_RETAILERS);
  const [currentRetailer, setCurrentRetailer] = useState<Retailer>(INITIAL_RETAILERS[0]);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [payments, setPayments] = useState<Payment[]>(INITIAL_PAYMENTS);
  const [ledger, setLedger] = useState<LedgerEntry[]>(INITIAL_LEDGER);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(INITIAL_STOCK_MOVEMENTS);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlertItem[]>(INITIAL_EXPIRY_ALERTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [expiryRules, setExpiryRules] = useState<ExpiryRule[]>(INITIAL_EXPIRY_RULES);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(INITIAL_RAW_MATERIALS);
  const [rawMaterialMovements, setRawMaterialMovements] = useState<RawMaterialMovement[]>(INITIAL_RAW_MATERIAL_MOVEMENTS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [rolePermissions] = useState<RolePermission[]>(INITIAL_ROLE_PERMISSIONS);

  // Customer Cart
  const [cart, setCart] = useState<CartItem[]>([
    { product: INITIAL_PRODUCTS[0], quantity: 2 }, // Basundi 2
    { product: INITIAL_PRODUCTS[1], quantity: 1 }, // Pedha 1
    { product: INITIAL_PRODUCTS[2], quantity: 3 }, // Shrikhand 3
  ]);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Cart operations
  const addToCart = (productId: string, qty = 1) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    setCart(prev => {
      const existing = prev.find(i => i.product.id === productId);
      if (existing) {
        return prev.map(item =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      } else {
        return [...prev, { product: prod, quantity: qty }];
      }
    });
    addToast(`Added ${prod.name} to cart`, 'info');
  };

  const updateCartQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity * item.product.defaultPrice, 0);
  }, [cart]);

  // Place order
  const placeOrder = (notes?: string): Order => {
    const newOrderNum = `#MD${1030 + orders.length}`;
    const orderItems = cart.map(item => {
      // Find matching batch
      const activeBatch = batches.find(b => b.productId === item.product.id && b.availableQty > 0) || batches[0];
      return {
        productId: item.product.id,
        productName: item.product.name,
        batchNumber: activeBatch ? activeBatch.batchNumber : 'GEN-01',
        unit: item.product.unit,
        quantity: item.quantity,
        unitPrice: item.product.defaultPrice,
        totalPrice: item.quantity * item.product.defaultPrice,
      };
    });

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: newOrderNum,
      retailerId: currentRetailer.id,
      retailerName: currentRetailer.businessName,
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      status: 'confirmed',
      items: orderItems,
      totalAmount: cartTotal,
      paymentStatus: 'unpaid',
      notes: notes || 'Booked via Customer Retailer Portal',
    };

    setOrders(prev => [newOrder, ...prev]);
    clearCart();

    // Add customer & internal notification
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      date: 'Just now',
      timeGroup: 'today',
      recipientType: 'customer',
      recipientId: currentRetailer.id,
      title: `Order Placed Successfully ${newOrderNum}`,
      message: `Your order for ${orderItems.length} products worth ₹${cartTotal.toLocaleString('en-IN')} has been placed.`,
      type: 'order',
      channel: 'in_app',
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev]);

    addToast(`Order ${newOrderNum} placed successfully!`, 'success');
    return newOrder;
  };

  const reorder = (orderId: string) => {
    const prevOrder = orders.find(o => o.id === orderId);
    if (!prevOrder) return;

    // Add items from prevOrder to cart
    prevOrder.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        addToCart(prod.id, item.quantity);
      }
    });

    addToast(`Reordered items from ${prevOrder.orderNumber} added to cart!`, 'success');
  };

  // Create Production Batch
  const createProductionBatch = ({
    productId,
    producedQty,
    productionDate,
    expiryDate,
    notes,
  }: {
    productId: string;
    producedQty: number;
    productionDate: string;
    expiryDate: string;
    notes?: string;
  }): Batch => {
    const prod = products.find(p => p.id === productId) || products[0];
    const cleanDate = productionDate.replace(/-/g, '').slice(2);
    const prefix = prod.name.charAt(0).toUpperCase();
    const batchNumber = `${prefix}${cleanDate}${Math.floor(10 + Math.random() * 89)}`;

    const newBatch: Batch = {
      id: `batch-${Date.now()}`,
      batchNumber,
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit,
      productionDate,
      expiryDate,
      producedQty,
      soldQty: 0,
      returnedQty: 0,
      damagedQty: 0,
      availableQty: producedQty,
      status: 'active',
      notes: notes || `Fresh production batch created for ${prod.name}`,
    };

    // Add batch
    setBatches(prev => [newBatch, ...prev]);

    // Add stock movement
    const newMovement: StockMovement = {
      id: `mov-${Date.now()}`,
      date: productionDate,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'production',
      productId: prod.id,
      productName: prod.name,
      batchNumber,
      quantity: producedQty,
      fromLocation: 'Dairy Production Unit',
      toLocation: 'Finished Goods Cold Storage',
      reference: `PROD-${Date.now().toString().slice(-4)}`,
      user: 'Mahesh (Prod Mgr)',
    };
    setStockMovements(prev => [newMovement, ...prev]);

    addToast(`Batch ${batchNumber} created with ${producedQty} units!`, 'success');
    return newBatch;
  };

  // Create Invoice
  const createInvoice = ({
    retailerId,
    items,
  }: {
    retailerId: string;
    items: {
      productId: string;
      batchNumber: string;
      quantity: number;
      rate: number;
      taxPercent: number;
      discount?: number;
    }[];
  }): Invoice => {
    const ret = retailers.find(r => r.id === retailerId) || retailers[0];
    const invoiceNumber = `INV-${1035 + invoices.length}`;

    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    const invoiceItems = items.map(item => {
      const prod = products.find(p => p.id === item.productId)!;
      const lineSubtotal = item.quantity * item.rate;
      const disc = item.discount || 0;
      const taxable = lineSubtotal - disc;
      const tax = (taxable * item.taxPercent) / 100;
      subtotal += taxable;
      taxAmount += tax;
      discountAmount += disc;

      // Update batch stock
      setBatches(prev =>
        prev.map(b => {
          if (b.batchNumber === item.batchNumber) {
            const newSold = b.soldQty + item.quantity;
            const newAvail = Math.max(0, b.producedQty - newSold + b.returnedQty - b.damagedQty);
            return {
              ...b,
              soldQty: newSold,
              availableQty: newAvail,
              status: newAvail === 0 ? 'exhausted' : b.status,
            };
          }
          return b;
        })
      );

      // Add movement
      const mov: StockMovement = {
        id: `mov-${Date.now()}-${Math.random()}`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'sale',
        productId: prod.id,
        productName: prod.name,
        batchNumber: item.batchNumber,
        quantity: -item.quantity,
        fromLocation: 'Finished Goods Cold Storage',
        toLocation: ret.businessName,
        reference: invoiceNumber,
        user: 'Deepak (Billing)',
      };
      setStockMovements(prev => [mov, ...prev]);

      return {
        productId: prod.id,
        productName: prod.name,
        batchNumber: item.batchNumber,
        unit: prod.unit,
        quantity: item.quantity,
        rate: item.rate,
        taxPercent: item.taxPercent,
        discount: disc,
        amount: Math.round((taxable + tax) * 100) / 100,
      };
    });

    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    const newInv: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      retailerId: ret.id,
      retailerName: ret.businessName,
      retailerGstin: ret.gstin,
      retailerAddress: ret.address,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      items: invoiceItems,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      paidAmount: 0,
      outstandingAmount: totalAmount,
      status: 'unpaid',
    };

    setInvoices(prev => [newInv, ...prev]);

    // Update retailer outstanding
    setRetailers(prev =>
      prev.map(r =>
        r.id === ret.id ? { ...r, outstandingAmount: r.outstandingAmount + totalAmount, lastOrderDate: newInv.date } : r
      )
    );

    // Add ledger entry
    const newLedger: LedgerEntry = {
      id: `led-${Date.now()}`,
      date: newInv.date,
      retailerId: ret.id,
      particular: `${invoiceNumber} (Sale of Dairy Goods)`,
      debit: totalAmount,
      credit: undefined,
      balance: ret.outstandingAmount + totalAmount,
      reference: invoiceNumber,
    };
    setLedger(prev => [...prev, newLedger]);

    addToast(`Invoice ${invoiceNumber} created for ₹${totalAmount.toLocaleString('en-IN')}`, 'success');
    return newInv;
  };

  // Record payment
  const recordPayment = ({
    retailerId,
    invoiceNumber,
    amount,
    paymentMethod,
    reference,
    notes,
  }: {
    retailerId: string;
    invoiceNumber: string;
    amount: number;
    paymentMethod: Payment['paymentMethod'];
    reference: string;
    notes?: string;
  }): Payment => {
    const ret = retailers.find(r => r.id === retailerId) || retailers[0];
    const paymentNumber = `PAY-${1085 + payments.length}`;

    const newPay: Payment = {
      id: `pay-${Date.now()}`,
      paymentNumber,
      date: new Date().toISOString().split('T')[0],
      retailerId: ret.id,
      retailerName: ret.businessName,
      invoiceNumber,
      amount,
      paymentMethod,
      reference,
      notes,
      recordedBy: 'Sneha (Accountant)',
    };

    setPayments(prev => [newPay, ...prev]);

    // Update invoice if matched
    setInvoices(prev =>
      prev.map(inv => {
        if (inv.invoiceNumber === invoiceNumber) {
          const newPaid = inv.paidAmount + amount;
          const newOut = Math.max(0, inv.totalAmount - newPaid);
          return {
            ...inv,
            paidAmount: newPaid,
            outstandingAmount: newOut,
            status: newOut === 0 ? 'paid' : 'partial',
          };
        }
        return inv;
      })
    );

    // Update retailer balance
    const updatedBalance = Math.max(0, ret.outstandingAmount - amount);
    setRetailers(prev =>
      prev.map(r => (r.id === ret.id ? { ...r, outstandingAmount: updatedBalance } : r))
    );

    // Add ledger credit
    const newLedger: LedgerEntry = {
      id: `led-${Date.now()}`,
      date: newPay.date,
      retailerId: ret.id,
      particular: `Payment Received via ${paymentMethod.toUpperCase()} (${reference})`,
      debit: undefined,
      credit: amount,
      balance: updatedBalance,
      reference: paymentNumber,
    };
    setLedger(prev => [...prev, newLedger]);

    addToast(`Recorded payment ${paymentNumber} of ₹${amount.toLocaleString('en-IN')}`, 'success');
    return newPay;
  };

  // Add Expense
  const addExpense = ({
    category,
    description,
    amount,
    paymentMethod,
    paidTo,
    referenceNumber,
  }: {
    category: Expense['category'];
    description: string;
    amount: number;
    paymentMethod: Payment['paymentMethod'];
    paidTo: string;
    referenceNumber: string;
  }): Expense => {
    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      category,
      description,
      amount,
      paymentMethod,
      paidTo,
      referenceNumber,
    };

    setExpenses(prev => [newExp, ...prev]);
    addToast(`Expense recorded: ₹${amount.toLocaleString('en-IN')} for ${category}`, 'info');
    return newExp;
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, status } : o))
    );
    addToast(`Order status updated to ${status.toUpperCase()}`, 'info');
  };

  const toggleExpiryRule = (ruleId: string) => {
    setExpiryRules(prev =>
      prev.map(r => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    );
    addToast('Notification rule updated', 'info');
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsRead = (recipientType: 'customer' | 'internal') => {
    setNotifications(prev =>
      prev.map(n => (n.recipientType === recipientType ? { ...n, read: true } : n))
    );
    addToast('All notifications marked as read', 'info');
  };

  const addRawMaterialPurchase = (data: {
    materialId?: string;
    newMaterialName?: string;
    category?: string;
    unit?: string;
    qty: number;
    costPerUnit?: number;
    supplier?: string;
    reference?: string;
    notes?: string;
  }) => {
    let matId = data.materialId;
    let matName = '';
    let matUnit = data.unit || 'Units';

    if (data.materialId) {
      const existing = rawMaterials.find(m => m.id === data.materialId);
      if (existing) {
        matName = existing.name;
        matUnit = existing.unit;
        const newStock = existing.currentStock + data.qty;
        const newStatus = newStock <= 0 ? 'out_of_stock' : newStock <= existing.minStockThreshold ? 'low_stock' : 'healthy';

        setRawMaterials(prev => prev.map(m => m.id === data.materialId ? {
          ...m,
          currentStock: newStock,
          status: newStatus,
          costPerUnit: data.costPerUnit !== undefined && data.costPerUnit > 0 ? data.costPerUnit : m.costPerUnit,
          supplier: data.supplier ? data.supplier : m.supplier,
          lastRestockedDate: new Date().toISOString().split('T')[0]
        } : m));
      }
    } else if (data.newMaterialName) {
      matId = `rm-${Date.now()}`;
      matName = data.newMaterialName;
      const newMat: RawMaterial = {
        id: matId,
        name: data.newMaterialName,
        category: data.category || 'Dairy Inward',
        unit: data.unit || 'Units',
        currentStock: data.qty,
        minStockThreshold: Math.max(10, Math.round(data.qty * 0.2)),
        costPerUnit: data.costPerUnit || 0,
        supplier: data.supplier || 'Farmer Co-op / Supplier',
        status: 'healthy',
        lastRestockedDate: new Date().toISOString().split('T')[0],
      };
      setRawMaterials(prev => [newMat, ...prev]);
    }

    if (matId) {
      const ref = data.reference || `PO-${Date.now().toString().slice(-4)}`;
      const newMovement: RawMaterialMovement = {
        id: `rmm-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        materialId: matId,
        materialName: matName,
        type: 'purchase',
        quantity: data.qty,
        unit: matUnit,
        reference: ref,
        user: 'Warehouse Desk',
        notes: data.notes || (data.supplier ? `Supplier: ${data.supplier}` : undefined),
      };
      setRawMaterialMovements(prev => [newMovement, ...prev]);
      addToast(`Purchased ${data.qty} ${matUnit} of ${matName}`, 'success');
    }
  };

  const recordRawMaterialUsage = (data: {
    materialId: string;
    qty: number;
    purpose?: string;
    batchNumber?: string;
    reference?: string;
    notes?: string;
  }): boolean => {
    const existing = rawMaterials.find(m => m.id === data.materialId);
    if (!existing) {
      addToast('Raw material not found', 'error');
      return false;
    }
    if (data.qty <= 0) {
      addToast('Please enter a valid quantity greater than 0', 'error');
      return false;
    }
    if (data.qty > existing.currentStock) {
      addToast(`Insufficient stock! Only ${existing.currentStock} ${existing.unit} available.`, 'error');
      return false;
    }

    const newStock = existing.currentStock - data.qty;
    const newStatus = newStock <= 0 ? 'out_of_stock' : newStock <= existing.minStockThreshold ? 'low_stock' : 'healthy';

    setRawMaterials(prev => prev.map(m => m.id === data.materialId ? {
      ...m,
      currentStock: newStock,
      status: newStatus,
    } : m));

    const noteDetails = [
      data.purpose ? `Purpose: ${data.purpose}` : '',
      data.batchNumber ? `Batch: ${data.batchNumber}` : '',
      data.notes ? data.notes : '',
    ].filter(Boolean).join(' | ');

    const newMovement: RawMaterialMovement = {
      id: `rmm-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      materialId: data.materialId,
      materialName: existing.name,
      type: 'production_consumption',
      quantity: -data.qty,
      unit: existing.unit,
      reference: data.reference || data.batchNumber || `USE-${Date.now().toString().slice(-4)}`,
      user: 'Production Supervisor',
      notes: noteDetails || 'Consumed in dairy processing',
    };

    setRawMaterialMovements(prev => [newMovement, ...prev]);
    addToast(`Recorded usage: ${data.qty} ${existing.unit} of ${existing.name}`, 'info');
    return true;
  };

  const addRawMaterialStock = (materialId: string, qty: number, reference: string, notes?: string) => {
    addRawMaterialPurchase({ materialId, qty, reference, notes });
  };

  const updateUserStatus = (userId: string, status: 'active' | 'inactive') => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u));
    addToast(`User status updated to ${status}`, 'info');
  };

  const updateUserRole = (userId: string, role: InternalRole) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    addToast(`User role updated to ${role.replace('_', ' ')}`, 'info');
  };

  const registerRetailer = (data: { businessName: string; ownerName: string; mobile: string; address: string }): Retailer => {
    const newRet: Retailer = {
      id: `ret-${Date.now()}`,
      businessName: data.businessName,
      ownerName: data.ownerName,
      mobile: data.mobile,
      email: `${data.businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
      address: data.address,
      area: 'Local Distribution Zone',
      gstin: `27AA${Math.floor(1000000000 + Math.random() * 9000000000)}1Z5`,
      creditLimit: 25000,
      outstandingAmount: 0,
      paymentTerms: 'Net 7 Days',
      status: 'active',
      lastOrderDate: new Date().toISOString().split('T')[0],
    };
    setRetailers(prev => [...prev, newRet]);
    setCurrentRetailer(newRet);
    addToast(`Shop "${data.businessName}" registered successfully!`, 'success');
    return newRet;
  };

  return (
    <DairyContext.Provider
      value={{
        portal,
        setPortal,
        internalRole,
        setInternalRole,
        internalView,
        setInternalView,
        customerViewMode,
        setCustomerViewMode,
        selectedBatchId,
        setSelectedBatchId,
        selectedRetailerId,
        setSelectedRetailerId,
        selectedOrderId,
        setSelectedOrderId,
        selectedInvoiceId,
        setSelectedInvoiceId,

        currentRetailer,
        setCurrentRetailer,

        products,
        batches,
        retailers,
        orders,
        invoices,
        payments,
        ledger,
        expenses,
        stockMovements,
        expiryAlerts,
        notifications,
        expiryRules,
        rawMaterials,
        rawMaterialMovements,
        users,
        rolePermissions,

        cart,
        cartCount,
        cartTotal,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        placeOrder,
        reorder,

        createProductionBatch,
        createInvoice,
        recordPayment,
        addExpense,
        addRawMaterialStock,
        addRawMaterialPurchase,
        recordRawMaterialUsage,
        updateUserStatus,
        updateUserRole,
        registerRetailer,
        updateOrderStatus,
        toggleExpiryRule,
        markNotificationRead,
        markAllNotificationsRead,

        toasts,
        addToast,
        removeToast,
      }}
    >
      {children}
    </DairyContext.Provider>
  );
};

export const useDairy = () => {
  const context = useContext(DairyContext);
  if (!context) {
    throw new Error('useDairy must be used within a DairyProvider');
  }
  return context;
};
