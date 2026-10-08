import React, { useState, useRef, useEffect } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { InternalRole } from '../../types/dairy';
import { LanguageSelector } from '../ui/LanguageSelector';
import { ResetPasswordModal } from '../common/ResetPasswordModal';
import {
  Menu,
  Search,
  Bell,
  Plus,
  User,
  KeyRound,
  Globe,
  LogOut,
  ChevronDown,
  Shield,
  Layers,
  Factory,
  ShieldAlert,
  CheckCheck,
  ExternalLink
} from 'lucide-react';

interface InternalHeaderProps {
  onToggleSidebar: () => void;
  onOpenCreateBatch: () => void;
  onOpenRecordPayment: () => void;
  onOpenAddExpense: () => void;
}

export const InternalHeader: React.FC<InternalHeaderProps> = ({
  onToggleSidebar,
  onOpenCreateBatch,
  onOpenRecordPayment,
  onOpenAddExpense,
}) => {
  const {
    internalRole,
    internalView,
    setInternalView,
    currentUser,
    logout,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    addToast,
  } = useDairy();

  const { t } = useTranslation();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => n.recipientType === 'internal' && !n.read).length;

  const roleLabels: Record<InternalRole, string> = {
    admin: t.internal.header.roleAdmin,
    production_manager: t.internal.header.roleProduction,
    warehouse_manager: t.internal.header.roleWarehouse,
    accountant: t.internal.header.roleAccountant,
  };

  const roleBadges: Record<InternalRole, string> = {
    admin: 'bg-purple-50 text-purple-700 border-purple-200',
    production_manager: 'bg-amber-50 text-amber-700 border-amber-200',
    warehouse_manager: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accountant: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  // Human-readable page titles
  const viewTitles: Record<string, string> = {
    dashboard: t.internal.nav.dashboard,
    production: t.internal.nav.production,
    batches: t.internal.nav.batches,
    inventory: t.internal.nav.finishedGoods,
    raw_materials: t.internal.nav.rawMaterials,
    stock_movements: t.internal.nav.stockMovements,
    orders: t.internal.nav.orders,
    invoices: t.internal.nav.invoices,
    customers: t.internal.nav.customers,
    retailers: t.internal.nav.customers,
    payments: t.internal.nav.payments,
    record_payment: 'Record Payment',
    ledger: t.internal.nav.customerLedger,
    expenses: t.internal.nav.expenses,
    expiry: t.internal.nav.expiryManagement,
    reports: t.internal.nav.reports,
    users: t.internal.nav.users,
    roles: t.internal.nav.rolesPermissions,
    products: t.internal.nav.products,
    categories: t.internal.nav.categories,
    channels: t.internal.nav.channels,
    pricing: t.internal.nav.pricing,
    settings: t.internal.nav.settings,
  };

  const displayName = currentUser?.fullName || 'Staff User';
  const roleTitle = roleLabels[internalRole] || 'Internal Staff';

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-2.5 sticky top-0 z-30 shadow-xs shrink-0">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Sidebar toggle & View title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Toggle Sidebar"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-sm font-bold text-slate-900 capitalize leading-none">
              {viewTitles[internalView] || internalView.replace('_', ' ')}
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block mt-0.5">
              Madhav Dairy Central ERP
            </p>
          </div>
        </div>

        {/* Center: Search Input */}
        <div className="hidden md:flex items-center flex-1 max-w-xs mx-4">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={t.internal.header.searchPlaceholder}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs pl-8 pr-3 py-1.5 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-colors"
            />
          </div>
        </div>

        {/* Right: Actions, Language, Verified Role Badge, Profile */}
        <div className="flex items-center gap-2">
          {/* Quick Action Button depending on role */}
          {(internalRole === 'admin' || internalRole === 'production_manager') && (
            <button
              onClick={onOpenCreateBatch}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Batch</span>
            </button>
          )}


          {/* Database Authenticated Role Badge (Non-clickable, coming from Supabase RBAC) */}
          <div className="hidden md:flex items-center">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-2xs ${roleBadges[internalRole] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              <Shield className="w-3 h-3" />
              <span>{roleTitle}</span>
            </span>
          </div>

          {/* Language Selector */}
          <div className="hidden sm:block border-l border-slate-200 pl-2 ml-1">
            <LanguageSelector variant="dropdown" />
          </div>

          {/* Notifications Center Dropdown */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-1.5 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 text-xs">
                {/* Header */}
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">Website Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllNotificationsRead('internal')}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                {/* Notifications List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.filter(n => n.recipientType === 'internal').slice(0, 15).map(n => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.read) markNotificationRead(n.id);
                        if (n.type === 'expiry') {
                          setInternalView('expiry');
                          setIsNotificationsOpen(false);
                        }
                      }}
                      className={`p-3.5 transition-colors cursor-pointer flex gap-3 ${
                        n.read ? 'bg-white hover:bg-slate-50/80 text-slate-600' : 'bg-blue-50/30 hover:bg-blue-50/60 text-slate-900'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-700 border border-amber-200 mt-0.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className={`text-xs font-bold leading-tight ${n.read ? 'text-slate-800' : 'text-slate-950'}`}>
                            {n.title}
                          </h4>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          {n.message}
                        </p>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                          <span>{n.date}</span>
                          {n.type === 'expiry' && (
                            <span className="text-blue-600 font-bold flex items-center gap-0.5 hover:underline">
                              <span>View Freshness Radar</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {notifications.filter(n => n.recipientType === 'internal').length === 0 && (
                    <div className="p-8 text-center text-slate-400">
                      <Bell className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                      <p className="text-xs">No active notifications</p>
                    </div>
                  )}
                </div>

                {/* Footer link to Expiry Radar */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
                  <button
                    onClick={() => {
                      setInternalView('expiry');
                      setIsNotificationsOpen(false);
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Open Expiry Surveillance Radar</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
              aria-label="User Profile Menu"
            >
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left text-xs">
                <span className="font-semibold text-slate-900 block leading-tight truncate max-w-[120px]">
                  {displayName}
                </span>
                <span className="text-[10px] text-slate-500 block leading-tight">
                  {roleTitle}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2.5 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {currentUser?.email || 'Authenticated Employee'}
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded mt-1 border border-blue-100">
                    {roleTitle}
                  </span>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      setIsChangePasswordOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-left transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    <span>Change Password</span>
                  </button>

                  <div className="px-3.5 py-2 flex items-center justify-between border-t border-b border-slate-100 my-1">
                    <span className="text-[11px] font-medium text-slate-600 flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      Language
                    </span>
                    <LanguageSelector variant="compact" />
                  </div>

                  <button
                    onClick={async () => {
                      setIsProfileOpen(false);
                      await logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 text-left font-semibold transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <ResetPasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        title="Change Your Account Password"
        subtitle="Establish a new password for your Madhav Dairy ERP staff account."
      />
    </header>
  );
};
