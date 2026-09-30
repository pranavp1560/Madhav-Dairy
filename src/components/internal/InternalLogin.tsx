import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { Button } from '../ui/Button';
import { ForgotPasswordModal } from '../common/ForgotPasswordModal';
import { Milk, ArrowLeft, Lock, Mail, ArrowRight, Shield } from 'lucide-react';

export const InternalLogin: React.FC = () => {
  const { setPortal, login, addToast } = useDairy();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      addToast('Please enter your work email and password', 'warning');
      return;
    }

    setIsLoggingIn(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      addToast(err.message || 'Invalid email or password. Please verify your credentials.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100/70 text-slate-900 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header with Dairy ERP Brand */}
        <div className="p-6 bg-slate-900 text-white text-center relative">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 text-white rounded-xl border border-white/20 mb-2 shadow-inner">
            <Milk className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Madhav Dairy ERP</h1>
          <p className="text-xs text-blue-200 mt-1 uppercase tracking-wider font-semibold">
            Internal Staff & Management Portal
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Sign In to Work Account</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your authorized staff credentials to access operations
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@madhavdairy.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">Password</label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-colors"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoggingIn}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to ERP
            </Button>
          </form>

          {/* Clean entry navigation link back to customer portal login */}
          <div className="text-center pt-4 border-t border-slate-100">
            <button
              onClick={() => setPortal('customer_login')}
              className="text-xs text-slate-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1.5 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Switch to Retailer Customer Login</span>
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Recovery Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        defaultEmail={email}
        portalType="internal"
      />
    </div>
  );
};
