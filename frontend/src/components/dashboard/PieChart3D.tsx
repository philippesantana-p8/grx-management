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
  compact?: boolean;
};

const PALETTE = ["#3b82f6", "#f8fafc", "#ef4444", "#22c55e", "#f97316", "#a855f7"];

function shade(hex: string, amount: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const n = parseInt(raw, 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (n & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sectorPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${e.x} ${e.y} A ${r} ${r} 0 ${large} 1 ${s.x} ${s.y} Z`;
}

function wallPath(
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
  depth: number
) {
  const a = polar(cx, cy, r, start);
  const b = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return [
    `M ${a.x} ${a.y}`,
    `A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`,
    `L ${b.x} ${b.y + depth}`,
    `A ${r} ${r} 0 ${large} 0 ${a.x} ${a.y + depth}`,
    "Z",
  ].join(" ");
}

/**
 * Pizza 3D “explodida” (referência 2): todas as fatias separadas,
 * cores sólidas opacas, laterais sombreadas e sombra no chão.
 */
export function PieChart3D({ slices, size = 280, compact = false }: Props) {
  const uid = useId().replace(/:/g, "");
  const chartSize = compact ? Math.max(size, 280) : size;
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);

  if (total <= 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-slate-500 ${
          compact ? "h-60" : "h-56"
        }`}
      >
        Sem resultado atribuído no período.
      </div>
    );
  }

  const cx = chartSize / 2;
  const cy = chartSize / 2 - 2;
  const r = chartSize * 0.3;
  const depth = Math.max(28, chartSize * 0.12);
  const explode = r * 0.2;

  let angle = -30;
  const arcs = slices
    .map((slice, i) => {
      const value = Math.max(0, slice.value);
      const portion = (value / total) * 360;
      const start = angle;
      const end = angle + portion;
      angle = end;
      const mid = (start + end) / 2;
      const off = polar(0, 0, explode, mid);
      return {
        ...slice,
        value,
        start,
        end,
        portion,
        mid,
        ox: off.x,
        oy: off.y * 0.72,
        color: slice.color || PALETTE[i % PALETTE.length],
        idx: i,
      };
    })
    .filter((a) => a.portion > 0.35);

  // Desenha de trás para frente (fatias com mid perto de 180 primeiro)
  const drawOrder = [...arcs].sort((a, b) => {
    const ay = Math.sin(((a.mid - 90) * Math.PI) / 180);
    const by = Math.sin(((b.mid - 90) * Math.PI) / 180);
    return ay - by;
  });

  return (
    <div
      className={
        compact
          ? "flex flex-col items-stretch gap-3"
          : "flex flex-col gap-4 sm:flex-row sm:items-center"
      }
    >
      <svg
        viewBox={`0 0 ${chartSize} ${chartSize + depth + 8}`}
        className={compact ? "mx-auto h-60 w-60" : "mx-auto h-64 w-64"}
        role="img"
        aria-label="Gráfico de pizza 3D explodida"
      >
        <defs>
          <filter id={`${uid}-soft`} x="-40%" y="-30%" width="180%" height="180%">
            <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#94a3b8" floodOpacity="0.35" />
          </filter>
          {arcs.map((a) => (
            <linearGradient
              key={`side-${a.key}`}
              id={`${uid}-side-${a.idx}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={shade(a.color, -18)} />
              <stop offset="100%" stopColor={shade(a.color, -55)} />
            </linearGradient>
          ))}
        </defs>

        {/* sombra coletiva no chão */}
        <ellipse
          cx={cx}
          cy={cy + depth + 18}
          rx={r * 1.05}
          ry={r * 0.26}
          fill="rgba(148,163,184,0.22)"
          filter={`url(#${uid}-soft)`}
        />

        {drawOrder.map((a) => {
          const scx = cx + a.ox;
          const scy = cy + a.oy;
          const pStart = polar(scx, scy, r, a.start);
          const pEnd = polar(scx, scy, r, a.end);
          const center = { x: scx, y: scy };

          // Face radial mais “de frente” fica um pouco mais clara
          const faceA = shade(a.color, -35);
          const faceB = shade(a.color, -25);

          return (
            <g key={a.key} filter={`url(#${uid}-soft)`}>
              {/* parede externa */}
              <path
                d={wallPath(scx, scy, r, a.start, a.end, depth)}
                fill={`url(#${uid}-side-${a.idx})`}
              />
              {/* faces internas (corte da fatia) */}
              <polygon
                points={`${center.x},${center.y} ${pStart.x},${pStart.y} ${pStart.x},${pStart.y + depth} ${center.x},${center.y + depth}`}
                fill={faceA}
              />
              <polygon
                points={`${center.x},${center.y} ${pEnd.x},${pEnd.y} ${pEnd.x},${pEnd.y + depth} ${center.x},${center.y + depth}`}
                fill={faceB}
              />
              {/* topo opaco sólido */}
              <path
                d={sectorPath(scx, scy, r, a.start, a.end)}
                fill={a.color}
                stroke="rgba(15,23,42,0.06)"
                strokeWidth={0.6}
              />
              {/* highlight suave no topo (luz de cima/esquerda) */}
              <path
                d={sectorPath(scx, scy, r, a.start, a.end)}
                fill="rgba(255,255,255,0.14)"
                style={{ mixBlendMode: "soft-light" }}
              />
            </g>
          );
        })}
      </svg>

      <ul
        className={
          compact
            ? "min-w-0 space-y-1.5 text-xs"
            : "min-w-0 flex-1 space-y-2 text-sm"
        }
      >
        {arcs.map((a) => {
          const pct = (a.value / total) * 100;
          return (
            <li key={a.key} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm shadow-sm ring-1 ring-black/5"
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
