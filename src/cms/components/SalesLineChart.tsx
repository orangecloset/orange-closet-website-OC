import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { SalesDailyPoint } from "../lib/api";

const LINE_COLOR = "#f97316";
const CHART_HEIGHT = 280;
const PAD = { left: 46, right: 14, top: 16, bottom: 30 };

function formatMoney(value: number): string {
  return `₱${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatAxis(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return `₱${k >= 10 ? Math.round(k) : Number(k.toFixed(1))}k`;
  }
  // Keep small scales readable instead of collapsing several ticks onto "₱1".
  if (value > 0 && value < 10) return `₱${value.toFixed(2)}`;
  return `₱${Math.round(value)}`;
}

function formatDayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function niceMax(value: number): number {
  if (value <= 0) return 1000;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

type Point = { x: number; y: number; data: SalesDailyPoint };

function smoothPath(points: Point[]): string {
  if (points.length < 2) return "";
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return path;
}

export default function SalesLineChart({ data }: { data: SalesDailyPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, "");

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(320, Math.round(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rawMax = useMemo(
    () => data.reduce((max, d) => (d.revenue > max ? d.revenue : max), 0),
    [data]
  );

  const geo = useMemo(() => {
    if (width <= 0 || data.length === 0) return null;
    const plotW = width - PAD.left - PAD.right;
    const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
    const max = niceMax(Math.max(rawMax, 1));
    const stepX = data.length > 1 ? plotW / (data.length - 1) : plotW;
    const points: Point[] = data.map((d, i) => ({
      x: PAD.left + i * stepX,
      y: PAD.top + plotH - (d.revenue / max) * plotH,
      data: d,
    }));
    return { plotW, plotH, max, stepX, points };
  }, [width, data, rawMax]);

  const hasSales = data.some((d) => d.count > 0);
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  const hovered = hover !== null && geo ? geo.points[hover] : null;

  let tooltipLeft = 0;
  let tooltipTop = 0;
  if (hovered) {
    tooltipLeft = hovered.x + 14;
    if (tooltipLeft + 172 > width - 4) tooltipLeft = hovered.x - 172 - 14;
    tooltipLeft = Math.max(4, Math.min(tooltipLeft, width - 172 - 4));
    tooltipTop = Math.min(Math.max(hovered.y - 34, 6), CHART_HEIGHT - 104);
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (width / rect.width);
    const index = Math.max(
      0,
      Math.min(geo.points.length - 1, Math.round((x - PAD.left) / geo.stepX))
    );
    setHover(index);
  };

  // Pick x labels by pixel spacing so the last two dates never collide on
  // narrow screens, and always keep the first and last day visible.
  const labelIndices = useMemo(() => {
    if (!geo) return [];
    const last = geo.points.length - 1;
    if (last <= 0) return [0];
    const minGap = 56;
    const steps = [1, 2, 3, 5, 7, 10, 14, 15, 30];
    const step = steps.find((s) => s * geo.stepX >= minGap) ?? steps[steps.length - 1];
    const count = Math.floor(last / step) + 1;
    if (count <= 1) return [0, last];
    return Array.from({ length: count }, (_, k) => Math.round((k * last) / (count - 1)));
  }, [geo]);

  const showYLabels = rawMax > 0;
  const line = geo ? smoothPath(geo.points) : "";

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height: CHART_HEIGHT }}>
      {geo && (
        <>
          <svg
            width={width}
            height={CHART_HEIGHT}
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            className="block max-w-full"
            style={{ overflow: "visible" }}
            role="img"
            aria-label={`Revenue line chart for ${data.length} days, totaling ${formatMoney(totalRevenue)}`}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.2} />
                <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>

            {Array.from({ length: 5 }, (_, i) => {
              const y = PAD.top + (geo.plotH * i) / 4;
              return (
                <g key={i}>
                  <line
                    x1={PAD.left}
                    y1={y}
                    x2={PAD.left + geo.plotW}
                    y2={y}
                    stroke="#f0f0f0"
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                  />
                  <text
                    x={PAD.left - 9}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize={10.5}
                    fill="#a1a1aa"
                  >
                    {showYLabels || i === 4 ? formatAxis(geo.max * (1 - i / 4)) : ""}
                  </text>
                </g>
              );
            })}

            <path
              d={`${line} L${geo.points[geo.points.length - 1].x},${PAD.top + geo.plotH} L${geo.points[0].x},${PAD.top + geo.plotH} Z`}
              fill={`url(#${gradientId})`}
            />
            <path
              d={line}
              fill="none"
              stroke={LINE_COLOR}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {labelIndices.map((i) => {
              const point = geo.points[i];
              const last = geo.points.length - 1;
              const anchor =
                i === 0 && i !== last ? "start" : i === last && i !== 0 ? "end" : "middle";
              return (
                <text
                  key={point.data.date}
                  x={point.x}
                  y={PAD.top + geo.plotH + 18}
                  textAnchor={anchor}
                  fontSize={10.5}
                  fill="#a1a1aa"
                >
                  {formatDayLabel(point.data.date)}
                </text>
              );
            })}

            {hovered && (
              <>
                <line
                  x1={hovered.x}
                  y1={PAD.top}
                  x2={hovered.x}
                  y2={PAD.top + geo.plotH}
                  stroke="#d4d4d8"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle
                  cx={hovered.x}
                  cy={hovered.y}
                  r={4.5}
                  fill={LINE_COLOR}
                  stroke="#fff"
                  strokeWidth={2}
                />
              </>
            )}

            <rect
              x={PAD.left}
              y={PAD.top}
              width={geo.plotW}
              height={geo.plotH}
              fill="transparent"
            />
          </svg>

          {!hasSales && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded bg-white/90 px-3 py-1.5 text-xs text-[var(--fg-muted)]">
                No sales in this period.
              </p>
            </div>
          )}

          {hovered && (
            <div
              className="pointer-events-none absolute z-10 min-w-[158px] rounded-md bg-[#18181b] px-3 py-2 text-white shadow-lg"
              style={{ left: tooltipLeft, top: tooltipTop }}
            >
              <p className="mb-1 text-[11px] text-white/60">
                {new Date(`${hovered.data.date}T00:00:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <div className="flex justify-between gap-4 text-xs leading-relaxed">
                <span className="text-white/60">Revenue</span>
                <b className="font-semibold tabular-nums">{formatMoney(hovered.data.revenue)}</b>
              </div>
              <div className="flex justify-between gap-4 text-xs leading-relaxed">
                <span className="text-white/60">Sales</span>
                <b className="font-semibold tabular-nums">{hovered.data.count}</b>
              </div>
              <div className="flex justify-between gap-4 text-xs leading-relaxed">
                <span className="text-white/60">Units</span>
                <b className="font-semibold tabular-nums">{hovered.data.units}</b>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
