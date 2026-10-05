import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { LanguageSelector } from '../ui/LanguageSelector';
import { authService } from '../../services/authService';
import { Store, User, Phone, Lock, Mail, MapPin, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface CustomerRegisterProps {
  onBackToLogin: () => void;
  onSuccess: () => void;
}

export const CustomerRegister: React.FC<CustomerRegisterProps> = ({ onBackToLogin, onSuccess }) => {
  const { addToast } = useDairy();
  const { t } = useTranslation();

  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Pune');
  const [state, setState] = useState('Maharashtra');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.replace(/\D/g, '');

    // Validation
    if (!shopName.trim() || !ownerName.trim() || !cleanEmail || !cleanMobile || !password || !address.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (cleanMobile.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.signUpCustomer({
        businessName: shopName.trim(),
        ownerName: ownerName.trim(),
        email: cleanEmail,
        mobile: cleanMobile,
        password,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim() || undefined,
        gstin: gstin.trim() || undefined,
      });

      if (result.requiresEmailConfirmation) {
        setRequiresConfirmation(true);
      } else {
        addToast(`Retailer account for "${shopName.trim()}" created successfully!`, 'success');
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please check your information.');
    } finally {
      setIsLoading(false);
    }
  };

  if (requiresConfirmation) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Verify Your Email Address</h1>
          <p className="text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
            A confirmation email has been dispatched to <strong className="text-slate-900">{email}</strong>. Please check your inbox and confirm your address to activate your Madhav Dairy retailer account.
          </p>
          <div className="pt-2">
            <button
              onClick={onBackToLogin}
              className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition-colors"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 font-sans py-8">
      {/* Container */}
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-5">
        {/* Top Header & Language */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToLogin}
            className="min-h-[44px] px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-2 text-sm font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.common.back}</span>
          </button>
          <LanguageSelector variant="compact" />
        </div>

        {/* Brand identity */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center p-2.5 bg-white border border-slate-200 rounded-2xl mx-auto shadow-2xs mb-2 max-w-[200px]">
            <img src="/logo.png" alt="Madhav Dairy" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t.customer.auth.registerTitle}</h1>
          <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            {t.customer.auth.registerSubtitle}
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-bold text-slate-800 text-sm mb-1.5">
              {t.customer.auth.shopNameLabel} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Store className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                placeholder="e.g. Sai Dairy & Provision Stores"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                className="w-full h-12 min-h-[48px] pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 text-sm mb-1.5">
              {t.customer.auth.ownerNameLabel} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Patil"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                className="w-full h-12 min-h-[48px] pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 text-sm mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="ramesh@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-12 min-h-[48px] pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 text-sm mb-1.5">
                {t.customer.auth.mobileLabel} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10-digit mobile"
                  value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-12 min-h-[48px] pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl font-mono-numbers text-slate-900 text-base focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 text-sm mb-1.5">
              {t.customer.auth.passwordLabel} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Choose a password (min 6 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-12 min-h-[48px] pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 text-sm mb-1.5">
              {t.customer.auth.addressLabel} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-5 h-5 text-slate-400 absolute left-4 top-3.5 pointer-events-none" />
              <textarea
                rows={2}
                required
                placeholder="Shop number, market, street, area"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full p-3.5 pl-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 text-sm mb-1.5">City</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full h-12 min-h-[48px] px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 text-sm mb-1.5">State</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                className="w-full h-12 min-h-[48px] px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-base shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60"
            >
              {isLoading ? 'Creating Retailer Account...' : t.customer.auth.registerButton}
            </button>
          </div>
        </form>

        <div className="text-center pt-3 border-t border-slate-100">
          <button
            onClick={onBackToLogin}
            className="min-h-[44px] text-sm text-slate-600 hover:text-blue-600 font-bold"
          >
            {t.customer.auth.alreadyHaveAccount}
          </button>
        </div>
      </div>
    </div>
  );
};
