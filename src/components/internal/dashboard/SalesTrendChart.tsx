import React, { useState, useMemo } from 'react';
import { TrendingUp, Calendar, ArrowUpRight } from 'lucide-react';
import { formatINR, parseLocalDate, toLocalDateString } from './dashboardUtils';

export interface SalesDataPoint {
  dateStr: string;   // YYYY-MM-DD
  label: string;     // e.g. "08 Oct"
  sales: number;
  orderCount: number;
}

interface SalesTrendChartProps {
  data: SalesDataPoint[];
  isLoading?: boolean;
}

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
  data,
  isLoading = false,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [grouping, setGrouping] = useState<'daily' | 'weekly'>('daily');

  // Aggregated data according to grouping
  const chartData = useMemo(() => {
    if (grouping === 'daily' || data.length <= 10) return data;

    // Group by 7-day buckets
    const result: SalesDataPoint[] = [];
    const chunkSize = 7;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const totalSales = chunk.reduce((s, d) => s + d.sales, 0);
      const totalOrders = chunk.reduce((s, d) => s + d.orderCount, 0);
      result.push({
        dateStr: chunk[0].dateStr,
        label: `${chunk[0].label} - ${chunk[chunk.length - 1].label}`,
        sales: totalSales,
        orderCount: totalOrders,
      });
    }
    return result;
  }, [data, grouping]);

  const totalPeriodSales = useMemo(() => chartData.reduce((s, d) => s + d.sales, 0), [chartData]);
  const maxSales = useMemo(() => Math.max(...chartData.map(d => d.sales), 100), [chartData]);
  const avgSales = useMemo(() => (chartData.length > 0 ? totalPeriodSales / chartData.length : 0), [chartData, totalPeriodSales]);

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;

  // Compute points
  const points = useMemo(() => {
    if (chartData.length === 0) return [];
    if (chartData.length === 1) {
      return [{
        x: paddingLeft + chartW / 2,
        y: paddingTop + chartH - (chartData[0].sales / maxSales) * chartH,
        data: chartData[0],
      }];
    }
    return chartData.map((d, i) => {
      const x = paddingLeft + (i / (chartData.length - 1)) * chartW;
      const y = paddingTop + chartH - (d.sales / maxSales) * chartH;
      return { x, y, data: d };
    });
  }, [chartData, maxSales, chartW, chartH, paddingLeft, paddingTop]);

  // Construct smooth bezier path
  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      path += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  }, [points]);

  // Construct area closed path
  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const bottomY = paddingTop + chartH;
    return `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
  }, [linePath, points, paddingTop, chartH]);

  // Y-axis ticks
  const yTicks = [0, maxSales * 0.33, maxSales * 0.66, maxSales];

  const hoveredPoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 flex flex-col justify-between">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Sales Revenue Trend
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Daily order revenue recognized for the active period
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Summary Pills */}
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-slate-900 font-mono-numbers">
              {formatINR(totalPeriodSales)}
            </span>
            <span className="block text-[10px] text-slate-400">Total in Period</span>
          </div>

          {/* Grouping Toggle */}
          {data.length > 7 && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold">
              <button
                onClick={() => setGrouping('daily')}
                className={`px-2 py-1 rounded-md transition-all ${
                  grouping === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setGrouping('weekly')}
                className={`px-2 py-1 rounded-md transition-all ${
                  grouping === 'weekly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Weekly
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas Area */}
      {isLoading ? (
        <div className="h-56 flex items-center justify-center text-slate-400 text-xs">
          Loading sales data...
        </div>
      ) : chartData.length === 0 || totalPeriodSales === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
          <Calendar className="w-8 h-8 text-slate-300 mb-1.5" />
          <p className="font-semibold text-slate-600">No Sales in Selected Period</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Orders placed in this date range will reflect here automatically.</p>
        </div>
      ) : (
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-52 sm:h-56 select-none"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="salesAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines & Y Ticks */}
            {yTicks.map((val, idx) => {
              const y = paddingTop + chartH - (val / maxSales) * chartH;
              return (
                <g key={idx}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {formatINR(val, true)}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            {areaPath && (
              <path d={areaPath} fill="url(#salesAreaGradient)" />
            )}

            {/* Main Trend Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Hover guideline */}
            {hoveredPoint && (
              <line
                x1={hoveredPoint.x}
                y1={paddingTop}
                x2={hoveredPoint.x}
                y2={paddingTop + chartH}
                stroke="#3b82f6"
                strokeDasharray="2 2"
                strokeWidth="1.5"
              />
            )}

            {/* Data Dots & Click Target overlays */}
            {points.map((p, idx) => {
              const isHovered = hoveredIdx === idx;
              return (
                <g key={idx}>
                  {/* Invisible broad hitbox for touch & mouse */}
                  <rect
                    x={p.x - 14}
                    y={paddingTop}
                    width={28}
                    height={chartH}
                    fill="transparent"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  />
                  {/* Visible Dot */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 5.5 : 3}
                    fill="#ffffff"
                    stroke={isHovered ? '#1d4ed8' : '#2563eb'}
                    strokeWidth={isHovered ? 2.5 : 2}
                    className="transition-all pointer-events-none"
                  />
                </g>
              );
            })}

            {/* X-axis Labels */}
            {points.map((p, idx) => {
              // Show label if sparse or specific steps
              const step = Math.ceil(points.length / 7);
              if (idx % step !== 0 && idx !== points.length - 1) return null;
              return (
                <text
                  key={idx}
                  x={p.x}
                  y={svgHeight - 12}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="9.5"
                  fontWeight="500"
                >
                  {p.data.label}
                </text>
              );
            })}
          </svg>

          {/* Floating Tooltip Box */}
          {hoveredPoint && (
            <div
              className="absolute z-10 pointer-events-none bg-slate-900 text-white rounded-xl px-3 py-2 text-xs shadow-xl border border-slate-700/80 -translate-x-1/2 -translate-y-full transition-all"
              style={{
                left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                top: `${(hoveredPoint.y / svgHeight) * 100 - 8}%`,
              }}
            >
              <div className="font-semibold text-[11px] text-slate-300 flex items-center justify-between gap-3">
                <span>{hoveredPoint.data.label}</span>
                <span className="text-[10px] text-blue-400 font-mono-numbers">
                  {hoveredPoint.data.orderCount} order{hoveredPoint.data.orderCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-sm font-black font-mono-numbers text-white mt-0.5">
                {formatINR(hoveredPoint.data.sales)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart Footer Stats */}
      <div className="pt-2.5 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Average Daily Run: <strong className="font-mono-numbers text-slate-800">{formatINR(avgSales)}</strong></span>
        <span>Peak Day: <strong className="font-mono-numbers text-slate-800">{formatINR(maxSales)}</strong></span>
      </div>
    </div>
  );
};
