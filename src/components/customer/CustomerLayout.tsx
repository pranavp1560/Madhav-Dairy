import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { LanguageSelector } from '../ui/LanguageSelector';
import { CustomerHome } from './CustomerHome';
import { CustomerCatalog } from './CustomerCatalog';
import { CustomerCart } from './CustomerCart';
import { CustomerOrders } from './CustomerOrders';
import { CustomerPayments } from './CustomerPayments';
import { CustomerAlerts } from './CustomerAlerts';
import { CustomerExpiryAlerts } from './CustomerExpiryAlerts';
import { CustomerProfile } from './CustomerProfile';
import {
  Home,
  ShoppingBag,
  Clock,
  CreditCard,
  User,
  Bell,
  ShoppingCart,
  LogOut,
  Store
} from 'lucide-react';

export const CustomerLayout: React.FC = () => {
  const {
    cartCount,
    notifications,
    currentRetailer,
    currentUser,
    logout,
  } = useDairy();

  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<string>('home');

  const unreadAlertsCount = notifications.filter(
    n => n.recipientType === 'customer' && (!n.recipientId || (currentRetailer && n.recipientId === currentRetailer.id)) && !n.read
  ).length;

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <CustomerHome onNavigate={tab => setActiveTab(tab)} />;
      case 'products':
        return <CustomerCatalog onNavigate={tab => setActiveTab(tab)} />;
      case 'cart':
        return <CustomerCart onNavigate={tab => setActiveTab(tab)} />;
      case 'orders':
        return <CustomerOrders onNavigate={tab => setActiveTab(tab)} />;
      case 'payments':
        return <CustomerPayments onNavigate={tab => setActiveTab(tab)} />;
      case 'alerts':
        return <CustomerAlerts onNavigate={tab => setActiveTab(tab)} />;
      case 'expiry':
        return <CustomerExpiryAlerts onNavigate={tab => setActiveTab(tab)} />;
      case 'profile':
        return <CustomerProfile />;
      default:
        return <CustomerHome onNavigate={tab => setActiveTab(tab)} />;
    }
  };

  const navItems = [
    { id: 'home', label: t.customer.nav.home, icon: Home },
    { id: 'products', label: t.customer.nav.products, icon: ShoppingBag },
    { id: 'orders', label: t.customer.nav.orders, icon: Clock },
    { id: 'payments', label: t.customer.nav.payments, icon: CreditCard },
    { id: 'profile', label: t.customer.nav.profile, icon: User },
  ];

  const businessDisplayName = currentRetailer?.businessName || currentUser?.fullName || 'Retailer Partner';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Top Responsive Application Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          {/* Logo & Store Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setActiveTab('home')}
              className="h-11 px-2 rounded-xl bg-white border border-slate-200/90 hover:border-blue-300 flex items-center justify-center shadow-2xs shrink-0 transition-colors"
              title="Home"
              aria-label="Madhav Dairy Home"
            >
              <img src="/logo.png" alt="Madhav Dairy" className="h-8 sm:h-9 w-auto max-w-[110px] sm:max-w-[130px] object-contain" />
            </button>
            <div className="min-w-0">
              <span className="text-base sm:text-lg font-bold text-slate-900 block leading-tight truncate">
                {t.common.appTitle}
              </span>
              <span className="text-xs sm:text-sm text-blue-700 font-semibold block leading-tight truncate flex items-center gap-1.5 mt-0.5">
                <Store className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                <span className="truncate">{businessDisplayName}</span>
              </span>
            </div>
          </div>

          {/* Desktop & Tablet Navigation Bar */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1.5 rounded-xl border border-slate-200">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-all relative ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notification Bell */}
            <button
              onClick={() => setActiveTab('alerts')}
              className={`relative min-h-[44px] min-w-[44px] p-2.5 rounded-xl border transition-all flex items-center justify-center ${
                activeTab === 'alerts'
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
              }`}
              title="Alerts & Updates"
              aria-label="View Alerts"
            >
              <Bell className="w-5 h-5" />
              {unreadAlertsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-red-500 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {/* Language Selector */}
            <LanguageSelector variant="compact" />

            {/* Cart Button */}
            <button
              onClick={() => setActiveTab('cart')}
              className={`relative min-h-[44px] px-3.5 py-2 rounded-xl border transition-all flex items-center gap-2 font-bold text-sm ${
                activeTab === 'cart'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
              title="Shopping Cart"
              aria-label="View Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="bg-blue-600 text-white font-extrabold text-xs px-2 py-0.5 rounded-full flex items-center justify-center font-mono-numbers ring-2 ring-white shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Sign Out Button (Desktop) */}
            <button
              onClick={() => logout()}
              className="hidden lg:flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors text-sm font-medium"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
        {renderScreen()}
      </main>

      {/* Mobile Bottom Navigation Bar (Hidden on md/lg/xl viewports) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-2 flex justify-around items-center z-30 shadow-lg min-h-[60px]">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 min-h-[48px] flex flex-col items-center justify-center py-1 rounded-xl transition-all relative select-none ${
                isActive
                  ? 'text-blue-700 font-bold bg-blue-50/80'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
                }`}
              />
              <span className="text-xs mt-1 font-semibold tracking-tight truncate max-w-[64px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
