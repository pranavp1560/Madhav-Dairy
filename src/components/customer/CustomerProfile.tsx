import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { LanguageSelector } from '../ui/LanguageSelector';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import {
  Store,
  User,
  Phone,
  MapPin,
  CreditCard,
  Lock,
  Headphones,
  LogOut,
  ChevronRight,
  Globe
} from 'lucide-react';

export const CustomerProfile: React.FC = () => {
  const { currentRetailer, setPortal, addToast } = useDairy();
  const { t } = useTranslation();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');

  const handleLogout = () => {
    setPortal('customer_login');
    addToast('Logged out of Retailer Portal', 'info');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin) return;
    setIsPasswordModalOpen(false);
    setOldPin('');
    setNewPin('');
    addToast('Password updated successfully!', 'success');
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Profile Details Card (Section 38) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
            {currentRetailer.businessName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Retailer Store
            </span>
            <h1 className="text-base font-bold text-slate-900 mt-1 truncate">
              {currentRetailer.businessName}
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentRetailer.ownerName}</span>
            </p>
          </div>
        </div>

        {/* Contact info list */}
        <div className="pt-3 border-t border-slate-100 text-xs space-y-2 text-slate-700">
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-mono-numbers font-medium">+91 {currentRetailer.mobile}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>{currentRetailer.address}</span>
          </div>
        </div>
      </div>

      {/* Financial Account Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <CreditCard className="w-4 h-4 text-blue-600" />
          <span>{t.customer.profile.retailerProfile}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 block uppercase">
              {t.customer.profile.outstandingBalance}
            </span>
            <span className="text-base font-bold text-slate-900 font-mono-numbers mt-0.5 block">
              ₹{currentRetailer.outstandingAmount.toLocaleString()}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 block uppercase">
              {t.customer.profile.creditLimit}
            </span>
            <span className="text-base font-bold text-slate-900 font-mono-numbers mt-0.5 block">
              ₹{currentRetailer.creditLimit.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
          <span>{t.customer.profile.paymentTerms}:</span>
          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            {currentRetailer.paymentTerms}
          </span>
        </div>
      </div>

      {/* Preferences & Language (Section 38 & 41) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="font-semibold text-slate-800 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <span>{t.customer.profile.appLanguage}</span>
          </span>
          <LanguageSelector variant="pills" />
        </div>

        <button
          onClick={() => setIsPasswordModalOpen(true)}
          className="w-full flex items-center justify-between text-left py-1 text-slate-700 hover:text-slate-900 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400" />
            <span className="font-medium">{t.customer.profile.changePassword}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Support Helpline */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-1.5 text-xs text-center">
        <div className="flex items-center justify-center gap-1.5 font-bold text-slate-900">
          <Headphones className="w-4 h-4 text-blue-600" />
          <span>{t.customer.profile.contactMadhavDairy}</span>
        </div>
        <p className="text-slate-600 font-mono-numbers font-medium">
          {t.customer.profile.supportHotline}
        </p>
      </div>

      {/* Logout Action */}
      <div className="pt-2">
        <Button
          variant="secondary"
          size="md"
          className="w-full text-red-600 border-red-200 hover:bg-red-50"
          icon={<LogOut className="w-4 h-4" />}
          onClick={handleLogout}
        >
          {t.common.logout}
        </Button>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title={t.customer.profile.changePassword}
        subtitle="Update your mobile access PIN/password"
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
            <input
              type="password"
              value={oldPin}
              onChange={e => setOldPin(e.target.value)}
              placeholder="Enter current PIN"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 text-xs"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">New 4-6 Digit Password</label>
            <input
              type="password"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              placeholder="Enter new PIN"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 text-xs"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsPasswordModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Password
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
