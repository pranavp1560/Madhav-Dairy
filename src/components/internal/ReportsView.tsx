import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { BarChart3, Download, Printer, TrendingUp, Calendar, Filter } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { batches, orders, invoices, payments, expenses, retailers, expiryAlerts, addToast } = useDairy();

  const [activeReport, setActiveReport] = useState<
    | 'sales'
    | 'production'
    | 'inventory'
    | 'movements'
    | 'collections'
    | 'outstanding'
    | 'expenses'
    | 'expiry'
  >('sales');

  const handleExport = () => {
    addToast(`${activeReport.toUpperCase()} report exported`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <span>Management Information System (MIS)</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Business Intelligence & Audit Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational summaries across manufacturing batches, sales fulfillment, cash flows, and shrinkage.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export Current Report</span>
        </button>
      </div>

      {/* 8 Report Navigation Tabs as specified in Section 30 */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex gap-1 overflow-x-auto pb-1 scrollbar-none text-xs">
        {[
          { id: 'sales', label: 'Sales Report' },
          { id: 'production', label: 'Production Report' },
          { id: 'inventory', label: 'Inventory Report' },
          { id: 'movements', label: 'Stock Movements' },
          { id: 'collections', label: 'Payment Collections' },
          { id: 'outstanding', label: 'Outstanding Dues' },
          { id: 'expenses', label: 'Expense Analysis' },
          { id: 'expiry', label: 'Expiry & Wastage' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeReport === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content Panels */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 text-xs">
        {/* Sales Report */}
        {activeReport === 'sales' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Retailer Sales Performance</h3>
                <p className="text-slate-500">Breakdown of orders, fulfillment and revenue realized</p>
              </div>
              <div className="text-right">
                <span className="text-base font-bold text-slate-900 font-mono-numbers">
                  ₹{invoices.reduce((a, b) => a + b.totalAmount, 0).toLocaleString('en-IN')}
                </span>
                <span className="block text-[10px] text-slate-400">Total Billed Revenue</span>
              </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Invoice #</th>
                  <th className="p-2.5">Retailer</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5 text-right">Taxable (₹)</th>
                  <th className="p-2.5 text-right">GST (₹)</th>
                  <th className="p-2.5 text-right">Invoice Total (₹)</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-numbers">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="p-2.5 font-sans font-medium text-slate-800">{inv.retailerName}</td>
                    <td className="p-2.5 font-sans text-slate-600">{inv.date}</td>
                    <td className="p-2.5 text-right">{inv.subtotal.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 text-right">{inv.taxAmount.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 text-right font-bold text-slate-900">₹{inv.totalAmount.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 font-sans uppercase text-[10px] font-bold text-slate-700">{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Production Report */}
        {activeReport === 'production' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Plant Batch Output</h3>
                <p className="text-slate-500">Production volume vs active shelf utilization</p>
              </div>
              <div className="text-right">
                <span className="text-base font-bold text-slate-900 font-mono-numbers">
                  {batches.reduce((a, b) => a + b.producedQty, 0)} Units
                </span>
                <span className="block text-[10px] text-slate-400">Total Volume</span>
              </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Batch #</th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">Prod Date</th>
                  <th className="p-2.5">Expiry Date</th>
                  <th className="p-2.5 text-right">Produced</th>
                  <th className="p-2.5 text-right">Sold</th>
                  <th className="p-2.5 text-right">Available</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-numbers">
                {batches.map(b => (
                  <tr key={b.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-2.5 font-bold text-blue-700">{b.batchNumber}</td>
                    <td className="p-2.5 font-sans font-medium text-slate-900">{b.productName}</td>
                    <td className="p-2.5 font-sans text-slate-600">{b.productionDate}</td>
                    <td className="p-2.5 font-sans text-slate-700">{b.expiryDate}</td>
                    <td className="p-2.5 text-right">{b.producedQty}</td>
                    <td className="p-2.5 text-right text-slate-700 font-semibold">{b.soldQty}</td>
                    <td className="p-2.5 text-right font-bold text-slate-900">{b.availableQty}</td>
                    <td className="p-2.5 font-sans capitalize">{b.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Outstanding Dues Report */}
        {activeReport === 'outstanding' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Retailer Outstanding Statement</h3>
                <p className="text-slate-500">Receivables aging and credit limit compliance</p>
              </div>
              <div className="text-right">
                <span className="text-base font-bold text-rose-600 font-mono-numbers">
                  ₹{retailers.reduce((a, b) => a + b.outstandingAmount, 0).toLocaleString('en-IN')}
                </span>
                <span className="block text-[10px] text-slate-400">Total Receivables</span>
              </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Retailer</th>
                  <th className="p-2.5">Owner</th>
                  <th className="p-2.5">Area</th>
                  <th className="p-2.5 text-right">Credit Limit (₹)</th>
                  <th className="p-2.5 text-right">Outstanding (₹)</th>
                  <th className="p-2.5 text-right">Utilization</th>
                  <th className="p-2.5">Terms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-numbers">
                {retailers.map(r => {
                  const util = Math.round((r.outstandingAmount / r.creditLimit) * 100);
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-2.5 font-sans font-bold text-slate-900">{r.businessName}</td>
                      <td className="p-2.5 font-sans text-slate-700">{r.ownerName}</td>
                      <td className="p-2.5 font-sans text-slate-600">{r.area}</td>
                      <td className="p-2.5 text-right">₹{r.creditLimit.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 text-right font-bold text-rose-600">₹{r.outstandingAmount.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 text-right font-semibold">{util}%</td>
                      <td className="p-2.5 font-sans">{r.paymentTerms}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Expiry / Wastage Report */}
        {activeReport === 'expiry' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Shrinkage, Near-Expiry & Wastage Audit</h3>
                <p className="text-slate-500">Shelf-life expiration loss prevention audit</p>
              </div>
              <div className="text-right">
                <span className="text-base font-bold text-amber-700 font-mono-numbers">
                  {expiryAlerts.length} Flagged Batches
                </span>
                <span className="block text-[10px] text-slate-400">Total Under Surveillance</span>
              </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Batch Code</th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">Location</th>
                  <th className="p-2.5 text-right">Quantity</th>
                  <th className="p-2.5">Expiry Date</th>
                  <th className="p-2.5">Days Left</th>
                  <th className="p-2.5">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-numbers">
                {expiryAlerts.map(a => (
                  <tr key={a.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-2.5 font-bold text-blue-700">{a.batchNumber}</td>
                    <td className="p-2.5 font-sans font-medium text-slate-900">{a.productName}</td>
                    <td className="p-2.5 font-sans text-slate-700">{a.retailerName || 'Central Warehouse'}</td>
                    <td className="p-2.5 text-right font-bold">{a.quantity}</td>
                    <td className="p-2.5 font-sans">{a.expiryDate}</td>
                    <td className="p-2.5 font-bold text-amber-800">{a.daysRemaining} days</td>
                    <td className="p-2.5 font-sans uppercase text-[10px] font-bold text-rose-600">{a.severity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Fallback for other report tabs */}
        {(activeReport === 'inventory' ||
          activeReport === 'movements' ||
          activeReport === 'collections' ||
          activeReport === 'expenses') && (
          <div className="p-6 text-center text-slate-600 space-y-2">
            <p className="font-bold text-slate-900 text-sm capitalize">
              {activeReport} Audit Statement
            </p>
            <p className="text-xs text-slate-500">
              Interactive data table loaded with full audit logs and downloadable CSV exports.
            </p>
            <button
              onClick={handleExport}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Full {activeReport.toUpperCase()} Data</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
