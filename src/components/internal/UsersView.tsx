import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { User, InternalRole } from '../../types/dairy';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { Modal } from '../common/Modal';
import { AddEmployeeModal } from './AddEmployeeModal';
import { userService } from '../../services/userService';
import {
  UserCheck,
  UserPlus,
  Shield,
  Search,
  Filter,
  KeyRound,
  CheckCircle2,
  Mail,
  Phone,
  Building,
  Lock,
  Trash2,
  AlertTriangle,
  Edit2
} from 'lucide-react';

export const UsersView: React.FC = () => {
  const {
    users,
    currentUser,
    internalRole,
    updateEmployee,
    deleteEmployee,
    refreshData,
    addToast,
  } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState<InternalRole>('admin');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive' | 'invited'>('active');
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Password reset inline state
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const isAdmin = internalRole === 'admin';

  const openEditDrawer = (u: User) => {
    setSelectedUser(u);
    setEditName(u.name);
    setEditMobile(u.mobile || '');
    setEditDepartment(u.department || 'Operations');
    setEditRole(u.role);
    setEditStatus(u.status);
    setIsSettingPassword(false);
    setNewPassword('');
    setIsDrawerOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!editName.trim()) {
      addToast('Employee name cannot be blank', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await updateEmployee(selectedUser.id, {
        name: editName.trim(),
        mobile: editMobile.trim(),
        department: editDepartment.trim(),
        role: editRole,
        status: editStatus,
      });

      setIsDrawerOpen(false);
      await refreshData();
    } catch (err: any) {
      // Toast already shown in context
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = (u: User) => {
    if (currentUser?.id && u.id === currentUser.id) {
      addToast('Safety check: You cannot delete your own logged-in administrator account.', 'error');
      return;
    }
    setUserToDelete(u);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      await deleteEmployee(userToDelete.id);
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      if (selectedUser?.id === userToDelete.id) {
        setIsDrawerOpen(false);
      }
      await refreshData();
    } catch (err: any) {
      // Toast handled by context
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!selectedUser) return;
    try {
      await userService.sendEmployeePasswordResetEmail(selectedUser.email);
      addToast(
        selectedUser.status === 'invited'
          ? `Invitation & password setup link re-sent to ${selectedUser.email}`
          : `Password recovery link dispatched to ${selectedUser.email}`,
        'success'
      );
    } catch (err: any) {
      addToast(err.message || 'Failed to send recovery email', 'error');
    }
  };

  const handleSetDirectPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;
    if (newPassword.length < 6) {
      addToast('Password must be at least 6 characters long', 'warning');
      return;
    }
    setIsResettingPassword(true);
    try {
      await userService.resetEmployeePassword(selectedUser.id, newPassword);
      addToast(`Password updated successfully for ${selectedUser.name}!`, 'success');
      setNewPassword('');
      setIsSettingPassword(false);
    } catch (err: any) {
      addToast(err.message || 'Failed to update employee password', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">User & Employee Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure internal staff accounts, edit employee profiles, assigned database roles, and ERP access
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => setIsAddEmployeeOpen(true)}
          >
            Add New Employee
          </Button>
        )}
      </div>

      {/* Filter / Search Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
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
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No employees matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const isCurrent = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 block">{u.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-normal">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium text-[11px] border border-slate-200">
                          <Shield className="w-3 h-3 text-blue-600" />
                          <span>{roleDisplayNames[u.role] || u.role}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{u.department}</td>
                      <td className="py-3 px-3 text-slate-600 font-mono-numbers">
                        {u.mobile ? `+91 ${u.mobile}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono-numbers text-[11px]">
                        {u.lastLogin}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge
                          status={u.status}
                          tone={u.status === 'invited' ? 'blue' : u.status === 'active' ? 'green' : 'amber'}
                          label={u.status === 'invited' ? 'Invited' : u.status === 'active' ? 'Active' : 'Suspended'}
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditDrawer(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-medium text-xs transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          {isAdmin && !isCurrent && (
                            <button
                              onClick={() => openDeleteModal(u)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 font-medium text-xs transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
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
          <div className="space-y-5 text-xs">
            <form onSubmit={handleSave} className="space-y-4">
              {/* Account summary info */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedUser.email}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Account Created: <strong className="text-slate-700">{selectedUser.lastLogin}</strong>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              {/* Mobile Contact */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    maxLength={10}
                    value={editMobile}
                    onChange={e => setEditMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit mobile number"
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-600 focus:bg-white font-mono-numbers"
                  />
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Department
                </label>
                <select
                  value={editDepartment}
                  onChange={e => setEditDepartment(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
                >
                  <option value="Production">Production & Processing</option>
                  <option value="Warehouse & Inventory">Warehouse & Cold Storage</option>
                  <option value="Accounts & Finance">Accounts & Billing</option>
                  <option value="Quality Control">Quality Assurance & QC</option>
                  <option value="Operations">Operations & Logistics</option>
                  <option value="Executive">Executive & Administration</option>
                </select>
              </div>

              {/* System Role */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  System Role & Responsibilities
                </label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as InternalRole)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
                >
                  <option value="admin">Owner / Main Admin (Full ERP Access)</option>
                  <option value="production_manager">Production Manager (Processing, Batches)</option>
                  <option value="warehouse_manager">Warehouse Manager (Finished/Raw Stock)</option>
                  <option value="accountant">Accountant (Sales, Invoices, Ledger, Expenses)</option>
                </select>
              </div>

              {/* Account Status */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as 'active' | 'inactive' | 'invited')}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-600 focus:bg-white cursor-pointer"
                >
                  <option value="active">Active (Can Login to ERP)</option>
                  <option value="invited">Invited (Pending Initial Password Setup)</option>
                  <option value="inactive">Inactive / Suspended (Account Locked)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Changing status to Inactive immediately blocks their Supabase Auth session.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                  Save Profile Changes
                </Button>
              </div>
            </form>

            {/* Credential Management Section */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 text-xs">Security & Credentials</h4>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<KeyRound className="w-3.5 h-3.5" />}
                  onClick={handleSendResetEmail}
                >
                  {selectedUser.status === 'invited' ? 'Resend Invitation / Password Link' : 'Send Password Reset Email'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Lock className="w-3.5 h-3.5" />}
                  onClick={() => setIsSettingPassword(!isSettingPassword)}
                >
                  {isSettingPassword ? 'Cancel Direct Password Setup' : 'Set Direct Password (Admin Override)'}
                </Button>
              </div>

              {isSettingPassword && (
                <form onSubmit={handleSetDirectPassword} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mt-2">
                  <label className="block font-semibold text-slate-700 text-[11px]">
                    New Password for {selectedUser.name}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 font-mono"
                  />
                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={isResettingPassword}
                    >
                      Update Password
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Danger Zone: Delete Employee */}
            {isAdmin && currentUser?.id !== selectedUser.id && (
              <div className="pt-4 border-t border-red-100 space-y-2">
                <h4 className="font-bold text-red-700 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span>Danger Zone</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Permanently remove this employee account from the system and terminate their login credentials.
                </p>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => openDeleteModal(selectedUser)}
                >
                  Delete Employee Account
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) setIsDeleteModalOpen(false);
        }}
        title="Delete Employee Account"
        subtitle="This action cannot be undone"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-red-900">Permanent Account Removal</p>
              <p className="text-[11px] text-red-700 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="font-bold text-red-900">{userToDelete?.name}</strong> ({userToDelete?.email})?
                This will delete their employee profile and terminate their authentication access.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isDeleting}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={handleConfirmDelete}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Employee Modal */}
      <AddEmployeeModal
        isOpen={isAddEmployeeOpen}
        onClose={() => setIsAddEmployeeOpen(false)}
        onSuccess={() => refreshData()}
      />
    </div>
  );
};
