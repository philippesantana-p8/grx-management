"use client";

import { formatCurrency } from "@/lib/utils";
import { shade, voxelCube } from "@/components/dashboard/pixel-3d";

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

const PALETTE = ["#2563eb", "#22c55e", "#f97316", "#a855f7", "#06b6d4", "#ef4444"];

type Voxel = {
  key: string;
  x: number;
  y: number;
  z: number;
  color: string;
  sort: number;
};

/** Rosca 3D em voxels (pixel art) — fatias por ângulo. */
export function PieChart3D({ slices, size = 220, compact = false }: Props) {
  const chartSize = compact ? Math.max(size, 240) : size;
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);

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

  let cursor = 0;
  const arcs = slices
    .map((slice, i) => {
      const value = Math.max(0, slice.value);
      const start = cursor;
      const portion = value / total;
      cursor += portion;
      return {
        ...slice,
        start,
        end: cursor,
        color: slice.color || PALETTE[i % PALETTE.length],
        value,
      };
    })
    .filter((a) => a.end - a.start > 0.001);

  const cx = chartSize / 2;
  const cy = chartSize / 2 + 10;
  const outerR = chartSize * 0.34;
  const innerR = outerR * 0.42;
  const voxel = compact ? 11 : 12;
  const layers = 3;
  const steps = 56;

  const voxels: Voxel[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const arc = arcs.find((a) => t >= a.start && t < a.end) ?? arcs[arcs.length - 1];
    const angle = t * Math.PI * 2 - Math.PI / 2;
    for (let ring = 0; ring < 2; ring++) {
      const rr = innerR + (outerR - innerR) * (0.35 + ring * 0.45);
      const px = cx + Math.cos(angle) * rr;
      const py = cy + Math.sin(angle) * rr * 0.55;
      for (let z = 0; z < layers; z++) {
        voxels.push({
          key: `${i}-${ring}-${z}`,
          x: px - voxel / 2,
          y: py - z * (voxel * 0.55),
          z,
          color: arc.color,
          sort: py + z * 0.01 + Math.sin(angle) * 0.001,
        });
      }
    }
  }

  voxels.sort((a, b) => a.sort - b.sort);

  return (
    <div
      className={
        compact
          ? "flex flex-col items-stretch gap-3"
          : "flex flex-col gap-4 sm:flex-row sm:items-center"
      }
    >
      <div className="relative mx-auto">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-3 rounded-[28px] bg-[repeating-linear-gradient(0deg,rgba(15,23,42,0.03)_0_2px,transparent_2px_4px)]"
        />
        <svg
          viewBox={`0 0 ${chartSize} ${chartSize}`}
          className="relative mx-auto h-56 w-56 [image-rendering:pixelated]"
          role="img"
          aria-label="Gráfico pixel 3D"
          shapeRendering="crispEdges"
        >
          {/* sombra do chão */}
          <ellipse
            cx={cx}
            cy={cy + 18}
            rx={outerR * 1.05}
            ry={outerR * 0.28}
            fill="rgba(15,23,42,0.12)"
          />
          {voxels.map((v) => {
            const cube = voxelCube(v.x, v.y, voxel, v.color);
            return (
              <g key={v.key}>
                <polygon points={cube.side} fill={cube.colors.side} />
                <polygon points={cube.front} fill={cube.colors.front} />
                <polygon points={cube.top} fill={cube.colors.top} />
                {/* pixel highlight */}
                <rect
                  x={v.x + 1}
                  y={v.y + 1}
                  width={Math.max(2, voxel * 0.28)}
                  height={Math.max(2, voxel * 0.22)}
                  fill="rgba(255,255,255,0.35)"
                />
              </g>
            );
          })}
          {/* núcleo pixel */}
          <rect
            x={cx - 14}
            y={cy - 10}
            width={28}
            height={20}
            fill="#f8fafc"
            stroke={shade("#94a3b8", 0)}
            strokeWidth={2}
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
          const pct = (a.value / total) * 100;
          return (
            <li key={a.key} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-3 w-3 shrink-0 border border-slate-900/20 shadow-[2px_2px_0_rgba(15,23,42,0.15)]"
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
