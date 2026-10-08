import React, { useState, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { InternalRole } from '../../types/dairy';
import { userService, PermissionActionMap, RolePermissionsMatrix, DEFAULT_ROLE_PERMISSIONS_MATRIX } from '../../services/userService';
import { Button } from '../ui/Button';
import {
  ShieldCheck,
  ShieldAlert,
  Save,
  RotateCcw,
  Check,
  X,
  Info,
  Search,
  Filter,
  CheckCircle2,
  Lock,
  Unlock,
  Sliders,
  Layers
} from 'lucide-react';

interface ModuleConfig {
  key: string;
  name: string;
  category: 'Operations' | 'Inventory & Quality' | 'Sales & Finance' | 'Administration';
  description: string;
}

const SYSTEM_MODULES: ModuleConfig[] = [
  // Operations
  { key: 'production', name: 'Production Runs', category: 'Operations', description: 'Batch processing, recipes, yield calculations & logs' },
  { key: 'batches', name: 'Batch Tracking', category: 'Operations', description: 'Batch numbers, QA inspections, shelf life calculation' },
  { key: 'dashboard', name: 'Operations Dashboard', category: 'Operations', description: 'High-level KPIs, inventory and sales summary metrics' },

  // Inventory & Quality
  { key: 'inventory', name: 'Finished Goods Stock', category: 'Inventory & Quality', description: 'Finished stock balances, stock adjustments, cold storage' },
  { key: 'raw_materials', name: 'Raw Materials Inventory', category: 'Inventory & Quality', description: 'Raw milk inward, culture, packaging materials' },
  { key: 'expiry', name: 'Expiry Radar & Surveillance', category: 'Inventory & Quality', description: 'Expiry alert thresholds, customer tracking, batch surveillance' },

  // Sales & Finance
  { key: 'orders', name: 'Orders Management', category: 'Sales & Finance', description: 'Retailer orders, dispatch scheduling, batch allocation' },
  { key: 'invoices', name: 'Invoices & Billing', category: 'Sales & Finance', description: 'Tax invoices, delivery notes, GST summaries' },
  { key: 'customers', name: 'Customer Retailers', category: 'Sales & Finance', description: 'Retailer directory, credit limits, sales channels' },
  { key: 'payments', name: 'Payment Entries', category: 'Sales & Finance', description: 'Collection entries, multi-invoice payment allocation' },
  { key: 'ledger', name: 'Customer Ledger', category: 'Sales & Finance', description: 'Live account ledger, outstanding balance statements' },
  { key: 'expenses', name: 'Daily Expenses', category: 'Sales & Finance', description: 'Operational expenses, plant utilities, petty cash' },

  // Administration
  { key: 'products', name: 'Products Catalog', category: 'Administration', description: 'Parent products, child SKUs, base shelf life' },
  { key: 'categories', name: 'Product Categories', category: 'Administration', description: 'Dairy category taxonomy & product grouping' },
  { key: 'channels', name: 'Sales Channels', category: 'Administration', description: 'Sales tier pricing rules (Wholesale, Retail, etc.)' },
  { key: 'reports', name: 'Business Reports', category: 'Administration', description: 'Sales performance, production yield, financial audit' },
  { key: 'users', name: 'User Management', category: 'Administration', description: 'Internal employee accounts, database roles & access' },
  { key: 'settings', name: 'System Settings', category: 'Administration', description: 'Company profile, branch locations, operational configs' },
];

export const RolesPermissionsView: React.FC = () => {
  const { internalRole, addToast } = useDairy();

  const [selectedRole, setSelectedRole] = useState<InternalRole>('admin');
  const [matrix, setMatrix] = useState<RolePermissionsMatrix>(DEFAULT_ROLE_PERMISSIONS_MATRIX);
  const [initialMatrix, setInitialMatrix] = useState<RolePermissionsMatrix>(DEFAULT_ROLE_PERMISSIONS_MATRIX);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const isAdmin = internalRole === 'admin';

  // Load live matrix from Supabase
  useEffect(() => {
    let isMounted = true;
    const loadMatrix = async () => {
      setIsLoading(true);
      try {
        const liveMatrix = await userService.fetchRolePermissionsMatrix();
        if (isMounted) {
          setMatrix(liveMatrix);
          setInitialMatrix(JSON.parse(JSON.stringify(liveMatrix)));
        }
      } catch (err) {
        console.error('Failed to load role permissions matrix:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadMatrix();
    return () => {
      isMounted = false;
    };
  }, []);

  const activePermissions = matrix[selectedRole] || {};
  const initialRolePermissions = initialMatrix[selectedRole] || {};

  // Check if current role has unsaved changes
  const hasUnsavedChanges = JSON.stringify(activePermissions) !== JSON.stringify(initialRolePermissions);

  // Toggle individual permission
  const handleToggle = (moduleKey: string, action: keyof PermissionActionMap) => {
    if (!isAdmin) {
      addToast('Only administrators can modify role permissions', 'warning');
      return;
    }

    setMatrix(prev => {
      const roleState = prev[selectedRole] || {};
      const modState = roleState[moduleKey] || { view: false, create: false, edit: false, delete: false };

      return {
        ...prev,
        [selectedRole]: {
          ...roleState,
          [moduleKey]: {
            ...modState,
            [action]: !modState[action],
          },
        },
      };
    });
  };

  // Toggle all actions for a specific module row
  const handleToggleRow = (moduleKey: string, enableAll: boolean) => {
    if (!isAdmin) return;

    setMatrix(prev => {
      const roleState = prev[selectedRole] || {};
      return {
        ...prev,
        [selectedRole]: {
          ...roleState,
          [moduleKey]: {
            view: enableAll,
            create: enableAll,
            edit: enableAll,
            delete: enableAll,
          },
        },
      };
    });
  };

  // Save changes to Supabase
  const handleSave = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      await userService.saveRolePermissions(selectedRole, activePermissions);
      setInitialMatrix(prev => ({
        ...prev,
        [selectedRole]: JSON.parse(JSON.stringify(activePermissions)),
      }));
      addToast(`Role permissions for "${selectedRole.replace('_', ' ')}" updated successfully in Supabase!`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save role permissions', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default configuration
  const handleResetToDefaults = () => {
    if (!isAdmin) return;
    const defaults = DEFAULT_ROLE_PERMISSIONS_MATRIX[selectedRole];
    setMatrix(prev => ({
      ...prev,
      [selectedRole]: JSON.parse(JSON.stringify(defaults)),
    }));
    addToast(`Reset permissions for ${selectedRole.replace('_', ' ')} to system defaults. Click "Save Changes" to persist.`, 'info');
  };

  // Grant all permissions for role
  const handleGrantAll = () => {
    if (!isAdmin) return;
    const allEnabled: Record<string, PermissionActionMap> = {};
    SYSTEM_MODULES.forEach(m => {
      allEnabled[m.key] = { view: true, create: true, edit: true, delete: true };
    });
    setMatrix(prev => ({
      ...prev,
      [selectedRole]: allEnabled,
    }));
  };

  // Filter modules
  const filteredModules = SYSTEM_MODULES.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const categories = ['All', 'Operations', 'Inventory & Quality', 'Sales & Finance', 'Administration'];

  const roleLabels: Record<InternalRole, { name: string; desc: string; badge: string }> = {
    admin: { name: 'Owner / Admin', desc: 'Full executive control, RBAC authority & system configuration', badge: 'bg-purple-100 text-purple-800' },
    production_manager: { name: 'Production Manager', desc: 'Plant manufacturing, batches, recipe control & raw materials', badge: 'bg-blue-100 text-blue-800' },
    warehouse_manager: { name: 'Warehouse Manager', desc: 'Cold chain stock, finished goods inventory & dispatch logistics', badge: 'bg-emerald-100 text-emerald-800' },
    accountant: { name: 'Accountant', desc: 'Sales invoices, retail collections, expenses & customer ledger', badge: 'bg-amber-100 text-amber-800' },
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Role & Permission Matrix</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Supabase RBAC
            </span>
            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                Unsaved changes
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Administer granular module access (Read, Create, Edit, Delete) enforced across the ERP and PostgreSQL Row Level Security
          </p>
        </div>

        {/* Action Controls for Admin */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={handleResetToDefaults}
                disabled={isSaving || isLoading}
                title="Restore default permission set for this role"
              >
                Reset Defaults
              </Button>

              <Button
                variant="primary"
                size="sm"
                icon={<Save className="w-3.5 h-3.5" />}
                onClick={handleSave}
                isLoading={isSaving}
                disabled={!hasUnsavedChanges || isSaving || isLoading}
              >
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Role Selection Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {(['admin', 'production_manager', 'warehouse_manager', 'accountant'] as InternalRole[]).map(role => {
          const isSelected = selectedRole === role;
          const roleInfo = roleLabels[role];
          return (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`p-3 rounded-xl border text-left transition-all relative ${
                isSelected
                  ? 'bg-blue-50/70 border-blue-500 shadow-xs ring-1 ring-blue-500'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900">{roleInfo.name}</span>
                {isSelected && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                {roleInfo.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Admin Mode vs Read-only Notice */}
      <div className={`flex items-start gap-3 p-3.5 rounded-xl border text-xs ${
        isAdmin
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}>
        {isAdmin ? (
          <Unlock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div className="space-y-0.5 flex-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              {isAdmin
                ? `Admin Control Enabled: Configuring permissions for ${roleLabels[selectedRole].name}`
                : `Read-Only Mode: Viewing permissions for ${roleLabels[selectedRole].name}`}
            </span>
            {isAdmin && (
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  onClick={handleGrantAll}
                  className="text-emerald-700 hover:text-emerald-900 font-medium underline"
                >
                  Grant All Access
                </button>
              </div>
            )}
          </div>
          <p className="text-[11px] opacity-90 leading-relaxed">
            {isAdmin
              ? 'Click any toggle below to grant or revoke module capabilities. Remember to click "Save Changes" to sync directly with Supabase database.'
              : 'You do not hold administrator privileges. Contact an Owner/Admin to adjust permissions matrix.'}
          </p>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search functional module..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4 w-1/3">Functional Module</th>
                <th className="py-3 px-3 text-center w-28">View / Read</th>
                <th className="py-3 px-3 text-center w-28">Create / Add</th>
                <th className="py-3 px-3 text-center w-28">Edit / Update</th>
                <th className="py-3 px-3 text-center w-28">Delete / Revoke</th>
                {isAdmin && <th className="py-3 px-4 text-right w-28">Quick Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredModules.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="py-10 text-center text-slate-400">
                    No functional modules found matching &ldquo;{searchQuery}&rdquo;.
                  </td>
                </tr>
              ) : (
                filteredModules.map(mod => {
                  const perm = activePermissions[mod.key] || {
                    view: false,
                    create: false,
                    edit: false,
                    delete: false,
                  };
                  const allActive = perm.view && perm.create && perm.edit && perm.delete;

                  return (
                    <tr key={mod.key} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{mod.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                              {mod.key}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 mt-0.5">
                            {mod.description}
                          </span>
                        </div>
                      </td>

                      {/* View / Read Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleToggle(mod.key, 'view')}
                          className={`inline-flex items-center justify-center gap-1 w-16 py-1 rounded-md text-xs font-semibold transition-all ${
                            perm.view
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200'
                          } ${!isAdmin ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-95'}`}
                        >
                          {perm.view ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          <span>{perm.view ? 'Allow' : 'Deny'}</span>
                        </button>
                      </td>

                      {/* Create / Add Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleToggle(mod.key, 'create')}
                          className={`inline-flex items-center justify-center gap-1 w-16 py-1 rounded-md text-xs font-semibold transition-all ${
                            perm.create
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200'
                          } ${!isAdmin ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-95'}`}
                        >
                          {perm.create ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          <span>{perm.create ? 'Allow' : 'Deny'}</span>
                        </button>
                      </td>

                      {/* Edit / Update Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleToggle(mod.key, 'edit')}
                          className={`inline-flex items-center justify-center gap-1 w-16 py-1 rounded-md text-xs font-semibold transition-all ${
                            perm.edit
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200'
                          } ${!isAdmin ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-95'}`}
                        >
                          {perm.edit ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          <span>{perm.edit ? 'Allow' : 'Deny'}</span>
                        </button>
                      </td>

                      {/* Delete / Revoke Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleToggle(mod.key, 'delete')}
                          className={`inline-flex items-center justify-center gap-1 w-16 py-1 rounded-md text-xs font-semibold transition-all ${
                            perm.delete
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200'
                          } ${!isAdmin ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-95'}`}
                        >
                          {perm.delete ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          <span>{perm.delete ? 'Allow' : 'Deny'}</span>
                        </button>
                      </td>

                      {/* Row Quick Action */}
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleRow(mod.key, !allActive)}
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          >
                            {allActive ? 'Revoke All' : 'Grant All'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer save reminder bar */}
        {isAdmin && hasUnsavedChanges && (
          <div className="bg-amber-50 border-t border-amber-200 p-3 flex items-center justify-between px-4">
            <span className="text-xs font-medium text-amber-900">
              You have unsaved changes in the permissions matrix for <strong>{roleLabels[selectedRole].name}</strong>.
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMatrix(prev => ({ ...prev, [selectedRole]: JSON.parse(JSON.stringify(initialRolePermissions)) }))}
              >
                Discard
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Save className="w-3.5 h-3.5" />}
                onClick={handleSave}
                isLoading={isSaving}
              >
                Save Changes Now
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
