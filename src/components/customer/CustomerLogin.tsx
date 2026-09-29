import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { LanguageSelector } from '../ui/LanguageSelector';
import { CustomerRegister } from './CustomerRegister';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Milk, ArrowRight, ShieldCheck, Phone, Lock, Sparkles, Store } from 'lucide-react';

export const CustomerLogin: React.FC = () => {
  const { setPortal, setCurrentRetailer, retailers, login, addToast } = useDairy();
  const { t } = useTranslation();

  const [isRegistering, setIsRegistering] = useState(false);
  const [mobile, setMobile] = useState('9822012345');
  const [password, setPassword] = useState('Password@123');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (isRegistering) {
    return (
      <CustomerRegister
        onBackToLogin={() => setIsRegistering(false)}
        onSuccess={() => setPortal('customer')}
      />
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile) {
      addToast('Please enter mobile number or email', 'warning');
      return;
    }
    setIsLoggingIn(true);
    try {
      const matched = retailers.find(r => r.mobile === mobile || r.email === mobile);
      const email = matched?.email || (mobile.includes('@') ? mobile : 'abc.retailers@gmail.com');
      await login(email, password || 'Password@123');
      if (matched) setCurrentRetailer(matched);
    } catch (err: any) {
      addToast(err.message || 'Login failed', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickSelect = async (retId: string) => {
    const selected = retailers.find(r => r.id === retId);
    if (selected) {
      setMobile(selected.mobile);
      setPassword('Password@123');
      setCurrentRetailer(selected);
      setIsLoggingIn(true);
      try {
        await login(selected.email || 'abc.retailers@gmail.com', 'Password@123');
      } catch (err: any) {
        addToast(err.message || 'Login failed', 'error');
      } finally {
        setIsLoggingIn(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Brand Banner with Primary Blue */}
        <div className="bg-blue-600 px-6 py-6 text-white text-center relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-100 bg-blue-700/60 px-2 py-0.5 rounded">
              Retailer Portal
            </span>
            <div className="bg-white/10 backdrop-blur-xs rounded-md px-1 text-white">
              <LanguageSelector variant="compact" />
            </div>
          </div>

          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-inner">
            <Milk className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t.common.appTitle}</h1>
          <p className="text-blue-100 text-xs mt-0.5">{t.common.tagline}</p>
        </div>

        {/* Login Form */}
        <div className="p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{t.customer.auth.loginTitle}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t.customer.auth.loginSubtitle}</p>
          </div>

          {/* Quick Demo Retailers for Presentation Convenience */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Demo Retailer Accounts:
            </span>
            <div className="flex flex-wrap gap-1">
              {retailers.slice(0, 3).map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleQuickSelect(r.id)}
                  className={`text-[11px] px-2 py-1 rounded-md border transition-all ${
                    mobile === r.mobile
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
                  }`}
                >
                  {r.businessName}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-3 text-xs">
            <Input
              label={t.customer.auth.mobileLabel}
              type="tel"
              maxLength={10}
              placeholder={t.customer.auth.mobilePlaceholder}
              value={mobile}
              onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
              leftIcon={<Phone className="w-4 h-4" />}
              required
            />

            <Input
              label={t.customer.auth.passwordLabel}
              type="password"
              placeholder={t.customer.auth.passwordPlaceholder}
              value={password}
              onChange={e => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />

            <div className="pt-1">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isLoggingIn}
              >
                {t.customer.auth.loginButton}
              </Button>
            </div>
          </form>

          {/* Registration Link */}
          <div className="text-center pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs text-slate-600">
            <span>{t.customer.auth.noAccount}</span>
            <button
              onClick={() => setIsRegistering(true)}
              className="font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2"
            >
              {t.customer.auth.createAccount}
            </button>
          </div>

          {/* Jump to Internal Portal */}
          <div className="pt-2 text-center">
            <button
              onClick={() => setPortal('internal_login')}
              className="text-[11px] text-slate-400 hover:text-slate-700 transition-colors"
            >
              Staff & Management Login &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
