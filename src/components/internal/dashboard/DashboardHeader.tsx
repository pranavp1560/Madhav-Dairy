import React, { useState } from 'react';
import { Button } from '../../ui/Button';
import {
  Calendar,
  RefreshCw,
  Download,
  Plus,
  TrendingUp,
  Boxes,
  Check,
  ChevronDown,
  X
} from 'lucide-react';
import { DateRangePreset, DateRangeBounds } from './dashboardUtils';
import { InternalRole } from '../../../types/dairy';

interface DashboardHeaderProps {
  internalRole: InternalRole;
  dateBounds: DateRangeBounds;
  onChangePreset: (preset: DateRangePreset) => void;
  customStartDate: string;
  customEndDate: string;
  onChangeCustomDates: (start: string, end: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenCreateBatch: () => void;
  onNavigateToInvoices: () => void;
  onNavigateToRawMaterials: () => void;
  onExportReport: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  internalRole,
  dateBounds,
  onChangePreset,
  customStartDate,
  customEndDate,
  onChangeCustomDates,
  onRefresh,
  isRefreshing,
  onOpenCreateBatch,
  onNavigateToInvoices,
  onNavigateToRawMaterials,
  onExportReport,
}) => {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [tempStart, setTempStart] = useState(customStartDate);
  const [tempEnd, setTempEnd] = useState(customEndDate);

  const presets: { id: DateRangePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7days', label: 'Last 7 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'custom', label: 'Custom' },
  ];

  const handleApplyCustom = () => {
    if (tempStart && tempEnd) {
      onChangeCustomDates(tempStart, tempEnd);
      onChangePreset('custom');
      setShowCustomPicker(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 space-y-4">
      {/* Upper Row: Title & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Madhav Dairy ERP
            </h1>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              Operations Hub
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Real-time manufacturing batches, wholesale order dispatch, cold chain stock health, and cash flow ledger.
          </p>
        </div>

        {/* Quick Operations Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 sm:px-3 sm:py-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Refresh ERP Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export Report */}
          <button
            onClick={onExportReport}
            className="px-3 py-2 text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Report</span>
          </button>

          {/* Role-Based Quick Actions */}
          {(internalRole === 'admin' || internalRole === 'production_manager') && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={onOpenCreateBatch}
            >
              Create Batch
            </Button>
          )}

          {(internalRole === 'admin' || internalRole === 'accountant') && (
            <Button
              variant="secondary"
              size="sm"
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              onClick={onNavigateToInvoices}
            >
              Invoices
            </Button>
          )}

          {internalRole === 'warehouse_manager' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Boxes className="w-3.5 h-3.5" />}
              onClick={onNavigateToRawMaterials}
            >
              Inward Stock
            </Button>
          )}
        </div>
      </div>

      {/* Lower Row: Date Range Filter Pills & Active Range Display */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1.5 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Period:
          </span>
          {presets.map(p => {
            const isActive = dateBounds.preset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (p.id === 'custom') {
                    setShowCustomPicker(!showCustomPicker);
                  } else {
                    setShowCustomPicker(false);
                    onChangePreset(p.id);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20'
                    : 'text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Current Active Range Tag */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-slate-600 font-mono-numbers">
          <span className="text-slate-400 text-[11px]">Filtered:</span>
          <span className="font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-[11px]">
            {dateBounds.startStr} &rarr; {dateBounds.endStr}
          </span>
        </div>
      </div>

      {/* Collapsible Custom Date Picker */}
      {showCustomPicker && (
        <div className="p-3 bg-slate-50 border border-blue-200 rounded-xl flex flex-wrap items-center gap-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <label className="text-slate-600 font-medium">From:</label>
            <input
              type="date"
              value={tempStart}
              onChange={e => setTempStart(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono-numbers focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-600 font-medium">To:</label>
            <input
              type="date"
              value={tempEnd}
              onChange={e => setTempEnd(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono-numbers focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleApplyCustom}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1 shadow-sm transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Apply Range
          </button>
          <button
            onClick={() => setShowCustomPicker(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
