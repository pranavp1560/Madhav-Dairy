import React, { useState } from 'react';
import { Modal } from './Modal';
import { authService } from '../../services/authService';
import { useDairy } from '../../context/DairyContext';
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
  portalType?: 'customer' | 'internal';
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  defaultEmail = '',
  portalType = 'customer',
}) => {
  const { addToast } = useDairy();
  const [email, setEmail] = useState(defaultEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      await authService.resetPassword(email.trim());
      setIsSent(true);
      addToast('Password recovery instructions sent to your email address.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to send password recovery email. Please verify your address.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSent(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Reset Your Password"
      subtitle={
        portalType === 'internal'
          ? 'Enter your registered work email to receive password recovery instructions'
          : 'Enter your registered email address to receive password recovery instructions'
      }
      maxWidth="md"
    >
      {isSent ? (
        <div className="py-4 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Check Your Inbox</h4>
          <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
            We have sent password recovery instructions to <strong className="text-slate-900">{email}</strong>. Please follow the link in the email to set a new password.
          </p>
          <div className="pt-2">
            <Button variant="primary" size="md" onClick={handleClose}>
              Back to Sign In
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Registered Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              A secure password reset link will be dispatched to this address.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="md" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Send Recovery Link
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
