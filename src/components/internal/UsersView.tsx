import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { User, InternalRole } from '../../types/dairy';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  UserCheck,
  UserPlus,
  Shield,
  Search,
  Filter,
  KeyRound,
  CheckCircle2,
  XCircle,
  Mail,
  Phone
} from 'lucide-react';

export const UsersView: React.FC = () => {
  const { users, updateUserStatus, updateUserRole, addToast } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Edit form states
  const [editRole, setEditRole] = useState<InternalRole>('admin');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

  const openEditDrawer = (u: User) => {
    setSelectedUser(u);
    setEditRole(u.role);
    setEditStatus(u.status);
    setIsDrawerOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    updateUserRole(selectedUser.id, editRole);
    updateUserStatus(selectedUser.id, editStatus);
    setIsDrawerOpen(false);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleDisplayNames: Record<InternalRole, string> = {
    admin: 'Owner / Admin',
    production_manager: 'Production Manager',
    warehouse_manager: 'Warehouse Manager',
    accountant: 'Accountant',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900">User Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure internal staff accounts, role designations, and portal access permissions
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<UserPlus className="w-4 h-4" />}
          onClick={() => addToast('User provisioning requires Supabase Auth invite (simulated)', 'info')}
        >
          Add New Employee
        </Button>
      </div>

      {/* Filter / Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, department..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">Role:</span>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="All">All Roles</option>
            <option value="admin">Owner / Admin</option>
            <option value="production_manager">Production Manager</option>
            <option value="warehouse_manager">Warehouse Manager</option>
            <option value="accountant">Accountant</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">Last Active</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 block">{u.name}</span>
                        <span className="text-[11px] text-slate-500 font-normal">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium text-[11px] border border-slate-200">
                      <Shield className="w-3 h-3 text-blue-600" />
                      <span>{roleDisplayNames[u.role]}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{u.department}</td>
                  <td className="py-3 px-3 text-slate-600 font-mono-numbers">
                    +91 {u.mobile}
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-mono-numbers text-[11px]">
                    {u.lastLogin}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge
                      status={u.status}
                      label={u.status === 'active' ? 'Active' : 'Suspended'}
                    />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openEditDrawer(u)}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-medium text-xs transition-colors"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedUser ? `Manage ${selectedUser.name}` : 'Edit Employee'}
        subtitle={selectedUser ? selectedUser.email : ''}
        width="md"
      >
        {selectedUser && (
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{selectedUser.email}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>+91 {selectedUser.mobile}</span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1">
                Department: <strong className="text-slate-700">{selectedUser.department}</strong>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                System Role & Responsibilities
              </label>
              <select
                value={editRole}
                onChange={e => setEditRole(e.target.value as InternalRole)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-600"
              >
                <option value="admin">Owner / Main Admin (Full ERP Access)</option>
                <option value="production_manager">Production Manager (Processing, Batches)</option>
                <option value="warehouse_manager">Warehouse Manager (Finished/Raw Stock)</option>
                <option value="accountant">Accountant (Sales, Invoices, Ledger, Expenses)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value as 'active' | 'inactive')}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-600"
              >
                <option value="active">Active (Can Login)</option>
                <option value="inactive">Inactive / Suspended</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<KeyRound className="w-3.5 h-3.5" />}
                onClick={() => addToast(`Password reset link sent to ${selectedUser.email}`, 'info')}
              >
                Send Password Reset Email
              </Button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsDrawerOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
};
