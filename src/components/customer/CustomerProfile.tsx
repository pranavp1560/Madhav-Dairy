import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { LanguageSelector } from '../ui/LanguageSelector';
import { Button } from '../ui/Button';
import { ResetPasswordModal } from '../common/ResetPasswordModal';
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
  Globe,
  Mail,
  ShieldCheck,
  FileText
} from 'lucide-react';

export const CustomerProfile: React.FC = () => {
  const { currentRetailer, currentUser, logout } = useDairy();
  const { t } = useTranslation();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const businessName = currentRetailer?.businessName || currentUser?.fullName || 'Retailer Store';
  const ownerName = currentRetailer?.ownerName || currentUser?.fullName || 'Owner';
  const mobile = currentRetailer?.mobile || currentUser?.mobile || '';
  const email = currentRetailer?.email || currentUser?.email || '';
  const address = currentRetailer?.address || 'Registered Address';
  const gstin = currentRetailer?.gstin || '';
  const outstandingAmount = currentRetailer?.outstandingAmount || 0;
  const creditLimit = currentRetailer?.creditLimit || 50000;
  const paymentTerms = currentRetailer?.paymentTerms || 'Net 15 Days';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28 font-sans">
      {/* 1. Page Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {t.customer.profile.title}
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          Manage your registered retail store profile and account preferences
        </p>
      </div>

      {/* 2. Store & Proprietor Profile Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-2xl shrink-0 shadow-sm">
            {businessName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Retail Partner</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
              {businessName}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 flex items-center gap-2 mt-0.5">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800">{ownerName}</span>
            </p>
          </div>
        </div>

        {/* Contact info list */}
        <div className="pt-4 border-t border-slate-100 text-sm sm:text-base grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block uppercase font-bold">Contact Mobile</span>
              <span className="font-mono-numbers font-bold text-slate-900 text-sm sm:text-base">
                {mobile ? `+91 ${mobile}` : 'Not provided'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="truncate">
              <span className="text-xs text-slate-400 block uppercase font-bold">Email Address</span>
              <span className="font-semibold text-slate-900 text-sm sm:text-base truncate block">
                {email || 'Not provided'}
              </span>
            </div>
          </div>

          {gstin && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 block uppercase font-bold">GSTIN</span>
                <span className="font-mono-numbers font-bold text-slate-900 text-sm sm:text-base">
                  {gstin}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 sm:col-span-2 lg:col-span-3 pt-1">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block uppercase font-bold">Delivery Address</span>
              <span className="text-slate-800 font-medium leading-relaxed text-sm sm:text-base">
                {address}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Financial Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-base sm:text-lg">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <span>{t.customer.profile.retailerProfile}</span>
          </div>
          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Payment Terms: {paymentTerms}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              {t.customer.profile.outstandingBalance}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono-numbers mt-1 block">
              ₹{outstandingAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">
              Current amount payable to Madhav Dairy
            </span>
          </div>

          <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              {t.customer.profile.creditLimit}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono-numbers mt-1 block">
              ₹{creditLimit.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">
              Approved revolving credit limit
            </span>
          </div>
        </div>
      </div>

      {/* 4. Language & Security Preferences */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 pb-2.5 border-b border-slate-100">
          Preferences & Security
        </h2>

        {/* Language selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-slate-100">
          <span className="font-semibold text-slate-800 flex items-center gap-2.5 text-sm sm:text-base">
            <Globe className="w-5 h-5 text-blue-600" />
            <span>{t.customer.profile.appLanguage}</span>
          </span>
          <LanguageSelector variant="pills" />
        </div>

        {/* Password update (Min 48px Touch Target) */}
        <button
          onClick={() => setIsPasswordModalOpen(true)}
          className="w-full min-h-[48px] flex items-center justify-between text-left py-2 text-slate-800 hover:text-blue-600 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-slate-400" />
            <span className="font-bold text-sm sm:text-base">{t.customer.profile.changePassword}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* 5. Support Helpline */}
      <div className="bg-blue-50/70 rounded-2xl border border-blue-200 p-5 space-y-1.5 text-center">
        <div className="flex items-center justify-center gap-2 font-bold text-slate-900 text-base">
          <Headphones className="w-5 h-5 text-blue-600" />
          <span>{t.customer.profile.contactMadhavDairy}</span>
        </div>
        <p className="text-slate-800 font-mono-numbers font-black text-lg sm:text-xl">
          {t.customer.profile.supportHotline}
        </p>
        <p className="text-xs sm:text-sm text-slate-600">
          Customer support available 7:00 AM – 8:00 PM for dispatch, billing & order queries
        </p>
      </div>

      {/* 6. Logout Action (Min 48px Target) */}
      <div className="pt-2">
        <button
          onClick={handleLogout}
          className="w-full min-h-[50px] px-5 py-3 rounded-2xl text-base font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2 transition-colors active:scale-[0.99]"
        >
          <LogOut className="w-5 h-5" />
          <span>{t.common.logout}</span>
        </button>
      </div>

      {/* Real Supabase Password Reset Modal */}
      {isPasswordModalOpen && (
        <ResetPasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
        />
      )}
    </div>
  );
};
