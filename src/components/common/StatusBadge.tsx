import React from 'react';
import { OrderStatus, BatchStatus, ExpirySeverity, MovementType } from '../../types/dairy';

interface StatusBadgeProps {
  status: string;
  type?: 'order' | 'batch' | 'expiry' | 'invoice' | 'movement';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'order',
  size = 'md',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  if (type === 'order') {
    const s = status as string;
    switch (s) {
      case 'pending':
        return <span className={`${sizeClasses} rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200`}>Pending</span>;
      case 'confirmed':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200`}>Confirmed</span>;
      case 'preparing':
        return <span className={`${sizeClasses} rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200`}>Preparing</span>;
      case 'dispatched':
        return <span className={`${sizeClasses} rounded-full font-medium bg-sky-50 text-sky-700 border border-sky-200`}>Dispatched</span>;
      case 'delivered':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-green-50 text-green-700 border border-green-200`}>Delivered</span>;
      case 'cancelled':
        return <span className={`${sizeClasses} rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200`}>Cancelled</span>;
      default:
        return <span className={`${sizeClasses} rounded-full font-medium bg-slate-100 text-slate-600`}>{status}</span>;
    }
  }

  if (type === 'expiry') {
    const sev = status as ExpirySeverity;
    switch (sev) {
      case 'urgent':
        return (
          <span className={`${sizeClasses} rounded-full font-semibold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1`}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
            Urgent (≤3d)
          </span>
        );
      case 'soon':
        return (
          <span className={`${sizeClasses} rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Soon (≤5d)
          </span>
        );
      case 'upcoming':
        return (
          <span className={`${sizeClasses} rounded-full font-medium bg-yellow-50 text-yellow-800 border border-yellow-200 flex items-center gap-1`}>
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
            Upcoming (≤7d)
          </span>
        );
      case 'expired':
        return (
          <span className={`${sizeClasses} rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1`}>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
            Expired
          </span>
        );
      default:
        return <span className={`${sizeClasses} rounded-full font-medium bg-green-50 text-green-700 border border-green-200`}>Fresh</span>;
    }
  }

  if (type === 'batch') {
    const bs = status as BatchStatus;
    switch (bs) {
      case 'active':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-green-50 text-green-700 border border-green-200`}>Active</span>;
      case 'near_expiry':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200`}>Near Expiry</span>;
      case 'expired':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-red-50 text-red-700 border border-red-200`}>Expired</span>;
      case 'exhausted':
        return <span className={`${sizeClasses} rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200`}>Exhausted</span>;
      default:
        return <span className={`${sizeClasses} rounded-full font-medium bg-slate-100 text-slate-600`}>{status}</span>;
    }
  }

  if (type === 'invoice') {
    switch (status) {
      case 'ready':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-sky-50 text-sky-700 border border-sky-200`}>Ready</span>;
      case 'delivered':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200`}>Delivered</span>;
      case 'open_payment':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200`}>Open Payment</span>;
      case 'settled':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200`}>Settled</span>;
      case 'cancelled':
        return <span className={`${sizeClasses} rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200`}>Cancelled</span>;
      // Legacy fallback
      case 'paid':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200`}>Settled</span>;
      case 'partial':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200`}>Open Payment</span>;
      case 'unpaid':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-sky-50 text-sky-700 border border-sky-200`}>Ready</span>;
      default:
        return <span className={`${sizeClasses} rounded-full font-medium bg-slate-100 text-slate-600`}>{status}</span>;
    }
  }

  if (type === 'movement') {
    const mt = status as MovementType;
    switch (mt) {
      case 'production':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-green-50 text-green-700 border border-green-200`}>+ Production</span>;
      case 'sale':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200`}>- Sale Outward</span>;
      case 'return':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200`}>+ Return Inward</span>;
      case 'damage':
        return <span className={`${sizeClasses} rounded-full font-semibold bg-rose-50 text-rose-700 border border-rose-200`}>- Damaged / Scrap</span>;
      case 'transfer':
        return <span className={`${sizeClasses} rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200`}>⇄ Transfer</span>;
      case 'adjustment':
        return <span className={`${sizeClasses} rounded-full font-medium bg-purple-50 text-purple-700 border border-purple-200`}>± Adjustment</span>;
      default:
        return <span className={`${sizeClasses} rounded-full font-medium bg-slate-100 text-slate-600`}>{status}</span>;
    }
  }

  return (
    <span className={`${sizeClasses} rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200`}>
      {status}
    </span>
  );
};
