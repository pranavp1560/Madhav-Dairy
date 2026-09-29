import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Settings, Shield, Store, FileText, Bell, Check, Save } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { products, addToast } = useDairy();
  const [activeTab, setActiveTab] = useState<'profile' | 'roles' | 'pricing' | 'expiry'>('profile');

  const [companyName, setCompanyName] = useState('Madhav Dairy Private Limited');
  const [gstin, setGstin] = useState('27AAACM4401N1Z2');
  const [fssai, setFssai] = useState('11522036000492');
  const [address, setAddress] = useState('Plot No. 42, Shirwal Industrial Dairy Zone, Pune-Satara Highway, Maharashtra - 412801');
  const [bankAccount, setBankAccount] = useState('50200088912345 (HDFC Bank, Kothrud Branch, IFSC: HDFC0001234)');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    addToast('Business settings saved successfully!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wider">
            <Settings className="w-4 h-4 text-blue-600" />
            <span>Master Enterprise Configurations</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            System & Business Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage corporate profile, GST & FSSAI licensing, user roles and batch expiry policies.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex gap-1 overflow-x-auto pb-1 scrollbar-none text-xs">
        {[
          { id: 'profile', label: 'Business Profile & Tax' },
          { id: 'roles', label: 'Roles & Access Matrix' },
          { id: 'pricing', label: 'Products & Pricing Master' },
          { id: 'expiry', label: 'Expiry Alert Policies' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-4xl text-xs">
        {activeTab === 'profile' && (
          <form onSubmit={handleSave} className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-200">
              Corporate Legal Entity & Licensing
            </h3>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Trade Name</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={e => setGstin(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono-numbers font-semibold text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">FSSAI Food License Number</label>
                <input
                  type="text"
                  value={fssai}
                  onChange={e => setFssai(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono-numbers font-semibold text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Processing Plant & Regd Office Address</label>
              <textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                rows={2}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Primary Settlement Bank Account</label>
              <input
                type="text"
                value={bankAccount}
                onChange={e => setBankAccount(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono-numbers text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </form>
        )}

        {activeTab === 'roles' && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-200">
              Role-Based Access Control (RBAC) Matrix
            </h3>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">System Role</th>
                  <th className="p-2.5">Default User</th>
                  <th className="p-2.5">Production</th>
                  <th className="p-2.5">Sales / Invoicing</th>
                  <th className="p-2.5">Finance / Ledger</th>
                  <th className="p-2.5">Expiry Alerts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-blue-50/30">
                  <td className="p-2.5 font-bold text-slate-900">Owner / Admin</td>
                  <td className="p-2.5 text-slate-600">admin@madhavdairy.com</td>
                  <td className="p-2.5 text-blue-700 font-bold">Full</td>
                  <td className="p-2.5 text-blue-700 font-bold">Full</td>
                  <td className="p-2.5 text-blue-700 font-bold">Full</td>
                  <td className="p-2.5 text-blue-700 font-bold">Full</td>
                </tr>
                <tr className="hover:bg-blue-50/30">
                  <td className="p-2.5 font-bold text-slate-900">Production Manager</td>
                  <td className="p-2.5 text-slate-600">production@madhavdairy.com</td>
                  <td className="p-2.5 text-blue-700 font-bold">Full</td>
                  <td className="p-2.5 text-slate-400">Read Only</td>
                  <td className="p-2.5 text-slate-400">—</td>
                  <td className="p-2.5 text-blue-700 font-bold">Full</td>
                </tr>
                <tr className="hover:bg-blue-50/30">
                  <td className="p-2.5 font-bold text-slate-900">Accountant</td>
                  <td className="p-2.5 text-slate-600">accounts@madhavdairy.com</td>
                  <td className="p-2.5 text-slate-400">—</td>
                  <td className="p-2.5 text-blue-700 font-bold">Full</td>
                  <td className="p-2.5 text-blue-700 font-bold">Full</td>
                  <td className="p-2.5 text-slate-400">Read Only</td>
                </tr>
                <tr className="hover:bg-blue-50/30">
                  <td className="p-2.5 font-bold text-slate-900">Warehouse Manager</td>
                  <td className="p-2.5 text-slate-600">warehouse@madhavdairy.com</td>
                  <td className="p-2.5 text-blue-700 font-bold">Inward</td>
                  <td className="p-2.5 text-blue-700 font-bold">Dispatch</td>
                  <td className="p-2.5 text-slate-400">—</td>
                  <td className="p-2.5 text-blue-700 font-bold">Full</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-200">
              Product Master & Wholesale Pricing
            </h3>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Product Name</th>
                  <th className="p-2.5">Unit</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5 text-right">Default Wholesale (₹)</th>
                  <th className="p-2.5 text-right">Shelf Life</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.slice(0, 8).map(p => (
                  <tr key={p.id} className="hover:bg-blue-50/30">
                    <td className="p-2.5 font-bold text-slate-900">{p.name}</td>
                    <td className="p-2.5 text-slate-600">{p.unit}</td>
                    <td className="p-2.5">{p.category}</td>
                    <td className="p-2.5 text-right font-mono-numbers font-bold text-slate-900">₹{p.defaultPrice}</td>
                    <td className="p-2.5 text-right font-mono-numbers text-slate-600">{p.shelfLifeDays} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'expiry' && (
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-200">
              Regulatory Freshness & Threshold Policies
            </h3>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-slate-700">
              <p><strong>1. Near-Expiry Threshold:</strong> Automatic amber warning at 5 days remaining.</p>
              <p><strong>2. Urgent Threshold:</strong> Red alarm triggered at 2 days remaining, prompting reverse logistics pickup or markdown.</p>
              <p><strong>3. Expired Stock Lock:</strong> Batches reaching expiry are blocked from being added to invoices.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
