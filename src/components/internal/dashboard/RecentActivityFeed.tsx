import React from 'react';
import {
  ShoppingCart,
  Factory,
  Receipt,
  IndianRupee,
  Clock,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { formatINR } from './dashboardUtils';

export interface ActivityEvent {
  id: string;
  type: 'order' | 'batch' | 'invoice' | 'payment';
  title: string;
  subtitle: string;
  timestamp: string;
  amount?: number;
  statusBadge?: string;
  targetView: string;
  entityId?: string;
}

interface RecentActivityFeedProps {
  activities: ActivityEvent[];
  onNavigate: (view: string, entityId?: string) => void;
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  activities,
  onNavigate,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Operational Activity Feed
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Audit trail of orders, production batches, invoices, and payment receipts
          </p>
        </div>
        <span className="text-xs font-bold text-slate-400 font-mono-numbers">
          Latest {activities.length} Events
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-xs">
          No operational activity recorded yet.
        </div>
      ) : (
        <div className="space-y-2.5 my-1 divide-y divide-slate-100">
          {activities.slice(0, 6).map(act => {
            const isOrder = act.type === 'order';
            const isBatch = act.type === 'batch';
            const isInvoice = act.type === 'invoice';
            const isPayment = act.type === 'payment';

            return (
              <div
                key={act.id}
                onClick={() => onNavigate(act.targetView, act.entityId)}
                className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                {/* Left: Icon & Description */}
                <div className="flex items-center gap-3 truncate">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isOrder
                      ? 'bg-blue-50 text-blue-600'
                      : isBatch
                      ? 'bg-teal-50 text-teal-600'
                      : isInvoice
                      ? 'bg-purple-50 text-purple-600'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {isOrder && <ShoppingCart className="w-4 h-4" />}
                    {isBatch && <Factory className="w-4 h-4" />}
                    {isInvoice && <Receipt className="w-4 h-4" />}
                    {isPayment && <IndianRupee className="w-4 h-4" />}
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {act.title}
                      </span>
                      {act.statusBadge && (
                        <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {act.statusBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {act.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right: Amount & Timestamp */}
                <div className="text-right flex-shrink-0 flex items-center gap-3">
                  <div>
                    {act.amount !== undefined && (
                      <span className="block text-xs font-black font-mono-numbers text-slate-900">
                        {formatINR(act.amount)}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">
                      {act.timestamp}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Continuous ledger audit synchronization</span>
        <button
          onClick={() => onNavigate('reports')}
          className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
        >
          <span>Audit Reports</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
