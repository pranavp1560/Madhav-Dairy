import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import {
  AlertTriangle,
  Clock,
  Bell,
  Search,
  CheckCircle2,
  Sliders,
  Send,
  ShieldAlert,
  ArrowRight,
  Package,
  Store,
  RefreshCw,
  Edit2,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { ProductExpiryRule } from '../../types/dairy';
import { formatCalendarDate } from '../../utils/dateUtils';

interface ExpiryViewProps {
  onSelectBatch: (id: string) => void;
}

export const ExpiryView: React.FC<ExpiryViewProps> = ({ onSelectBatch }) => {
  const {
    productExpiryRules,
    staffStockExpiry,
    customerExpiryTracking,
    notifications,
    updateProductExpiryRule,
    toggleProductExpiryRule,
    evaluateExpiryRisk,
    sendManualWebsiteNotification,
    refreshExpiryData,
    addToast
  } = useDairy();

  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'customer' | 'rules' | 'notifications'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [rangeFilter, setRangeFilter] = useState<'all' | 'today' | '3days' | '5days' | '10days' | 'expired'>('all');
  const [isScanning, setIsScanning] = useState(false);

  // Edit Product Rule Modal State
  const [editingRule, setEditingRule] = useState<ProductExpiryRule | null>(null);
  const [ruleAlert1, setRuleAlert1] = useState<number>(10);
  const [ruleAlert2, setRuleAlert2] = useState<number>(5);
  const [ruleAlert3, setRuleAlert3] = useState<number>(3);
  const [ruleEnabled, setRuleEnabled] = useState<boolean>(true);
  const [ruleError, setRuleError] = useState<string>('');
  const [isSavingRule, setIsSavingRule] = useState<boolean>(false);

  // Dynamic Bucket calculations across staff inventory and active customer batches
  const allTrackedItems = [
    ...staffStockExpiry.map(s => ({
      ...s,
      type: 'staff' as const,
      customerName: undefined,
    })),
    ...customerExpiryTracking.map(c => ({
      batchId: c.batchId,
      batchNumber: c.batchNumber,
      productId: c.productId,
      productName: c.productName,
      locationName: `Store: ${c.customerName || 'Customer'}`,
      availableQty: c.quantityRemaining,
      productionDate: '',
      expiryDate: c.expiryDate,
      daysRemaining: c.daysRemaining,
      alertLevel: c.daysRemaining < 0 ? 'expired' : c.daysRemaining === 0 ? 'expiring_today' : c.daysRemaining <= 3 ? 'urgent' : c.daysRemaining <= 5 ? 'warning' : 'upcoming',
      status: (c.daysRemaining < 0 ? 'expired' : 'active') as any,
      type: 'customer' as const,
      customerName: c.customerName,
    })),
  ];

  const expiringToday = staffStockExpiry.filter(a => a.daysRemaining === 0);
  const expiringIn3Days = staffStockExpiry.filter(a => a.daysRemaining > 0 && a.daysRemaining <= 3);
  const expiringIn5Days = staffStockExpiry.filter(a => a.daysRemaining > 3 && a.daysRemaining <= 5);
  const expiringIn10Days = staffStockExpiry.filter(a => a.daysRemaining > 5 && a.daysRemaining <= 10);
  const alreadyExpired = staffStockExpiry.filter(a => a.daysRemaining < 0);

  // Filtered staff stock
  const filteredStaffStock = staffStockExpiry.filter(item => {
    let matchesRange = true;
    if (rangeFilter === 'today') matchesRange = item.daysRemaining === 0;
    if (rangeFilter === '3days') matchesRange = item.daysRemaining > 0 && item.daysRemaining <= 3;
    if (rangeFilter === '5days') matchesRange = item.daysRemaining > 3 && item.daysRemaining <= 5;
    if (rangeFilter === '10days') matchesRange = item.daysRemaining > 5 && item.daysRemaining <= 10;
    if (rangeFilter === 'expired') matchesRange = item.daysRemaining < 0;

    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item.productName.toLowerCase().includes(query) ||
      item.batchNumber.toLowerCase().includes(query) ||
      item.locationName.toLowerCase().includes(query);

    return matchesRange && matchesSearch;
  });

  // Filtered customer tracking
  const filteredCustomerTracking = customerExpiryTracking.filter(item => {
    let matchesRange = true;
    if (rangeFilter === 'today') matchesRange = item.daysRemaining === 0;
    if (rangeFilter === '3days') matchesRange = item.daysRemaining > 0 && item.daysRemaining <= 3;
    if (rangeFilter === '5days') matchesRange = item.daysRemaining > 3 && item.daysRemaining <= 5;
    if (rangeFilter === '10days') matchesRange = item.daysRemaining > 5 && item.daysRemaining <= 10;
    if (rangeFilter === 'expired') matchesRange = item.daysRemaining < 0;

    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item.productName.toLowerCase().includes(query) ||
      item.batchNumber.toLowerCase().includes(query) ||
      (item.customerName && item.customerName.toLowerCase().includes(query));

    return matchesRange && matchesSearch;
  });

  // Expiry notifications log
  const expiryNotifications = notifications.filter(n => n.type === 'expiry');

  const handleOpenEditRule = (rule: ProductExpiryRule) => {
    setEditingRule(rule);
    setRuleAlert1(rule.alert1Days);
    setRuleAlert2(rule.alert2Days);
    setRuleAlert3(rule.alert3Days);
    setRuleEnabled(rule.enabled);
    setRuleError('');
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    if (ruleAlert1 <= 0 || ruleAlert2 <= 0 || ruleAlert3 <= 0) {
      setRuleError('All alert thresholds must be positive integers (> 0).');
      return;
    }

    if (ruleAlert1 <= ruleAlert2 || ruleAlert2 <= ruleAlert3) {
      setRuleError('Thresholds must strictly follow: Alert 1 > Alert 2 > Alert 3 (e.g. 10 > 5 > 3).');
      return;
    }

    if (ruleAlert1 > editingRule.shelfLifeDays) {
      setRuleError(`Alert 1 (${ruleAlert1} days) cannot exceed the product shelf life (${editingRule.shelfLifeDays} days).`);
      return;
    }

    try {
      setIsSavingRule(true);
      await updateProductExpiryRule({
        productId: editingRule.productId,
        alert1Days: ruleAlert1,
        alert2Days: ruleAlert2,
        alert3Days: ruleAlert3,
        enabled: ruleEnabled,
      });
      setEditingRule(null);
    } catch (err: any) {
      setRuleError(err.message || 'Failed to update rule');
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleTriggerSurveillance = async () => {
    try {
      setIsScanning(true);
      await evaluateExpiryRisk();
    } finally {
      setIsScanning(false);
    }
  };

  const handleSendWebsiteNotification = async (item: {
    batchId: string;
    batchNumber: string;
    productName: string;
    daysRemaining: number;
    locationName?: string;
  }) => {
    await sendManualWebsiteNotification({
      batchId: item.batchId,
      batchNumber: item.batchNumber,
      productName: item.productName,
      daysRemaining: item.daysRemaining,
      locationName: item.locationName,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Madhav Dairy Cold-Chain Freshness Engine</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Expiry Management & Website Notification System
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated threshold surveillance tracking real finished-goods inventory batches and delivered customer stocks.
          </p>
        </div>

        {/* Top actions & surveillance scan */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTriggerSurveillance}
            disabled={isScanning}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
            title="Evaluate expiry thresholds across live batches and stock"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning...' : 'Run Surveillance Scan'}</span>
          </button>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'overview' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'staff' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Staff Stock ({staffStockExpiry.length})
            </button>
            <button
              onClick={() => setActiveTab('customer')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'customer' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Customer Expiry ({customerExpiryTracking.length})
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'rules' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Product Rules
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'notifications' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Website Notifications ({expiryNotifications.length})
            </button>
          </div>
        </div>
      </div>

      {/* OVERVIEW CARDS: Dynamically reflects configured rules & live stock */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        {/* Expiring Today */}
        <div
          onClick={() => setRangeFilter(rangeFilter === 'today' ? 'all' : 'today')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
            rangeFilter === 'today'
              ? 'border-rose-600 bg-rose-50/80 shadow-md ring-2 ring-rose-400/20'
              : 'border-rose-200 bg-white hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-[10px] uppercase font-bold tracking-wider">Expiring Today</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <span className="text-2xl font-black text-rose-700 font-mono-numbers mt-1 block">
            {expiringToday.length}
          </span>
          <span className="text-[10px] text-rose-800 font-medium">0 days remaining</span>
        </div>

        {/* Expiring in 3 Days */}
        <div
          onClick={() => setRangeFilter(rangeFilter === '3days' ? 'all' : '3days')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
            rangeFilter === '3days'
              ? 'border-red-500 bg-red-50/60 shadow-md ring-2 ring-red-300/20'
              : 'border-red-100 bg-white hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between text-red-600">
            <span className="text-[10px] uppercase font-bold tracking-wider">In ≤ 3 Days</span>
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <span className="text-2xl font-black text-red-600 font-mono-numbers mt-1 block">
            {expiringIn3Days.length}
          </span>
          <span className="text-[10px] text-red-700 font-medium">Urgent clearance threshold</span>
        </div>

        {/* Expiring in 5 Days */}
        <div
          onClick={() => setRangeFilter(rangeFilter === '5days' ? 'all' : '5days')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
            rangeFilter === '5days'
              ? 'border-amber-500 bg-amber-50 shadow-md ring-2 ring-amber-300/20'
              : 'border-amber-200 bg-white hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[10px] uppercase font-bold tracking-wider">In ≤ 5 Days</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <span className="text-2xl font-black text-amber-700 font-mono-numbers mt-1 block">
            {expiringIn5Days.length}
          </span>
          <span className="text-[10px] text-amber-800 font-medium">Warning warning threshold</span>
        </div>

        {/* Expiring in 10 Days */}
        <div
          onClick={() => setRangeFilter(rangeFilter === '10days' ? 'all' : '10days')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
            rangeFilter === '10days'
              ? 'border-yellow-500 bg-yellow-50 shadow-md ring-2 ring-yellow-300/20'
              : 'border-yellow-200 bg-white hover:border-yellow-300'
          }`}
        >
          <div className="flex items-center justify-between text-yellow-800">
            <span className="text-[10px] uppercase font-bold tracking-wider">In ≤ 10 Days</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <span className="text-2xl font-black text-yellow-800 font-mono-numbers mt-1 block">
            {expiringIn10Days.length}
          </span>
          <span className="text-[10px] text-yellow-900 font-medium">Early advisory threshold</span>
        </div>

        {/* Expired */}
        <div
          onClick={() => setRangeFilter(rangeFilter === 'expired' ? 'all' : 'expired')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all col-span-2 sm:col-span-1 ${
            rangeFilter === 'expired'
              ? 'border-slate-700 bg-slate-100 shadow-md'
              : 'border-slate-200 bg-white hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-[10px] uppercase font-bold tracking-wider">Expired</span>
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <span className="text-2xl font-black text-slate-900 font-mono-numbers mt-1 block">
            {alreadyExpired.length}
          </span>
          <span className="text-[10px] text-slate-600 font-medium">Locked for quality disposal</span>
        </div>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
        <div className="relative w-full max-w-sm">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search Product, Batch # or Store..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="text-xs text-slate-500">
          Range Filter: <strong className="uppercase text-slate-800">{rangeFilter}</strong> &bull; Total live stock items: <strong>{staffStockExpiry.length}</strong>
        </div>
      </div>

      {/* OVERVIEW / SURVEILLANCE RADAR TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-sky-50/20 p-4 rounded-2xl border border-blue-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-sm font-bold text-blue-950 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-blue-600" />
                <span>Automated Expiry Radar & Traceability</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Evaluates active finished goods batches against product-configured thresholds (10 / 5 / 3 default). Only batches with physical stock generate active alerts.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('staff')}
              className="text-xs font-bold text-blue-700 bg-white px-3 py-1.5 rounded-xl border border-blue-200 shadow-2xs hover:bg-blue-50 transition-colors flex items-center gap-1"
            >
              <span>View Full Staff Stock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Staff Stock Radar Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                <span>Critical Inventory Batches Approaching Expiry</span>
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {filteredStaffStock.slice(0, 5).length} batches shown
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">Batch Number</th>
                    <th className="p-3">Location</th>
                    <th className="p-3 text-right">Available Qty</th>
                    <th className="p-3">Expiry Date</th>
                    <th className="p-3">Days Remaining</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredStaffStock.slice(0, 5).map(item => (
                    <tr key={`${item.batchId}-${item.locationId}`} className="hover:bg-blue-50/20 transition-colors">
                      <td className="p-3 font-sans font-bold text-slate-900">{item.productName}</td>
                      <td className="p-3">
                        <button
                          onClick={() => onSelectBatch(item.batchNumber)}
                          className="font-bold text-blue-700 hover:underline bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-xs"
                        >
                          {item.batchNumber}
                        </button>
                      </td>
                      <td className="p-3 font-sans text-slate-700">{item.locationName}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{item.availableQty} units</td>
                      <td className="p-3 font-sans font-medium text-slate-800">{formatCalendarDate(item.expiryDate)}</td>
                      <td className="p-3 font-bold">
                        <span className={item.daysRemaining <= 0 ? 'text-rose-600' : item.daysRemaining <= 3 ? 'text-red-600' : item.daysRemaining <= 5 ? 'text-amber-600' : 'text-slate-800'}>
                          {item.daysRemaining < 0 ? 'Expired' : item.daysRemaining === 0 ? 'Expiring Today' : `${item.daysRemaining} days`}
                        </span>
                      </td>
                      <td className="p-3 font-sans">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.alertLevel === 'expired'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : item.alertLevel === 'expiring_today' || item.alertLevel === 'urgent'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : item.alertLevel === 'warning'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {item.alertLevel.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredStaffStock.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                        No warehouse inventory batches matching current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STAFF STOCK EXPIRY TAB */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Staff Inventory Batch Expiry Tracking</h3>
              <p className="text-xs text-slate-500">
                Tracking formula: <code>Batch + Product + Location + Remaining Quantity + Expiry Date</code>
              </p>
            </div>
            <span className="text-xs text-slate-600 font-semibold bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              Showing {filteredStaffStock.length} batches
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">Batch</th>
                  <th className="p-3">Location</th>
                  <th className="p-3 text-right">Available Qty</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3">Days Remaining</th>
                  <th className="p-3">Alert Level</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-numbers">
                {filteredStaffStock.map(item => (
                  <tr key={`${item.batchId}-${item.locationId}`} className="hover:bg-blue-50/20 transition-colors">
                    <td className="p-3 font-sans font-bold text-slate-900">{item.productName}</td>
                    <td className="p-3">
                      <button
                        onClick={() => onSelectBatch(item.batchNumber)}
                        className="font-bold text-blue-700 hover:underline bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-xs"
                      >
                        {item.batchNumber}
                      </button>
                    </td>
                    <td className="p-3 font-sans text-slate-700">{item.locationName}</td>
                    <td className="p-3 text-right font-bold text-slate-900">{item.availableQty} units</td>
                    <td className="p-3 font-sans font-medium text-slate-800">{formatCalendarDate(item.expiryDate)}</td>
                    <td className="p-3 font-bold">
                      <span className={item.daysRemaining <= 0 ? 'text-rose-600' : item.daysRemaining <= 3 ? 'text-red-600' : item.daysRemaining <= 5 ? 'text-amber-600' : 'text-slate-800'}>
                        {item.daysRemaining < 0 ? 'Expired' : item.daysRemaining === 0 ? 'Expiring Today' : `${item.daysRemaining} days`}
                      </span>
                    </td>
                    <td className="p-3 font-sans">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.alertLevel === 'expired'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : item.alertLevel === 'expiring_today' || item.alertLevel === 'urgent'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : item.alertLevel === 'warning'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {item.alertLevel.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 font-sans">
                      <StatusBadge status={item.status} size="sm" />
                    </td>
                    <td className="p-3 text-center font-sans">
                      <button
                        onClick={() => handleSendWebsiteNotification(item)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-lg text-[11px] font-semibold transition-colors border border-blue-200 inline-flex items-center gap-1"
                        title="Send Real Website Notification"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send Website Notification</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredStaffStock.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-sans">
                      No stock batches matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CUSTOMER EXPIRY TRACKING TAB */}
      {activeTab === 'customer' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Customer Delivered Batch Expiry Surveillance</h3>
              <p className="text-xs text-slate-500">
                Formula: <code>Customer + Product + Delivered Batch + Delivered Order + Remaining Customer Quantity + Expiry Date</code>
              </p>
            </div>
            <span className="text-xs text-slate-600 font-semibold bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              Active Store Trackers: {filteredCustomerTracking.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Customer / Store</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Batch Number</th>
                  <th className="p-3">Delivered Date</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3">Days Remaining</th>
                  <th className="p-3 text-right">Customer Qty</th>
                  <th className="p-3">Tracking Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-numbers">
                {filteredCustomerTracking.map(item => (
                  <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="p-3 font-sans">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-blue-600" />
                        <span>{item.customerName}</span>
                      </div>
                      {item.orderNumber && (
                        <span className="text-[10px] text-slate-400">Order: {item.orderNumber}</span>
                      )}
                    </td>
                    <td className="p-3 font-sans font-bold text-slate-900">{item.productName}</td>
                    <td className="p-3">
                      <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-xs">
                        {item.batchNumber}
                      </span>
                    </td>
                    <td className="p-3 font-sans text-slate-600">{formatCalendarDate(item.deliveredAt)}</td>
                    <td className="p-3 font-sans font-medium text-slate-800">{formatCalendarDate(item.expiryDate)}</td>
                    <td className="p-3 font-bold">
                      <span className={item.daysRemaining <= 0 ? 'text-rose-600' : item.daysRemaining <= 3 ? 'text-red-600' : item.daysRemaining <= 5 ? 'text-amber-600' : 'text-slate-800'}>
                        {item.daysRemaining < 0 ? 'Expired' : item.daysRemaining === 0 ? 'Expiring Today' : `${item.daysRemaining} days`}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900">{item.quantityRemaining} units</td>
                    <td className="p-3 font-sans">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.trackingStatus === 'active'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : item.trackingStatus === 'superseded'
                          ? 'bg-slate-100 text-slate-700 border border-slate-200'
                          : item.trackingStatus === 'expired'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {item.trackingStatus}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredCustomerTracking.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                      No customer product batches tracked yet. Batches are automatically registered upon Order Delivery confirmation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRODUCT ALERT RULES TAB */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Product-Specific Expiry Alert Rules</h3>
              <p className="text-xs text-slate-500">
                Default threshold policy: <code>10 / 5 / 3 days</code>. Staff can configure custom alert schedules per product.
              </p>
            </div>
            <span className="text-[11px] text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 font-semibold">
              Rule Validation: Alert 1 &gt; Alert 2 &gt; Alert 3
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3 text-right">Shelf Life</th>
                  <th className="p-3 text-center">Alert 1 (Advisory)</th>
                  <th className="p-3 text-center">Alert 2 (Warning)</th>
                  <th className="p-3 text-center">Alert 3 (Urgent)</th>
                  <th className="p-3 text-center">Enabled</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-numbers">
                {productExpiryRules.map(rule => (
                  <tr key={rule.productId} className="hover:bg-blue-50/20 transition-colors">
                    <td className="p-3 font-sans font-bold text-slate-900">{rule.productName}</td>
                    <td className="p-3 text-right font-medium text-slate-700">{rule.shelfLifeDays} days</td>
                    <td className="p-3 text-center font-bold text-blue-700 bg-blue-50/30">{rule.alert1Days} days before</td>
                    <td className="p-3 text-center font-bold text-amber-700 bg-amber-50/30">{rule.alert2Days} days before</td>
                    <td className="p-3 text-center font-bold text-rose-700 bg-rose-50/30">{rule.alert3Days} days before</td>
                    <td className="p-3 text-center font-sans">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => toggleProductExpiryRule(rule.productId)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </td>
                    <td className="p-3 text-center font-sans">
                      <button
                        onClick={() => handleOpenEditRule(rule)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-200 inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit Thresholds</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NOTIFICATION HISTORY TAB */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden text-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Dispatched Website Notifications Log</h3>
              <p className="text-xs text-slate-500">
                Authoritative record of In-App / Website notifications dispatched by the automated surveillance engine.
              </p>
            </div>
            <span className="text-xs text-slate-600 font-semibold bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              Total Notifications: {expiryNotifications.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[750px]">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Recipient Type</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Message</th>
                  <th className="p-3">Channel</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expiryNotifications.map(notif => (
                  <tr key={notif.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="p-3 text-slate-600 font-mono-numbers whitespace-nowrap">{notif.date}</td>
                    <td className="p-3 font-semibold text-slate-800">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        notif.recipientType === 'customer'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {notif.recipientType === 'customer' ? 'Customer Store' : 'Internal Staff'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-900 font-bold">{notif.title}</td>
                    <td className="p-3 text-slate-600 max-w-sm truncate">{notif.message}</td>
                    <td className="p-3">
                      <span className="uppercase text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        Website Notification
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Dispatched
                      </span>
                    </td>
                  </tr>
                ))}
                {expiryNotifications.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No website notifications have been generated yet. Notifications trigger automatically as batch expiry approaches configured thresholds.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT RULE MODAL */}
      {editingRule && (
        <Modal
          isOpen={Boolean(editingRule)}
          onClose={() => setEditingRule(null)}
          title={`Configure Expiry Alert Thresholds`}
          subtitle={`Product: ${editingRule.productName} (Shelf Life: ${editingRule.shelfLifeDays} days)`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
              <p className="font-semibold">Threshold Rule Validation:</p>
              <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-blue-800">
                <li>Alert 1 &gt; Alert 2 &gt; Alert 3 &gt; 0</li>
                <li>Thresholds cannot exceed product shelf life ({editingRule.shelfLifeDays} days)</li>
                <li>Only Website/In-App notifications are dispatched</li>
              </ul>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alert 1 (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max={editingRule.shelfLifeDays}
                  value={ruleAlert1}
                  onChange={e => setRuleAlert1(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono-numbers font-bold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">Early notice</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alert 2 (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max={editingRule.shelfLifeDays - 1}
                  value={ruleAlert2}
                  onChange={e => setRuleAlert2(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono-numbers font-bold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">Warning</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alert 3 (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max={editingRule.shelfLifeDays - 2}
                  value={ruleAlert3}
                  onChange={e => setRuleAlert3(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono-numbers font-bold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">Urgent warning</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="font-bold text-slate-900 block text-xs">Enable Alert Generation</span>
                <span className="text-[11px] text-slate-500">Enable or suppress automated website notifications for this product</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ruleEnabled}
                  onChange={e => setRuleEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {ruleError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{ruleError}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingRule}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingRule ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
