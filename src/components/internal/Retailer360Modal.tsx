import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Modal } from '../common/Modal';
import { StatusBadge } from '../common/StatusBadge';
import {
  Users,
  Store,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  Clock,
  AlertTriangle,
  Receipt,
  BookOpen,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

interface Retailer360ModalProps {
  retailerId: string | null;
  onClose: () => void;
  onOpenRecordPayment?: () => void;
}

export const Retailer360Modal: React.FC<Retailer360ModalProps> = ({
  retailerId,
  onClose,
  onOpenRecordPayment,
}) => {
  const {
    retailers,
    orders,
    invoices,
    payments,
    ledger,
    expiryAlerts,
    batches
  } = useDairy();

  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'invoices' | 'payments' | 'ledger' | 'expiry' | 'profile'>('overview');

  if (!retailerId) return null;

  const retailer = retailers.find(r => r.id === retailerId);
  if (!retailer) return null;

  const retailerOrders = orders.filter(o => o.retailerId === retailer.id);
  const retailerInvoices = invoices.filter(i => i.retailerId === retailer.id);
  const retailerPayments = payments.filter(p => p.retailerId === retailer.id);
  const retailerLedger = ledger.filter(l => l.retailerId === retailer.id);
  const retailerExpiry = expiryAlerts.filter(a => a.retailerId === retailer.id);

  const totalPurchases = retailerInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0) + 450000; // adding historical baseline

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Retailer 360° View: ${retailer.businessName}`}
      subtitle={`Owner: ${retailer.ownerName} • ${retailer.area} • Channel: ${retailer.salesChannelName || 'Wholesale'} • Mobile: +91 ${retailer.mobile}`}
      maxWidth="5xl"
    >
      <div className="space-y-4 text-xs">
        {/* Top Summary Ribbon */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Outstanding</span>
            <span className="text-base font-bold text-rose-600 font-mono-numbers">
              ₹{retailer.outstandingAmount.toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Purchases</span>
            <span className="text-base font-bold text-slate-900 font-mono-numbers">
              ₹{totalPurchases.toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Credit Limit</span>
            <span className="text-base font-bold text-slate-800 font-mono-numbers">
              ₹{retailer.creditLimit.toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Last Order Date</span>
            <span className="text-base font-bold text-slate-900">
              {retailer.lastOrderDate || '10 Sep 2026'}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'orders', label: `Orders (${retailerOrders.length})` },
            { id: 'invoices', label: `Invoices (${retailerInvoices.length})` },
            { id: 'payments', label: `Payments (${retailerPayments.length})` },
            { id: 'ledger', label: 'Customer Ledger' },
            { id: 'expiry', label: `Expiry Stock (${retailerExpiry.length})` },
            { id: 'profile', label: 'Business Profile' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white border-t-2 border-blue-600 text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="min-h-[280px]">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                  Credit & Account Health
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Credit Limit:</span>
                    <span className="font-mono-numbers font-bold">₹{retailer.creditLimit.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Outstanding Balance:</span>
                    <span className="font-mono-numbers font-bold text-rose-600">₹{retailer.outstandingAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Available Credit:</span>
                    <span className="font-mono-numbers font-bold text-green-600">
                      ₹{(retailer.creditLimit - retailer.outstandingAmount).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Terms:</span>
                    <span className="font-semibold text-slate-800">{retailer.paymentTerms}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex gap-2">

                  {onOpenRecordPayment && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenRecordPayment();
                      }}
                      className="flex-1 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-center shadow-sm transition-colors"
                    >
                      + Record Payment
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                  Recent Activity & Expiry Alerts
                </h4>
                {retailerExpiry.length > 0 ? (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>{retailerExpiry.length} Products Nearing Expiry at this Retailer</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Batch tracking indicates {retailerExpiry[0].productName} (Batch {retailerExpiry[0].batchNumber}) has only {retailerExpiry[0].daysRemaining} days left.
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500">No active expiry risks reported for this retailer.</p>
                )}

                <div className="pt-2 text-xs space-y-1 text-slate-600">
                  <p>Registered GSTIN: <strong className="font-mono-numbers text-slate-800">{retailer.gstin}</strong></p>
                  <p>Delivery Route: <strong>West Pune Route #3 (Morning 07:00 AM)</strong></p>
                </div>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Order ID</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Items</th>
                    <th className="p-2.5 text-right">Amount (₹)</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {retailerOrders.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono-numbers font-bold text-slate-900">{o.orderNumber}</td>
                      <td className="p-2.5 text-slate-600">{o.orderDate}</td>
                      <td className="p-2.5 text-slate-700">{o.items.length} items ({o.items.map(i => i.productName).join(', ')})</td>
                      <td className="p-2.5 text-right font-mono-numbers font-bold">₹{o.totalAmount.toLocaleString('en-IN')}</td>
                      <td className="p-2.5"><StatusBadge status={o.status} type="order" size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Invoice #</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Due Date</th>
                    <th className="p-2.5 text-right">Total (₹)</th>
                    <th className="p-2.5 text-right">Outstanding (₹)</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {retailerInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="p-2.5 text-slate-600 font-sans">{inv.date}</td>
                      <td className="p-2.5 text-slate-600 font-sans">{inv.dueDate}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">₹{inv.totalAmount.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 text-right font-bold text-rose-600">₹{inv.outstandingAmount.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 font-sans"><StatusBadge status={inv.status} type="invoice" size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Receipt #</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Against Inv</th>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5">Reference</th>
                    <th className="p-2.5 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {retailerPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono-numbers font-bold text-slate-900">{p.paymentNumber}</td>
                      <td className="p-2.5 text-slate-600">{p.date}</td>
                      <td className="p-2.5 font-mono-numbers">{p.invoiceNumber}</td>
                      <td className="p-2.5 uppercase font-semibold text-slate-700">{p.paymentMethod}</td>
                      <td className="p-2.5 text-slate-500 font-mono-numbers text-[11px]">{p.reference}</td>
                      <td className="p-2.5 text-right font-mono-numbers font-bold text-green-600">₹{p.amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Customer Ledger Tab */}
          {activeTab === 'ledger' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800">Current Closing Ledger Balance:</span>
                <span className="font-mono-numbers font-extrabold text-base text-rose-600">
                  ₹{retailer.outstandingAmount.toLocaleString('en-IN')} (Dr)
                </span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Particulars</th>
                      <th className="p-2.5 text-right">Debit (₹)</th>
                      <th className="p-2.5 text-right">Credit (₹)</th>
                      <th className="p-2.5 text-right">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono-numbers">
                    {retailerLedger.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-sans text-slate-600">{entry.date}</td>
                        <td className="p-2.5 font-sans font-medium text-slate-900">{entry.particular}</td>
                        <td className="p-2.5 text-right font-bold text-rose-600">
                          {entry.debit ? `₹${entry.debit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="p-2.5 text-right font-bold text-green-600">
                          {entry.credit ? `₹${entry.credit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
                          ₹{entry.balance.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expiry Stock Tab */}
          {activeTab === 'expiry' && (
            <div className="space-y-3">
              <p className="text-slate-600">
                Active batches currently stocked at <strong>{retailer.businessName}</strong> tracked by delivery invoice:
              </p>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Product</th>
                      <th className="p-2.5">Batch Code</th>
                      <th className="p-2.5 text-right">Units Held</th>
                      <th className="p-2.5">Expiry Date</th>
                      <th className="p-2.5">Remaining</th>
                      <th className="p-2.5">Urgency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {retailerExpiry.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{exp.productName}</td>
                        <td className="p-2.5 font-mono-numbers font-semibold text-blue-700">{exp.batchNumber}</td>
                        <td className="p-2.5 text-right font-mono-numbers font-bold">{exp.quantity}</td>
                        <td className="p-2.5 text-slate-600">{exp.expiryDate}</td>
                        <td className="p-2.5 font-mono-numbers font-bold text-amber-700">{exp.daysRemaining} days</td>
                        <td className="p-2.5"><StatusBadge status={exp.severity} type="expiry" size="sm" /></td>
                      </tr>
                    ))}
                    {retailerExpiry.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400">
                          No approaching expiry alerts for this retailer. All items fresh.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                Full Retailer Registration Record
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Business Name</span>
                  <p className="font-bold text-slate-900 text-sm">{retailer.businessName}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Proprietor / Contact</span>
                  <p className="font-semibold text-slate-800">{retailer.ownerName}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Phone</span>
                  <p className="font-mono-numbers font-semibold">+91 {retailer.mobile}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Email</span>
                  <p className="text-slate-700">{retailer.email || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Sales Channel</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mt-0.5">
                    {retailer.salesChannelName || 'Wholesale'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 block uppercase">Delivery / Billing Address</span>
                  <p className="text-slate-700">{retailer.address}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
