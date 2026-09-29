import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { LanguageSelector } from '../ui/LanguageSelector';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Milk, Store, User, Phone, Lock, MapPin, ArrowLeft } from 'lucide-react';

interface CustomerRegisterProps {
  onBackToLogin: () => void;
  onSuccess: () => void;
}

export const CustomerRegister: React.FC<CustomerRegisterProps> = ({ onBackToLogin, onSuccess }) => {
  const { registerRetailer } = useDairy();
  const { t } = useTranslation();

  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName || !ownerName || !mobile || !address) return;

    setIsLoading(true);
    try {
      await registerRetailer({
        businessName: shopName,
        ownerName,
        mobile,
        address,
        password,
      });
      onSuccess();
    } catch {
      // Toast displayed in context
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      {/* Container */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5">
        {/* Top Header & Language */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToLogin}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.common.back}</span>
          </button>
          <LanguageSelector variant="compact" />
        </div>

        {/* Brand identity */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-xs mb-2">
            <Milk className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">{t.customer.auth.registerTitle}</h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            {t.customer.auth.registerSubtitle}
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <Input
            label={t.customer.auth.shopNameLabel}
            placeholder="e.g. Sai Dairy & Provision Stores"
            value={shopName}
            onChange={e => setShopName(e.target.value)}
            leftIcon={<Store className="w-4 h-4" />}
            required
          />

          <Input
            label={t.customer.auth.ownerNameLabel}
            placeholder="e.g. Ramesh Patil"
            value={ownerName}
            onChange={e => setOwnerName(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          <Input
            label={t.customer.auth.mobileLabel}
            type="tel"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={mobile}
            onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
            leftIcon={<Phone className="w-4 h-4" />}
            required
          />

          <Input
            label={t.customer.auth.passwordLabel}
            type="password"
            placeholder="Create a 4-6 digit PIN/password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.customer.auth.addressLabel}
            </label>
            <div className="relative">
              <textarea
                rows={2}
                placeholder="Shop number, street, landmark, area"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isLoading}
            >
              {t.customer.auth.registerButton}
            </Button>
          </div>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <button
            onClick={onBackToLogin}
            className="text-xs text-slate-600 hover:text-blue-600 font-semibold"
          >
            {t.customer.auth.alreadyHaveAccount}
          </button>
        </div>
      </div>
    </div>
  );
};
