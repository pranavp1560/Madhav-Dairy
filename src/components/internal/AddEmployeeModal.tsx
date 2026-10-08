import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { userService } from '../../services/userService';
import { Modal } from '../common/Modal';
import { InternalRole } from '../../types/dairy';
import { Button } from '../ui/Button';
import { User, Mail, Phone, Building, Shield, Send, KeyRound, Check } from 'lucide-react';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { addToast } = useDairy();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [department, setDepartment] = useState('Operations');
  const [role, setRole] = useState<InternalRole>('production_manager');
  const [authMethod, setAuthMethod] = useState<'invite' | 'password'>('invite');
  const [initialPassword, setInitialPassword] = useState('Madhav@1234');
  const [status, setStatus] = useState<'active' | 'invited'>('invited');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim().replace(/\D/g, '');

    if (!fullName.trim() || !cleanEmail || !cleanMobile) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Please enter a valid work email address.');
      return;
    }

    if (cleanMobile.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (authMethod === 'password' && initialPassword.trim().length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await userService.createEmployee({
        fullName: fullName.trim(),
        email: cleanEmail,
        mobile: cleanMobile,
        department: department.trim(),
        role,
        status: authMethod === 'password' ? 'active' : status,
        password: authMethod === 'password' ? initialPassword.trim() : undefined,
      });

      if (authMethod === 'password') {
        addToast(
          `Employee "${fullName.trim()}" created with active login access! Password: ${initialPassword}`,
          'success'
        );
      } else {
        addToast(
          `Employee created successfully. Invitation dispatched to ${cleanEmail}.`,
          'success'
        );
      }

      // Reset form
      setFullName('');
      setEmail('');
      setMobile('');
      setDepartment('Operations');
      setRole('production_manager');
      setAuthMethod('invite');
      setInitialPassword('Madhav@1234');
      setStatus('invited');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create employee account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Employee"
      subtitle="Provision internal staff member with database role assignment and ERP permissions"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Onboarding Mode Selection */}
        <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setAuthMethod('invite');
              setStatus('invited');
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              authMethod === 'invite'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Send Email Invitation</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod('password');
              setStatus('active');
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              authMethod === 'password'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Set Direct Initial Password</span>
          </button>
        </div>

        {/* Security / Onboarding Notice */}
        <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-3">
          {authMethod === 'invite' ? (
            <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          ) : (
            <KeyRound className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5 text-[11px] text-blue-800 leading-relaxed">
            {authMethod === 'invite' ? (
              <p>
                An invitation email will be sent to the employee. They will securely choose their own password using the verification link.
              </p>
            ) : (
              <p>
                An active ERP account will be created immediately with the password specified below. The employee can log in right away.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Anand Kulkarni"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Work Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="anand@madhavdairy.com"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Mobile Contact <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="tel"
                required
                maxLength={10}
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                placeholder="10-digit mobile number"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono-numbers text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Department <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
              >
                <option value="Production">Production & Processing</option>
                <option value="Warehouse & Inventory">Warehouse & Cold Storage</option>
                <option value="Accounts & Finance">Accounts & Billing</option>
                <option value="Quality Control">Quality Assurance & QC</option>
                <option value="Operations">Operations & Logistics</option>
                <option value="Executive">Executive & Administration</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Assigned Role <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={role}
                onChange={e => setRole(e.target.value as InternalRole)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
              >
                <option value="admin">Owner / Main Admin (Full ERP Access)</option>
                <option value="production_manager">Production Manager (Recipes, Batches, QC)</option>
                <option value="warehouse_manager">Warehouse Manager (Stock & Goods)</option>
                <option value="accountant">Accountant (Invoices, Ledger, Payments, Expenses)</option>
              </select>
            </div>
          </div>

          {authMethod === 'password' ? (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Initial Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  minLength={6}
                  value={initialPassword}
                  onChange={e => setInitialPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none font-mono"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Initial Account Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'invited' | 'active')}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
              >
                <option value="invited">Invited (Send invitation email now)</option>
                <option value="active">Active (Pre-activated)</option>
              </select>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            icon={authMethod === 'invite' ? <Send className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          >
            {authMethod === 'invite' ? 'Create Employee & Send Invite' : 'Create Active Employee'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
