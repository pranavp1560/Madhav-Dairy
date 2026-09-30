import React from 'react';
import { DairyProvider, useDairy } from './context/DairyContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { CustomerLogin } from './components/customer/CustomerLogin';
import { CustomerLayout } from './components/customer/CustomerLayout';
import { InternalLogin } from './components/internal/InternalLogin';
import { InternalLayout } from './components/internal/InternalLayout';
import { ToastContainer } from './components/common/ToastContainer';
import { ResetPasswordModal } from './components/common/ResetPasswordModal';
import { Milk, Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    portal,
    currentUser,
    isLoading,
    isPasswordRecovery,
    setIsPasswordRecovery,
  } = useDairy();

  // Full-page branded loading splash while initializing session & credentials
  if (isLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white font-sans">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-4 animate-pulse">
          <Milk className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Madhav Dairy</h1>
        <p className="text-xs text-slate-400 mt-1">Verifying session & database security...</p>
        <div className="mt-6 flex items-center gap-2 text-xs text-blue-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Connecting to Supabase...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-50 font-sans">
      {/* Dynamic Production Router based on Authenticated Identity */}
      {currentUser ? (
        currentUser.userType === 'customer' ? (
          <CustomerLayout />
        ) : (
          <InternalLayout />
        )
      ) : (
        portal === 'internal_login' ? (
          <InternalLogin />
        ) : (
          <CustomerLogin />
        )
      )}

      {/* Global Password Recovery Modal when recovery link is activated */}
      <ResetPasswordModal
        isOpen={isPasswordRecovery}
        onClose={() => setIsPasswordRecovery(false)}
        title="Set New Account Password"
        subtitle="You accessed your account via a secure password recovery link. Please choose a new password."
      />

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
