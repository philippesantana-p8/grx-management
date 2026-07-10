import { cn } from "@/lib/utils";

export type GlassActionTone =
  | "neutral"
  | "brand"
  | "red"
  | "red-soft"
  | "amber"
  | "emerald"
  | "green"
  | "orange"
  | "sky";

export type GlassStatTone = "neutral" | "amber" | "brand" | "green" | "red" | "slate";

/** Abas / links de submenu (DRE, Motoristas, filtros). */
export function glassTabLink(active: boolean): string {
  return cn("liquid-glass-tab-link", active && "liquid-glass-tab-link--active");
}

/** Botões de ação em listas (OS, proposta, etc.). */
export function glassAction(tone: GlassActionTone = "neutral", compact = false): string {
  return cn(
    "liquid-glass-action",
    `liquid-glass-action--${tone}`,
    compact && "liquid-glass-action--compact"
  );
}

/** Barra de abas / submenu. */
export function glassTabsNav(): string {
  return "liquid-glass-tabs-nav";
}

/** Painel de filtros (OS, motoristas, infrações). */
export function glassFilterPanel(): string {
  return "liquid-glass-panel";
}

/** Select e inputs em painéis de filtro. */
export function glassField(): string {
  return "liquid-glass-field";
}

/** Cartão clicável de filtro (infrações). */
export function glassFilterCard(active: boolean, tone?: GlassStatTone): string {
  return cn(
    "liquid-glass-filter-card",
    tone && `liquid-glass-filter-card--${tone}`,
    active && "liquid-glass-filter-card--active"
  );
}

/** Cartão de resumo / estatística (DRE, dashboards). */
export function glassStatCard(tone: GlassStatTone = "neutral"): string {
  return cn("liquid-glass-stat-card", `liquid-glass-stat-card--${tone}`);
}

/** Cartão genérico com vidro. */
export function glassCard(): string {
  return "liquid-glass-card";
}

/** Botão compacto só com ícone. */
export function glassIconBtn(): string {
  return "liquid-glass-icon-btn";
}
