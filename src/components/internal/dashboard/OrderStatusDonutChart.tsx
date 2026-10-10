import React, { useState } from 'react';
import { OrderStatus } from '../../../types/dairy';

export interface OrderStatusCount {
  status: OrderStatus;
  label: string;
  count: number;
  color: string;
  hoverColor: string;
}

interface OrderStatusDonutChartProps {
  statusCounts: OrderStatusCount[];
  totalOrders: number;
  onSelectStatus?: (status: OrderStatus) => void;
}

export const OrderStatusDonutChart: React.FC<OrderStatusDonutChartProps> = ({
  statusCounts,
  totalOrders,
  onSelectStatus,
}) => {
  const [hoveredStatus, setHoveredStatus] = useState<OrderStatus | null>(null);

  // SVG Donut geometry
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute slice offsets
  let accumulatedPercent = 0;
  const slices = statusCounts.map(item => {
    const percent = totalOrders > 0 ? (item.count / totalOrders) : 0;
    const dashLength = percent * circumference;
    const dashOffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;

    return {
      ...item,
      percent: Math.round(percent * 100),
      dashLength,
      dashOffset,
    };
  });

  const activeSlice = hoveredStatus
    ? slices.find(s => s.status === hoveredStatus)
    : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Order Fulfillment Pipeline
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Active distribution across order lifecycle statuses
          </p>
        </div>
        <span className="text-xs font-bold text-slate-700 font-mono-numbers bg-slate-100 px-2 py-0.5 rounded-md">
          {totalOrders} Total
        </span>
      </div>

      {totalOrders === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
          No orders found for this period.
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 my-2">
          {/* Donut SVG */}
          <div className="relative w-40 h-40 flex items-center justify-center flex-shrink-0">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="transform -rotate-90"
            >
              {/* Background ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth={strokeWidth}
              />

              {/* Data Slices */}
              {slices.map(slice => {
                if (slice.count === 0) return null;
                const isHovered = hoveredStatus === slice.status;
                return (
                  <circle
                    key={slice.status}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={isHovered ? slice.hoverColor : slice.color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${slice.dashLength} ${circumference - slice.dashLength}`}
                    strokeDashoffset={slice.dashOffset}
                    strokeLinecap="round"
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredStatus(slice.status)}
                    onMouseLeave={() => setHoveredStatus(null)}
                    onClick={() => onSelectStatus?.(slice.status)}
                  />
                );
              })}
            </svg>

            {/* Donut Center Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-2xl font-black text-slate-900 font-mono-numbers tracking-tight">
                {activeSlice ? activeSlice.count : totalOrders}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {activeSlice ? activeSlice.label : 'Orders'}
              </span>
            </div>
          </div>

          {/* Slices Legend */}
          <div className="flex-1 w-full space-y-1.5 text-xs">
            {slices.map(s => {
              const isHovered = hoveredStatus === s.status;
              return (
                <div
                  key={s.status}
                  onMouseEnter={() => setHoveredStatus(s.status)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  onClick={() => onSelectStatus?.(s.status)}
                  className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isHovered ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="font-medium text-slate-700 capitalize">
                      {s.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-numbers">
                    <span className="font-bold text-slate-900">{s.count}</span>
                    <span className="text-[10px] text-slate-400 w-8 text-right">
                      {s.percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-2.5 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Click slice to filter in Orders module</span>
        <span className="font-semibold text-blue-600">
          {slices.find(s => s.status === 'delivered')?.percent || 0}% Fulfilled
        </span>
      </div>
    </div>
  );
};
