import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { LanguageSelector } from '../ui/LanguageSelector';
import { CustomerRegister } from './CustomerRegister';
import { ForgotPasswordModal } from '../common/ForgotPasswordModal';
import { Button } from '../ui/Button';
import { Milk, ArrowRight, Lock, Mail, Store } from 'lucide-react';

export const CustomerLogin: React.FC = () => {
  const { setPortal, login, addToast } = useDairy();
  const { t } = useTranslation();

  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (isRegistering) {
    return (
      <CustomerRegister
        onBackToLogin={() => setIsRegistering(false)}
        onSuccess={() => {
          setIsRegistering(false);
        }}
      />
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      addToast('Please enter your email and password', 'warning');
      return;
    }

    setIsLoggingIn(true);
    try {
      await login(cleanEmail, password);
    } catch (err: any) {
      addToast(err.message || 'Invalid email or password. Please verify your credentials.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Brand Banner */}
        <div className="bg-blue-600 px-5 sm:px-6 py-6 text-white text-center relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100 bg-blue-700/70 px-2.5 py-0.5 rounded-full border border-blue-500/40">
              Retailer Portal
            </span>
            <div className="bg-white/10 backdrop-blur-xs rounded-lg px-1.5 py-0.5 text-white">
              <LanguageSelector variant="compact" />
            </div>
          </div>

          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-2.5 shadow-inner">
            <Milk className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{t.common.appTitle}</h1>
          <p className="text-blue-100 text-xs mt-0.5">{t.common.tagline}</p>
        </div>

        {/* Login Form */}
        <div className="p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t.customer.auth.loginTitle}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t.customer.auth.loginSubtitle}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-slate-700 font-bold text-xs mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-10 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-bold text-xs">
                  {t.customer.auth.passwordLabel}
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  placeholder={t.customer.auth.passwordPlaceholder}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-10 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full h-10 sm:h-11 text-xs sm:text-sm font-bold shadow-2xs"
                isLoading={isLoggingIn}
                icon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}
              >
                {t.customer.auth.loginButton}
              </Button>
            </div>
          </form>

          {/* Registration Link */}
          <div className="text-center pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-600">
            <span>{t.customer.auth.noAccount}</span>
            <button
              onClick={() => setIsRegistering(true)}
              className="font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2"
            >
              {t.customer.auth.createAccount}
            </button>
          </div>

          {/* Clean entry navigation link to internal staff ERP login */}
          <div className="pt-3 text-center border-t border-slate-100">
            <button
              onClick={() => setPortal('internal_login')}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors inline-flex items-center gap-1"
            >
              <span>Dairy Staff & Management ERP Login &rarr;</span>
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        defaultEmail={email}
        portalType="customer"
      />
    </div>
  );
};
