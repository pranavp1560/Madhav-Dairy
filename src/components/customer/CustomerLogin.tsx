import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { LanguageSelector } from '../ui/LanguageSelector';
import { CustomerRegister } from './CustomerRegister';
import { ForgotPasswordModal } from '../common/ForgotPasswordModal';
import { ArrowRight, Lock, Mail } from 'lucide-react';

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
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Brand Banner */}
        <div className="bg-blue-600 px-6 py-7 text-white text-center relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-100 bg-blue-700/80 px-3 py-1 rounded-full border border-blue-500/40">
              Retailer Portal
            </span>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl px-2 py-1 text-white">
              <LanguageSelector variant="compact" />
            </div>
          </div>

          <div className="inline-flex items-center justify-center p-2.5 bg-white rounded-2xl mb-3 shadow-md mx-auto max-w-[200px]">
            <img src="/logo.png" alt="Madhav Dairy" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{t.common.appTitle}</h1>
          <p className="text-blue-100 text-sm mt-1">{t.common.tagline}</p>
        </div>

        {/* Login Form */}
        <div className="p-6 sm:p-7 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{t.customer.auth.loginTitle}</h2>
            <p className="text-sm text-slate-500 mt-1">{t.customer.auth.loginSubtitle}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-slate-800 font-bold text-sm mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-12 min-h-[48px] pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-slate-800 font-bold text-sm">
                  {t.customer.auth.passwordLabel}
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  placeholder={t.customer.auth.passwordPlaceholder}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-12 min-h-[48px] pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-base shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60"
              >
                {isLoggingIn ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>{t.customer.auth.loginButton}</span>
                    <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Registration Link */}
          <div className="text-center pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-sm text-slate-600">
            <span>{t.customer.auth.noAccount}</span>
            <button
              onClick={() => setIsRegistering(true)}
              className="font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2"
            >
              {t.customer.auth.createAccount}
            </button>
          </div>

          {/* Staff Login Link */}
          <div className="pt-3 text-center border-t border-slate-100">
            <button
              onClick={() => setPortal('internal_login')}
              className="min-h-[44px] text-xs sm:text-sm text-slate-500 hover:text-slate-900 font-semibold transition-colors inline-flex items-center gap-1.5"
            >
              <span>Dairy Staff & Operations ERP Portal &rarr;</span>
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
      />
    </div>
  );
};
