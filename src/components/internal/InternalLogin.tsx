import React, { useState } from 'react';
import { useDairy } from '../../context/DairyContext';
import { InternalRole } from '../../types/dairy';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Shield, ArrowRight, ArrowLeft, KeyRound, UserCheck, Milk } from 'lucide-react';

export const InternalLogin: React.FC = () => {
  const { setPortal, setInternalRole, addToast } = useDairy();
  const [email, setEmail] = useState('admin@madhavdairy.com');
  const [password, setPassword] = useState('admin123');

  const demoRoles: { role: InternalRole; title: string; email: string; desc: string }[] = [
    { role: 'admin', title: 'Owner / Admin', email: 'admin@madhavdairy.com', desc: 'Full business & system access' },
    { role: 'production_manager', title: 'Production Manager', email: 'production@madhavdairy.com', desc: 'Batches, processing, QC' },
    { role: 'accountant', title: 'Accountant', email: 'accounts@madhavdairy.com', desc: 'Invoices, ledger, collections' },
    { role: 'warehouse_manager', title: 'Warehouse / Stock Manager', email: 'warehouse@madhavdairy.com', desc: 'Inventory & stock movements' },
  ];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setPortal('internal');
    addToast('Logged in successfully as Internal User', 'success');
  };

  const handleSelectRole = (role: InternalRole, userEmail: string) => {
    setInternalRole(role);
    setEmail(userEmail);
    setPassword('password123');
    setPortal('internal');
    const roleTitle = demoRoles.find(r => r.role === role)?.title;
    addToast(`Logged in as ${roleTitle}`, 'success');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 text-slate-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header with Blue Badge */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-200 text-center relative">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-xl border border-blue-200/60 mb-2 shadow-xs">
            <Milk className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Madhav Dairy ERP</h1>
          <p className="text-xs text-blue-600 mt-0.5 uppercase tracking-wider font-semibold">
            Internal Management System
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Role Quick Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Select Demo Role to Log In:
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {demoRoles.map(item => (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => handleSelectRole(item.role, item.email)}
                  className="p-3 text-left rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-blue-50 hover:border-blue-300 transition-all group"
                >
                  <span className="text-xs font-bold text-slate-800 block group-hover:text-blue-600">
                    {item.title}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                    {item.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-400 uppercase font-bold">
              or enter credentials
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-colors"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
            >
              Sign In to ERP Dashboard &rarr;
            </Button>
          </form>

          {/* Back to Customer Link */}
          <div className="text-center pt-3 border-t border-slate-200">
            <button
              onClick={() => setPortal('customer_login')}
              className="text-xs text-slate-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retailer Customer Portal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
