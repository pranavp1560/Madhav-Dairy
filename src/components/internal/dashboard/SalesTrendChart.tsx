import React, { useState, useMemo, useRef } from 'react';
import { useDairy } from '../../../context/DairyContext';
import { getTodayDateString, formatCalendarDate } from '../../../utils/dateUtils';
import {
  TrendingUp,
  Calendar,
  IndianRupee,
  ShoppingCart,
  ChevronDown,
  Layers,
  ArrowRight,
  Filter
} from 'lucide-react';

type DateFilterType = 'today' | '7days' | '30days' | 'this_month' | 'custom';

export const SalesTrendChart: React.FC = () => {
  const { orders, isLoading, setInternalView } = useDairy();

  const [dateFilter, setDateFilter] = useState<DateFilterType>('7days');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => getTodayDateString());
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Generate bucket series based on selected filter
  const chartSeries = useMemo(() => {
    const today = new Date();
    const todayStr = getTodayDateString();

    interface DataBucket {
      key: string;
      label: string;
      shortLabel: string;
      amount: number;
      orderCount: number;
    }

    const buckets: DataBucket[] = [];

    if (dateFilter === 'today') {
      // Hourly slots for today
      const hours = [6, 9, 12, 15, 18, 21, 24];
      hours.forEach((h, i) => {
        const prevH = i === 0 ? 0 : hours[i - 1];
        const label = `${String(h).padStart(2, '0')}:00`;
        buckets.push({
          key: `today-${h}`,
          label: `Today ${label}`,
          shortLabel: label,
          amount: 0,
          orderCount: 0,
        });
      });

      // Distribute today's orders
      orders
        .filter(o => o.status !== 'cancelled' && toDateOnly(o.orderDate) === todayStr)
        .forEach(o => {
          let targetBucketIndex = buckets.length - 1;
          try {
            const ordDate = new Date(o.orderDate);
            const hour = ordDate.getHours();
            const idx = hours.findIndex(h => hour <= h);
            if (idx !== -1) targetBucketIndex = idx;
          } catch {
            targetBucketIndex = Math.floor(buckets.length / 2);
          }
          if (buckets[targetBucketIndex]) {
            buckets[targetBucketIndex].amount += Number(o.totalAmount) || 0;
            buckets[targetBucketIndex].orderCount += 1;
          }
        });
    } else {
      let startD = new Date(today);
      let endD = new Date(today);

      if (dateFilter === '7days') {
        startD.setDate(today.getDate() - 6);
      } else if (dateFilter === '30days') {
        startD.setDate(today.getDate() - 29);
      } else if (dateFilter === 'this_month') {
        startD = new Date(today.getFullYear(), today.getMonth(), 1);
      } else if (dateFilter === 'custom') {
        startD = new Date(customStart || todayStr);
        endD = new Date(customEnd || todayStr);
        if (startD > endD) {
          const temp = startD;
          startD = endD;
          endD = temp;
        }
      }

      // Generate daily buckets
      const curr = new Date(startD);
      while (curr <= endD) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${d}`;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const shortLabel = `${d} ${months[curr.getMonth()]}`;

        buckets.push({
          key: dateKey,
          label: formatCalendarDate(dateKey),
          shortLabel,
          amount: 0,
          orderCount: 0,
        });
        curr.setDate(curr.getDate() + 1);
      }

      // Aggregate actual orders
      const bucketMap = new Map<string, DataBucket>();
      buckets.forEach(b => bucketMap.set(b.key, b));

      orders
        .filter(o => o.status !== 'cancelled')
        .forEach(o => {
          const ordDateKey = toDateOnly(o.orderDate);
          const b = bucketMap.get(ordDateKey);
          if (b) {
            b.amount += Number(o.totalAmount) || 0;
            b.orderCount += 1;
          }
        });
    }

    return buckets;
  }, [orders, dateFilter, customStart, customEnd]);

  // Total metrics in current view
  const totalPeriodSales = useMemo(
    () => chartSeries.reduce((sum, b) => sum + b.amount, 0),
    [chartSeries]
  );
  const totalPeriodOrders = useMemo(
    () => chartSeries.reduce((sum, b) => sum + b.orderCount, 0),
    [chartSeries]
  );
  const avgOrderValue = totalPeriodOrders > 0 ? totalPeriodSales / totalPeriodOrders : 0;

  // Chart dimensions & scaling
  const chartWidth = 1000;
  const chartHeight = 240;
  const paddingLeft = 70;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 35;

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const maxSales = useMemo(() => {
    const rawMax = Math.max(...chartSeries.map(d => d.amount), 0);
    if (rawMax <= 0) return 5000;
    // Round up to clean step ceiling
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const multiple = Math.ceil(rawMax / magnitude);
    return Math.max(multiple * magnitude, 1000);
  }, [chartSeries]);

  // Compute (x, y) plot coordinates
  const points = useMemo(() => {
    if (chartSeries.length === 0) return [];
    if (chartSeries.length === 1) {
      return [
        {
          x: paddingLeft + plotWidth / 2,
          y: paddingTop + plotHeight - (chartSeries[0].amount / maxSales) * plotHeight,
          data: chartSeries[0],
          index: 0,
        },
      ];
    }
    return chartSeries.map((d, i) => {
      const x = paddingLeft + (i / (chartSeries.length - 1)) * plotWidth;
      const y = paddingTop + plotHeight - (d.amount / maxSales) * plotHeight;
      return { x, y, data: d, index: i };
    });
  }, [chartSeries, maxSales, plotWidth, plotHeight]);

  // Construct smooth SVG path
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };
    if (points.length === 1) {
      const p = points[0];
      return {
        linePath: `M ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y}`,
        areaPath: `M ${p.x - 20} ${paddingTop + plotHeight} L ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y} L ${p.x + 20} ${paddingTop + plotHeight} Z`,
      };
    }

    // Build smooth cubic curve
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    const baselineY = paddingTop + plotHeight;
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const area = `${d} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

    return { linePath: d, areaPath: area };
  }, [points, paddingTop, plotHeight]);

  // Horizontal grid lines
  const gridLines = useMemo(() => {
    const steps = 4;
    const lines = [];
    for (let i = 0; i <= steps; i++) {
      const val = (maxSales / steps) * i;
      const y = paddingTop + plotHeight - (val / maxSales) * plotHeight;
      lines.push({ val, y });
    }
    return lines;
  }, [maxSales, paddingTop, plotHeight]);

  // X-axis label indices to prevent label crowding
  const labelIndices = useMemo(() => {
    const total = chartSeries.length;
    if (total <= 7) return chartSeries.map((_, i) => i);
    const step = Math.ceil(total / 6);
    const indices: number[] = [];
    for (let i = 0; i < total; i += step) {
      indices.push(i);
    }
    if (!indices.includes(total - 1)) {
      indices.push(total - 1);
    }
    return indices;
  }, [chartSeries]);

  // Handle interactive hover over SVG
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const mouseXRatio = (e.clientX - svgRect.left) / svgRect.width;
    const svgX = mouseXRatio * chartWidth;

    // Find closest point by x coordinate
    let closestIdx = 0;
    let minDiff = Infinity;
    points.forEach((p, idx) => {
      const diff = Math.abs(p.x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setHoveredPointIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoveredPointIndex(null);
  };

  const hoveredPoint = hoveredPointIndex !== null ? points[hoveredPointIndex] : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Chart Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Sales Trend
              </h3>
              <p className="text-xs text-slate-500">
                Live revenue realization from retail fulfillment & orders
              </p>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-4 mt-3 text-xs">
            <div className="flex items-baseline gap-1.5">
              <span className="text-slate-400 font-medium">Billed:</span>
              <span className="font-bold text-slate-900 font-mono-numbers text-sm">
                ₹{totalPeriodSales.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-300" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-slate-400 font-medium">Orders:</span>
              <span className="font-bold text-slate-800 font-mono-numbers text-sm">
                {totalPeriodOrders}
              </span>
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-300" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-slate-400 font-medium">AOV:</span>
              <span className="font-bold text-slate-800 font-mono-numbers text-sm">
                ₹{Math.round(avgOrderValue).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Date Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'custom', label: 'Custom Range' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setDateFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dateFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Range Selector bar */}
      {dateFilter === 'custom' && (
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-600 font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            Date Span:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-blue-600"
            />
            <span className="text-slate-400 font-medium">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      )}

      {/* Responsive Chart Surface */}
      <div ref={containerRef} className="p-4 sm:p-5 relative select-none">
        {isLoading ? (
          <div className="h-60 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <span className="text-xs text-slate-500 font-medium">
              Loading live sales telemetry...
            </span>
          </div>
        ) : totalPeriodSales === 0 ? (
          <div className="h-60 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-800">
              No sales logged for this date window
            </h4>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
              Live orders and retailer fulfillments created in this period will automatically map to this curve.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => setDateFilter('30days')}
                className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 transition-colors"
              >
                View Last 30 Days
              </button>
              <button
                onClick={() => setInternalView('create_order')}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition-colors"
              >
                + New Order
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto overflow-visible cursor-crosshair"
              style={{ minHeight: '220px' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                <linearGradient id="salesTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                  <stop offset="85%" stopColor="#2563EB" stopOpacity="0.02" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines & Y-Axis Labels */}
              {gridLines.map((line, i) => (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={line.y}
                    x2={chartWidth - paddingRight}
                    y2={line.y}
                    stroke="#E2E8F0"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingLeft - 10}
                    y={line.y + 3.5}
                    textAnchor="end"
                    fill="#94A3B8"
                    fontSize="10.5"
                    fontFamily="monospace"
                  >
                    ₹{line.val >= 1000 ? `${(line.val / 1000).toFixed(0)}k` : line.val}
                  </text>
                </g>
              ))}

              {/* Area Gradient Fill */}
              {areaPath && (
                <path d={areaPath} fill="url(#salesTrendGrad)" />
              )}

              {/* Smooth Primary Line */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Point Markers */}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={hoveredPointIndex === i ? 5.5 : p.data.amount > 0 ? 3.5 : 2}
                  fill={hoveredPointIndex === i ? '#2563EB' : p.data.amount > 0 ? '#FFFFFF' : '#CBD5E1'}
                  stroke="#2563EB"
                  strokeWidth={hoveredPointIndex === i ? 2.5 : p.data.amount > 0 ? 2 : 1}
                  className="transition-all duration-150"
                />
              ))}

              {/* Active Hover Crosshair Guideline */}
              {hoveredPoint && (
                <g>
                  <line
                    x1={hoveredPoint.x}
                    y1={paddingTop}
                    x2={hoveredPoint.x}
                    y2={paddingTop + plotHeight}
                    stroke="#3B82F6"
                    strokeDasharray="3 3"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* X-Axis Ticks & Date Labels */}
              {labelIndices.map(idx => {
                const p = points[idx];
                if (!p) return null;
                return (
                  <text
                    key={idx}
                    x={p.x}
                    y={paddingTop + plotHeight + 20}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="10.5"
                    fontWeight="500"
                  >
                    {p.data.shortLabel}
                  </text>
                );
              })}
            </svg>

            {/* Currency-Formatted Tooltip Card */}
            {hoveredPoint && (
              <div
                className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
                style={{
                  left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                  top: `${(hoveredPoint.y / chartHeight) * 100}%`,
                }}
              >
                <div className="bg-slate-900 text-white rounded-lg shadow-xl px-3 py-2 border border-slate-700 text-xs min-w-[130px] animate-in fade-in zoom-in-95 duration-100">
                  <div className="text-[10.5px] text-slate-300 font-semibold border-b border-slate-700 pb-1 flex items-center justify-between gap-2">
                    <span>{hoveredPoint.data.label}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-3">
                    <span className="text-[11px] text-slate-400">Sales:</span>
                    <span className="font-bold font-mono-numbers text-sm text-emerald-400">
                      ₹{hoveredPoint.data.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-slate-400 mt-0.5">
                    <span>Orders:</span>
                    <span className="font-medium text-slate-200">
                      {hoveredPoint.data.orderCount}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
