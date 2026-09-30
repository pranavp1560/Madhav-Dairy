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
    <div className="max-w-4xl mx-auto space-y-4 pb-28 font-sans">
      {/* 1. Store & Proprietor Profile Details Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-2xs">
            {businessName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 mb-0.5">
              <ShieldCheck className="w-3 h-3" />
              <span>Verified Retail Partner</span>
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 truncate">
              {businessName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5 mt-0.5">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800">{ownerName}</span>
            </p>
          </div>
        </div>

        {/* Contact info list */}
        <div className="pt-3 border-t border-slate-100 text-xs sm:text-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-slate-700">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Contact Mobile</span>
              <span className="font-mono-numbers font-bold text-slate-900 text-xs sm:text-sm">
                {mobile ? `+91 ${mobile}` : 'Not provided'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Email Address</span>
              <span className="font-semibold text-slate-900 text-xs sm:text-sm truncate block">
                {email || 'Not provided'}
              </span>
            </div>
          </div>

          {gstin && (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">GSTIN</span>
                <span className="font-mono-numbers font-semibold text-slate-900 text-xs sm:text-sm">
                  {gstin}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 sm:col-span-2 lg:col-span-3">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Delivery Address</span>
              <span className="text-slate-800 font-medium leading-relaxed text-xs sm:text-sm">
                {address}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Financial Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4 text-xs sm:text-sm">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm sm:text-base">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span>{t.customer.profile.retailerProfile}</span>
          </div>
          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            Payment Terms: {paymentTerms}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              {t.customer.profile.outstandingBalance}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900 font-mono-numbers mt-1 block">
              ₹{outstandingAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Current amount payable to Madhav Dairy
            </span>
          </div>

          <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              {t.customer.profile.creditLimit}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900 font-mono-numbers mt-1 block">
              ₹{creditLimit.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Approved revolving credit limit
            </span>
          </div>
        </div>
      </div>

      {/* 3. Language & Security Preferences */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3 text-xs sm:text-sm">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
          Preferences & Security
        </h3>

        {/* Language selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-1.5 border-b border-slate-100">
          <span className="font-semibold text-slate-800 flex items-center gap-2 text-xs sm:text-sm">
            <Globe className="w-4 h-4 text-blue-600" />
            <span>{t.customer.profile.appLanguage}</span>
          </span>
          <LanguageSelector variant="pills" />
        </div>

        {/* Password update */}
        <button
          onClick={() => setIsPasswordModalOpen(true)}
          className="w-full min-h-[40px] flex items-center justify-between text-left py-1.5 text-slate-800 hover:text-blue-600 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-xs sm:text-sm">{t.customer.profile.changePassword}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* 4. Support Helpline */}
      <div className="bg-blue-50/60 rounded-xl border border-blue-200 p-4 space-y-1 text-center text-xs sm:text-sm">
        <div className="flex items-center justify-center gap-2 font-bold text-slate-900 text-sm">
          <Headphones className="w-4 h-4 text-blue-600" />
          <span>{t.customer.profile.contactMadhavDairy}</span>
        </div>
        <p className="text-slate-700 font-mono-numbers font-bold text-sm sm:text-base">
          {t.customer.profile.supportHotline}
        </p>
        <p className="text-[11px] text-slate-500">
          Customer support available 7:00 AM – 8:00 PM for dispatch & billing queries
        </p>
      </div>

      {/* 5. Logout Action */}
      <div className="pt-1">
        <Button
          variant="secondary"
          size="md"
          className="w-full h-10 sm:h-11 text-xs sm:text-sm font-bold text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          icon={<LogOut className="w-4 h-4" />}
          onClick={handleLogout}
        >
          {t.common.logout}
        </Button>
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
