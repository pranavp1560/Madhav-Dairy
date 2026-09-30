import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { StatusBadge } from '../common/StatusBadge';
import {
  AlertTriangle,
  Clock,
  Bell,
  Search,
  CheckCircle2,
  Sliders,
  Send,
  MessageSquare,
  Smartphone,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface ExpiryViewProps {
  onSelectBatch: (id: string) => void;
}

export const ExpiryView: React.FC<ExpiryViewProps> = ({ onSelectBatch }) => {
  const {
    expiryAlerts,
    expiryRules,
    toggleExpiryRule,
    notifications,
    addToast
  } = useDairy();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'rules' | 'history'>('dashboard');
  const [rangeFilter, setRangeFilter] = useState<'all' | 'today' | '3days' | '5days' | '7days' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Bucket calculations
  const expiringToday = expiryAlerts.filter(a => a.daysRemaining === 0);
  const expiringIn3Days = expiryAlerts.filter(a => a.daysRemaining > 0 && a.daysRemaining <= 3);
  const expiringIn5Days = expiryAlerts.filter(a => a.daysRemaining > 3 && a.daysRemaining <= 5);
  const expiringIn7Days = expiryAlerts.filter(a => a.daysRemaining > 5 && a.daysRemaining <= 7);
  const alreadyExpired = expiryAlerts.filter(a => a.daysRemaining < 0);

  const filteredAlerts = expiryAlerts.filter(a => {
    let matchesRange = true;
    if (rangeFilter === 'today') matchesRange = a.daysRemaining === 0;
    if (rangeFilter === '3days') matchesRange = a.daysRemaining > 0 && a.daysRemaining <= 3;
    if (rangeFilter === '5days') matchesRange = a.daysRemaining > 3 && a.daysRemaining <= 5;
    if (rangeFilter === '7days') matchesRange = a.daysRemaining > 5 && a.daysRemaining <= 7;
    if (rangeFilter === 'expired') matchesRange = a.daysRemaining < 0;

    const matchesSearch =
      a.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.retailerName && a.retailerName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesRange && matchesSearch;
  });

  const handleSendManualReminder = (batchNumber: string, retailerName?: string) => {
    addToast(`Automated WhatsApp & Push expiry alert dispatched for Batch ${batchNumber} to ${retailerName || 'Warehouse Dispatch'}`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Madhav Dairy Freshness & Batch Traceability Hub</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Expiry Risk Radar & Notification Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated threshold surveillance tracking batch shelf lives across warehouse storage and retailer shelves.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'dashboard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Expiry Dashboard
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'rules' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Alert Rules
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dispatch Log
          </button>
        </div>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 5 Prominent Buckets as specified in Section 28 */}
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
                <span className="text-[10px] uppercase font-bold">Expiring Today</span>
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
                <span className="text-[10px] uppercase font-bold">In ≤ 3 Days</span>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <span className="text-2xl font-black text-red-600 font-mono-numbers mt-1 block">
                {expiringIn3Days.length}
              </span>
              <span className="text-[10px] text-red-700 font-medium">Urgent clearance</span>
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
                <span className="text-[10px] uppercase font-bold">In ≤ 5 Days</span>
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span className="text-2xl font-black text-amber-700 font-mono-numbers mt-1 block">
                {expiringIn5Days.length}
              </span>
              <span className="text-[10px] text-amber-800 font-medium">Customer alert zone</span>
            </div>

            {/* Expiring in 7 Days */}
            <div
              onClick={() => setRangeFilter(rangeFilter === '7days' ? 'all' : '7days')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                rangeFilter === '7days'
                  ? 'border-yellow-500 bg-yellow-50 shadow-md ring-2 ring-yellow-300/20'
                  : 'border-yellow-200 bg-white hover:border-yellow-300'
              }`}
            >
              <div className="flex items-center justify-between text-yellow-800">
                <span className="text-[10px] uppercase font-bold">In ≤ 7 Days</span>
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span className="text-2xl font-black text-yellow-800 font-mono-numbers mt-1 block">
                {expiringIn7Days.length}
              </span>
              <span className="text-[10px] text-yellow-900 font-medium">Upcoming watch</span>
            </div>

            {/* Already Expired */}
            <div
              onClick={() => setRangeFilter(rangeFilter === 'expired' ? 'all' : 'expired')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all col-span-2 sm:col-span-1 ${
                rangeFilter === 'expired'
                  ? 'border-slate-700 bg-slate-100 shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-400'
              }`}
            >
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-[10px] uppercase font-bold">Already Expired</span>
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <span className="text-2xl font-black text-slate-900 font-mono-numbers mt-1 block">
                {alreadyExpired.length}
              </span>
              <span className="text-[10px] text-slate-600 font-medium">Locked for QC writeoff</span>
            </div>
          </div>

          {/* Search and Table Filters */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between text-xs">
            <div className="relative w-full max-w-sm">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Product, Batch # or Retailer..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="text-xs text-slate-500">
              Showing <strong>{filteredAlerts.length}</strong> batches with active expiry alerts
            </div>
          </div>

          {/* Table as specified in Section 28 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">Batch Number</th>
                    <th className="p-3">Current Location / Retailer</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3">Expiry Date</th>
                    <th className="p-3">Days Remaining</th>
                    <th className="p-3">Alert Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-numbers">
                  {filteredAlerts.map(a => {
                    return (
                      <tr key={a.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-3 font-sans font-bold text-slate-900">{a.productName}</td>
                        <td className="p-3">
                          <button
                            onClick={() => onSelectBatch(a.batchNumber)}
                            className="font-bold text-blue-700 hover:underline bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-xs"
                          >
                            {a.batchNumber}
                          </button>
                        </td>
                        <td className="p-3 font-sans">
                          {a.retailerName ? (
                            <span className="font-semibold text-slate-800">{a.retailerName}</span>
                          ) : (
                            <span className="text-slate-500 italic">Finished Goods Cold Storage</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">{a.quantity} units</td>
                        <td className="p-3 font-sans font-medium text-slate-800">{a.expiryDate}</td>
                        <td className="p-3 font-bold">
                          <span className={a.daysRemaining <= 2 ? 'text-rose-600' : a.daysRemaining <= 5 ? 'text-amber-600' : 'text-slate-800'}>
                            {a.daysRemaining > 0 ? `${a.daysRemaining} days` : 'Expired'}
                          </span>
                        </td>
                        <td className="p-3 font-sans">
                          <StatusBadge status={a.severity} type="expiry" size="sm" />
                        </td>
                        <td className="p-3 text-center font-sans">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleSendManualReminder(a.batchNumber, a.retailerName)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded text-[11px] font-semibold transition-colors border border-blue-200 flex items-center gap-1"
                              title="Send WhatsApp & Push Notification"
                            >
                              <Send className="w-3 h-3" />
                              <span>Dispatch Alert</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RULES CONFIGURATION TAB as specified in Section 29 */}
      {activeTab === 'rules' && (
        <div className="space-y-4 max-w-3xl">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
            <h3 className="text-sm font-bold text-slate-900">Automated Notification Rules</h3>
            <p className="text-xs text-slate-500">
              Configure trigger thresholds and dispatch channels (In-App, Push, WhatsApp, SMS).
            </p>
          </div>

          <div className="space-y-3">
            {expiryRules.map(rule => (
              <div
                key={rule.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">{rule.title}</h4>
                    <span className="text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                      Target: {rule.target}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Fires when shelf life remaining is <strong>{rule.daysBeforeExpiry} days</strong>.
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    {rule.channels.map(ch => (
                      <span
                        key={ch}
                        className="text-[10px] uppercase font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200"
                      >
                        {ch.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleExpiryRule(rule.id)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DISPATCH LOG TAB */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Dispatched Notification Log</h3>
            <p className="text-xs text-slate-500">
              Audit log of push notifications, in-app alerts, and WhatsApp messages dispatched to retailers.
            </p>
          </div>

          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Recipient</th>
                <th className="p-3">Notification Title</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notifications.map(notif => (
                <tr key={notif.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="p-3 text-slate-600 font-mono-numbers">{notif.date}</td>
                  <td className="p-3 font-semibold text-slate-800">
                    {notif.recipientType === 'customer' ? 'Customer / Retailer' : 'Internal Operations'}
                  </td>
                  <td className="p-3 text-slate-900 font-medium">{notif.title}</td>
                  <td className="p-3">
                    <span className="uppercase text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                      {notif.channel.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-green-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Dispatched
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
