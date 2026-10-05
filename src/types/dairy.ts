export type InternalRole = 'admin' | 'production_manager' | 'accountant' | 'warehouse_manager';

export type Language = 'en' | 'mr' | 'hi';

export type ProductCategory = 
  | 'All'
  | 'Sweets & Desserts'
  | 'Fresh Milk & Curd'
  | 'Paneer & Ghee'
  | 'Beverages & Other'
  | string;

export interface CategoryItem {
  id: string;
  name: string;
  nameMr?: string;
  nameHi?: string;
  description?: string;
  isActive: boolean;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalesChannel {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  customerCount?: number;
  pricingCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductChannelPrice {
  id: string;
  productId: string;
  productName?: string;
  channelId: string;
  channelName?: string;
  channelCode?: string;
  standardPrice: number;
  minimumPrice: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SkuChannelPrice {
  id: string;
  skuId: string;
  skuCode?: string;
  variantName?: string;
  productId?: string;
  productName?: string;
  channelId: string;
  channelName?: string;
  channelCode?: string;
  standardPrice: number;
  minimumPrice: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductSku {
  id: string;
  productId?: string;
  productName?: string;
  skuCode: string;
  variantName?: string; // e.g. "500gm", "1kg", "2kg"
  packSize: string; // e.g. "500 ml", "1 Litre", "250 g"
  quantity?: number; // e.g. 500, 1, 2
  unit?: string; // e.g. "gm", "kg", "ml", "L", "pouch"
  mrp: number;
  sellingPrice?: number;
  barcode?: string;
  isDefault?: boolean;
  isActive?: boolean;
  channelPrices?: SkuChannelPrice[];
  channelCount?: number;
  pricingStatus?: 'configured' | 'partial' | 'not_configured';
}

export interface Product {
  id: string;
  name: string;
  nameMr?: string;
  nameHi?: string;
  categoryId?: string;
  category: ProductCategory;
  brand?: string;
  unit: string; // e.g. "500 ml pouch", "250g box", "1 kg tin"
  mrp?: number;
  defaultPrice: number;
  shelfLifeDays: number;
  description: string;
  isAvailable: boolean;
  isActive?: boolean;
  minStockThreshold: number;
  imageUrl?: string;
  skus: ProductSku[];
  skuCount?: number;
  channelPrices?: ProductChannelPrice[];
  channelCount?: number;
  pricingStatus?: 'configured' | 'partial' | 'not_configured';
}

export type BatchStatus = 'active' | 'near_expiry' | 'expired' | 'exhausted';

export interface BatchItem {
  id: string;
  productId: string;
  productName: string;
  packSize: string;
  producedQty: number;
  availableQty: number;
  reservedQty: number;
  soldQty: number;
  damagedQty: number;
}

export interface Batch {
  id: string;
  batchNumber: string; // e.g. "A1092026"
  productId: string;
  productName: string;
  unit: string;
  productionDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  producedQty: number;
  soldQty: number;
  returnedQty: number;
  damagedQty: number;
  availableQty: number;
  status: BatchStatus;
  notes?: string;
  items?: BatchItem[];
  rawMaterialsUsed?: { materialId: string; materialName: string; quantity: number; unit: string }[];
}

export interface Retailer {
  id: string;
  businessName: string;
  ownerName: string;
  mobile: string;
  email: string;
  address: string;
  area: string;
  gstin: string;
  creditLimit: number;
  outstandingAmount: number;
  paymentTerms: string; // e.g. "Net 15 Days"
  status: 'active' | 'inactive';
  lastOrderDate: string;
  salesChannelId?: string;
  salesChannelName?: string;
  salesChannelCode?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'dispatched' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  productName: string;
  skuId?: string;
  skuCode?: string;
  variantName?: string;
  batchNumber?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "#MD1025"
  retailerId: string;
  retailerName: string;
  retailerChannelId?: string;
  retailerChannelName?: string;
  retailerChannelCode?: string;
  orderDate: string;
  deliveryDate?: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  notes?: string;
  dispatchDate?: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  batchNumber: string;
  unit: string;
  quantity: number;
  rate: number;
  taxPercent: number;
  discount: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. "INV-1025"
  orderId?: string;
  retailerId: string;
  retailerName: string;
  retailerGstin: string;
  retailerAddress: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'paid' | 'partial' | 'unpaid';
}

export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'credit' | 'other';

export interface Payment {
  id: string;
  paymentNumber: string;
  date: string;
  retailerId: string;
  retailerName: string;
  invoiceNumber: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference: string;
  notes?: string;
  recordedBy: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  retailerId: string;
  particular: string; // e.g. "INV-1021", "Payment via UPI"
  debit?: number;
  credit?: number;
  balance: number;
  reference: string;
}

export type ExpenseCategory = 
  | 'Raw Material'
  | 'Packaging'
  | 'Transportation'
  | 'Electricity'
  | 'Salary'
  | 'Maintenance'
  | 'Fuel'
  | 'Rent'
  | 'Marketing'
  | 'Other';

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidTo: string;
  referenceNumber: string;
}

export type MovementType = 
  | 'production' 
  | 'reservation' 
  | 'release' 
  | 'sale' 
  | 'damage' 
  | 'return' 
  | 'adjustment' 
  | 'transfer' 
  | 'opening';

export interface StockMovement {
  id: string;
  date: string;
  time: string;
  type: MovementType;
  productId: string;
  productName: string;
  batchNumber: string;
  quantity: number; // positive or negative
  fromLocation: string;
  toLocation: string;
  reference: string;
  user: string;
}

export type RawMaterialMovementType = 
  | 'opening' 
  | 'purchase' 
  | 'production_consumption' 
  | 'damage' 
  | 'adjustment' 
  | 'transfer' 
  | 'return';

export interface RawMaterial {
  id: string;
  name: string;
  nameMr?: string;
  nameHi?: string;
  category: string;
  unit: string; // e.g. "Litres", "kg", "Units"
  currentStock: number;
  minStockThreshold: number;
  costPerUnit: number;
  supplier: string;
  status: 'healthy' | 'low_stock' | 'out_of_stock';
  lastRestockedDate: string;
}

export interface RawMaterialMovement {
  id: string;
  date: string;
  time: string;
  materialId: string;
  materialName: string;
  type: RawMaterialMovementType;
  quantity: number;
  unit: string;
  reference: string;
  user: string;
  notes?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: InternalRole;
  status: 'active' | 'inactive' | 'invited';
  lastLogin: string;
  department: string;
  invitedAt?: string;
}

export interface RolePermission {
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type ExpirySeverity = 'urgent' | 'soon' | 'upcoming' | 'expired';

export interface ExpiryAlertItem {
  id: string;
  batchNumber: string;
  productId: string;
  productName: string;
  retailerId?: string;
  retailerName?: string;
  location: 'warehouse' | 'retailer';
  quantity: number;
  productionDate: string;
  expiryDate: string;
  daysRemaining: number;
  severity: ExpirySeverity;
  alertStatus: 'active' | 'acknowledged' | 'resolved';
}

export interface NotificationItem {
  id: string;
  date: string; // ISO or relative
  timeGroup: 'today' | 'yesterday' | 'earlier';
  recipientType: 'customer' | 'internal';
  recipientId?: string; // retailerId if customer
  title: string;
  message: string;
  type: 'expiry' | 'order' | 'product' | 'payment';
  channel: 'in_app' | 'push' | 'whatsapp' | 'sms';
  read: boolean;
  actionUrl?: string;
}

export interface ExpiryRule {
  id: string;
  title: string;
  daysBeforeExpiry: number;
  severity: ExpirySeverity;
  target: 'customer' | 'internal' | 'both';
  channels: ('in_app' | 'push' | 'whatsapp' | 'sms')[];
  enabled: boolean;
}
