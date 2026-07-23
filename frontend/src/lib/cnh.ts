/** Utilitários de validação da CNH brasileira (11 dígitos + DV). */

import { getExpiryTierByMonths } from "@/lib/expiry-status";

export const CNH_CATEGORIES = [
  { value: "A", label: "A — Motocicletas" },
  { value: "B", label: "B — Automóveis" },
  { value: "C", label: "C — Caminhões" },
  { value: "D", label: "D — Ônibus / micro-ônibus" },
  { value: "E", label: "E — Carreta / reboque" },
  { value: "AB", label: "AB — A + B" },
  { value: "AC", label: "AC — A + C" },
  { value: "AD", label: "AD — A + D" },
  { value: "AE", label: "AE — A + E" },
] as const;

export type CnhCategory = (typeof CNH_CATEGORIES)[number]["value"];

export const CNH_EXPIRY_WARNING_MONTHS = 2;
export const CNH_EXPIRY_CRITICAL_MONTHS = 1;

export type CnhExpiryStatus = "none" | "ok" | "warning" | "critical" | "expired";

const CATEGORY_ORDER = new Map(CNH_CATEGORIES.map((item, index) => [item.value, index]));

export function normalizeCnh(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCnh(value: string): string {
  const digits = normalizeCnh(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function isValidCnh(value: string): boolean {
  const digits = normalizeCnh(value);

  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const numbers = digits.split("").map(Number);

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += numbers[i] * (9 - i);
  let firstDigit = sum % 11;
  if (firstDigit >= 10) firstDigit = 0;

  sum = 0;
  for (let i = 0; i < 9; i++) sum += numbers[i] * (i + 1);
  let secondDigit = sum % 11;
  if (secondDigit >= 10) secondDigit = 0;

  return numbers[9] === firstDigit && numbers[10] === secondDigit;
}

/** Retorna mensagem de erro ou null se válido/vazio. */
export function validateCnh(value: string | null | undefined): string | null {
  if (value == null || String(value).trim() === "") return null;

  const digits = normalizeCnh(value);
  if (digits.length !== 11) {
    return "CNH deve conter 11 dígitos.";
  }
  if (!isValidCnh(digits)) {
    return "Número de CNH inválido (dígitos verificadores incorretos).";
  }
  return null;
}

export function sortCnhCategories(categories: string[]): string[] {
  return [...categories].sort(
    (a, b) => (CATEGORY_ORDER.get(a as CnhCategory) ?? 99) - (CATEGORY_ORDER.get(b as CnhCategory) ?? 99)
  );
}

export function formatCnhCategories(categories: string[] | null | undefined): string {
  if (!categories?.length) return "—";
  return sortCnhCategories(categories).join(", ");
}

export function toggleCnhCategory(current: string[], value: CnhCategory): string[] {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return sortCnhCategories([...next]);
}

export function getCnhExpiryStatus(date: string | null | undefined): CnhExpiryStatus {
  return getExpiryTierByMonths(date, CNH_EXPIRY_WARNING_MONTHS, CNH_EXPIRY_CRITICAL_MONTHS);
}

export function getCnhExpiryMessage(date: string | null | undefined): string | null {
  const status = getCnhExpiryStatus(date);
  if (status === "expired") return "CNH vencida. Regularize antes de usar o motorista em operação.";
  if (status === "critical") {
    return `CNH vence em até ${CNH_EXPIRY_CRITICAL_MONTHS} mês. Providencie a renovação.`;
  }
  if (status === "warning") {
    return `CNH vence em até ${CNH_EXPIRY_WARNING_MONTHS} meses. Verifique a renovação.`;
  }
  return null;
}

export function isCnhExpiryDanger(status: CnhExpiryStatus): boolean {
  return status === "expired" || status === "critical";
}

export function formatCnhExpiryDate(date: string | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
