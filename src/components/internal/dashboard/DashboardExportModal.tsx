import React from 'react';
import { Download, Printer, X, FileText, CheckCircle2 } from 'lucide-react';
import { formatINR, formatCompactNumber, DateRangeBounds } from './dashboardUtils';
import { DashboardKpiData } from './DashboardKpiGrid';
import { SalesDataPoint } from './SalesTrendChart';
import { ProductProductionItem } from './ProductionByProductChart';
import { CustomerOutstandingItem } from './OutstandingPaymentsChart';

interface DashboardExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateBounds: DateRangeBounds;
  kpi: DashboardKpiData;
  salesData: SalesDataPoint[];
  productionData: ProductProductionItem[];
  customerData: CustomerOutstandingItem[];
}

export const DashboardExportModal: React.FC<DashboardExportModalProps> = ({
  isOpen,
  onClose,
  dateBounds,
  kpi,
  salesData,
  productionData,
  customerData,
}) => {
  if (!isOpen) return null;

  const handleDownloadCSV = () => {
    let csv = `Madhav Dairy ERP - Executive Dashboard Report\n`;
    csv += `Period: ${dateBounds.label} (${dateBounds.startStr} to ${dateBounds.endStr})\n`;
    csv += `Generated On: ${new Date().toLocaleString()}\n\n`;

    csv += `KEY PERFORMANCE INDICATORS\n`;
    csv += `Metric,Value\n`;
    csv += `Total Sales,${kpi.totalSales}\n`;
    csv += `Total Orders,${kpi.totalOrders}\n`;
    csv += `Pending Orders,${kpi.pendingOrdersCount}\n`;
    csv += `Dispatched Orders,${kpi.dispatchedOrdersCount}\n`;
    csv += `Total Production Quantity,${kpi.totalProductionQty}\n`;
    csv += `Batches Logged,${kpi.batchesLoggedCount}\n`;
    csv += `Low Stock Items,${kpi.lowStockItemsCount + kpi.outOfStockItemsCount}\n`;
    csv += `Expiring Batches (<=5d),${kpi.expiringBatchesCount}\n`;
    csv += `Total Outstanding Dues,${kpi.totalOutstandingAmount}\n`;
    csv += `Overdue Dues,${kpi.overdueAmount}\n\n`;

    csv += `DAILY SALES BREAKDOWN\n`;
    csv += `Date,Order Count,Revenue (INR)\n`;
    salesData.forEach(s => {
      csv += `${s.dateStr},${s.orderCount},${s.sales}\n`;
    });
    csv += `\n`;

    csv += `PRODUCTION BY PRODUCT\n`;
    csv += `Product Name,Produced Quantity,Unit,Batch Count\n`;
    productionData.forEach(p => {
      csv += `"${p.productName}",${p.producedQty},${p.unit},${p.batchCount}\n`;
    });
    csv += `\n`;

    csv += `CUSTOMER RECEIVABLES\n`;
    csv += `Customer,Outstanding Amount,Credit Limit,Overdue Amount\n`;
    customerData.forEach(c => {
      csv += `"${c.businessName}",${c.outstandingAmount},${c.creditLimit},${c.overdueAmount}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Madhav_Dairy_Report_${dateBounds.startStr}_to_${dateBounds.endStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Export Executive ERP Report
              </h3>
              <p className="text-[11px] text-slate-500">
                Period: {dateBounds.startStr} &rarr; {dateBounds.endStr} ({dateBounds.label})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Report Preview */}
        <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Executive Summary
            </span>
            <div className="grid grid-cols-2 gap-2 font-mono-numbers">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Billed:</span>
                <span className="font-bold text-slate-900">{formatINR(kpi.totalSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Orders:</span>
                <span className="font-bold text-slate-900">{kpi.totalOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Production:</span>
                <span className="font-bold text-slate-900">{formatCompactNumber(kpi.totalProductionQty)} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Receivables:</span>
                <span className="font-bold text-slate-900">{formatINR(kpi.totalOutstandingAmount)}</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-600 space-y-1">
            <p><strong>Included sections in export:</strong></p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-500 text-[10px]">
              <li>Daily sales timeline & order count ({salesData.length} records)</li>
              <li>Manufacturing volume by SKU product ({productionData.length} items)</li>
              <li>Customer receivables, credit limits, and overdue aging ({customerData.length} retailers)</li>
              <li>Active stock alerts and near-expiry batches</li>
            </ul>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>

          <button
            onClick={handleDownloadCSV}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
};
