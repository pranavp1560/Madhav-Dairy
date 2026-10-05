import React, { useState } from 'react';
import { Modal } from './Modal';
import { authService } from '../../services/authService';
import { useDairy } from '../../context/DairyContext';
import { Lock, CheckCircle2, KeyRound } from 'lucide-react';
import { Button } from '../ui/Button';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
}) => {
  const { addToast, refreshData, currentUser } = useDairy();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isInvite = currentUser?.status === 'invited';
  const effectiveTitle = title || (isInvite ? 'Set Up Your Work Password' : 'Set New Password');
  const effectiveSubtitle = subtitle || (
    isInvite
      ? 'Welcome to Madhav Dairy ERP! Please choose a secure password to complete onboarding.'
      : 'Please choose a secure password with at least 6 characters.'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (newPassword.length < 6) {
      setValidationError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.updatePassword(newPassword);
      addToast(
        isInvite
          ? 'Password set successfully! Your account is now active.'
          : 'Password updated successfully! You can now continue.',
        'success'
      );
      setNewPassword('');
      setConfirmPassword('');
      onClose();
      await refreshData();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={effectiveTitle}
      subtitle={effectiveSubtitle}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {validationError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
            {validationError}
          </div>
        )}

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            New Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Confirm New Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
            />
          </div>
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
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            Save Password
          </Button>
        </div>
      </form>
    </Modal>
  );
};
