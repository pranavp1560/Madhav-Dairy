import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
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
  OrderStatus,
  RawMaterial,
  RawMaterialMovement,
  User,
  RolePermission
} from '../types/dairy';
import {
  authService,
  productService,
  customerService,
  orderService,
  invoiceService,
  paymentService,
  ledgerService,
  inventoryService,
  rawMaterialService,
  expenseService,
  expiryService,
  notificationService,
  userService,
  UserSessionProfile
} from '../services';

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

  // Supabase Auth & Session Profile
  currentUser: UserSessionProfile | null;
  login: (email: string, password: string) => Promise<UserSessionProfile>;
  logout: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;

  // Active Retailer
  currentRetailer: Retailer;
  setCurrentRetailer: (r: Retailer) => void;

  // Live Supabase Domain Data
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
  placeOrder: (notes?: string) => Promise<Order>;
  reorder: (orderId: string) => void;

  // Business Actions
  addProduct: (data: {
    name: string;
    nameMr?: string;
    nameHi?: string;
    categoryName?: string;
    packSize: string;
    unit: string;
    mrp: number;
    sellingPrice: number;
    shelfLifeDays: number;
    description?: string;
  }) => Promise<Product>;

  createProductionBatch: (data: {
    productId: string;
    producedQty: number;
    productionDate: string;
    expiryDate: string;
    notes?: string;
  }) => Promise<Batch>;

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
  }) => Promise<Invoice>;

  recordPayment: (data: {
    retailerId: string;
    invoiceNumber: string;
    amount: number;
    paymentMethod: Payment['paymentMethod'];
    reference: string;
    notes?: string;
  }) => Promise<Payment>;

  addExpense: (data: {
    category: Expense['category'];
    description: string;
    amount: number;
    paymentMethod: Payment['paymentMethod'];
    paidTo: string;
    referenceNumber: string;
  }) => Promise<Expense>;

  addRawMaterialStock: (materialId: string, qty: number, reference: string, notes?: string) => Promise<void>;
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
  }) => Promise<void>;
  recordRawMaterialUsage: (data: {
    materialId: string;
    qty: number;
    purpose?: string;
    batchNumber?: string;
    reference?: string;
    notes?: string;
  }) => Promise<boolean>;

  updateUserStatus: (userId: string, status: 'active' | 'inactive') => Promise<void>;
  updateUserRole: (userId: string, role: InternalRole) => Promise<void>;
  registerRetailer: (data: { businessName: string; ownerName: string; mobile: string; address: string; password?: string }) => Promise<Retailer>;

  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  toggleExpiryRule: (ruleId: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: (recipientType: 'customer' | 'internal') => Promise<void>;

  // Toasts
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

const fallbackRetailer: Retailer = {
  id: '70000000-0000-0000-0000-000000000001',
  businessName: 'ABC Retailers',
  ownerName: 'Ramesh Patil',
  mobile: '9822012345',
  email: 'abc.retailers@gmail.com',
  address: 'Shop No. 4, Shivaji Chowk, Kothrud, Pune - 411038',
  area: 'Pune West',
  gstin: '27AABCU9603R1ZM',
  creditLimit: 100000,
  outstandingAmount: 28500,
  paymentTerms: 'Net 15 Days',
  status: 'active',
  lastOrderDate: '2026-09-10',
};

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

  // Auth User & Profile
  const [currentUser, setCurrentUser] = useState<UserSessionProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Entities initialized from Supabase
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [currentRetailer, setCurrentRetailer] = useState<Retailer>(fallbackRetailer);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlertItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [expiryRules, setExpiryRules] = useState<ExpiryRule[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [rawMaterialMovements, setRawMaterialMovements] = useState<RawMaterialMovement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);

  // Customer Cart
  const [cart, setCart] = useState<CartItem[]>([]);

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

  // Primary Data Loading from Supabase
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load products & categories
      const prods = await productService.fetchProducts();
      setProducts(prods);

      // Load retailers
      const custs = await customerService.fetchCustomers();
      setRetailers(custs);
      if (custs.length > 0) {
        setCurrentRetailer(custs[0]);
      }

      // Load orders
      const ords = await orderService.fetchOrders();
      setOrders(ords);

      // Load invoices
      const invs = await invoiceService.fetchInvoices();
      setInvoices(invs);

      // Load payments
      const pays = await paymentService.fetchPayments();
      setPayments(pays);

      // Load ledger
      const ledg = await ledgerService.fetchLedger();
      setLedger(ledg);

      // Load inventory & batches
      const bts = await inventoryService.fetchBatches();
      setBatches(bts);

      const movs = await inventoryService.fetchStockMovements();
      setStockMovements(movs);

      // Load raw materials
      const rms = await rawMaterialService.fetchRawMaterials();
      setRawMaterials(rms);

      const rmMovs = await rawMaterialService.fetchRawMaterialMovements();
      setRawMaterialMovements(rmMovs);

      // Load expenses
      const exps = await expenseService.fetchExpenses();
      setExpenses(exps);

      // Load expiry radar
      const expR = await expiryService.fetchExpiryRules();
      setExpiryRules(expR);

      const expA = await expiryService.fetchExpiryAlerts();
      setExpiryAlerts(expA);

      // Load notifications
      const notifs = await notificationService.fetchNotifications();
      setNotifications(notifs);

      // Load users & roles
      const usrs = await userService.fetchUsers();
      setUsers(usrs);

      const rPerms = await userService.fetchRolePermissions();
      setRolePermissions(rPerms);

    } catch (err: any) {
      console.error('Error fetching Supabase data:', err);
      setError(err.message || 'Failed to load data from Supabase');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Restore Supabase Auth session on component mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const session = await authService.getSession();
        if (session?.user) {
          const profile = await authService.getUserProfile(session.user.id);
          if (profile) {
            setCurrentUser(profile);
            if (profile.userType === 'customer') {
              setPortal('customer');
            } else {
              setPortal('internal');
              setInternalRole(profile.role as InternalRole);
            }
          }
        }
      } catch (e) {
        console.warn('Session restoration error:', e);
      } finally {
        await refreshData();
      }
    };

    initAuth();

    // Listen to Supabase auth state change
    const { data: { subscription } } = authService.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await authService.getUserProfile(session.user.id);
        setCurrentUser(profile);
        if (profile) {
          if (profile.userType === 'customer') {
            setPortal('customer');
          } else {
            setPortal('internal');
            setInternalRole(profile.role as InternalRole);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setPortal('customer_login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshData]);

  // Auth actions
  const login = async (email: string, pass: string): Promise<UserSessionProfile> => {
    const profile = await authService.signIn(email, pass);
    setCurrentUser(profile);
    if (profile.userType === 'customer') {
      setPortal('customer');
      if (profile.customerId) {
        const matched = retailers.find(r => r.id === profile.customerId);
        if (matched) setCurrentRetailer(matched);
      }
    } else {
      setPortal('internal');
      setInternalRole(profile.role as InternalRole);
    }
    await refreshData();
    addToast(`Welcome, ${profile.fullName}!`, 'success');
    return profile;
  };

  const logout = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setPortal('customer_login');
    addToast('Logged out successfully', 'info');
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
  const placeOrder = async (notes?: string): Promise<Order> => {
    if (cart.length === 0) {
      throw new Error('Cart is empty');
    }

    try {
      const newOrder = await orderService.createOrder({
        customerId: currentRetailer.id,
        items: cart.map(i => ({
          productId: i.product.id,
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: i.product.defaultPrice,
        })),
        notes: notes || 'Booked via Customer Retailer Portal',
        deliveryDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      });

      setOrders(prev => [newOrder, ...prev]);
      clearCart();

      // Refresh notifications & orders
      const latestNotifs = await notificationService.fetchNotifications();
      setNotifications(latestNotifs);

      addToast(`Order ${newOrder.orderNumber} placed successfully!`, 'success');
      return newOrder;
    } catch (err: any) {
      addToast(`Failed to place order: ${err.message}`, 'error');
      throw err;
    }
  };

  const reorder = (orderId: string) => {
    const prevOrder = orders.find(o => o.id === orderId);
    if (!prevOrder) return;

    prevOrder.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        addToCart(prod.id, item.quantity);
      }
    });

    addToast(`Reordered items from ${prevOrder.orderNumber} added to cart!`, 'success');
  };

  // Add Product to catalog
  const addProduct = async (data: {
    name: string;
    nameMr?: string;
    nameHi?: string;
    categoryName?: string;
    packSize: string;
    unit: string;
    mrp: number;
    sellingPrice: number;
    shelfLifeDays: number;
    description?: string;
  }): Promise<Product> => {
    try {
      const newProd = await productService.createProduct(data);
      setProducts(prev => [...prev, newProd]);
      addToast(`Product "${newProd.name}" added to catalog!`, 'success');
      return newProd;
    } catch (err: any) {
      addToast(`Error adding product: ${err.message}`, 'error');
      throw err;
    }
  };

  // Create Production Batch
  const createProductionBatch = async (data: {
    productId: string;
    producedQty: number;
    productionDate: string;
    expiryDate: string;
    notes?: string;
  }): Promise<Batch> => {
    try {
      const newBatch = await inventoryService.createBatch(data);
      setBatches(prev => [newBatch, ...prev]);

      const movs = await inventoryService.fetchStockMovements();
      setStockMovements(movs);

      addToast(`Batch ${newBatch.batchNumber} created with ${data.producedQty} units!`, 'success');
      return newBatch;
    } catch (err: any) {
      addToast(`Error creating batch: ${err.message}`, 'error');
      throw err;
    }
  };

  // Create Invoice
  const createInvoice = async (data: {
    retailerId: string;
    items: {
      productId: string;
      batchNumber: string;
      quantity: number;
      rate: number;
      taxPercent: number;
      discount?: number;
    }[];
  }): Promise<Invoice> => {
    try {
      const newInv = await invoiceService.createInvoice(data);
      setInvoices(prev => [newInv, ...prev]);

      // Refresh ledger & retailers
      const updatedLedger = await ledgerService.fetchLedger();
      setLedger(updatedLedger);

      const updatedRetailers = await customerService.fetchCustomers();
      setRetailers(updatedRetailers);

      addToast(`Invoice ${newInv.invoiceNumber} generated!`, 'success');
      return newInv;
    } catch (err: any) {
      addToast(`Error generating invoice: ${err.message}`, 'error');
      throw err;
    }
  };

  // Record Payment
  const recordPayment = async (data: {
    retailerId: string;
    invoiceNumber: string;
    amount: number;
    paymentMethod: Payment['paymentMethod'];
    reference: string;
    notes?: string;
  }): Promise<Payment> => {
    try {
      const newPay = await paymentService.recordPayment(data);
      setPayments(prev => [newPay, ...prev]);

      // Refresh invoices, ledger, and customer balances
      const [updatedInvs, updatedLedger, updatedRetailers] = await Promise.all([
        invoiceService.fetchInvoices(),
        ledgerService.fetchLedger(),
        customerService.fetchCustomers(),
      ]);

      setInvoices(updatedInvs);
      setLedger(updatedLedger);
      setRetailers(updatedRetailers);

      addToast(`Payment of ₹${data.amount.toLocaleString('en-IN')} recorded!`, 'success');
      return newPay;
    } catch (err: any) {
      addToast(`Error recording payment: ${err.message}`, 'error');
      throw err;
    }
  };

  // Add Expense
  const addExpense = async (data: {
    category: Expense['category'];
    description: string;
    amount: number;
    paymentMethod: Payment['paymentMethod'];
    paidTo: string;
    referenceNumber: string;
  }): Promise<Expense> => {
    try {
      const newExp = await expenseService.addExpense(data);
      setExpenses(prev => [newExp, ...prev]);
      addToast(`Expense entry recorded!`, 'success');
      return newExp;
    } catch (err: any) {
      addToast(`Error recording expense: ${err.message}`, 'error');
      throw err;
    }
  };

  // Raw Materials
  const addRawMaterialStock = async (materialId: string, qty: number, reference: string, notes?: string) => {
    try {
      await rawMaterialService.addRawMaterialStock(materialId, qty, reference, notes);
      const [rms, rmMovs] = await Promise.all([
        rawMaterialService.fetchRawMaterials(),
        rawMaterialService.fetchRawMaterialMovements(),
      ]);
      setRawMaterials(rms);
      setRawMaterialMovements(rmMovs);
      addToast(`Raw material stock updated successfully!`, 'success');
    } catch (err: any) {
      addToast(`Error updating material stock: ${err.message}`, 'error');
    }
  };

  const addRawMaterialPurchase = async (data: {
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
    const matId = data.materialId || rawMaterials[0]?.id || '60000000-0000-0000-0000-000000000001';
    await addRawMaterialStock(matId, data.qty, data.reference || 'PO-NEW', data.notes);
  };

  const recordRawMaterialUsage = async (data: {
    materialId: string;
    qty: number;
    purpose?: string;
    batchNumber?: string;
    reference?: string;
    notes?: string;
  }): Promise<boolean> => {
    try {
      await rawMaterialService.recordRawMaterialUsage(
        data.materialId,
        data.qty,
        data.reference || (data.batchNumber ? `Batch ${data.batchNumber}` : 'USAGE'),
        data.notes || data.purpose
      );
      const [rms, rmMovs] = await Promise.all([
        rawMaterialService.fetchRawMaterials(),
        rawMaterialService.fetchRawMaterialMovements(),
      ]);
      setRawMaterials(rms);
      setRawMaterialMovements(rmMovs);
      addToast(`Raw material consumption recorded!`, 'success');
      return true;
    } catch (err: any) {
      addToast(`Error recording consumption: ${err.message}`, 'error');
      return false;
    }
  };

  // User & Roles
  const updateUserStatus = async (userId: string, status: 'active' | 'inactive') => {
    try {
      await userService.updateUserStatus(userId, status);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u));
      addToast(`User status updated to ${status}`, 'success');
    } catch (err: any) {
      addToast(`Failed to update status: ${err.message}`, 'error');
    }
  };

  const updateUserRole = async (userId: string, role: InternalRole) => {
    try {
      await userService.updateUserRole(userId, role);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      addToast(`User role updated to ${role}`, 'success');
    } catch (err: any) {
      addToast(`Failed to update role: ${err.message}`, 'error');
    }
  };

  // Customer Registration
  const registerRetailer = async (data: {
    businessName: string;
    ownerName: string;
    mobile: string;
    address: string;
    password?: string;
  }): Promise<Retailer> => {
    try {
      const cleanMobile = data.mobile.replace(/\D/g, '');
      const authEmail = `retailer.${cleanMobile}@madhavdairy.com`;
      const pass = data.password || 'Password@123';

      const newRet = await customerService.registerCustomer({
        ...data,
        email: authEmail,
      });

      // Provision auth account in background so retailer can log in immediately
      try {
        await authService.signUp(authEmail, pass, data.ownerName, cleanMobile, 'customer', {
          businessName: data.businessName,
          address: data.address,
        });
      } catch (authErr) {
        console.warn('Customer auth provision note:', authErr);
      }

      setRetailers(prev => [...prev, newRet]);
      setCurrentRetailer(newRet);
      addToast(`Retailer account for "${newRet.businessName}" registered!`, 'success');
      return newRet;
    } catch (err: any) {
      addToast(`Registration failed: ${err.message}`, 'error');
      throw err;
    }
  };

  // Order status
  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, status);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      addToast(`Order status updated to ${status}`, 'success');
    } catch (err: any) {
      addToast(`Failed to update order: ${err.message}`, 'error');
    }
  };

  // Expiry rule toggle
  const toggleExpiryRule = async (ruleId: string) => {
    const r = expiryRules.find(x => x.id === ruleId);
    if (!r) return;
    try {
      await expiryService.toggleExpiryRule(ruleId, r.enabled);
      setExpiryRules(prev => prev.map(x => x.id === ruleId ? { ...x, enabled: !x.enabled } : x));
      addToast(`Expiry rule updated`, 'info');
    } catch (err: any) {
      addToast(`Failed to update rule: ${err.message}`, 'error');
    }
  };

  // Notifications
  const markNotificationRead = async (id: string) => {
    await notificationService.markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = async () => {
    await notificationService.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
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

        currentUser,
        login,
        logout,
        isLoading,
        error,
        refreshData,

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

        addProduct,
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
