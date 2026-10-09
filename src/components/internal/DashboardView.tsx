import React from 'react';
import { useDairy } from '../../context/DairyContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { Button } from '../ui/Button';
import { getTodayDateString, formatCalendarDate } from '../../utils/dateUtils';
import { DashboardKpiCards } from './dashboard/DashboardKpiCards';
import { SalesTrendChart } from './dashboard/SalesTrendChart';
import { ProductStockByBatchChart } from './dashboard/ProductStockByBatchChart';
import { RawMaterialStockChart } from './dashboard/RawMaterialStockChart';
import { DashboardNotificationPanel } from './dashboard/DashboardNotificationPanel';
import {
  Calendar,
  Plus,
  TrendingUp,
  CreditCard,
  Boxes,
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface DashboardViewProps {
  onOpenCreateBatch: () => void;
  onOpenRecordPayment: () => void;
  onOpenAddExpense: () => void;
  onSelectBatch: (id: string) => void;
  onSelectRetailer: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenCreateBatch,
  onOpenRecordPayment,
  onOpenAddExpense,
  onSelectBatch,
  onSelectRetailer,
}) => {
  const { internalRole, setInternalView, refreshData, isLoading } = useDairy();
  const { t } = useTranslation();

  const todayStr = getTodayDateString();
  const formattedToday = formatCalendarDate(todayStr);

  return (
    <div className="space-y-6">
      {/* Top Banner: Context & Role Actions */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {t.internal?.dashboard?.title || 'Operational Dashboard'}
            </h1>
            <span className="text-[11px] bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1.5 shadow-2xs">
              <Calendar className="w-3 h-3 text-blue-600" />
              <span>{formattedToday}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t.internal?.dashboard?.subtitle || 'Live manufacturing batches, sales fulfillment, inventory balances & alerts'}
          </p>
        </div>

        {/* Action Shortcuts based on role */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={() => refreshData()}
            title="Refresh Supabase Live Data"
          >
            Refresh
          </Button>

          {(internalRole === 'admin' || internalRole === 'production_manager') && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={onOpenCreateBatch}
            >
              + Create Batch
            </Button>
          )}

          {(internalRole === 'admin' || internalRole === 'accountant') && (
            <Button
              variant="secondary"
              size="sm"
              icon={<CreditCard className="w-3.5 h-3.5" />}
              onClick={onOpenRecordPayment}
            >
              Record Payment
            </Button>
          )}

          {internalRole === 'warehouse_manager' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Boxes className="w-3.5 h-3.5" />}
              onClick={() => setInternalView('raw_materials')}
            >
              Inward Stock
            </Button>
          )}
        </div>
      </div>

      {/* Row 1 — KPI Cards (6 in a single row on desktop) */}
      <DashboardKpiCards onNavigate={setInternalView} />

      {/* Row 2 — Sales Trend (Full available width) */}
      <SalesTrendChart />

      {/* Row 3 — Two Inventory Charts (Two-column grid with equal-width on desktop, stacked on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Product Stock by Batch */}
        <ProductStockByBatchChart onSelectBatch={onSelectBatch} />

        {/* Right: Raw Material Stock */}
        <RawMaterialStockChart />
      </div>

      {/* Row 4 — Notification Panel (Spanning full dashboard width) */}
      <DashboardNotificationPanel onSelectBatch={onSelectBatch} />
    </div>
  );
};
