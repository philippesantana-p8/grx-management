/** Status de validade genérico (CNH e documentos/licenças). */

export type ExpiryTier =
  | "none"
  | "ok"
  | "first"
  | "second"
  | "critical"
  | "urgent"
  | "expired";

export type ExpiryBadgeVariant = "default" | "success" | "warning" | "danger";

export type DayAlertThresholds = {
  first: number;
  second: number;
  critical: number;
  urgent: number;
};

export const DEFAULT_DOCUMENT_ALERT_DAYS: DayAlertThresholds = {
  first: 60,
  second: 30,
  critical: 15,
  urgent: 7,
};

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysUntilExpiry(date: string | null | undefined): number | null {
  if (!date) return null;
  const expiry = parseDateOnly(date);
  if (!expiry) return null;
  const today = startOfToday();
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Thresholds em dias (documentos). Menor tier vence. */
export function getExpiryTierByDays(
  date: string | null | undefined,
  thresholds: DayAlertThresholds = DEFAULT_DOCUMENT_ALERT_DAYS,
  options?: { noExpiry?: boolean }
): ExpiryTier {
  if (options?.noExpiry) return "ok";
  if (!date) return "none";
  const days = daysUntilExpiry(date);
  if (days == null) return "none";
  if (days < 0) return "expired";
  if (days <= thresholds.urgent) return "urgent";
  if (days <= thresholds.critical) return "critical";
  if (days <= thresholds.second) return "second";
  if (days <= thresholds.first) return "first";
  return "ok";
}

export function expiryTierToBadgeVariant(tier: ExpiryTier): ExpiryBadgeVariant {
  if (tier === "expired" || tier === "urgent" || tier === "critical") return "danger";
  if (tier === "first" || tier === "second") return "warning";
  if (tier === "ok") return "success";
  return "default";
}

export function expiryTierLabel(tier: ExpiryTier): string {
  switch (tier) {
    case "expired":
      return "Vencido";
    case "urgent":
      return "Urgente (7 dias)";
    case "critical":
      return "Crítico (15 dias)";
    case "second":
      return "Vence em breve (30 dias)";
    case "first":
      return "Atenção (60 dias)";
    case "ok":
      return "Válido";
    default:
      return "Sem vencimento";
  }
}

/** CNH legado: warning = 2 meses, critical = 1 mês (aprox. 60/30 dias). */
export function getExpiryTierByMonths(
  date: string | null | undefined,
  warningMonths: number,
  criticalMonths: number
): "none" | "ok" | "warning" | "critical" | "expired" {
  if (!date) return "none";
  const expiry = parseDateOnly(date);
  if (!expiry) return "none";
  const today = startOfToday();
  if (expiry < today) return "expired";

  const criticalLimit = new Date(today);
  criticalLimit.setMonth(criticalLimit.getMonth() + criticalMonths);
  if (expiry <= criticalLimit) return "critical";

  const warningLimit = new Date(today);
  warningLimit.setMonth(warningLimit.getMonth() + warningMonths);
  if (expiry <= warningLimit) return "warning";

  return "ok";
}

export function formatExpiryDateBR(date: string | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

export function isoWeekPeriodKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
