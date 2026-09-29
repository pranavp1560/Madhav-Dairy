import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { InternalRole } from '../../types/dairy';
import { Button } from '../ui/Button';
import { ShieldCheck, Check, X, Info } from 'lucide-react';

export const RolesPermissionsView: React.FC = () => {
  const { internalRole, addToast } = useDairy();

  const [selectedRole, setSelectedRole] = useState<InternalRole>('admin');

  // Matrix definition mapped to business permissions
  const rolePermissionsMap: Record<InternalRole, Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>> = {
    admin: {
      'Production Runs': { view: true, create: true, edit: true, delete: true },
      'Batch Tracking': { view: true, create: true, edit: true, delete: false },
      'Finished Goods Stock': { view: true, create: true, edit: true, delete: true },
      'Raw Materials Inventory': { view: true, create: true, edit: true, delete: true },
      'Stock Movements Ledger': { view: true, create: true, edit: false, delete: false },
      'Orders Management': { view: true, create: true, edit: true, delete: true },
      'Invoices & Billing': { view: true, create: true, edit: true, delete: false },
      'Customer Retailers': { view: true, create: true, edit: true, delete: true },
      'Payment Entries': { view: true, create: true, edit: true, delete: false },
      'Customer Ledger': { view: true, create: false, edit: false, delete: false },
      'Daily Expenses': { view: true, create: true, edit: true, delete: true },
      'Expiry Radar': { view: true, create: false, edit: true, delete: false },
      'Business Reports': { view: true, create: false, edit: false, delete: false },
      'User Management': { view: true, create: true, edit: true, delete: true },
      'System Settings': { view: true, create: false, edit: true, delete: false },
    },
    production_manager: {
      'Production Runs': { view: true, create: true, edit: true, delete: false },
      'Batch Tracking': { view: true, create: true, edit: true, delete: false },
      'Finished Goods Stock': { view: true, create: false, edit: false, delete: false },
      'Raw Materials Inventory': { view: true, create: true, edit: true, delete: false },
      'Stock Movements Ledger': { view: true, create: true, edit: false, delete: false },
      'Orders Management': { view: false, create: false, edit: false, delete: false },
      'Invoices & Billing': { view: false, create: false, edit: false, delete: false },
      'Customer Retailers': { view: false, create: false, edit: false, delete: false },
      'Payment Entries': { view: false, create: false, edit: false, delete: false },
      'Customer Ledger': { view: false, create: false, edit: false, delete: false },
      'Daily Expenses': { view: false, create: false, edit: false, delete: false },
      'Expiry Radar': { view: true, create: false, edit: false, delete: false },
      'Business Reports': { view: true, create: false, edit: false, delete: false },
      'User Management': { view: false, create: false, edit: false, delete: false },
      'System Settings': { view: false, create: false, edit: false, delete: false },
    },
    warehouse_manager: {
      'Production Runs': { view: true, create: false, edit: false, delete: false },
      'Batch Tracking': { view: true, create: false, edit: true, delete: false },
      'Finished Goods Stock': { view: true, create: true, edit: true, delete: false },
      'Raw Materials Inventory': { view: true, create: true, edit: true, delete: false },
      'Stock Movements Ledger': { view: true, create: true, edit: false, delete: false },
      'Orders Management': { view: true, create: false, edit: true, delete: false },
      'Invoices & Billing': { view: false, create: false, edit: false, delete: false },
      'Customer Retailers': { view: false, create: false, edit: false, delete: false },
      'Payment Entries': { view: false, create: false, edit: false, delete: false },
      'Customer Ledger': { view: false, create: false, edit: false, delete: false },
      'Daily Expenses': { view: false, create: false, edit: false, delete: false },
      'Expiry Radar': { view: true, create: false, edit: true, delete: false },
      'Business Reports': { view: true, create: false, edit: false, delete: false },
      'User Management': { view: false, create: false, edit: false, delete: false },
      'System Settings': { view: false, create: false, edit: false, delete: false },
    },
    accountant: {
      'Production Runs': { view: false, create: false, edit: false, delete: false },
      'Batch Tracking': { view: false, create: false, edit: false, delete: false },
      'Finished Goods Stock': { view: false, create: false, edit: false, delete: false },
      'Raw Materials Inventory': { view: false, create: false, edit: false, delete: false },
      'Stock Movements Ledger': { view: false, create: false, edit: false, delete: false },
      'Orders Management': { view: true, create: false, edit: false, delete: false },
      'Invoices & Billing': { view: true, create: true, edit: true, delete: false },
      'Customer Retailers': { view: true, create: true, edit: true, delete: false },
      'Payment Entries': { view: true, create: true, edit: true, delete: false },
      'Customer Ledger': { view: true, create: false, edit: false, delete: false },
      'Daily Expenses': { view: true, create: true, edit: true, delete: false },
      'Expiry Radar': { view: false, create: false, edit: false, delete: false },
      'Business Reports': { view: true, create: false, edit: false, delete: false },
      'User Management': { view: false, create: false, edit: false, delete: false },
      'System Settings': { view: false, create: false, edit: false, delete: false },
    },
  };

  const activePermissions = rolePermissionsMap[selectedRole];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900">Role & Permission Matrix</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Role-Based Access Control (RBAC) enforcing backend and Row Level Security (RLS) rules
          </p>
        </div>
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
          {(['admin', 'production_manager', 'warehouse_manager', 'accountant'] as InternalRole[]).map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                selectedRole === role
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {role === 'admin' ? 'Admin' : role === 'production_manager' ? 'Production' : role === 'warehouse_manager' ? 'Warehouse' : 'Accountant'}
            </button>
          ))}
        </div>
      </div>

      {/* Info Notice */}
      <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p>
          Viewing permission matrix for <strong className="capitalize">{selectedRole.replace('_', ' ')}</strong>.
          Permissions directly enforce component rendering, action buttons, and PostgreSQL Row-Level Security policies.
        </p>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Functional Module</th>
                <th className="py-3 px-4 text-center">View / Read</th>
                <th className="py-3 px-4 text-center">Create / Add</th>
                <th className="py-3 px-4 text-center">Edit / Update</th>
                <th className="py-3 px-4 text-center">Delete / Revoke</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {Object.entries(activePermissions).map(([moduleName, perm]) => (
                <tr key={moduleName} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {moduleName}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {perm.view ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {perm.create ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {perm.edit ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {perm.delete ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
