"use client";

import { useId } from "react";
import { formatCurrency } from "@/lib/utils";

export type PieSlice = {
  key: string;
  label: string;
  value: number;
  color?: string;
};

type Props = {
  slices: PieSlice[];
  size?: number;
  /** Layout vertical compacto (3 colunas no Geral). */
  compact?: boolean;
};

const PALETTE = ["#2563eb", "#22c55e", "#f97316", "#a855f7", "#06b6d4", "#ef4444"];

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${e.x} ${e.y} A ${r} ${r} 0 ${large} 1 ${s.x} ${s.y} Z`;
}

/** Pizza 3D com acabamento liquid-glass (gradiente + highlight + borda). */
export function PieChart3D({ slices, size = 220, compact = false }: Props) {
  const uid = useId().replace(/:/g, "");
  const chartSize = compact ? Math.max(size, 220) : size;
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const cx = chartSize / 2;
  const cy = chartSize / 2 - 4;
  const r = chartSize * (compact ? 0.42 : 0.38);
  const depth = 12;
  const hole = r * 0.28;

  if (total <= 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-slate-500 ${
          compact ? "h-52" : "h-48"
        }`}
      >
        Sem resultado atribuído no período.
      </div>
    );
  }

  let angle = 0;
  const arcs = slices.map((slice, i) => {
    const portion = (Math.max(0, slice.value) / total) * 360;
    const start = angle;
    const end = angle + portion;
    angle = end;
    return {
      ...slice,
      start,
      end,
      color: slice.color || PALETTE[i % PALETTE.length],
      gradId: `${uid}-slice-${i}`,
    };
  });

  return (
    <div
      className={
        compact
          ? "flex flex-col items-stretch gap-3"
          : "flex flex-col gap-4 sm:flex-row sm:items-center"
      }
    >
      <div className="relative mx-auto shrink-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-2 rounded-full bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-[2px]"
        />
        <svg
          viewBox={`0 0 ${chartSize} ${chartSize}`}
          className="relative mx-auto h-52 w-52 drop-shadow-md"
          role="img"
          aria-label="Gráfico de participação"
        >
          <defs>
            {arcs.map((a) => (
              <linearGradient
                key={a.gradId}
                id={a.gradId}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
                <stop offset="38%" stopColor={a.color} stopOpacity="0.92" />
                <stop offset="100%" stopColor={a.color} stopOpacity="0.78" />
              </linearGradient>
            ))}
            <radialGradient id={`${uid}-hole`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#f8fafc" stopOpacity="0.82" />
              <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.55" />
            </radialGradient>
            <linearGradient id={`${uid}-sheen`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* camada de profundidade 3D */}
          {arcs.map((a) =>
            a.end - a.start < 0.5 ? null : (
              <path
                key={`d-${a.key}`}
                d={arcPath(cx, cy + depth, r, a.start, a.end)}
                fill={a.color}
                opacity={0.28}
              />
            )
          )}

          {/* face superior com vidro */}
          {arcs.map((a) =>
            a.end - a.start < 0.5 ? null : (
              <path
                key={a.key}
                d={arcPath(cx, cy, r, a.start, a.end)}
                fill={`url(#${a.gradId})`}
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={1.25}
              />
            )
          )}

          {/* brilho liquid-glass */}
          <ellipse
            cx={cx - r * 0.12}
            cy={cy - r * 0.22}
            rx={r * 0.72}
            ry={r * 0.38}
            fill={`url(#${uid}-sheen)`}
            style={{ mixBlendMode: "soft-light" }}
          />

          <circle
            cx={cx}
            cy={cy}
            r={hole}
            fill={`url(#${uid}-hole)`}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={1.5}
          />
        </svg>
      </div>

      <ul
        className={
          compact
            ? "min-w-0 space-y-1.5 text-xs"
            : "min-w-0 flex-1 space-y-2 text-sm"
        }
      >
        {arcs.map((a) => {
          const pct = total > 0 ? (Math.max(0, a.value) / total) * 100 : 0;
          return (
            <li key={a.key} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm shadow-sm ring-1 ring-white/70"
                  style={{ background: a.color }}
                />
                <span className="truncate font-medium text-slate-800">{a.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-600">
                {pct.toFixed(1)}% · {formatCurrency(a.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
