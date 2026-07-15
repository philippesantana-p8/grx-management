/** Utilitários compartilhados dos gráficos voxel / pixel 3D. */

export function shade(hex: string, amount: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const n = parseInt(raw, 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (n & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Cubo isométrico “pixel” (topo / frente / lado). */
export function voxelCube(
  x: number,
  y: number,
  size: number,
  color: string
): { top: string; front: string; side: string; colors: { top: string; front: string; side: string } } {
  const dx = size * 0.55;
  const dy = size * 0.32;
  return {
    top: `${x},${y} ${x + dx},${y - dy} ${x + dx + size},${y - dy} ${x + size},${y}`,
    front: `${x},${y} ${x + size},${y} ${x + size},${y + size} ${x},${y + size}`,
    side: `${x + size},${y} ${x + size + dx},${y - dy} ${x + size + dx},${y + size - dy} ${x + size},${y + size}`,
    colors: {
      top: shade(color, 48),
      front: color,
      side: shade(color, -42),
    },
  };
}
