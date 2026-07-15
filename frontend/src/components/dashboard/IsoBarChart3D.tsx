"use client";

import { formatCurrency } from "@/lib/utils";
import { voxelCube } from "@/components/dashboard/pixel-3d";

export type IsoBarItem = {
  key: string;
  label: string;
  value: number;
  color: string;
  topColor: string;
  sideColor: string;
};

type Props = {
  items: IsoBarItem[];
  height?: number;
};

/** Torres voxel / pixel 3D (empilhamento de cubos). */
export function IsoBarChart3D({ items, height = 200 }: Props) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const voxel = 14;
  const gap = 22;
  const maxStacks = 8;
  const baseY = height - 36;
  const chartW = Math.max(240, items.length * (voxel + gap + 18) + 48);

  return (
    <div className="relative w-full overflow-x-auto rounded-xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(226,232,240,0.35))] p-2">
      <svg
        viewBox={`0 0 ${chartW} ${height}`}
        className="mx-auto block h-auto w-full max-w-md [image-rendering:pixelated]"
        role="img"
        aria-label="Gráfico de barras pixel 3D"
        shapeRendering="crispEdges"
      >
        {/* chão pixel */}
        {Array.from({ length: Math.floor(chartW / 8) }).map((_, i) => (
          <rect
            key={`g-${i}`}
            x={i * 8}
            y={baseY + 6}
            width={8}
            height={8}
            fill={i % 2 === 0 ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.08)"}
          />
        ))}

        {items.map((item, index) => {
          const stacks = Math.max(
            1,
            Math.round((Math.abs(item.value) / max) * maxStacks)
          );
          const x0 = 36 + index * (voxel + gap + 16);
          const cubes = [];
          for (let s = 0; s < stacks; s++) {
            const y = baseY - s * (voxel * 0.92);
            const cube = voxelCube(x0, y, voxel, item.color);
            cubes.push(
              <g key={`${item.key}-${s}`}>
                <polygon points={cube.side} fill={cube.colors.side} />
                <polygon points={cube.front} fill={cube.colors.front} />
                <polygon points={cube.top} fill={cube.colors.top} />
                <rect
                  x={x0 + 2}
                  y={y + 2}
                  width={4}
                  height={3}
                  fill="rgba(255,255,255,0.4)"
                />
              </g>
            );
          }

          return (
            <g key={item.key}>
              {cubes}
              <text
                x={x0 + voxel * 0.7}
                y={baseY - stacks * (voxel * 0.92) - 10}
                textAnchor="middle"
                className="fill-slate-800"
                style={{ fontSize: 10, fontWeight: 700 }}
              >
                {formatCurrency(item.value)}
              </text>
              <text
                x={x0 + voxel * 0.55}
                y={baseY + 22}
                textAnchor="middle"
                className="fill-slate-500"
                style={{ fontSize: 10, fontWeight: 600 }}
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
  revenue: { color: "#22c55e", topColor: "#4ade80", sideColor: "#15803d" },
  expense: { color: "#ef4444", topColor: "#f87171", sideColor: "#b91c1c" },
  result: { color: "#2563eb", topColor: "#60a5fa", sideColor: "#1d4ed8" },
} as const;
