"use client";

import { useId } from "react";
import { formatCurrency } from "@/lib/utils";

export type IsoBarItem = {
  key: string;
  label: string;
  value: number;
  color: string; // front face
  topColor: string;
  sideColor: string;
};

type Props = {
  items: IsoBarItem[];
  height?: number;
};

/** Barras isométricas 3D com acabamento liquid-glass. */
export function IsoBarChart3D({ items, height = 180 }: Props) {
  const uid = useId().replace(/:/g, "");
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const barW = 36;
  const gap = 28;
  const depth = 14;
  const baseY = height - 28;
  const chartW = Math.max(220, items.length * (barW + gap) + 40);

  return (
    <div className="relative w-full overflow-x-auto rounded-2xl bg-white/25 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-[1.5px]">
      <svg
        viewBox={`0 0 ${chartW} ${height}`}
        className="mx-auto block h-auto w-full max-w-md drop-shadow-sm"
        role="img"
        aria-label="Gráfico de barras 3D"
      >
        <defs>
          <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="100%" stopColor="rgba(148,163,184,0.08)" />
          </linearGradient>
          {items.map((item, index) => (
            <g key={`defs-${item.key}`}>
              <linearGradient id={`${uid}-front-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                <stop offset="40%" stopColor={item.color} stopOpacity="0.95" />
                <stop offset="100%" stopColor={item.color} stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id={`${uid}-top-${index}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
                <stop offset="55%" stopColor={item.topColor} stopOpacity="0.95" />
                <stop offset="100%" stopColor={item.topColor} stopOpacity="0.75" />
              </linearGradient>
              <linearGradient id={`${uid}-side-${index}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={item.sideColor} stopOpacity="0.95" />
                <stop offset="100%" stopColor={item.sideColor} stopOpacity="0.7" />
              </linearGradient>
            </g>
          ))}
        </defs>

        <ellipse
          cx={chartW / 2}
          cy={baseY + 8}
          rx={chartW * 0.42}
          ry={12}
          fill={`url(#${uid}-floor)`}
        />

        {items.map((item, index) => {
          const h = Math.max(8, (Math.abs(item.value) / max) * (height - 70));
          const x = 28 + index * (barW + gap);
          const y = baseY - h;
          const front = `${x},${y} ${x + barW},${y} ${x + barW},${baseY} ${x},${baseY}`;
          const top = `${x},${y} ${x + depth},${y - depth} ${x + barW + depth},${y - depth} ${x + barW},${y}`;
          const side = `${x + barW},${y} ${x + barW + depth},${y - depth} ${x + barW + depth},${baseY - depth} ${x + barW},${baseY}`;

          return (
            <g key={item.key}>
              <polygon
                points={side}
                fill={`url(#${uid}-side-${index})`}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={0.75}
              />
              <polygon
                points={front}
                fill={`url(#${uid}-front-${index})`}
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={1}
              />
              <polygon
                points={top}
                fill={`url(#${uid}-top-${index})`}
                stroke="rgba(255,255,255,0.65)"
                strokeWidth={1}
              />
              {/* sheen na face frontal */}
              <polygon
                points={`${x + 3},${y + 2} ${x + barW * 0.38},${y + 2} ${x + barW * 0.38},${baseY - 2} ${x + 3},${baseY - 2}`}
                fill="rgba(255,255,255,0.18)"
              />
              <text
                x={x + barW / 2 + depth / 4}
                y={y - depth - 8}
                textAnchor="middle"
                className="fill-slate-700"
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {formatCurrency(item.value)}
              </text>
              <text
                x={x + barW / 2}
                y={baseY + 18}
                textAnchor="middle"
                className="fill-slate-500"
                style={{ fontSize: 10 }}
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export const GRX_BAR_COLORS = {
  revenue: { color: "#059669", topColor: "#34d399", sideColor: "#047857" },
  expense: { color: "#d0001f", topColor: "#f87171", sideColor: "#9f1239" },
  result: { color: "#0369a1", topColor: "#38bdf8", sideColor: "#075985" },
} as const;
