import React from 'react';

export type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'gray';

export interface StatusBadgeProps {
  status: string;
  tone?: BadgeTone;
  label?: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  tone,
  label,
  size = 'md',
  showDot = true,
  className = '',
}) => {
  // Determine tone automatically if not explicitly provided
  let effectiveTone: BadgeTone = tone || 'gray';

  if (!tone) {
    const s = status.toLowerCase();
    if (['healthy', 'active', 'delivered', 'paid', 'settled', 'success', 'available', 'completed'].includes(s)) {
      effectiveTone = 'green';
    } else if (['near_expiry', 'soon', 'upcoming', 'preparing', 'partial', 'low_stock', 'warning', 'open_payment'].includes(s)) {
      effectiveTone = 'amber';
    } else if (['urgent', 'expired', 'cancelled', 'out_of_stock', 'unpaid', 'danger', 'damage'].includes(s)) {
      effectiveTone = 'red';
    } else if (['pending', 'dispatched', 'confirmed', 'ready', 'production', 'info'].includes(s)) {
      effectiveTone = 'blue';
    } else {
      effectiveTone = 'gray';
    }
  }

  const toneClasses = {
    green: 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]',
    amber: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
    red: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]',
    blue: 'bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE]',
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const dotClasses = {
    green: 'bg-[#16A34A]',
    amber: 'bg-[#F59E0B]',
    red: 'bg-[#DC2626]',
    blue: 'bg-[#2563EB]',
    gray: 'bg-slate-400',
  };

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  // Format label text if not custom provided
  const displayText = label || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${toneClasses[effectiveTone]} ${sizeClasses[size]} ${className}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClasses[effectiveTone]}`} />
      )}
      <span>{displayText}</span>
    </span>
  );
};
