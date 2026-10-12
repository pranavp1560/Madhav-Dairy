import React, { useState, useMemo } from 'react';
import { useDairy } from '../../context/DairyContext';
import { MultiSelectFilter, MultiSelectOption } from './MultiSelectFilter';
import {
  BarChart3,
  Download,
  Printer,
  TrendingUp,
  Calendar,
  Filter,
  Search,
  X,
  MapPin,
  User,
  Package,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  FileText,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Truck
} from 'lucide-react';
import {
  Batch,
  Order,
  Invoice,
  Payment,
  Expense,
  Retailer,
  ExpiryAlertItem,
  Product,
  StockMovement
} from '../../types/dairy';

type ReportTab =
  | 'sales'
  | 'production'
  | 'inventory'
  | 'movements'
  | 'collections'
  | 'outstanding'
  | 'expenses'
  | 'expiry';

type DatePeriod = 'all' | 'today' | '30days' | 'month' | 'fy';

export const ReportsView: React.FC = () => {
  const {
    batches,
    orders,
    invoices,
    payments,
    expenses,
    retailers,
    expiryAlerts,
    products,
    stockMovements,
    addToast
  } = useDairy();

  const [activeReport, setActiveReport] = useState<ReportTab>('sales');

  // ---------------------------------------------------------------------------
  // FILTER STATES (MULTI-SELECT SUPPORTED)
  // ---------------------------------------------------------------------------
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [datePeriod, setDatePeriod] = useState<DatePeriod>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ---------------------------------------------------------------------------
  // DYNAMIC DROPDOWN OPTIONS DERIVED FROM SYSTEM DATA
  // ---------------------------------------------------------------------------
  const uniqueAreas = useMemo(() => {
    const areas = new Set<string>();
    retailers.forEach(r => {
      if (r.area && r.area.trim()) areas.add(r.area.trim());
    });
    return Array.from(areas).sort();
  }, [retailers]);

  const uniqueProductNames = useMemo(() => {
    const names = new Set<string>();
    products.forEach(p => {
      if (p.name && p.name.trim()) names.add(p.name.trim());
    });
    batches.forEach(b => {
      if (b.productName && b.productName.trim()) names.add(b.productName.trim());
    });
    return Array.from(names).sort();
  }, [products, batches]);

  const sortedRetailers = useMemo(() => {
    return [...retailers].sort((a, b) => a.businessName.localeCompare(b.businessName));
  }, [retailers]);

  // Options formatted for MultiSelectFilter
  const customerOptions: MultiSelectOption[] = useMemo(() => {
    return sortedRetailers.map(r => ({
      value: r.id,
      label: r.businessName,
      sublabel: r.area ? `${r.area}` : r.address || undefined
    }));
  }, [sortedRetailers]);

  const areaOptions: MultiSelectOption[] = useMemo(() => {
    return uniqueAreas.map(area => ({
      value: area,
      label: area
    }));
  }, [uniqueAreas]);

  const productOptions: MultiSelectOption[] = useMemo(() => {
    return uniqueProductNames.map(pName => ({
      value: pName,
      label: pName
    }));
  }, [uniqueProductNames]);

  const hasActiveFilters =
    selectedCustomerIds.length > 0 ||
    selectedAreas.length > 0 ||
    selectedProducts.length > 0 ||
    datePeriod !== 'all' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedCustomerIds([]);
    setSelectedAreas([]);
    setSelectedProducts([]);
    setDatePeriod('all');
    setSearchQuery('');
    addToast('Filters reset to default', 'info');
  };

  // Helper date checker
  const isDateInPeriod = (dateStr?: string) => {
    if (!dateStr || datePeriod === 'all') return true;
    const itemDate = new Date(dateStr);
    const itemTime = itemDate.getTime();
    const now = new Date();

    if (datePeriod === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      return dateStr.startsWith(todayStr);
    }
    if (datePeriod === '30days') {
      const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      return itemTime >= thirtyDaysAgo;
    }
    if (datePeriod === 'month') {
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }
    if (datePeriod === 'fy') {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const fyStartTime = new Date(fyStartYear, 3, 1).getTime();
      return itemTime >= fyStartTime;
    }
    return true;
  };

  // ---------------------------------------------------------------------------
  // FILTERED DATASETS
  // ---------------------------------------------------------------------------

  // 1. Sales Report (Invoices)
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Customer multi-select filter
      if (selectedCustomerIds.length > 0) {
        if (!selectedCustomerIds.includes(inv.retailerId) && !selectedCustomerIds.includes(inv.retailerName)) {
          return false;
        }
      }

      // Address / Area multi-select filter
      if (selectedAreas.length > 0) {
        const retailer = retailers.find(r => r.id === inv.retailerId || r.businessName === inv.retailerName);
        const areaStr = (retailer?.area || '').toLowerCase();
        const addrStr = (retailer?.address || inv.retailerAddress || '').toLowerCase();
        const matchesArea = selectedAreas.some(area => {
          const target = area.toLowerCase();
          return areaStr.includes(target) || addrStr.includes(target);
        });
        if (!matchesArea) return false;
      }

      // Product multi-select filter
      if (selectedProducts.length > 0) {
        const hasProd = inv.items?.some(it =>
          selectedProducts.some(p =>
            it.productName?.toLowerCase() === p.toLowerCase() || it.productId === p
          )
        );
        if (!hasProd) return false;
      }

      // Date period
      if (!isDateInPeriod(inv.date)) return false;

      // Free text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.retailerName.toLowerCase().includes(q) ||
          inv.status.toLowerCase().includes(q) ||
          inv.items?.some(it => it.productName.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [invoices, selectedCustomerIds, selectedAreas, selectedProducts, datePeriod, searchQuery, retailers]);

  // 2. Production Report (Batches)
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      // Product multi-select filter
      if (selectedProducts.length > 0) {
        const matchesProd = selectedProducts.some(p =>
          b.productName?.toLowerCase() === p.toLowerCase() || b.productId === p
        );
        if (!matchesProd) return false;
      }

      // Date period (by productionDate)
      if (!isDateInPeriod(b.productionDate)) return false;

      // Free text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          b.batchNumber.toLowerCase().includes(q) ||
          b.productName.toLowerCase().includes(q) ||
          b.status.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [batches, selectedProducts, datePeriod, searchQuery]);

  // 3. Outstanding Dues Report (Retailers)
  const filteredOutstanding = useMemo(() => {
    return retailers.filter(r => {
      // Customer multi-select filter
      if (selectedCustomerIds.length > 0 && !selectedCustomerIds.includes(r.id) && !selectedCustomerIds.includes(r.businessName)) {
        return false;
      }

      // Address / Area multi-select filter
      if (selectedAreas.length > 0) {
        const areaStr = (r.area || '').toLowerCase();
        const addrStr = (r.address || '').toLowerCase();
        const matchesArea = selectedAreas.some(area => {
          const target = area.toLowerCase();
          return areaStr.includes(target) || addrStr.includes(target);
        });
        if (!matchesArea) return false;
      }

      // Product multi-select filter: check if customer has purchased any of the selected products
      if (selectedProducts.length > 0) {
        const hasPurchased = invoices.some(
          inv =>
            (inv.retailerId === r.id || inv.retailerName === r.businessName) &&
            inv.items?.some(it =>
              selectedProducts.some(p => it.productName?.toLowerCase() === p.toLowerCase() || it.productId === p)
            )
        );
        if (!hasPurchased) return false;
      }

      // Free text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          r.businessName.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          (r.area && r.area.toLowerCase().includes(q)) ||
          (r.mobile && r.mobile.includes(q)) ||
          (r.gstin && r.gstin.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [retailers, selectedCustomerIds, selectedAreas, selectedProducts, searchQuery, invoices]);

  // 4. Payment Collections Report (Payments)
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Customer multi-select filter
      if (selectedCustomerIds.length > 0) {
        if (!selectedCustomerIds.includes(p.retailerId) && !selectedCustomerIds.includes(p.retailerName)) {
          return false;
        }
      }

      // Area multi-select filter
      if (selectedAreas.length > 0) {
        const retailer = retailers.find(r => r.id === p.retailerId || r.businessName === p.retailerName);
        const target = selectedAreas.map(a => a.toLowerCase());
        const areaStr = (retailer?.area || '').toLowerCase();
        const addrStr = (retailer?.address || '').toLowerCase();
        const matchesArea = target.some(t => areaStr.includes(t) || addrStr.includes(t));
        if (!matchesArea) return false;
      }

      // Product multi-select filter
      if (selectedProducts.length > 0) {
        const linkedInv = invoices.find(inv => inv.invoiceNumber === p.invoiceNumber);
        if (linkedInv) {
          const hasProd = linkedInv.items?.some(it =>
            selectedProducts.some(prod => it.productName?.toLowerCase() === prod.toLowerCase() || it.productId === prod)
          );
          if (!hasProd) return false;
        }
      }

      // Date period
      if (!isDateInPeriod(p.date)) return false;

      // Free text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          p.paymentNumber.toLowerCase().includes(q) ||
          p.retailerName.toLowerCase().includes(q) ||
          p.invoiceNumber.toLowerCase().includes(q) ||
          p.reference.toLowerCase().includes(q) ||
          p.paymentMethod.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [payments, selectedCustomerIds, selectedAreas, selectedProducts, datePeriod, searchQuery, retailers, invoices]);

  // 5. Expiry & Wastage Report (Alerts)
  const filteredExpiry = useMemo(() => {
    return expiryAlerts.filter(a => {
      // Product multi-select filter
      if (selectedProducts.length > 0) {
        const matchesProd = selectedProducts.some(p => a.productName?.toLowerCase() === p.toLowerCase());
        if (!matchesProd) return false;
      }

      // Customer multi-select filter
      if (selectedCustomerIds.length > 0) {
        if (a.retailerName) {
          const matched = retailers.find(r => selectedCustomerIds.includes(r.id) || selectedCustomerIds.includes(r.businessName));
          if (!matched || a.retailerName !== matched.businessName) return false;
        }
      }

      // Area multi-select filter
      if (selectedAreas.length > 0 && a.retailerName) {
        const matched = retailers.find(r => r.businessName === a.retailerName);
        const areaStr = (matched?.area || '').toLowerCase();
        const addrStr = (matched?.address || '').toLowerCase();
        const matchesArea = selectedAreas.some(area => {
          const target = area.toLowerCase();
          return areaStr.includes(target) || addrStr.includes(target);
        });
        if (!matchesArea) return false;
      }

      // Free text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          a.batchNumber.toLowerCase().includes(q) ||
          a.productName.toLowerCase().includes(q) ||
          (a.retailerName && a.retailerName.toLowerCase().includes(q)) ||
          a.severity.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [expiryAlerts, selectedProducts, selectedCustomerIds, selectedAreas, searchQuery, retailers]);

  // 6. Stock Movements Report
  const filteredMovements = useMemo(() => {
    return stockMovements.filter(m => {
      // Product multi-select filter
      if (selectedProducts.length > 0) {
        const matchesProd = selectedProducts.some(p =>
          m.productName?.toLowerCase() === p.toLowerCase() || m.productId === p
        );
        if (!matchesProd) return false;
      }

      // Area / Location multi-select filter
      if (selectedAreas.length > 0) {
        const fromStr = (m.fromLocation || '').toLowerCase();
        const toStr = (m.toLocation || '').toLowerCase();
        const matchesArea = selectedAreas.some(area => {
          const target = area.toLowerCase();
          return fromStr.includes(target) || toStr.includes(target);
        });
        if (!matchesArea) return false;
      }

      // Date period
      if (!isDateInPeriod(m.date)) return false;

      // Free text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          m.productName.toLowerCase().includes(q) ||
          m.batchNumber.toLowerCase().includes(q) ||
          m.type.toLowerCase().includes(q) ||
          m.fromLocation.toLowerCase().includes(q) ||
          m.toLocation.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [stockMovements, selectedProducts, selectedAreas, datePeriod, searchQuery]);

  // 7. Inventory Stock (Derived from batches)
  const filteredInventory = useMemo(() => {
    return filteredBatches;
  }, [filteredBatches]);

  // 8. Expense Analysis Report
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (!isDateInPeriod(exp.date)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          (exp.referenceNumber || exp.id).toLowerCase().includes(q) ||
          exp.category.toLowerCase().includes(q) ||
          (exp.paidTo || '').toLowerCase().includes(q) ||
          (exp.description || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [expenses, datePeriod, searchQuery]);

  // ---------------------------------------------------------------------------
  // EXPORT CSV HANDLER (DOWLOADS AUTHENTIC FILTERED DATASET)
  // ---------------------------------------------------------------------------
  const handleExportCSV = () => {
    const nowStr = new Date().toLocaleString('en-IN');
    const customerLabel = selectedCustomerIds.length === 0
      ? 'All Customers'
      : selectedCustomerIds
          .map(cid => retailers.find(r => r.id === cid)?.businessName || cid)
          .join('; ');
    const areaLabel = selectedAreas.length === 0
      ? 'All Areas / Addresses'
      : selectedAreas.join('; ');
    const productLabel = selectedProducts.length === 0
      ? 'All Products'
      : selectedProducts.join('; ');
    const periodLabels: Record<DatePeriod, string> = {
      all: 'Complete History',
      today: 'Today',
      '30days': 'Last 30 Days',
      month: 'This Month',
      fy: 'Current Financial Year',
    };

    let csv = `MADHAV DAIRY PRIVATE LIMITED - MANAGEMENT INFORMATION SYSTEM (MIS)\n`;
    csv += `Official Audit Report: ${activeReport.toUpperCase()}\n`;
    csv += `Generated On: "${nowStr}"\n`;
    csv += `Filters Applied: Customer="${customerLabel}", Area="${areaLabel}", Product="${productLabel}", Period="${periodLabels[datePeriod]}"\n\n`;

    if (activeReport === 'sales') {
      csv += `Invoice No,Retailer Name,Date,Due Date,Taxable Amount (INR),GST Tax (INR),Total Amount (INR),Status\n`;
      filteredInvoices.forEach(inv => {
        csv += `"${inv.invoiceNumber}","${inv.retailerName}","${inv.date}","${inv.dueDate}",${inv.subtotal},${inv.taxAmount},${inv.totalAmount},"${inv.status}"\n`;
      });
      csv += `\nTotal Invoices,${filteredInvoices.length}\n`;
      csv += `Total Billed Revenue (INR),${filteredInvoices.reduce((s, i) => s + i.totalAmount, 0)}\n`;
    } else if (activeReport === 'production') {
      csv += `Batch No,Product Name,Production Date,Expiry Date,Produced Qty,Sold Qty,Available Qty,Status\n`;
      filteredBatches.forEach(b => {
        csv += `"${b.batchNumber}","${b.productName}","${b.productionDate}","${b.expiryDate}",${b.producedQty},${b.soldQty},${b.availableQty},"${b.status}"\n`;
      });
      csv += `\nTotal Batches,${filteredBatches.length}\n`;
      csv += `Total Volume Produced,${filteredBatches.reduce((s, b) => s + b.producedQty, 0)}\n`;
    } else if (activeReport === 'outstanding') {
      csv += `Customer / Retailer,Owner Name,Area,Address,Mobile,Credit Limit (INR),Outstanding Dues (INR),Utilization (%),Payment Terms\n`;
      filteredOutstanding.forEach(r => {
        const util = Math.round((r.outstandingAmount / (r.creditLimit || 1)) * 100);
        csv += `"${r.businessName}","${r.ownerName}","${r.area || ''}","${r.address || ''}","+91 ${r.mobile}",${r.creditLimit},${r.outstandingAmount},${util}%,"${r.paymentTerms || ''}"\n`;
      });
      csv += `\nTotal Accounts,${filteredOutstanding.length}\n`;
      csv += `Total Receivables (INR),${filteredOutstanding.reduce((s, r) => s + r.outstandingAmount, 0)}\n`;
    } else if (activeReport === 'collections') {
      csv += `Receipt No,Payment Date,Retailer Name,Linked Invoice No,Amount (INR),Payment Method,Reference / UTR,Accounted\n`;
      filteredPayments.forEach(p => {
        csv += `"${p.paymentNumber}","${p.date}","${p.retailerName}","${p.invoiceNumber}",${p.amount},"${p.paymentMethod}","${p.reference || ''}","${p.isAccounted ? 'Yes' : 'No'}"\n`;
      });
      csv += `\nTotal Collections Count,${filteredPayments.length}\n`;
      csv += `Total Collected (INR),${filteredPayments.reduce((s, p) => s + p.amount, 0)}\n`;
    } else if (activeReport === 'expiry') {
      csv += `Batch Code,Product Name,Location / Retailer,Stock Quantity,Expiry Date,Days Remaining,Severity Status\n`;
      filteredExpiry.forEach(a => {
        csv += `"${a.batchNumber}","${a.productName}","${a.retailerName || 'Central Warehouse'}",${a.quantity},"${a.expiryDate}",${a.daysRemaining},"${a.severity}"\n`;
      });
      csv += `\nTotal Flagged Batches,${filteredExpiry.length}\n`;
      csv += `Total At-Risk Units,${filteredExpiry.reduce((s, a) => s + a.quantity, 0)}\n`;
    } else if (activeReport === 'movements') {
      csv += `Date,Time,Product Name,Batch Code,Movement Type,Quantity,From Location,To Location\n`;
      filteredMovements.forEach(m => {
        csv += `"${m.date}","${m.time}","${m.productName}","${m.batchNumber}","${m.type}",${m.quantity},"${m.fromLocation}","${m.toLocation}"\n`;
      });
      csv += `\nTotal Movement Records,${filteredMovements.length}\n`;
    } else if (activeReport === 'inventory') {
      csv += `Batch No,Product Name,Produced Date,Expiry Date,Initial Stock,Sold Out,Available Stock,Status\n`;
      filteredInventory.forEach(b => {
        csv += `"${b.batchNumber}","${b.productName}","${b.productionDate}","${b.expiryDate}",${b.producedQty},${b.soldQty},${b.availableQty},"${b.status}"\n`;
      });
      csv += `\nTotal Active Stock Units,${filteredInventory.reduce((s, b) => s + b.availableQty, 0)}\n`;
    } else if (activeReport === 'expenses') {
      csv += `Reference No,Date,Category,Amount (INR),Paid To / Vendor,Payment Method,Description\n`;
      filteredExpenses.forEach(exp => {
        csv += `"${exp.referenceNumber || exp.id}","${exp.date}","${exp.category}",${exp.amount},"${exp.paidTo || ''}","${exp.paymentMethod}","${exp.description || ''}"\n`;
      });
      csv += `\nTotal Expenses (INR),${filteredExpenses.reduce((s, e) => s + e.amount, 0)}\n`;
    }

    // Trigger browser download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `madhav_dairy_${activeReport}_report_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast(`${activeReport.toUpperCase()} report exported with applied filters`, 'success');
  };

  const handlePrint = () => {
    window.print();
    addToast('Opening print dialog for report...', 'info');
  };

  return (
    <div className="space-y-5 font-sans">
      {/* 1. Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <span>Management Information System (MIS)</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-1">
            Business Intelligence & Filterable Audit Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Filter and inspect operational reports by Customer, Address/Area, Products, and Date Period with real CSV exports.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Print or save as PDF"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            title="Export filtered report as CSV spreadsheet"
          >
            <Download className="w-4 h-4" />
            <span>Export Filtered Report (CSV)</span>
          </button>
        </div>
      </div>

      {/* 2. Universal Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Filter Report Records</span>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Filters Active
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Customer Name Multi-Select */}
          <MultiSelectFilter
            label="Customer Name"
            icon={<User className="w-3 h-3 text-slate-500" />}
            options={customerOptions}
            selectedValues={selectedCustomerIds}
            onChange={setSelectedCustomerIds}
            placeholder="All Customers"
          />

          {/* Address / Area Multi-Select */}
          <MultiSelectFilter
            label="Address / Area"
            icon={<MapPin className="w-3 h-3 text-slate-500" />}
            options={areaOptions}
            selectedValues={selectedAreas}
            onChange={setSelectedAreas}
            placeholder="All Areas"
          />

          {/* Product Multi-Select */}
          <MultiSelectFilter
            label="Product"
            icon={<Package className="w-3 h-3 text-slate-500" />}
            options={productOptions}
            selectedValues={selectedProducts}
            onChange={setSelectedProducts}
            placeholder="All Products"
          />

          {/* Date Period Filter */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>Date Period</span>
            </label>
            <select
              value={datePeriod}
              onChange={e => setDatePeriod(e.target.value as DatePeriod)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none transition-all cursor-pointer font-medium"
            >
              <option value="all">All History</option>
              <option value="today">Today</option>
              <option value="30days">Last 30 Days</option>
              <option value="month">This Month</option>
              <option value="fy">FY 2026-27</option>
            </select>
          </div>

          {/* Search Query */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Search className="w-3 h-3 text-slate-500" />
              <span>Search Text</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search invoice, batch, doc #..."
                className="w-full pl-3 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filter Chips Strip */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-[11px]">
            <span className="font-semibold text-slate-500">Active Criteria:</span>

            {/* Customer Chips */}
            {selectedCustomerIds.map(cid => {
              const matched = retailers.find(r => r.id === cid);
              const labelName = matched ? matched.businessName : cid;
              return (
                <span
                  key={`chip-cust-${cid}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                >
                  <span>Customer: {labelName}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerIds(prev => prev.filter(id => id !== cid))}
                    className="hover:text-blue-900 p-0.5 cursor-pointer"
                    title="Remove this customer"
                  >
                    ✕
                  </button>
                </span>
              );
            })}

            {/* Area Chips */}
            {selectedAreas.map(area => (
              <span
                key={`chip-area-${area}`}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold"
              >
                <span>Area: {area}</span>
                <button
                  type="button"
                  onClick={() => setSelectedAreas(prev => prev.filter(a => a !== area))}
                  className="hover:text-indigo-900 p-0.5 cursor-pointer"
                  title="Remove this area"
                >
                  ✕
                </button>
              </span>
            ))}

            {/* Product Chips */}
            {selectedProducts.map(pName => (
              <span
                key={`chip-prod-${pName}`}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold"
              >
                <span>Product: {pName}</span>
                <button
                  type="button"
                  onClick={() => setSelectedProducts(prev => prev.filter(p => p !== pName))}
                  className="hover:text-emerald-900 p-0.5 cursor-pointer"
                  title="Remove this product"
                >
                  ✕
                </button>
              </span>
            ))}

            {/* Period Chip */}
            {datePeriod !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                <span>Period: {datePeriod}</span>
                <button
                  type="button"
                  onClick={() => setDatePeriod('all')}
                  className="hover:text-amber-900 p-0.5 cursor-pointer"
                  title="Reset date period"
                >
                  ✕
                </button>
              </span>
            )}

            {/* Search Query Chip */}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                <span>Search: "{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-slate-900 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Report Navigation Tabs */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex gap-1 overflow-x-auto pb-1 scrollbar-none text-xs">
        {[
          { id: 'sales', label: `Sales Report (${filteredInvoices.length})` },
          { id: 'production', label: `Production Output (${filteredBatches.length})` },
          { id: 'inventory', label: `Inventory Stock (${filteredInventory.length})` },
          { id: 'movements', label: `Stock Movements (${filteredMovements.length})` },
          { id: 'collections', label: `Collections (${filteredPayments.length})` },
          { id: 'outstanding', label: `Outstanding Dues (${filteredOutstanding.length})` },
          { id: 'expenses', label: `Expenses (${filteredExpenses.length})` },
          { id: 'expiry', label: `Expiry & Shrinkage (${filteredExpiry.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as ReportTab)}
            className={`px-3 py-2 rounded-lg font-bold whitespace-nowrap transition-all ${
              activeReport === tab.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Filtered Report Content Panels */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 text-xs">
        {/* =================================================================== */}
        {/* TAB 1: SALES REPORT                                                 */}
        {/* =================================================================== */}
        {activeReport === 'sales' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Retailer Sales Performance Audit</h3>
                <p className="text-slate-500">
                  Showing {filteredInvoices.length} invoices matching active criteria
                </p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-base font-bold text-slate-900 font-mono-numbers block">
                    ₹{filteredInvoices.reduce((a, b) => a + b.totalAmount, 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400">Total Filtered Billed Revenue</span>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg border border-blue-200 flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export ({filteredInvoices.length})</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[750px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Invoice #</th>
                    <th className="p-2.5">Retailer</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Products Sold</th>
                    <th className="p-2.5 text-right">Taxable (₹)</th>
                    <th className="p-2.5 text-right">GST (₹)</th>
                    <th className="p-2.5 text-right">Total (₹)</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                        No sales invoices match the selected customer, address, or product filters.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{inv.invoiceNumber}</td>
                        <td className="p-2.5 font-sans font-medium text-slate-800">
                          {inv.retailerName}
                          {inv.retailerAddress && (
                            <span className="block text-[10px] text-slate-400 truncate max-w-xs">{inv.retailerAddress}</span>
                          )}
                        </td>
                        <td className="p-2.5 font-sans text-slate-600">{inv.date}</td>
                        <td className="p-2.5 font-sans text-slate-700">
                          {inv.items?.map(it => it.productName).join(', ') || 'Dairy Products'}
                        </td>
                        <td className="p-2.5 text-right">{inv.subtotal.toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right">{inv.taxAmount.toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">₹{inv.totalAmount.toLocaleString('en-IN')}</td>
                        <td className="p-2.5 font-sans">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            inv.status === 'settled'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inv.status === 'open_payment'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: PRODUCTION OUTPUT REPORT                                     */}
        {/* =================================================================== */}
        {activeReport === 'production' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Plant Batch Output</h3>
                <p className="text-slate-500">
                  Showing {filteredBatches.length} production batches matching filters
                </p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-base font-bold text-slate-900 font-mono-numbers block">
                    {filteredBatches.reduce((a, b) => a + b.producedQty, 0).toLocaleString('en-IN')} Units
                  </span>
                  <span className="text-[10px] text-slate-400">Total Produced Volume</span>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg border border-blue-200 flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export ({filteredBatches.length})</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[750px]">
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
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                        No production batches match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-blue-700">{b.batchNumber}</td>
                        <td className="p-2.5 font-sans font-medium text-slate-900">{b.productName}</td>
                        <td className="p-2.5 font-sans text-slate-600">{b.productionDate}</td>
                        <td className="p-2.5 font-sans text-slate-700">{b.expiryDate}</td>
                        <td className="p-2.5 text-right">{b.producedQty}</td>
                        <td className="p-2.5 text-right text-slate-700">{b.soldQty}</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">{b.availableQty}</td>
                        <td className="p-2.5 font-sans capitalize">{b.status.replace('_', ' ')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: INVENTORY STOCK REPORT                                       */}
        {/* =================================================================== */}
        {activeReport === 'inventory' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Current Warehouse Stock Inventory</h3>
                <p className="text-slate-500">Live shelf inventory by product and batch traceability</p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-base font-bold text-emerald-700 font-mono-numbers block">
                    {filteredInventory.reduce((a, b) => a + b.availableQty, 0).toLocaleString('en-IN')} Units
                  </span>
                  <span className="text-[10px] text-slate-400">Total Available in Stock</span>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg border border-blue-200 flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export ({filteredInventory.length})</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[750px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Batch Code</th>
                    <th className="p-2.5">Product Name</th>
                    <th className="p-2.5">Production Date</th>
                    <th className="p-2.5">Expiry Date</th>
                    <th className="p-2.5 text-right">Produced Qty</th>
                    <th className="p-2.5 text-right">Sold Qty</th>
                    <th className="p-2.5 text-right">Available Qty</th>
                    <th className="p-2.5">Stock Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                        No inventory batches found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-blue-700">{b.batchNumber}</td>
                        <td className="p-2.5 font-sans font-medium text-slate-900">{b.productName}</td>
                        <td className="p-2.5 font-sans text-slate-600">{b.productionDate}</td>
                        <td className="p-2.5 font-sans text-slate-600">{b.expiryDate}</td>
                        <td className="p-2.5 text-right">{b.producedQty}</td>
                        <td className="p-2.5 text-right text-slate-600">{b.soldQty}</td>
                        <td className="p-2.5 text-right font-black text-emerald-700">{b.availableQty}</td>
                        <td className="p-2.5 font-sans">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            b.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {b.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: STOCK MOVEMENTS REPORT                                       */}
        {/* =================================================================== */}
        {activeReport === 'movements' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Stock Movements & Logistics Audit</h3>
                <p className="text-slate-500">
                  Showing {filteredMovements.length} warehouse movement logs
                </p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg border border-blue-200 flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export ({filteredMovements.length})</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[750px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5">Batch Code</th>
                    <th className="p-2.5">Movement Type</th>
                    <th className="p-2.5 text-right">Quantity</th>
                    <th className="p-2.5">From Location</th>
                    <th className="p-2.5">To Destination</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                        No stock movement logs found for the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-sans text-slate-600">{m.date} {m.time}</td>
                        <td className="p-2.5 font-sans font-medium text-slate-900">{m.productName}</td>
                        <td className="p-2.5 font-bold text-blue-700">{m.batchNumber}</td>
                        <td className="p-2.5 font-sans capitalize">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {m.type}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900">{m.quantity}</td>
                        <td className="p-2.5 font-sans text-slate-600">{m.fromLocation}</td>
                        <td className="p-2.5 font-sans text-slate-800 font-medium">{m.toLocation}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 5: PAYMENT COLLECTIONS REPORT                                   */}
        {/* =================================================================== */}
        {activeReport === 'collections' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Payment Collections & Receipts</h3>
                <p className="text-slate-500">
                  Showing {filteredPayments.length} collection records matching filters
                </p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-base font-bold text-emerald-700 font-mono-numbers block">
                    ₹{filteredPayments.reduce((a, b) => a + b.amount, 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400">Total Filtered Collections</span>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg border border-blue-200 flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export ({filteredPayments.length})</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[750px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Receipt #</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Retailer Customer</th>
                    <th className="p-2.5">Linked Invoice</th>
                    <th className="p-2.5 text-right">Amount (₹)</th>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5">UTR / Reference</th>
                    <th className="p-2.5">Accounting Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                        No payment collection records found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{p.paymentNumber}</td>
                        <td className="p-2.5 font-sans text-slate-600">{p.date}</td>
                        <td className="p-2.5 font-sans font-medium text-slate-900">{p.retailerName}</td>
                        <td className="p-2.5 font-sans text-blue-600 font-semibold">{p.invoiceNumber}</td>
                        <td className="p-2.5 text-right font-black text-emerald-700">₹{p.amount.toLocaleString('en-IN')}</td>
                        <td className="p-2.5 font-sans capitalize">{p.paymentMethod.replace('_', ' ')}</td>
                        <td className="p-2.5 text-slate-600">{p.reference || '—'}</td>
                        <td className="p-2.5 font-sans">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.isAccounted
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {p.isAccounted ? 'Accounted' : 'Pending Verification'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 6: OUTSTANDING DUES REPORT                                      */}
        {/* =================================================================== */}
        {activeReport === 'outstanding' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Retailer Outstanding Dues Statement</h3>
                <p className="text-slate-500">
                  Showing {filteredOutstanding.length} customer accounts matching filters
                </p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-base font-bold text-rose-600 font-mono-numbers block">
                    ₹{filteredOutstanding.reduce((a, b) => a + b.outstandingAmount, 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400">Total Filtered Receivables</span>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg border border-blue-200 flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export ({filteredOutstanding.length})</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[750px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Retailer</th>
                    <th className="p-2.5">Owner / Contact</th>
                    <th className="p-2.5">Area & Address</th>
                    <th className="p-2.5 text-right">Credit Limit (₹)</th>
                    <th className="p-2.5 text-right">Outstanding Dues (₹)</th>
                    <th className="p-2.5 text-right">Utilization</th>
                    <th className="p-2.5">Payment Terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredOutstanding.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                        No customer accounts found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOutstanding.map(r => {
                      const util = Math.round((r.outstandingAmount / (r.creditLimit || 1)) * 100);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-sans font-bold text-slate-900">{r.businessName}</td>
                          <td className="p-2.5 font-sans text-slate-700">{r.ownerName} (+91 {r.mobile})</td>
                          <td className="p-2.5 font-sans text-slate-600">
                            <span className="font-semibold text-slate-800">{r.area || 'All Areas'}</span>
                            {r.address && <span className="block text-[10px] text-slate-400 truncate max-w-xs">{r.address}</span>}
                          </td>
                          <td className="p-2.5 text-right">₹{r.creditLimit.toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-right font-bold text-rose-600">₹{r.outstandingAmount.toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-right font-semibold">{util}%</td>
                          <td className="p-2.5 font-sans">{r.paymentTerms || 'Standard'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 7: EXPENSES ANALYSIS REPORT                                     */}
        {/* =================================================================== */}
        {activeReport === 'expenses' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Plant & Operational Expense Analysis</h3>
                <p className="text-slate-500">
                  Showing {filteredExpenses.length} expense voucher records
                </p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-base font-bold text-slate-900 font-mono-numbers block">
                    ₹{filteredExpenses.reduce((a, b) => a + b.amount, 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-400">Total Filtered Operating Expenses</span>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg border border-blue-200 flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export ({filteredExpenses.length})</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[750px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Voucher #</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Paid To / Vendor</th>
                    <th className="p-2.5">Payment Method</th>
                    <th className="p-2.5 text-right">Amount (₹)</th>
                    <th className="p-2.5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                        No expenses match the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{exp.referenceNumber || exp.id}</td>
                        <td className="p-2.5 font-sans text-slate-600">{exp.date}</td>
                        <td className="p-2.5 font-sans capitalize font-semibold text-slate-700">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            {exp.category}
                          </span>
                        </td>
                        <td className="p-2.5 font-sans text-slate-800">{exp.paidTo}</td>
                        <td className="p-2.5 font-sans capitalize">{exp.paymentMethod.replace('_', ' ')}</td>
                        <td className="p-2.5 text-right font-black text-slate-900">₹{exp.amount.toLocaleString('en-IN')}</td>
                        <td className="p-2.5 font-sans text-slate-600">{exp.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 8: EXPIRY & WASTAGE REPORT                                      */}
        {/* =================================================================== */}
        {activeReport === 'expiry' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Shrinkage, Near-Expiry & Wastage Audit</h3>
                <p className="text-slate-500">
                  Showing {filteredExpiry.length} batches under surveillance
                </p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-base font-bold text-amber-700 font-mono-numbers block">
                    {filteredExpiry.reduce((a, b) => a + b.quantity, 0).toLocaleString('en-IN')} Units
                  </span>
                  <span className="text-[10px] text-slate-400">Total Units Under Surveillance</span>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg border border-blue-200 flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export ({filteredExpiry.length})</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[750px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Batch Code</th>
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5">Retailer / Location</th>
                    <th className="p-2.5 text-right">Quantity</th>
                    <th className="p-2.5">Expiry Date</th>
                    <th className="p-2.5">Days Left</th>
                    <th className="p-2.5">Severity Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredExpiry.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                        No near-expiry alerts found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredExpiry.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-blue-700">{a.batchNumber}</td>
                        <td className="p-2.5 font-sans font-medium text-slate-900">{a.productName}</td>
                        <td className="p-2.5 font-sans text-slate-700">{a.retailerName || 'Central Warehouse'}</td>
                        <td className="p-2.5 text-right font-black">{a.quantity}</td>
                        <td className="p-2.5 font-sans text-slate-600">{a.expiryDate}</td>
                        <td className="p-2.5 font-bold text-amber-800">{a.daysRemaining} days</td>
                        <td className="p-2.5 font-sans">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            a.severity === 'urgent'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {a.severity}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
