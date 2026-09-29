import React from 'react';
import { DairyProvider, useDairy } from './context/DairyContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { CustomerLogin } from './components/customer/CustomerLogin';
import { CustomerLayout } from './components/customer/CustomerLayout';
import { InternalLogin } from './components/internal/InternalLogin';
import { InternalLayout } from './components/internal/InternalLayout';
import { ToastContainer } from './components/common/ToastContainer';

const AppContent: React.FC = () => {
  const { portal, setPortal } = useDairy();

  return (
    <div className="relative min-h-screen bg-slate-50">
      {/* Dynamic Portal Router */}
      {portal === 'customer_login' && <CustomerLogin />}
      {portal === 'customer' && <CustomerLayout />}
      {portal === 'internal_login' && <InternalLogin />}
      {portal === 'internal' && <InternalLayout />}

      {/* Floating Global Prototype Switcher (for presentation & testing convenience) */}
      <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 shadow-lg text-white text-[11px] font-medium">
        <span className="text-slate-400 font-normal pr-1 hidden sm:inline">Prototype Portal:</span>
        <button
          onClick={() => setPortal('customer_login')}
          className={`px-2.5 py-1 rounded-full transition-all ${
            portal === 'customer' || portal === 'customer_login'
              ? 'bg-blue-600 text-white font-bold shadow-xs'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Customer Portal
        </button>
        <button
          onClick={() => setPortal('internal')}
          className={`px-2.5 py-1 rounded-full transition-all ${
            portal === 'internal' || portal === 'internal_login'
              ? 'bg-blue-600 text-white font-bold shadow-xs'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Internal ERP
        </button>
      </div>

      {/* Global Toast Notifications */}
      <ToastContainer />
    </div>
  );
};

export function App() {
  return (
    <DairyProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </DairyProvider>
  );
}

export default App;

