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
  ProductExpiryRule,
  CustomerProductBatch,
  StaffStockExpiryItem,
  InternalRole,
  OrderStatus,
  RawMaterial,
  RawMaterialMovement,
  User,
  RolePermission,
  CategoryItem,
  SalesChannel,
  ProductChannelPrice,
  ProductSku,
  SkuChannelPrice,
  PaymentMethod,
  InvoiceAllocationInput,
  RecordCustomerPaymentResult,
  BusinessPaymentMethod,
  CustomerPaymentSubmission
} from '../types/dairy';
import {
  authService,
  productService,
  customerService,
  orderService,
  invoiceService,
  paymentService,
  paymentMethodService,
  ledgerService,
  inventoryService,
  rawMaterialService,
  expenseService,
  expiryService,
  notificationService,
  userService,
  channelService,
  UserSessionProfile
} from '../services';

export interface CartItem {
  product: Product;
  sku?: ProductSku;
  unitPrice: number;
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
  productExpiryRules: ProductExpiryRule[];
  staffStockExpiry: StaffStockExpiryItem[];
  customerExpiryTracking: CustomerProductBatch[];
  rawMaterials: RawMaterial[];
  rawMaterialMovements: RawMaterialMovement[];
  users: User[];
  rolePermissions: RolePermission[];
  categories: CategoryItem[];
  salesChannels: SalesChannel[];
  channelPrices: ProductChannelPrice[];
  skuChannelPrices: SkuChannelPrice[];

  // Payment Details & Customer Verification Submissions
  paymentMethods: BusinessPaymentMethod[];
  paymentSubmissions: CustomerPaymentSubmission[];
  loadPaymentMethods: () => Promise<void>;
  loadPaymentSubmissions: () => Promise<void>;
  createPaymentMethod: (method: {
    methodType: 'bank_account' | 'upi';
    displayName: string;
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    branchName?: string;
    upiId?: string;
    qrCodeUrl?: string;
    instructions?: string;
    isActive: boolean;
    isDefault: boolean;
  }) => Promise<BusinessPaymentMethod>;
  updatePaymentMethod: (id: string, updates: Partial<BusinessPaymentMethod>) => Promise<void>;
  togglePaymentMethodStatus: (id: string, isActive: boolean) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;
  submitCustomerPayment: (params: {
    invoiceId: string;
    paymentMethodType: 'upi' | 'bank_transfer' | 'other';
    transactionReference: string;
    amount: number;
    paymentMethodId?: string;
    transactionDate?: string;
    receiptUrl?: string;
    notes?: string;
  }) => Promise<{ success: boolean; submission_id: string; message: string }>;
  verifyAndAccountSubmission: (submissionId: string, notes?: string) => Promise<any>;
  rejectPaymentSubmission: (submissionId: string, reason: string) => Promise<any>;
  markDirectPaymentAccounted: (paymentId: string) => Promise<void>;
  rejectDirectPayment: (paymentId: string, reason: string) => Promise<void>;

  // Cart
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  addToCart: (productId: string, qty?: number, skuId?: string) => void;
  updateCartQty: (productId: string, qty: number, skuId?: string) => void;
  removeFromCart: (productId: string, skuId?: string) => void;
  clearCart: () => void;
  placeOrder: (notes?: string, deliveryDate?: string) => Promise<Order>;
  reorder: (orderId: string) => void;

  // Categories & Channels & Pricing Actions
  addCategory: (data: { name: string; nameMr?: string; nameHi?: string; description?: string }) => Promise<CategoryItem>;
  updateCategory: (id: string, data: { name?: string; nameMr?: string; nameHi?: string; description?: string; isActive?: boolean }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  toggleCategoryActive: (id: string, isActive: boolean) => Promise<void>;
  addSalesChannel: (data: { name: string; code: string; description?: string }) => Promise<SalesChannel>;
  updateSalesChannel: (id: string, data: { name?: string; code?: string; description?: string; isActive?: boolean }) => Promise<void>;
  deleteSalesChannel: (id: string) => Promise<void>;
  toggleSalesChannelActive: (id: string, isActive: boolean) => Promise<void>;
  saveChannelPrice: (data: { productId: string; channelId: string; standardPrice: number; minimumPrice: number; isActive?: boolean }) => Promise<ProductChannelPrice>;
  saveMultipleChannelPrices: (prices: { productId: string; channelId: string; standardPrice: number; minimumPrice: number; isActive?: boolean }[]) => Promise<void>;
  refreshPricingData: () => Promise<void>;

  // Parent Product CRUD
  createParentProduct: (data: {
    name: string;
    categoryId: string;
    description?: string;
    brand?: string;
    isActive?: boolean;
    baseUnit?: string;
  }) => Promise<Product>;
  updateParentProduct: (id: string, data: {
    name?: string;
    categoryId?: string;
    description?: string;
    brand?: string;
    isActive?: boolean;
    baseUnit?: string;
  }) => Promise<void>;
  toggleParentProductActive: (id: string, isActive: boolean) => Promise<void>;
  deleteParentProduct: (id: string) => Promise<void>;

  // Child SKU CRUD
  createSku: (data: {
    productId: string;
    skuCode: string;
    variantName: string;
    packSize?: string;
    quantity?: number;
    unit: string;
    mrp: number;
    sellingPrice?: number;
    barcode?: string;
    isDefault?: boolean;
    isActive?: boolean;
    channelPrices?: {
      channelId: string;
      standardPrice: number;
      minimumPrice: number;
    }[];
  }) => Promise<ProductSku>;
  updateSku: (id: string, data: {
    skuCode?: string;
    variantName?: string;
    packSize?: string;
    quantity?: number;
    unit?: string;
    mrp?: number;
    sellingPrice?: number;
    barcode?: string;
    isDefault?: boolean;
    isActive?: boolean;
  }) => Promise<void>;
  toggleSkuActive: (id: string, isActive: boolean) => Promise<void>;
  deleteSku: (id: string) => Promise<void>;

  // SKU Channel Pricing
  saveSkuChannelPrice: (data: {
    skuId: string;
    channelId: string;
    standardPrice: number;
    minimumPrice: number;
    isActive?: boolean;
  }) => Promise<SkuChannelPrice>;
  saveMultipleSkuChannelPrices: (prices: {
    skuId: string;
    channelId: string;
    standardPrice: number;
    minimumPrice: number;
    isActive?: boolean;
  }[]) => Promise<void>;

  // Business Actions
  addProduct: (data: {
    name: string;
    nameMr?: string;
    nameHi?: string;
    categoryName?: string;
    categoryId?: string;
    packSize: string;
    unit: string;
    mrp: number;
    sellingPrice: number;
    shelfLifeDays: number;
    description?: string;
    minStockThreshold?: number;
    channelPrices?: {
      channelId: string;
      standardPrice: number;
      minimumPrice: number;
    }[];
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

  recordCustomerPaymentWithAllocations: (data: {
    customerId: string;
    paymentAmount: number;
    paymentMethod: PaymentMethod;
    allocations: InvoiceAllocationInput[];
    referenceNumber: string;
    notes?: string;
    paymentDate?: string;
  }) => Promise<RecordCustomerPaymentResult>;

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

  updateUserStatus: (userId: string, status: 'active' | 'inactive' | 'invited') => Promise<void>;
  updateUserRole: (userId: string, role: InternalRole) => Promise<void>;
  updateEmployee: (userId: string, data: { name: string; mobile: string; department: string; role: InternalRole; status: 'active' | 'inactive' | 'invited' }) => Promise<void>;
  deleteEmployee: (userId: string) => Promise<void>;
  saveRolePermissions: (role: InternalRole, permissions: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>) => Promise<void>;
  registerRetailer: (data: {
    businessName: string;
    ownerName: string;
    email?: string;
    mobile: string;
    password?: string;
    address: string;
    area?: string;
    creditLimit?: number;
    salesChannelId?: string;
  }) => Promise<Retailer>;

  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  confirmOrder: (orderId: string) => Promise<void>;
  dispatchOrder: (orderId: string) => Promise<{ invoiceId?: string; invoiceNumber?: string }>;
  bulkConfirmOrders: (orderIds: string[]) => Promise<{ confirmed_count?: number; skipped_count?: number }>;
  bulkDispatchOrders: (orderIds: string[]) => Promise<{ dispatched_count?: number; skipped_count?: number; failed_count?: number }>;
  markInvoiceDelivered: (invoiceId: string) => Promise<void>;
  bulkDeliverInvoices: (invoiceIds: string[]) => Promise<{ delivered_count?: number; skipped_count?: number }>;
  allocateInvoicePayment: (params: {
    invoiceId: string;
    amount: number;
    paymentMethod?: PaymentMethod;
    reference?: string;
    notes?: string;
    paymentDate?: string;
  }) => Promise<void>;
  confirmInvoicePayment: (invoiceId: string) => Promise<void>;
  bulkConfirmInvoicePayments: (invoiceIds: string[]) => Promise<{ settled_count?: number; skipped_count?: number }>;
  createInternalOrder: (params: {
    customerId: string;
    items: {
      productId?: string;
      skuId?: string;
      batchId?: string;
      productName?: string;
      quantity: number;
      unitPrice: number;
    }[];
    notes?: string;
    deliveryDate?: string;
  }) => Promise<Order>;
  editOrder: (orderId: string, params: {
    customerId?: string;
    items: {
      productId?: string;
      skuId?: string;
      batchId?: string;
      productName?: string;
      quantity: number;
      unitPrice: number;
    }[];
    notes?: string;
    deliveryDate?: string;
    status?: OrderStatus;
  }) => Promise<Order>;
  orderToEdit: Order | null;
  setOrderToEdit: (order: Order | null) => void;
  navigateToCreateOrder: (order?: Order | null) => void;
  toggleExpiryRule: (ruleId: string) => Promise<void>;
  updateProductExpiryRule: (params: {
    productId: string;
    alert1Days: number;
    alert2Days: number;
    alert3Days: number;
    enabled: boolean;
  }) => Promise<void>;
  toggleProductExpiryRule: (productId: string) => Promise<void>;
  evaluateExpiryRisk: () => Promise<void>;
  sendManualWebsiteNotification: (params: {
    batchId: string;
    batchNumber: string;
    productName: string;
    daysRemaining: number;
    locationName?: string;
    customerId?: string;
    retailerName?: string;
  }) => Promise<void>;
  refreshExpiryData: () => Promise<void>;
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
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);

  const navigateToCreateOrder = (order?: Order | null) => {
    setOrderToEdit(order || null);
    setInternalView('create_order');
  };

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
  const [productExpiryRules, setProductExpiryRules] = useState<ProductExpiryRule[]>([]);
  const [staffStockExpiry, setStaffStockExpiry] = useState<StaffStockExpiryItem[]>([]);
  const [customerExpiryTracking, setCustomerExpiryTracking] = useState<CustomerProductBatch[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [rawMaterialMovements, setRawMaterialMovements] = useState<RawMaterialMovement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [salesChannels, setSalesChannels] = useState<SalesChannel[]>([]);
  const [channelPrices, setChannelPrices] = useState<ProductChannelPrice[]>([]);
  const [skuChannelPrices, setSkuChannelPrices] = useState<SkuChannelPrice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<BusinessPaymentMethod[]>([]);
  const [paymentSubmissions, setPaymentSubmissions] = useState<CustomerPaymentSubmission[]>([]);

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

      // 1. Always load products & categories
      const [prods, cats] = await Promise.all([
        productService.fetchProducts(),
        productService.fetchCategoriesDetail(),
      ]);
      setProducts(prods);
      setCategories(cats);

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
        setUsers([]);
        setSalesChannels([]);
        setChannelPrices([]);
        setSkuChannelPrices([]);
        setPaymentMethods([]);
        setPaymentSubmissions([]);
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
        } else if (profile.customerId) {
          const matched = custs.find(c => c.id === profile.customerId);
          if (matched) setCurrentRetailer(matched);
        } else if (custs.length === 1) {
          setCurrentRetailer(custs[0]);
        }

        const [ords, invs, pays, notifs, expAlerts, prices, skuPrs, custTracking, pMethods, pSubs] = await Promise.all([
          orderService.fetchOrders(),
          invoiceService.fetchInvoices(),
          paymentService.fetchPayments(),
          notificationService.fetchNotifications(),
          expiryService.fetchExpiryAlerts(),
          productService.fetchChannelPrices(),
          productService.fetchSkuChannelPrices(),
          expiryService.fetchCustomerExpiryTracking(profile.customerId || profile.customer?.id),
          paymentMethodService.fetchPaymentMethods(),
          paymentMethodService.fetchPaymentSubmissions({ customerId: profile.customerId || profile.customer?.id }),
        ]);

        setOrders(ords);
        setInvoices(invs);
        setPayments(pays);
        setNotifications(notifs);
        setExpiryAlerts(expAlerts);
        setChannelPrices(prices);
        setSkuChannelPrices(skuPrs);
        setCustomerExpiryTracking(custTracking);
        setPaymentMethods(pMethods);
        setPaymentSubmissions(pSubs);

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
          prodExpRules,
          staffExpItems,
          custTracking,
          expA,
          notifs,
          usrs,
          rPerms,
          channels,
          prices,
          skuPrs,
          pMethods,
          pSubs
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
          expiryService.fetchProductExpiryRules(),
          expiryService.fetchStaffStockExpiry(),
          expiryService.fetchCustomerExpiryTracking(),
          expiryService.fetchExpiryAlerts(),
          notificationService.fetchNotifications(),
          userService.fetchUsers(),
          userService.fetchRolePermissions(),
          channelService.fetchSalesChannels(),
          productService.fetchChannelPrices(),
          productService.fetchSkuChannelPrices(),
          paymentMethodService.fetchPaymentMethods(),
          paymentMethodService.fetchPaymentSubmissions(),
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
        setProductExpiryRules(prodExpRules);
        setStaffStockExpiry(staffExpItems);
        setCustomerExpiryTracking(custTracking);
        setExpiryAlerts(expA);
        setNotifications(notifs);
        setUsers(usrs);
        setRolePermissions(rPerms);
        setSalesChannels(channels);
        setChannelPrices(prices);
        setSkuChannelPrices(skuPrs);
        setPaymentMethods(pMethods);
        setPaymentSubmissions(pSubs);
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
    // Check for password recovery hash or employee invitation hash in URL
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const isRecoveryOrInvite = 
      hash.includes('type=recovery') || 
      search.includes('type=recovery') ||
      hash.includes('type=invite') || 
      search.includes('type=invite');

    if (isRecoveryOrInvite) {
      setIsPasswordRecovery(true);
    }

    const initAuth = async () => {
      try {
        setIsLoading(true);
        const session = await authService.getSession();
        if (session?.user) {
          const profile = await authService.getUserProfile(session.user.id);
          if (profile) {
            if (profile.status === 'invited') {
              // Employee accessed via invitation link: keep session active and prompt password setup
              setCurrentUser(profile);
              setIsPasswordRecovery(true);
              setPortal('internal');
              return;
            }

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
      const curHash = window.location.hash || '';
      const curSearch = window.location.search || '';
      const isRecoveryOrInviteNow = 
        curHash.includes('type=recovery') || 
        curSearch.includes('type=recovery') ||
        curHash.includes('type=invite') || 
        curSearch.includes('type=invite');

      if (event === 'PASSWORD_RECOVERY' || (session?.user && isRecoveryOrInviteNow)) {
        setIsPasswordRecovery(true);
      }

      if (session?.user) {
        try {
          const profile = await authService.getUserProfile(session.user.id);
          if (profile) {
            if (profile.status === 'invited') {
              setCurrentUser(profile);
              setIsPasswordRecovery(true);
              setPortal('internal');
              return;
            }

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
  const addToCart = (productId: string, qty = 1, skuId?: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    // Find chosen SKU or default SKU
    const targetSku = skuId
      ? prod.skus?.find(s => s.id === skuId)
      : (prod.skus?.find(s => s.isDefault) || prod.skus?.[0]);

    // Check if customer has channel-specific standard price for this SKU
    let effectivePrice = targetSku?.sellingPrice ?? prod.defaultPrice;
    if (currentRetailer?.salesChannelId) {
      if (targetSku?.channelPrices && targetSku.channelPrices.length > 0) {
        const scp = targetSku.channelPrices.find(
          c => c.channelId === currentRetailer.salesChannelId && c.isActive
        );
        if (scp) {
          effectivePrice = scp.standardPrice;
        }
      } else {
        const scp = skuChannelPrices.find(
          c => c.skuId === targetSku?.id && c.channelId === currentRetailer.salesChannelId && c.isActive
        );
        if (scp) {
          effectivePrice = scp.standardPrice;
        } else {
          // Fallback to product channel price
          const cp = (prod.channelPrices || channelPrices).find(
            c => c.productId === prod.id && c.channelId === currentRetailer.salesChannelId && c.isActive
          );
          if (cp) {
            effectivePrice = cp.standardPrice;
          }
        }
      }
    }

    setCart(prev => {
      const matchIdx = prev.findIndex(item =>
        item.product.id === productId && (targetSku ? item.sku?.id === targetSku.id : !item.sku)
      );

      if (matchIdx >= 0) {
        const copy = [...prev];
        copy[matchIdx] = {
          ...copy[matchIdx],
          unitPrice: effectivePrice,
          quantity: copy[matchIdx].quantity + qty,
        };
        return copy;
      } else {
        return [
          ...prev,
          {
            product: prod,
            sku: targetSku,
            unitPrice: effectivePrice,
            quantity: qty,
          },
        ];
      }
    });

    const skuLabel = targetSku?.variantName || targetSku?.packSize;
    const label = skuLabel ? `${prod.name} (${skuLabel})` : prod.name;
    addToast(`Added ${qty} × ${label} to cart`, 'info');
  };

  const updateCartQty = (productId: string, qty: number, skuId?: string) => {
    if (qty <= 0) {
      removeFromCart(productId, skuId);
      return;
    }
    setCart(prev =>
      prev.map(item => {
        const matches = item.product.id === productId && (skuId ? item.sku?.id === skuId : !item.sku);
        return matches ? { ...item, quantity: qty } : item;
      })
    );
  };

  const removeFromCart = (productId: string, skuId?: string) => {
    setCart(prev =>
      prev.filter(item => {
        if (skuId) {
          return !(item.product.id === productId && item.sku?.id === skuId);
        }
        return item.product.id !== productId;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity * (item.unitPrice ?? item.product.defaultPrice), 0);
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
        items: cart.map(i => {
          const skuLabel = i.sku?.variantName || i.sku?.packSize;
          const displayName = skuLabel ? `${i.product.name} (${skuLabel})` : i.product.name;
          return {
            productId: i.product.id,
            skuId: i.sku?.id,
            productName: displayName,
            quantity: i.quantity,
            unitPrice: i.unitPrice ?? i.product.defaultPrice,
          };
        }),
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
        addToCart(prod.id, item.quantity, item.skuId);
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
    categoryId?: string;
    packSize: string;
    unit: string;
    mrp: number;
    sellingPrice: number;
    shelfLifeDays: number;
    description?: string;
    minStockThreshold?: number;
    channelPrices?: {
      channelId: string;
      standardPrice: number;
      minimumPrice: number;
    }[];
  }): Promise<Product> => {
    try {
      const newProd = await productService.createProduct(data);
      setProducts(prev => [...prev, newProd]);
      await refreshPricingData();
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

  // Record Customer Payment With Multi-Invoice Allocations
  const recordCustomerPaymentWithAllocations = async (data: {
    customerId: string;
    paymentAmount: number;
    paymentMethod: PaymentMethod;
    allocations: InvoiceAllocationInput[];
    referenceNumber: string;
    notes?: string;
    paymentDate?: string;
  }): Promise<RecordCustomerPaymentResult> => {
    try {
      const result = await paymentService.recordCustomerPaymentWithAllocations({
        ...data,
        userId: currentUser?.id,
      });

      const [updatedInvs, updatedPays, updatedLedger, updatedRetailers] = await Promise.all([
        invoiceService.fetchInvoices(),
        paymentService.fetchPayments(),
        ledgerService.fetchLedger(),
        customerService.fetchCustomers(),
      ]);

      setInvoices(updatedInvs);
      setPayments(updatedPays);
      setLedger(updatedLedger);
      setRetailers(updatedRetailers);

      addToast(`Payment ${result.payment_number} of ₹${data.paymentAmount.toLocaleString('en-IN')} recorded successfully!`, 'success');
      return result;
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
  const updateUserStatus = async (userId: string, status: 'active' | 'inactive' | 'invited') => {
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

  const updateEmployee = async (
    userId: string,
    data: {
      name: string;
      mobile: string;
      department: string;
      role: InternalRole;
      status: 'active' | 'inactive' | 'invited';
    }
  ) => {
    try {
      await userService.updateEmployee(userId, data);
      setUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? {
                ...u,
                name: data.name,
                mobile: data.mobile,
                department: data.department,
                role: data.role,
                status: data.status,
              }
            : u
        )
      );
      addToast(`Employee "${data.name}" profile updated successfully!`, 'success');
    } catch (err: any) {
      addToast(`Failed to update employee: ${err.message}`, 'error');
      throw err;
    }
  };

  const deleteEmployee = async (userId: string) => {
    try {
      await userService.deleteEmployee(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      addToast('Employee removed successfully', 'success');
    } catch (err: any) {
      addToast(`Failed to delete employee: ${err.message}`, 'error');
      throw err;
    }
  };

  const saveRolePermissions = async (
    role: InternalRole,
    permissions: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>
  ) => {
    try {
      await userService.saveRolePermissions(role, permissions);
      addToast(`Role permissions for ${role.replace('_', ' ')} saved successfully!`, 'success');
    } catch (err: any) {
      addToast(`Failed to save role permissions: ${err.message}`, 'error');
      throw err;
    }
  };

  // Categories, Channels, and Pricing Actions
  const refreshPricingData = async () => {
    try {
      const [prods, cats, chs, prs, skuPrs] = await Promise.all([
        productService.fetchProducts(),
        productService.fetchCategoriesDetail(),
        channelService.fetchSalesChannels(),
        productService.fetchChannelPrices(),
        productService.fetchSkuChannelPrices(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setSalesChannels(chs);
      setChannelPrices(prs);
      setSkuChannelPrices(skuPrs);
    } catch (err: any) {
      console.error('Failed to refresh pricing data:', err);
    }
  };

  const addCategory = async (data: { name: string; nameMr?: string; nameHi?: string; description?: string }) => {
    try {
      const newCat = await productService.createCategory(data);
      setCategories(prev => [...prev, newCat]);
      addToast(`Category "${newCat.name}" created!`, 'success');
      return newCat;
    } catch (err: any) {
      addToast(`Failed to create category: ${err.message}`, 'error');
      throw err;
    }
  };

  const updateCategory = async (id: string, data: { name?: string; nameMr?: string; nameHi?: string; description?: string; isActive?: boolean }) => {
    try {
      await productService.updateCategory(id, data);
      await refreshPricingData();
      addToast('Category updated successfully!', 'success');
    } catch (err: any) {
      addToast(`Failed to update category: ${err.message}`, 'error');
      throw err;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await productService.deleteCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
      addToast('Category deleted successfully', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  const toggleCategoryActive = async (id: string, isActive: boolean) => {
    try {
      await productService.toggleCategoryActive(id, isActive);
      setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive } : c));
      addToast(`Category ${isActive ? 'activated' : 'deactivated'}`, 'info');
    } catch (err: any) {
      addToast(`Failed to update category status: ${err.message}`, 'error');
      throw err;
    }
  };

  const addSalesChannel = async (data: { name: string; code: string; description?: string }) => {
    try {
      const newChannel = await channelService.createSalesChannel(data);
      setSalesChannels(prev => [...prev, newChannel]);
      addToast(`Sales Channel "${newChannel.name}" added!`, 'success');
      return newChannel;
    } catch (err: any) {
      addToast(`Failed to create sales channel: ${err.message}`, 'error');
      throw err;
    }
  };

  const updateSalesChannel = async (id: string, data: { name?: string; code?: string; description?: string; isActive?: boolean }) => {
    try {
      await channelService.updateSalesChannel(id, data);
      await refreshPricingData();
      addToast('Sales channel updated successfully', 'success');
    } catch (err: any) {
      addToast(`Failed to update channel: ${err.message}`, 'error');
      throw err;
    }
  };

  const deleteSalesChannel = async (id: string) => {
    try {
      await channelService.deleteSalesChannel(id);
      setSalesChannels(prev => prev.filter(ch => ch.id !== id));
      addToast('Sales channel deleted successfully', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  const toggleSalesChannelActive = async (id: string, isActive: boolean) => {
    try {
      await channelService.toggleSalesChannelActive(id, isActive);
      setSalesChannels(prev => prev.map(ch => ch.id === id ? { ...ch, isActive } : ch));
      addToast(`Channel ${isActive ? 'activated' : 'deactivated'}`, 'info');
    } catch (err: any) {
      addToast(`Failed to toggle channel status: ${err.message}`, 'error');
      throw err;
    }
  };

  const saveChannelPrice = async (data: { productId: string; channelId: string; standardPrice: number; minimumPrice: number; isActive?: boolean }) => {
    try {
      const saved = await productService.saveChannelPrice(data);
      await refreshPricingData();
      addToast('Channel pricing updated successfully', 'success');
      return saved;
    } catch (err: any) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  const saveMultipleChannelPrices = async (prices: { productId: string; channelId: string; standardPrice: number; minimumPrice: number; isActive?: boolean }[]) => {
    try {
      await productService.saveMultipleChannelPrices(prices);
      await refreshPricingData();
      addToast('All channel prices saved successfully!', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  // -------------------------------------------------------------
  // Parent Product CRUD
  // -------------------------------------------------------------
  const createParentProduct = async (data: {
    name: string;
    categoryId: string;
    description?: string;
    brand?: string;
    isActive?: boolean;
    baseUnit?: string;
  }): Promise<Product> => {
    try {
      const newProd = await productService.createParentProduct(data);
      await refreshPricingData();
      addToast(`Product "${newProd.name}" created!`, 'success');
      return newProd;
    } catch (err: any) {
      addToast(`Failed to create product: ${err.message}`, 'error');
      throw err;
    }
  };

  const updateParentProduct = async (id: string, data: {
    name?: string;
    categoryId?: string;
    description?: string;
    brand?: string;
    isActive?: boolean;
    baseUnit?: string;
  }) => {
    try {
      await productService.updateParentProduct(id, data);
      await refreshPricingData();
      addToast('Product updated successfully!', 'success');
    } catch (err: any) {
      addToast(`Failed to update product: ${err.message}`, 'error');
      throw err;
    }
  };

  const toggleParentProductActive = async (id: string, isActive: boolean) => {
    try {
      await productService.toggleParentProductActive(id, isActive);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, isActive, isAvailable: isActive } : p));
      addToast(`Product ${isActive ? 'activated' : 'deactivated'}`, 'info');
    } catch (err: any) {
      addToast(`Failed to update status: ${err.message}`, 'error');
      throw err;
    }
  };

  const deleteParentProduct = async (id: string) => {
    try {
      await productService.deleteParentProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      addToast('Product deleted successfully', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  // -------------------------------------------------------------
  // Child SKU CRUD
  // -------------------------------------------------------------
  const createSku = async (data: {
    productId: string;
    skuCode: string;
    variantName: string;
    packSize?: string;
    quantity?: number;
    unit: string;
    mrp: number;
    sellingPrice?: number;
    barcode?: string;
    isDefault?: boolean;
    isActive?: boolean;
    channelPrices?: {
      channelId: string;
      standardPrice: number;
      minimumPrice: number;
    }[];
  }): Promise<ProductSku> => {
    try {
      const newSku = await productService.createSku(data);
      await refreshPricingData();
      addToast(`SKU "${newSku.skuCode}" (${newSku.variantName}) added!`, 'success');
      return newSku;
    } catch (err: any) {
      addToast(`Failed to add SKU: ${err.message}`, 'error');
      throw err;
    }
  };

  const updateSku = async (id: string, data: {
    skuCode?: string;
    variantName?: string;
    packSize?: string;
    quantity?: number;
    unit?: string;
    mrp?: number;
    sellingPrice?: number;
    barcode?: string;
    isDefault?: boolean;
    isActive?: boolean;
  }) => {
    try {
      await productService.updateSku(id, data);
      await refreshPricingData();
      addToast('SKU updated successfully!', 'success');
    } catch (err: any) {
      addToast(`Failed to update SKU: ${err.message}`, 'error');
      throw err;
    }
  };

  const toggleSkuActive = async (id: string, isActive: boolean) => {
    try {
      await productService.toggleSkuActive(id, isActive);
      await refreshPricingData();
      addToast(`SKU ${isActive ? 'activated' : 'deactivated'}`, 'info');
    } catch (err: any) {
      addToast(`Failed to update SKU status: ${err.message}`, 'error');
      throw err;
    }
  };

  const deleteSku = async (id: string) => {
    try {
      await productService.deleteSku(id);
      await refreshPricingData();
      addToast('SKU deleted successfully', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  // -------------------------------------------------------------
  // SKU Channel Pricing
  // -------------------------------------------------------------
  const saveSkuChannelPrice = async (data: {
    skuId: string;
    channelId: string;
    standardPrice: number;
    minimumPrice: number;
    isActive?: boolean;
  }) => {
    try {
      const saved = await productService.saveSkuChannelPrice(data);
      await refreshPricingData();
      addToast('SKU channel pricing updated successfully', 'success');
      return saved;
    } catch (err: any) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  const saveMultipleSkuChannelPrices = async (prices: {
    skuId: string;
    channelId: string;
    standardPrice: number;
    minimumPrice: number;
    isActive?: boolean;
  }[]) => {
    try {
      await productService.saveMultipleSkuChannelPrices(prices);
      await refreshPricingData();
      addToast('All SKU channel prices saved successfully!', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
      throw err;
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
    salesChannelId?: string;
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
        salesChannelId: data.salesChannelId,
      });

      setRetailers(prev => [...prev, newRet]);
      addToast(`Customer "${newRet.businessName}" added to system!`, 'success');
      return newRet;
    } catch (err: any) {
      addToast(`Registration failed: ${err.message}`, 'error');
      throw err;
    }
  };

  // Order and Invoice Lifecycle Workflows
  const confirmOrder = async (orderId: string) => {
    try {
      await orderService.confirmOrder(orderId, currentUser?.id);
      const updatedOrders = await orderService.fetchOrders();
      setOrders(updatedOrders);
      addToast('Order confirmed successfully!', 'success');
    } catch (err: any) {
      addToast(`Failed to confirm order: ${err.message}`, 'error');
      throw err;
    }
  };

  const dispatchOrder = async (orderId: string) => {
    try {
      const res = await orderService.dispatchOrder(orderId, currentUser?.id);
      const [updatedOrders, updatedInvoices] = await Promise.all([
        orderService.fetchOrders(),
        invoiceService.fetchInvoices(),
      ]);
      setOrders(updatedOrders);
      setInvoices(updatedInvoices);
      addToast(`Order dispatched! Invoice ${res.invoice_number || ''} generated.`, 'success');
      return { invoiceId: res.invoice_id, invoiceNumber: res.invoice_number };
    } catch (err: any) {
      addToast(`Failed to dispatch order: ${err.message}`, 'error');
      throw err;
    }
  };

  const bulkConfirmOrders = async (orderIds: string[]) => {
    try {
      const res = await orderService.bulkConfirmOrders(orderIds, currentUser?.id);
      const updatedOrders = await orderService.fetchOrders();
      setOrders(updatedOrders);
      addToast(`${res.confirmed_count} order(s) confirmed!`, 'success');
      return res;
    } catch (err: any) {
      addToast(`Failed to bulk confirm: ${err.message}`, 'error');
      throw err;
    }
  };

  const bulkDispatchOrders = async (orderIds: string[]) => {
    try {
      const res = await orderService.bulkDispatchOrders(orderIds, currentUser?.id);
      const [updatedOrders, updatedInvoices] = await Promise.all([
        orderService.fetchOrders(),
        invoiceService.fetchInvoices(),
      ]);
      setOrders(updatedOrders);
      setInvoices(updatedInvoices);
      addToast(`${res.dispatched_count} order(s) dispatched! ${res.invoices_created} invoice(s) generated.`, 'success');
      return res;
    } catch (err: any) {
      addToast(`Failed to bulk dispatch: ${err.message}`, 'error');
      throw err;
    }
  };

  const markInvoiceDelivered = async (invoiceId: string) => {
    try {
      await invoiceService.markDelivered(invoiceId, currentUser?.id);
      const updatedInvoices = await invoiceService.fetchInvoices();
      setInvoices(updatedInvoices);
      await refreshExpiryData();
      addToast('Invoice marked as Delivered & customer freshness tracking initialized!', 'success');
    } catch (err: any) {
      addToast(`Failed to deliver invoice: ${err.message}`, 'error');
      throw err;
    }
  };

  const bulkDeliverInvoices = async (invoiceIds: string[]) => {
    try {
      const res = await invoiceService.bulkDeliver(invoiceIds, currentUser?.id);
      const updatedInvoices = await invoiceService.fetchInvoices();
      setInvoices(updatedInvoices);
      await refreshExpiryData();
      addToast(`${res.delivered_count} invoice(s) marked as Delivered & customer freshness tracking initialized!`, 'success');
      return res;
    } catch (err: any) {
      addToast(`Failed to bulk deliver invoices: ${err.message}`, 'error');
      throw err;
    }
  };

  const allocateInvoicePayment = async (params: {
    invoiceId: string;
    amount: number;
    paymentMethod?: PaymentMethod;
    reference?: string;
    notes?: string;
    paymentDate?: string;
  }) => {
    try {
      await invoiceService.allocatePayment({
        invoiceId: params.invoiceId,
        amount: params.amount,
        paymentMethod: params.paymentMethod,
        reference: params.reference,
        notes: params.notes,
        userId: currentUser?.id,
        paymentDate: params.paymentDate,
      });
      const [updatedInvoices, updatedPayments] = await Promise.all([
        invoiceService.fetchInvoices(),
        paymentService.fetchPayments(),
      ]);
      setInvoices(updatedInvoices);
      setPayments(updatedPayments);
      addToast(`Payment of ₹${params.amount.toLocaleString('en-IN')} allocated!`, 'success');
    } catch (err: any) {
      addToast(`Failed to allocate payment: ${err.message}`, 'error');
      throw err;
    }
  };

  const confirmInvoicePayment = async (invoiceId: string) => {
    try {
      const res = await invoiceService.confirmPayment(invoiceId, currentUser?.id);
      const [updatedInvoices, updatedPayments, updatedLedger, updatedRetailers] = await Promise.all([
        invoiceService.fetchInvoices(),
        paymentService.fetchPayments(),
        ledgerService.fetchLedger(),
        customerService.fetchCustomers(),
      ]);
      setInvoices(updatedInvoices);
      setPayments(updatedPayments);
      setLedger(updatedLedger);
      setRetailers(updatedRetailers);
      addToast(res.fully_settled ? 'Payment confirmed! Invoice is Settled.' : 'Payment confirmed (partially accounted).', 'success');
    } catch (err: any) {
      addToast(`Failed to confirm payment: ${err.message}`, 'error');
      throw err;
    }
  };

  const bulkConfirmInvoicePayments = async (invoiceIds: string[]) => {
    try {
      const res = await invoiceService.bulkConfirmPayments(invoiceIds, currentUser?.id);
      const [updatedInvoices, updatedPayments, updatedLedger, updatedRetailers] = await Promise.all([
        invoiceService.fetchInvoices(),
        paymentService.fetchPayments(),
        ledgerService.fetchLedger(),
        customerService.fetchCustomers(),
      ]);
      setInvoices(updatedInvoices);
      setPayments(updatedPayments);
      setLedger(updatedLedger);
      setRetailers(updatedRetailers);
      addToast(`${res.settled_count} invoice(s) settled!`, 'success');
      return res;
    } catch (err: any) {
      addToast(`Failed to bulk confirm payments: ${err.message}`, 'error');
      throw err;
    }
  };

  // Order status
  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      if (status === 'confirmed') {
        await confirmOrder(orderId);
        return;
      }
      if (status === 'dispatched') {
        await dispatchOrder(orderId);
        return;
      }
      await orderService.updateOrderStatus(orderId, status, currentUser?.id);
      const updatedOrders = await orderService.fetchOrders();
      setOrders(updatedOrders);
      addToast(`Order status updated to ${status}`, 'success');
    } catch (err: any) {
      addToast(`Failed to update order: ${err.message}`, 'error');
    }
  };

  // Internal Order Creation by Staff
  const createInternalOrder = async (params: {
    customerId: string;
    items: {
      productId?: string;
      skuId?: string;
      batchId?: string;
      productName?: string;
      quantity: number;
      unitPrice: number;
    }[];
    notes?: string;
    deliveryDate?: string;
  }): Promise<Order> => {
    try {
      const newOrder = await orderService.createOrder({
        customerId: params.customerId,
        items: params.items.map(i => ({
          productId: i.productId,
          skuId: i.skuId,
          batchId: i.batchId,
          productName: i.productName || products.find(p => p.id === i.productId)?.name || 'Product',
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        notes: params.notes || 'Created via Staff Management Portal',
        deliveryDate: params.deliveryDate,
      });

      setOrders(prev => [newOrder, ...prev]);
      const latestNotifs = await notificationService.fetchNotifications();
      setNotifications(latestNotifs);
      addToast(`Order ${newOrder.orderNumber} created successfully!`, 'success');
      return newOrder;
    } catch (err: any) {
      addToast(`Failed to create order: ${err.message}`, 'error');
      throw err;
    }
  };

  // Edit Existing Order by Staff
  const editOrder = async (orderId: string, params: {
    customerId?: string;
    items: {
      productId?: string;
      skuId?: string;
      batchId?: string;
      productName?: string;
      quantity: number;
      unitPrice: number;
    }[];
    notes?: string;
    deliveryDate?: string;
    status?: OrderStatus;
  }): Promise<Order> => {
    try {
      const updatedOrder = await orderService.updateOrder(orderId, {
        customerId: params.customerId,
        items: params.items.map(i => ({
          productId: i.productId,
          skuId: i.skuId,
          batchId: i.batchId,
          productName: i.productName || products.find(p => p.id === i.productId)?.name || 'Product',
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        notes: params.notes,
        deliveryDate: params.deliveryDate,
        status: params.status,
      });
      setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
      addToast(`Order ${updatedOrder.orderNumber} updated successfully!`, 'success');
      return updatedOrder;
    } catch (err: any) {
      addToast(`Failed to update order: ${err.message}`, 'error');
      throw err;
    }
  };

  // Expiry methods
  const refreshExpiryData = async () => {
    try {
      const [pRules, sExp, cTrack, alerts, notifs] = await Promise.all([
        expiryService.fetchProductExpiryRules(),
        expiryService.fetchStaffStockExpiry(),
        expiryService.fetchCustomerExpiryTracking(currentRetailer?.id),
        expiryService.fetchExpiryAlerts(),
        notificationService.fetchNotifications(),
      ]);
      setProductExpiryRules(pRules);
      setStaffStockExpiry(sExp);
      setCustomerExpiryTracking(cTrack);
      setExpiryAlerts(alerts);
      setNotifications(notifs);
    } catch (err: any) {
      console.error('Error refreshing expiry data:', err);
    }
  };

  const updateProductExpiryRule = async (params: {
    productId: string;
    alert1Days: number;
    alert2Days: number;
    alert3Days: number;
    enabled: boolean;
  }) => {
    try {
      await expiryService.updateProductExpiryRule(params);
      await refreshExpiryData();
      addToast('Product expiry alert rule updated successfully', 'success');
    } catch (err: any) {
      addToast(`Failed to update rule: ${err.message}`, 'error');
      throw err;
    }
  };

  const toggleProductExpiryRule = async (productId: string) => {
    const existing = productExpiryRules.find(p => p.productId === productId);
    if (!existing) return;
    try {
      await expiryService.toggleProductExpiryRule(productId, existing.enabled);
      setProductExpiryRules(prev => prev.map(p => p.productId === productId ? { ...p, enabled: !p.enabled } : p));
      addToast(`Expiry alerts ${existing.enabled ? 'disabled' : 'enabled'} for ${existing.productName}`, 'info');
    } catch (err: any) {
      addToast(`Failed to toggle rule: ${err.message}`, 'error');
    }
  };

  const evaluateExpiryRisk = async () => {
    try {
      await expiryService.evaluateExpiryRisk();
      await refreshExpiryData();
      addToast('Freshness surveillance scan complete. Live expiry radar updated.', 'success');
    } catch (err: any) {
      addToast(`Evaluation error: ${err.message}`, 'error');
    }
  };

  const sendManualWebsiteNotification = async (params: {
    batchId: string;
    batchNumber: string;
    productName: string;
    daysRemaining: number;
    locationName?: string;
    customerId?: string;
    retailerName?: string;
  }) => {
    try {
      await expiryService.sendManualWebsiteNotification(params);
      const notifs = await notificationService.fetchNotifications();
      setNotifications(notifs);
      addToast(`Website notification published for Batch ${params.batchNumber}`, 'success');
    } catch (err: any) {
      addToast(`Notification dispatch failed: ${err.message}`, 'error');
    }
  };

  // Legacy Expiry rule toggle
  const toggleExpiryRule = async (ruleId: string) => {
    const r = expiryRules.find(x => x.id === ruleId);
    if (!r) return;
    try {
      await expiryService.toggleProductExpiryRule(r.productId || ruleId, r.enabled);
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

  // Payment Details & Customer Verification Operations
  const loadPaymentMethods = async () => {
    try {
      const methods = await paymentMethodService.fetchPaymentMethods();
      setPaymentMethods(methods);
    } catch (err: any) {
      console.error('Failed to load payment methods:', err);
    }
  };

  const loadPaymentSubmissions = async () => {
    try {
      const subs = await paymentMethodService.fetchPaymentSubmissions();
      setPaymentSubmissions(subs);
    } catch (err: any) {
      console.error('Failed to load payment submissions:', err);
    }
  };

  const createPaymentMethod = async (method: {
    methodType: 'bank_account' | 'upi';
    displayName: string;
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    branchName?: string;
    upiId?: string;
    qrCodeUrl?: string;
    instructions?: string;
    isActive: boolean;
    isDefault: boolean;
  }) => {
    try {
      const created = await paymentMethodService.createPaymentMethod(method);
      await loadPaymentMethods();
      addToast(`Payment method "${created.displayName}" created successfully`, 'success');
      return created;
    } catch (err: any) {
      addToast(`Failed to create payment method: ${err.message}`, 'error');
      throw err;
    }
  };

  const updatePaymentMethod = async (id: string, updates: Partial<BusinessPaymentMethod>) => {
    try {
      await paymentMethodService.updatePaymentMethod(id, updates);
      await loadPaymentMethods();
      addToast('Payment method updated successfully', 'success');
    } catch (err: any) {
      addToast(`Failed to update payment method: ${err.message}`, 'error');
      throw err;
    }
  };

  const togglePaymentMethodStatus = async (id: string, isActive: boolean) => {
    try {
      await paymentMethodService.togglePaymentMethodStatus(id, isActive);
      setPaymentMethods(prev => prev.map(m => m.id === id ? { ...m, isActive } : m));
      addToast(`Payment method ${isActive ? 'activated' : 'deactivated'}`, 'info');
    } catch (err: any) {
      addToast(`Failed to update status: ${err.message}`, 'error');
      throw err;
    }
  };

  const deletePaymentMethod = async (id: string) => {
    try {
      await paymentMethodService.deletePaymentMethod(id);
      setPaymentMethods(prev => prev.filter(m => m.id !== id));
      addToast('Payment method removed', 'success');
    } catch (err: any) {
      addToast(`Failed to delete payment method: ${err.message}`, 'error');
      throw err;
    }
  };

  const submitCustomerPayment = async (params: {
    invoiceId: string;
    paymentMethodType: 'upi' | 'bank_transfer' | 'other';
    transactionReference: string;
    amount: number;
    paymentMethodId?: string;
    transactionDate?: string;
    receiptUrl?: string;
    notes?: string;
  }) => {
    try {
      const result = await paymentMethodService.submitCustomerPayment(params);
      addToast(result.message || 'Payment submission received for verification!', 'success');
      const subs = await paymentMethodService.fetchPaymentSubmissions({
        customerId: currentRetailer?.id || currentUser?.customerId,
      });
      setPaymentSubmissions(subs);
      return result;
    } catch (err: any) {
      addToast(`Payment submission failed: ${err.message}`, 'error');
      throw err;
    }
  };

  const verifyAndAccountSubmission = async (submissionId: string, notes?: string) => {
    try {
      const result = await paymentMethodService.verifyAndAccountSubmission(submissionId, notes);
      addToast(`Payment ${result.payment_number} verified and accounted successfully!`, 'success');
      await refreshData();
      return result;
    } catch (err: any) {
      addToast(`Verification failed: ${err.message}`, 'error');
      throw err;
    }
  };

  const rejectPaymentSubmission = async (submissionId: string, reason: string) => {
    try {
      const result = await paymentMethodService.rejectSubmission(submissionId, reason);
      addToast('Payment submission marked as rejected', 'info');
      await loadPaymentSubmissions();
      return result;
    } catch (err: any) {
      addToast(`Rejection failed: ${err.message}`, 'error');
      throw err;
    }
  };

  const markDirectPaymentAccounted = async (paymentId: string) => {
    try {
      await paymentService.markPaymentAccounted(paymentId);
      addToast('Payment marked as accounted successfully!', 'success');
      await refreshData();
    } catch (err: any) {
      addToast(`Failed to mark payment as accounted: ${err.message}`, 'error');
      throw err;
    }
  };

  const rejectDirectPayment = async (paymentId: string, reason: string) => {
    try {
      await paymentService.rejectPayment(paymentId, reason);
      addToast('Payment marked as rejected/voided', 'info');
      await refreshData();
    } catch (err: any) {
      addToast(`Failed to reject payment: ${err.message}`, 'error');
      throw err;
    }
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
        productExpiryRules,
        staffStockExpiry,
        customerExpiryTracking,
        rawMaterials,
        rawMaterialMovements,
        users,
        rolePermissions,
        categories,
        salesChannels,
        channelPrices,
        skuChannelPrices,

        cart,
        cartCount,
        cartTotal,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        placeOrder,
        reorder,

        addCategory,
        updateCategory,
        deleteCategory,
        toggleCategoryActive,
        addSalesChannel,
        updateSalesChannel,
        deleteSalesChannel,
        toggleSalesChannelActive,
        saveChannelPrice,
        saveMultipleChannelPrices,
        refreshPricingData,

        createParentProduct,
        updateParentProduct,
        toggleParentProductActive,
        deleteParentProduct,

        createSku,
        updateSku,
        toggleSkuActive,
        deleteSku,

        saveSkuChannelPrice,
        saveMultipleSkuChannelPrices,

        addProduct,
        createProductionBatch,
        createInvoice,
        recordPayment,
        recordCustomerPaymentWithAllocations,
        addExpense,
        addRawMaterialStock,
        addRawMaterialPurchase,
        recordRawMaterialUsage,
        updateUserStatus,
        updateUserRole,
        updateEmployee,
        deleteEmployee,
        saveRolePermissions,
        registerRetailer,
        updateOrderStatus,
        confirmOrder,
        dispatchOrder,
        bulkConfirmOrders,
        bulkDispatchOrders,
        markInvoiceDelivered,
        bulkDeliverInvoices,
        allocateInvoicePayment,
        confirmInvoicePayment,
        bulkConfirmInvoicePayments,
        createInternalOrder,
        editOrder,
        orderToEdit,
        setOrderToEdit,
        navigateToCreateOrder,
        toggleExpiryRule,
        updateProductExpiryRule,
        toggleProductExpiryRule,
        evaluateExpiryRisk,
        sendManualWebsiteNotification,
        refreshExpiryData,
        markNotificationRead,
        markAllNotificationsRead,

        // Payment Details & Customer Verification Submissions
        paymentMethods,
        paymentSubmissions,
        loadPaymentMethods,
        loadPaymentSubmissions,
        createPaymentMethod,
        updatePaymentMethod,
        togglePaymentMethodStatus,
        deletePaymentMethod,
        submitCustomerPayment,
        verifyAndAccountSubmission,
        rejectPaymentSubmission,
        markDirectPaymentAccounted,
        rejectDirectPayment,

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
