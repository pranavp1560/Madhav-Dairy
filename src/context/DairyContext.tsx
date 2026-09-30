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
  internalView: string;
  setInternalView: (view: string) => void;
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
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (val: boolean) => void;

  // Active Retailer
  currentRetailer: Retailer | null;
  setCurrentRetailer: (r: Retailer | null) => void;

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
  placeOrder: (notes?: string, deliveryDate?: string) => Promise<Order>;
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
  registerRetailer: (data: {
    businessName: string;
    ownerName: string;
    email?: string;
    mobile: string;
    password?: string;
    address: string;
    area?: string;
    creditLimit?: number;
  }) => Promise<Retailer>;

  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  toggleExpiryRule: (ruleId: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: (recipientType: 'customer' | 'internal') => Promise<void>;

  // Toasts
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

const DairyContext = createContext<DairyContextType | undefined>(undefined);

export const DairyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation & Session State
  const [portal, setPortal] = useState<'customer' | 'internal' | 'customer_login' | 'internal_login'>('customer_login');
  const [internalView, setInternalView] = useState<string>('dashboard');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedRetailerId, setSelectedRetailerId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Auth User & Profile
  const [currentUser, setCurrentUser] = useState<UserSessionProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  // Entities initialized from Supabase
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [currentRetailer, setCurrentRetailer] = useState<Retailer | null>(null);
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
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Determine active internal role dynamically from database profile
  const internalRole: InternalRole = useMemo(() => {
    if (currentUser && currentUser.userType === 'internal') {
      return (currentUser.role as InternalRole) || 'admin';
    }
    return 'admin';
  }, [currentUser]);

  // Primary Data Loading from Supabase according to authenticated identity
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Always load products (public catalog accessible to both customers and staff)
      const prods = await productService.fetchProducts();
      setProducts(prods);

      // Check current session to load role-appropriate domain data
      const session = await authService.getSession();
      if (!session?.user) {
        // Not authenticated: clear user-specific data
        setRetailers([]);
        setCurrentRetailer(null);
        setOrders([]);
        setInvoices([]);
        setPayments([]);
        setLedger([]);
        setBatches([]);
        setStockMovements([]);
        setRawMaterials([]);
        setRawMaterialMovements([]);
        setExpenses([]);
        setExpiryAlerts([]);
        setNotifications([]);
        setUsers([]);
        return;
      }

      const profile = await authService.getUserProfile(session.user.id);
      if (!profile) return;

      if (profile.userType === 'customer') {
        // Customer view: RLS isolates customer data automatically
        const custs = await customerService.fetchCustomers();
        setRetailers(custs);

        if (profile.customer) {
          setCurrentRetailer(profile.customer);
        } else if (custs.length > 0) {
          setCurrentRetailer(custs[0]);
        }

        const [ords, invs, notifs, expAlerts] = await Promise.all([
          orderService.fetchOrders(),
          invoiceService.fetchInvoices(),
          notificationService.fetchNotifications(),
          expiryService.fetchExpiryAlerts(),
        ]);

        setOrders(ords);
        setInvoices(invs);
        setNotifications(notifs);
        setExpiryAlerts(expAlerts);

      } else if (profile.userType === 'internal') {
        // Internal staff view: load full organization data permitted by RLS
        const [
          custs,
          ords,
          invs,
          pays,
          ledg,
          bts,
          movs,
          rms,
          rmMovs,
          exps,
          expR,
          expA,
          notifs,
          usrs,
          rPerms
        ] = await Promise.all([
          customerService.fetchCustomers(),
          orderService.fetchOrders(),
          invoiceService.fetchInvoices(),
          paymentService.fetchPayments(),
          ledgerService.fetchLedger(),
          inventoryService.fetchBatches(),
          inventoryService.fetchStockMovements(),
          rawMaterialService.fetchRawMaterials(),
          rawMaterialService.fetchRawMaterialMovements(),
          expenseService.fetchExpenses(),
          expiryService.fetchExpiryRules(),
          expiryService.fetchExpiryAlerts(),
          notificationService.fetchNotifications(),
          userService.fetchUsers(),
          userService.fetchRolePermissions(),
        ]);

        setRetailers(custs);
        setOrders(ords);
        setInvoices(invs);
        setPayments(pays);
        setLedger(ledg);
        setBatches(bts);
        setStockMovements(movs);
        setRawMaterials(rms);
        setRawMaterialMovements(rmMovs);
        setExpenses(exps);
        setExpiryRules(expR);
        setExpiryAlerts(expA);
        setNotifications(notifs);
        setUsers(usrs);
        setRolePermissions(rPerms);
      }
    } catch (err: any) {
      console.error('Data refresh error:', err);
      setError(err.message || 'Failed to sync live data from Supabase');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Restore Supabase Auth session on component mount
  useEffect(() => {
    // Check for password recovery hash in URL
    if (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')) {
      setIsPasswordRecovery(true);
    }

    const initAuth = async () => {
      try {
        setIsLoading(true);
        const session = await authService.getSession();
        if (session?.user) {
          const profile = await authService.getUserProfile(session.user.id);
          if (profile) {
            if (profile.status !== 'active') {
              await authService.signOut();
              setCurrentUser(null);
              setCurrentRetailer(null);
              setPortal('customer_login');
              addToast('Your account is inactive or suspended. Please contact management.', 'error');
              return;
            }

            setCurrentUser(profile);
            if (profile.userType === 'customer') {
              setPortal('customer');
              if (profile.customer) {
                setCurrentRetailer(profile.customer);
              }
            } else {
              setPortal('internal');
            }
          } else {
            setCurrentUser(null);
            setPortal('customer_login');
          }
        } else {
          setCurrentUser(null);
          setCurrentRetailer(null);
          setPortal('customer_login');
        }
      } catch (e: any) {
        console.warn('Session restoration error:', e);
        setCurrentUser(null);
        setCurrentRetailer(null);
        setPortal('customer_login');
      } finally {
        await refreshData();
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen to Supabase auth state change
    const { data: { subscription } } = authService.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        return;
      }

      if (session?.user) {
        try {
          const profile = await authService.getUserProfile(session.user.id);
          if (profile) {
            if (profile.status !== 'active') {
              await authService.signOut();
              setCurrentUser(null);
              setCurrentRetailer(null);
              setPortal('customer_login');
              addToast('Your account is inactive or suspended.', 'error');
              return;
            }

            setCurrentUser(profile);
            if (profile.userType === 'customer') {
              setPortal('customer');
              if (profile.customer) {
                setCurrentRetailer(profile.customer);
              }
            } else {
              setPortal('internal');
            }
          }
        } catch (err) {
          console.error('Auth state profile error:', err);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setCurrentRetailer(null);
        setCart([]);
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
      if (profile.customer) {
        setCurrentRetailer(profile.customer);
      }
    } else {
      setPortal('internal');
    }
    await refreshData();
    addToast(`Welcome back, ${profile.fullName}!`, 'success');
    return profile;
  };

  const logout = async () => {
    try {
      await authService.signOut();
    } finally {
      setCurrentUser(null);
      setCurrentRetailer(null);
      setCart([]);
      setOrders([]);
      setInvoices([]);
      setPayments([]);
      setLedger([]);
      setBatches([]);
      setStockMovements([]);
      setRawMaterials([]);
      setRawMaterialMovements([]);
      setExpenses([]);
      setExpiryAlerts([]);
      setNotifications([]);
      setUsers([]);
      setPortal('customer_login');
      addToast('Signed out successfully', 'info');
    }
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
  const placeOrder = async (notes?: string, deliveryDate?: string): Promise<Order> => {
    if (cart.length === 0) {
      throw new Error('Cart is empty');
    }
    if (!currentRetailer) {
      throw new Error('No authenticated customer account found. Please sign in again.');
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
        deliveryDate: deliveryDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
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
    const matId = data.materialId || rawMaterials[0]?.id;
    if (!matId) {
      addToast('No raw material selected', 'error');
      return;
    }
    await addRawMaterialStock(matId, data.qty, data.reference || 'PO-PURCHASE', data.notes);
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

  // User & Roles Management
  const updateUserStatus = async (userId: string, status: 'active' | 'inactive') => {
    try {
      await userService.updateUserStatus(userId, status);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u));
      addToast(`Employee status updated to ${status}`, 'success');
    } catch (err: any) {
      addToast(`Failed to update status: ${err.message}`, 'error');
    }
  };

  const updateUserRole = async (userId: string, role: InternalRole) => {
    try {
      await userService.updateUserRole(userId, role);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      addToast(`Employee role updated to ${role}`, 'success');
    } catch (err: any) {
      addToast(`Failed to update role: ${err.message}`, 'error');
    }
  };

  // Internal Customer Creation from ERP
  const registerRetailer = async (data: {
    businessName: string;
    ownerName: string;
    email?: string;
    mobile: string;
    password?: string;
    address: string;
    area?: string;
    creditLimit?: number;
  }): Promise<Retailer> => {
    try {
      const newRet = await customerService.registerCustomer({
        businessName: data.businessName,
        ownerName: data.ownerName,
        email: data.email,
        mobile: data.mobile,
        address: data.address,
        area: data.area,
        creditLimit: data.creditLimit,
      });

      setRetailers(prev => [...prev, newRet]);
      addToast(`Customer "${newRet.businessName}" added to system!`, 'success');
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

  const markAllNotificationsRead = async (recipientType: 'customer' | 'internal') => {
    await notificationService.markAllAsRead();
    setNotifications(prev => prev.map(n => n.recipientType === recipientType ? { ...n, read: true } : n));
  };

  return (
    <DairyContext.Provider
      value={{
        portal,
        setPortal,
        internalRole,
        internalView,
        setInternalView,
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
        isPasswordRecovery,
        setIsPasswordRecovery,

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
