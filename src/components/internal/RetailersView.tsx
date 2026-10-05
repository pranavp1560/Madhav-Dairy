import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Users, Search, Phone, MapPin, Eye, ArrowRight, CreditCard, UserPlus } from 'lucide-react';
import { AddCustomerModal } from './AddCustomerModal';

interface RetailersViewProps {
  onSelectRetailer: (id: string) => void;
  onOpenRecordPayment: () => void;
}

export const RetailersView: React.FC<RetailersViewProps> = ({
  onSelectRetailer,
  onOpenRecordPayment,
}) => {
  const { retailers, salesChannels } = useDairy();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  const filteredRetailers = retailers.filter(r => {
    const matchesSearch =
      r.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.area.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel =
      selectedChannel === 'all' ||
      r.salesChannelId === selectedChannel ||
      (!r.salesChannelId && salesChannels.find(c => c.id === selectedChannel)?.code === 'WHOLESALE');
    return matchesSearch && matchesChannel;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Retailer Distribution Network</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            Retail Customers & Wholesale Accounts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage authorized grocery, dairy mart, and sweets confectioners retail partnerships.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Retail Customer</span>
          </button>
          <button
            onClick={onOpenRecordPayment}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4 text-slate-600" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Search & Channel Filter */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by store name, proprietor or area..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <select
            value={selectedChannel}
            onChange={e => setSelectedChannel(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
          >
            <option value="all">All Sales Channels</option>
            {salesChannels.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-slate-500 shrink-0">
          <strong>{filteredRetailers.length}</strong> Registered Retail Partners
        </span>
      </div>

      {/* Retailers Table as specified in Section 24 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Business Name</th>
                <th className="p-3">Sales Channel</th>
                <th className="p-3">Owner / Contact</th>
                <th className="p-3">Area / Route</th>
                <th className="p-3 text-right">Outstanding (₹)</th>
                <th className="p-3 text-right">Credit Limit (₹)</th>
                <th className="p-3">Last Order Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">360° Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRetailers.map(r => (
                <tr
                  key={r.id}
                  onClick={() => onSelectRetailer(r.id)}
                  className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                >
                  <td className="p-3 font-bold text-slate-900 text-sm">
                    {r.businessName}
                    <span className="block text-[10px] text-slate-400 font-mono-numbers">GSTIN: {r.gstin}</span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block">
                      {r.salesChannelName || 'Wholesale'}
                    </span>
                  </td>
                  <td className="p-3">
                    <p className="font-semibold text-slate-800">{r.ownerName}</p>
                    <p className="text-[11px] text-slate-500 font-mono-numbers">+91 {r.mobile}</p>
                  </td>
                  <td className="p-3 text-slate-700">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 text-slate-700">
                      {r.area}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono-numbers font-bold text-rose-600">
                    ₹{r.outstandingAmount.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-right font-mono-numbers font-semibold text-slate-700">
                    ₹{r.creditLimit.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 font-mono-numbers text-slate-600">{r.lastOrderDate}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                      Active
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onSelectRetailer(r.id);
                      }}
                      className="px-3 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 border border-blue-200"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>360° View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
      />
    </div>
  );
};
