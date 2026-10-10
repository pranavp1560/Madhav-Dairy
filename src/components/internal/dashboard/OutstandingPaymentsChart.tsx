import React from 'react';
import { Layers, AlertCircle, ArrowUpRight, IndianRupee } from 'lucide-react';
import { formatINR } from './dashboardUtils';

export interface CustomerOutstandingItem {
  customerId: string;
  businessName: string;
  outstandingAmount: number;
  creditLimit: number;
  overdueAmount: number;
  lastInvoiceDate?: string;
}

interface OutstandingPaymentsChartProps {
  customers: CustomerOutstandingItem[];
  totalOutstanding: number;
  totalOverdue: number;
  onNavigateToInvoices: () => void;
  onSelectCustomer?: (customerId: string) => void;
}

export const OutstandingPaymentsChart: React.FC<OutstandingPaymentsChartProps> = ({
  customers,
  totalOutstanding,
  totalOverdue,
  onNavigateToInvoices,
  onSelectCustomer,
}) => {
  const maxOutstanding = Math.max(...customers.map(c => c.outstandingAmount), 1000);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-600" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Customer Receivables & Aging
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Credit limits, active balances, and overdue invoices by wholesale retailer
          </p>
        </div>
        <button
          onClick={onNavigateToInvoices}
          className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 transition-colors"
        >
          <span>All Invoices</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Open</span>
            <div className="text-sm font-black text-slate-900 font-mono-numbers">
              {formatINR(totalOutstanding)}
            </div>
          </div>
          <span className="text-[10px] text-slate-500">Unsettled</span>
        </div>

        <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
          totalOverdue > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-100'
        }`}>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Overdue Dues</span>
            <div className={`text-sm font-black font-mono-numbers ${
              totalOverdue > 0 ? 'text-rose-700' : 'text-slate-900'
            }`}>
              {formatINR(totalOverdue)}
            </div>
          </div>
          {totalOverdue > 0 && (
            <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
              Action
            </span>
          )}
        </div>
      </div>

      {/* Customer Balances List */}
      {customers.length === 0 || totalOutstanding === 0 ? (
        <div className="h-44 flex items-center justify-center text-slate-400 text-xs">
          All delivered invoices have been fully settled. Zero outstanding balance!
        </div>
      ) : (
        <div className="space-y-2.5 my-1 overflow-y-auto max-h-52 pr-1 scrollbar-thin">
          {customers.slice(0, 5).map(cust => {
            const percentOfLimit = cust.creditLimit > 0
              ? Math.min(100, Math.round((cust.outstandingAmount / cust.creditLimit) * 100))
              : 50;
            const isNearLimit = percentOfLimit >= 85;

            return (
              <div
                key={cust.customerId}
                onClick={() => onSelectCustomer?.(cust.customerId)}
                className="p-2 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-200/80 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2 truncate max-w-[60%]">
                    <span className="font-semibold text-slate-800 truncate">
                      {cust.businessName}
                    </span>
                    {cust.overdueAmount > 0 && (
                      <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="text-right font-mono-numbers">
                    <span className="font-bold text-slate-900">
                      {formatINR(cust.outstandingAmount)}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">
                      / {formatINR(cust.creditLimit, true)}
                    </span>
                  </div>
                </div>

                {/* Balance vs Credit Limit Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isNearLimit
                        ? 'bg-rose-500'
                        : cust.overdueAmount > 0
                        ? 'bg-amber-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${percentOfLimit}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="pt-2.5 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Across <strong className="text-slate-800">{customers.length}</strong> active retail customers</span>
        <button
          onClick={onNavigateToInvoices}
          className="text-blue-600 font-semibold hover:underline"
        >
          Collect Payments &rarr;
        </button>
      </div>
    </div>
  );
};
