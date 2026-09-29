import React from 'react';
import { useDairy } from '../../context/DairyContext';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useDairy();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-elevated border transition-all transform translate-y-0 duration-300 ${
            toast.type === 'success'
              ? 'bg-white border-green-200 text-slate-800 ring-1 ring-green-500/10'
              : toast.type === 'warning'
              ? 'bg-amber-50 border-amber-300/60 text-amber-900'
              : toast.type === 'error'
              ? 'bg-red-50 border-red-300/60 text-red-900'
              : 'bg-white border-blue-200 text-slate-800 ring-1 ring-blue-500/10'
          }`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
          </div>
          <div className="flex-1 text-xs font-semibold leading-tight text-slate-800">
            {toast.message}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
