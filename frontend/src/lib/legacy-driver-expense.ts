/**
 * OS legado/importada sem valor de designação (motorista/ajudante).
 * Autorização operacional: lançar manualmente em DRE → Lançamentos da empresa
 * nas contas Motorista / Ajudante, até as novas OS usarem o fluxo do sistema.
 */

export type LegacyDriverExpenseRow = {
  code?: string | null;
  legacy_number?: string | null;
  service_date?: string | null;
  notes?: string | null;
  driver_id?: string | null;
  driver_assignment_sent_at?: string | null;
  driver_assignment_pay_amount?: number | string | null;
  driver_assignment_assistant_pay_amount?: number | string | null;
  driver_payment_paid_at?: string | null;
};

function parsePositiveAmount(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Tag usada no import EVENTOS / testes de carga. */
export function isImportedServiceOrderNotes(notes: string | null | undefined): boolean {
  const text = String(notes ?? "");
  return (
    text.includes("[IMPORTAÇÃO TESTE OS]") ||
    text.includes("[IMPORTACAO TESTE OS]") ||
    /importado de eventos/i.test(text)
  );
}

/** Tem valor de pagamento motorista ou ajudante na designação. */
export function hasDriverAssignmentPayAmounts(row: LegacyDriverExpenseRow): boolean {
  return (
    parsePositiveAmount(row.driver_assignment_pay_amount) != null ||
    parsePositiveAmount(row.driver_assignment_assistant_pay_amount) != null
  );
}

/**
 * OS com motorista, sem valores de designação — caminho legado:
 * lançar despesa manual no DRE da empresa (conta Motorista/Ajudante).
 */
export function needsManualCompanyDriverExpense(row: LegacyDriverExpenseRow): boolean {
  if (!row.driver_id) return false;
  if (row.driver_payment_paid_at) return false;
  if (hasDriverAssignmentPayAmounts(row)) return false;

  // Import explícito OU nunca passou pela designação WhatsApp (valores obrigatórios)
  if (isImportedServiceOrderNotes(row.notes)) return true;
  if (!row.driver_assignment_sent_at) return true;
  return false;
}

export type CompanyLedgerDriverExpensePrefill = {
  code?: string | null;
  legacyNumber?: string | null;
  serviceDate?: string | null;
  driverName?: string | null;
  /** Preferência de conta no plano DRE */
  account?: "motorista" | "ajudante";
};

/** Deep-link para pré-preencher Lançamentos da empresa. */
export function companyLedgerDriverExpenseHref(
  prefill: CompanyLedgerDriverExpensePrefill
): string {
  const params = new URLSearchParams();
  params.set("legacyPay", "1");
  if (prefill.account) params.set("account", prefill.account);
  if (prefill.code?.trim()) params.set("os", prefill.code.trim());
  if (prefill.legacyNumber?.trim()) params.set("legacy", prefill.legacyNumber.trim());
  if (prefill.serviceDate?.trim()) params.set("date", prefill.serviceDate.trim().slice(0, 10));
  if (prefill.driverName?.trim()) params.set("driver", prefill.driverName.trim());

  const parts = [
    prefill.code?.trim() ? `OS ${prefill.code.trim()}` : null,
    prefill.legacyNumber?.trim() ? `legado ${prefill.legacyNumber.trim()}` : null,
    prefill.driverName?.trim() ? prefill.driverName.trim() : null,
    "pagamento motorista/ajudante (OS importada — lançamento manual autorizado)",
  ].filter(Boolean);
  params.set("desc", parts.join(" · "));

  return `/dre/lancamentos?${params.toString()}`;
}

export function pickDreAccountIdForDriverExpense(
  accounts: Array<{ value: string; label: string; transaction_type: string }>,
  preference: "motorista" | "ajudante" = "motorista"
): string {
  const expense = accounts.filter((a) => a.transaction_type === "Despesa");
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const prefer =
    preference === "ajudante"
      ? [/ajudante/, /assistente/]
      : [/motorista/, /pagamento.?motorista/];

  for (const re of prefer) {
    const hit = expense.find((a) => re.test(norm(a.label)));
    if (hit) return hit.value;
  }

  // Fallback: qualquer despesa com o termo na preferência
  const fallback = expense.find((a) => norm(a.label).includes(preference));
  return fallback?.value ?? "";
}
