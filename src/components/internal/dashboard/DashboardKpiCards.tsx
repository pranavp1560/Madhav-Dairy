import React from 'react';
import { useDairy } from '../../../context/DairyContext';
import { useTranslation } from '../../../i18n/LanguageContext';
import { getTodayDateString, calculateDaysRemaining } from '../../../utils/dateUtils';
import {
  TrendingUp,
  ShoppingCart,
  Factory,
  AlertTriangle,
  Clock,
  CreditCard,
  ArrowUpRight
} from 'lucide-react';

interface DashboardKpiCardsProps {
  onNavigate?: (view: string) => void;
}

export const DashboardKpiCards: React.FC<DashboardKpiCardsProps> = ({ onNavigate }) => {
  const { orders, batches, rawMaterials, retailers, setInternalView } = useDairy();
  const { t } = useTranslation();

  const todayStr = getTodayDateString();

  // Helper to extract YYYY-MM-DD from any ISO timestamp or date string
  const toDateOnly = (val?: string | null): string => {
    if (!val) return '';
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch {
      // fallback
    }
    return val.split('T')[0];
  };

  // 1. Today's Sales (Live Supabase orders)
  const todaysOrders = orders.filter(
    o => o.status !== 'cancelled' && toDateOnly(o.orderDate) === todayStr
  );
  const todaysSalesAmount = todaysOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  // 2. Today's Orders Count
  const todaysOrdersCount = todaysOrders.length;
  const activeOrdersInPipeline = orders.filter(
    o => o.status === 'pending' || o.status === 'confirmed' || o.status === 'dispatched'
  ).length;

  // 3. Today's Production (Live Supabase batches produced today)
  const todaysBatches = batches.filter(
    b => toDateOnly(b.productionDate) === todayStr
  );
  const todaysProductionQty = todaysBatches.reduce((sum, b) => sum + (Number(b.producedQty) || 0), 0);
  const totalActiveBatches = batches.filter(b => b.status === 'active' && b.availableQty > 0).length;

  // 4. Low Stock Alerts (Raw materials healthy vs low/out of stock)
  const lowStockMaterials = rawMaterials.filter(
    m => m.status === 'low_stock' || m.status === 'out_of_stock'
  );
  const outOfStockCount = rawMaterials.filter(m => m.status === 'out_of_stock').length;

  // 5. Expiring Batches (Batches with availableQty > 0 expiring within 7 days or marked near_expiry)
  const expiringBatches = batches.filter(b => {
    if (b.availableQty <= 0) return false;
    const days = calculateDaysRemaining(b.expiryDate);
    return b.status === 'near_expiry' || days <= 7;
  });
  const urgentExpiringCount = batches.filter(b => {
    if (b.availableQty <= 0) return false;
    const days = calculateDaysRemaining(b.expiryDate);
    return days <= 3;
  }).length;

  // 6. Total Outstanding (Live Supabase customer ledger balances)
  const totalOutstanding = retailers.reduce(
    (sum, r) => sum + (Number(r.outstandingAmount) || 0),
    0
  );
  const retailersWithDue = retailers.filter(r => (Number(r.outstandingAmount) || 0) > 0).length;

  const navigate = (view: string) => {
    if (onNavigate) onNavigate(view);
    else setInternalView(view);
  };

  const cards = [
    {
      id: 'todays_sales',
      title: t.internal?.dashboard?.todaysSales || "Today's Sales",
      value: `₹${todaysSalesAmount.toLocaleString('en-IN')}`,
      subtitle: todaysOrdersCount > 0 ? `${todaysOrdersCount} orders today` : 'No orders logged today',
      icon: TrendingUp,
      iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
      valueColor: 'text-slate-900',
      badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
      badgeText: 'Live Billing',
      actionView: 'orders',
    },
    {
      id: 'todays_orders',
      title: t.internal?.dashboard?.todaysOrders || "Today's Orders",
      value: `${todaysOrdersCount}`,
      valueUnit: 'orders',
      subtitle: `${activeOrdersInPipeline} in active pipeline`,
      icon: ShoppingCart,
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      valueColor: 'text-slate-900',
      badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      badgeText: 'Dispatch Desk',
      actionView: 'orders',
    },
    {
      id: 'todays_production',
      title: t.internal?.dashboard?.todaysProduction || "Today's Production",
      value: `${todaysProductionQty.toLocaleString('en-IN')}`,
      valueUnit: 'units',
      subtitle: todaysBatches.length > 0 ? `${todaysBatches.length} batches logged` : `${totalActiveBatches} active in cold storage`,
      icon: Factory,
      iconBg: 'bg-sky-50 text-sky-600 border-sky-200',
      valueColor: 'text-slate-900',
      badgeColor: 'text-sky-700 bg-sky-50 border-sky-200',
      badgeText: 'Plant Floor',
      actionView: 'production',
    },
    {
      id: 'low_stock',
      title: t.internal?.dashboard?.lowStockMaterials || 'Low Stock Alerts',
      value: `${lowStockMaterials.length}`,
      valueUnit: 'items',
      subtitle: outOfStockCount > 0 ? `${outOfStockCount} critical out of stock` : 'Safety inventory monitor',
      icon: AlertTriangle,
      iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
      valueColor: lowStockMaterials.length > 0 ? 'text-amber-700' : 'text-slate-900',
      badgeColor: lowStockMaterials.length > 0 ? 'text-amber-800 bg-amber-50 border-amber-300' : 'text-emerald-700 bg-emerald-50 border-emerald-200',
      badgeText: lowStockMaterials.length > 0 ? 'Low Stock' : 'Optimal Stock',
      actionView: 'raw_materials',
    },
    {
      id: 'expiring_batches',
      title: t.internal?.dashboard?.expiringSoon || 'Expiring Batches',
      value: `${expiringBatches.length}`,
      valueUnit: 'batches',
      subtitle: urgentExpiringCount > 0 ? `${urgentExpiringCount} urgent (≤ 3 days)` : 'Within 7 days shelf-life',
      icon: Clock,
      iconBg: 'bg-rose-50 text-rose-600 border-rose-200',
      valueColor: expiringBatches.length > 0 ? 'text-rose-700' : 'text-slate-900',
      badgeColor: expiringBatches.length > 0 ? 'text-rose-800 bg-rose-50 border-rose-300' : 'text-slate-600 bg-slate-50 border-slate-200',
      badgeText: expiringBatches.length > 0 ? 'Priority Exit' : 'Clean QA',
      actionView: 'expiry',
    },
    {
      id: 'total_outstanding',
      title: t.internal?.dashboard?.outstandingAmount || 'Total Outstanding',
      value: `₹${Math.round(totalOutstanding).toLocaleString('en-IN')}`,
      subtitle: retailersWithDue > 0 ? `Across ${retailersWithDue} retailers` : 'Zero overdue collections',
      icon: CreditCard,
      iconBg: 'bg-purple-50 text-purple-600 border-purple-200',
      valueColor: 'text-slate-900',
      badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
      badgeText: 'Receivables',
      actionView: 'invoices',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => navigate(card.actionView)}
            className="group relative bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <div>
              {/* Header with Icon and subtle badge */}
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <span className="text-[11px] font-semibold text-slate-500 truncate group-hover:text-blue-700 transition-colors">
                  {card.title}
                </span>
                <div
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${card.iconBg} group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Metric Value */}
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-xl sm:text-2xl font-black font-mono-numbers tracking-tight ${card.valueColor}`}>
                  {card.value}
                </span>
                {card.valueUnit && (
                  <span className="text-[11px] font-medium text-slate-400">
                    {card.valueUnit}
                  </span>
                )}
              </div>
            </div>

            {/* Footer with subtle status and arrow on hover */}
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 truncate text-[10.5px]">
                {card.subtitle}
              </span>
              <ArrowUpRight className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-blue-600 transition-all shrink-0 ml-1" />
            </div>
          </button>
        );
      })}
    </div>
  );
};
