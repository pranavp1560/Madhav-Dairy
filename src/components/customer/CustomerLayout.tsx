import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { LanguageSelector } from '../ui/LanguageSelector';
import { CustomerHome } from './CustomerHome';
import { CustomerCatalog } from './CustomerCatalog';
import { CustomerCart } from './CustomerCart';
import { CustomerOrders } from './CustomerOrders';
import { CustomerAlerts } from './CustomerAlerts';
import { CustomerProfile } from './CustomerProfile';
import {
  Home,
  ShoppingBag,
  Clock,
  User,
  Bell,
  Smartphone,
  Maximize2,
  ShieldCheck,
  Milk,
  ShoppingCart
} from 'lucide-react';

export const CustomerLayout: React.FC = () => {
  const {
    setPortal,
    cartCount,
    notifications,
    currentRetailer,
    customerViewMode,
    setCustomerViewMode,
  } = useDairy();

  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<string>('home');

  const unreadAlertsCount = notifications.filter(
    n => n.recipientType === 'customer' && !n.read
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
      case 'alerts':
        return <CustomerAlerts onNavigate={tab => setActiveTab(tab)} />;
      case 'profile':
        return <CustomerProfile />;
      default:
        return <CustomerHome onNavigate={tab => setActiveTab(tab)} />;
    }
  };

  // Section 30 Bottom Navigation Items (Exactly 5 items)
  const navItems = [
    { id: 'home', label: t.customer.nav.home, icon: Home },
    { id: 'products', label: t.customer.nav.products, icon: ShoppingBag },
    { id: 'orders', label: t.customer.nav.orders, icon: Clock },
    {
      id: 'alerts',
      label: t.customer.nav.alerts,
      icon: Bell,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : null,
      badgeColor: 'bg-semanticRed-600',
    },
    { id: 'profile', label: t.customer.nav.profile, icon: User },
  ];

  const content = (
    <div className="flex flex-col min-h-screen bg-slate-50 max-w-md mx-auto relative shadow-card overflow-x-hidden font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Milk className="w-4 h-4 text-white" />
          </div>
          <div className="truncate">
            <span className="text-xs font-bold text-slate-900 block leading-tight truncate">
              {t.common.appTitle}
            </span>
            <span className="text-[10px] text-blue-600 font-semibold block leading-tight truncate">
              {currentRetailer.businessName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Language Selector */}
          <LanguageSelector variant="compact" />

          {/* Cart Icon in Header (Section 30) */}
          <button
            onClick={() => setActiveTab('cart')}
            className={`relative p-2 rounded-xl border transition-all ${
              activeTab === 'cart'
                ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-400'
            }`}
            title="Cart"
            aria-label="View Cart"
          >
            <ShoppingCart className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs font-mono-numbers ring-2 ring-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Screen Content */}
      <main className="flex-1 overflow-y-auto">
        {renderScreen()}
      </main>

      {/* Section 30 Bottom Navigation Bar (5 Items: Home, Products, Orders, Alerts, Profile) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-2 flex justify-around items-center max-w-md mx-auto z-30 shadow-lg">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-all relative select-none ${
                isActive
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 stroke-[2.2]' : 'stroke-[1.8]'
                  }`}
                />
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`absolute -top-1 -right-2 text-[9px] font-bold px-1.5 py-0.2 rounded-full text-white font-mono-numbers ${
                      item.badgeColor || 'bg-red-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 py-2 sm:py-6 px-2 sm:px-4">
      {/* Top Prototype Toolbar: View Mode & Jump to Internal */}
      <div className="max-w-md mx-auto mb-3 flex items-center justify-between text-xs text-white px-2">
        <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setCustomerViewMode('device_frame')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
              customerViewMode === 'device_frame'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Phone Frame</span>
          </button>
          <button
            onClick={() => setCustomerViewMode('fluid')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
              customerViewMode === 'fluid'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fluid View</span>
          </button>
        </div>

        {/* Jump to Internal ERP */}
        <button
          onClick={() => setPortal('internal')}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all"
        >
          <ShieldCheck className="w-4 h-4 text-blue-200" />
          <span>Switch to ERP &rarr;</span>
        </button>
      </div>

      {/* Screen Presentation: Frame vs Fluid */}
      {customerViewMode === 'device_frame' ? (
        <div className="flex justify-center items-center py-2">
          {/* Simulated Smartphone Shell */}
          <div className="relative border-[10px] border-slate-950 rounded-[44px] shadow-2xl overflow-hidden max-w-[420px] w-full ring-1 ring-white/10 bg-slate-50">
            {/* Notch / Speaker bar */}
            <div className="bg-slate-950 h-5 w-full flex items-center justify-center">
              <div className="w-16 h-2 bg-slate-800 rounded-full"></div>
            </div>
            {content}
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto">
          {content}
        </div>
      )}
    </div>
  );
};
