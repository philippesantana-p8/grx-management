/**
 * Lançamento inline de Motorista/Ajudante para OS legado (Despesas Motorista).
 * Grava no DRE empresa com service_order_id (rateio) e bloqueia duplicata por OS+conta.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createCompanyLedgerEntry } from "@/lib/dre-company-ledger-api";
import {
  alreadyLaunchedDriverExpenseMessage,
  driverAssistantKindFromAccountName,
  isDriverOrAssistantDreAccount,
  pickDreAccountIdForDriverExpense,
} from "@/lib/legacy-driver-expense";

export type DriverAssistantLaunchKind = "motorista" | "ajudante";

export type ExistingDriverAssistantExpense = {
  id: string;
  serviceOrderId: string;
  kind: DriverAssistantLaunchKind;
  amount: number;
  accountName: string;
  approvalStatus: string | null;
};

function parsePositiveAmount(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export { alreadyLaunchedDriverExpenseMessage };

/**
 * Busca despesas Motorista/Ajudante já vinculadas às OS (submitted/approved).
 */
export async function fetchExistingDriverAssistantExpenses(
  supabase: SupabaseClient,
  companyId: string,
  orderIds: string[]
): Promise<{ byOrder: Map<string, ExistingDriverAssistantExpense[]>; error: string | null }> {
  const byOrder = new Map<string, ExistingDriverAssistantExpense[]>();
  if (!orderIds.length) return { byOrder, error: null };

  const { data: accounts, error: accError } = await supabase
    .from("chart_of_accounts")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("status", "Ativo")
    .eq("transaction_type", "Despesa");

  if (accError) return { byOrder, error: accError.message };

  const accountById = new Map<string, string>();
  const relevantIds: string[] = [];
  for (const a of accounts ?? []) {
    const name = (a.name as string) || "";
    if (!isDriverOrAssistantDreAccount(name)) continue;
    accountById.set(a.id as string, name);
    relevantIds.push(a.id as string);
  }
  if (!relevantIds.length) return { byOrder, error: null };

  let { data, error } = await supabase
    .from("financial_transactions")
    .select("id, amount, service_order_id, chart_of_account_id, approval_status")
    .eq("company_id", companyId)
    .eq("transaction_type", "Despesa")
    .in("service_order_id", orderIds)
    .in("chart_of_account_id", relevantIds);

  if (
    error?.message?.toLowerCase().includes("approval_status") &&
    (error.message.toLowerCase().includes("does not exist") ||
      error.message.toLowerCase().includes("não existe"))
  ) {
    const retry = await supabase
      .from("financial_transactions")
      .select("id, amount, service_order_id, chart_of_account_id")
      .eq("company_id", companyId)
      .eq("transaction_type", "Despesa")
      .in("service_order_id", orderIds)
      .in("chart_of_account_id", relevantIds);
    data = (retry.data ?? []).map((r) => ({ ...r, approval_status: "approved" }));
    error = retry.error;
  }

  if (error) return { byOrder, error: error.message };

  for (const raw of data ?? []) {
    const orderId = raw.service_order_id as string | null;
    const accountName = accountById.get(raw.chart_of_account_id as string) || "";
    const kind = driverAssistantKindFromAccountName(accountName);
    if (!orderId || !kind) continue;
    const status = String(
      (raw as { approval_status?: string | null }).approval_status ?? "approved"
    ).toLowerCase();
    if (status === "rejected" || status === "cancelled") continue;

    const list = byOrder.get(orderId) ?? [];
    list.push({
      id: raw.id as string,
      serviceOrderId: orderId,
      kind,
      amount: Number(raw.amount),
      accountName,
      approvalStatus: (raw as { approval_status?: string | null }).approval_status ?? null,
    });
    byOrder.set(orderId, list);
  }

  return { byOrder, error: null };
}

export function hasLaunchedKind(
  existing: ExistingDriverAssistantExpense[] | undefined,
  kind: DriverAssistantLaunchKind
): boolean {
  return Boolean(existing?.some((e) => e.kind === kind));
}

export function launchedAmount(
  existing: ExistingDriverAssistantExpense[] | undefined,
  kind: DriverAssistantLaunchKind
): number | null {
  const hit = existing?.find((e) => e.kind === kind);
  return hit ? hit.amount : null;
}

export type LaunchLegacyInlineResult = {
  launched: DriverAssistantLaunchKind[];
  skipped: Array<{ kind: DriverAssistantLaunchKind; reason: string }>;
  error: string | null;
};

/**
 * Lança na linha: valida valores e grava Motorista e/ou Ajudante com OS vinculada.
 */
export async function launchLegacyDriverAssistantInline(params: {
  supabase: SupabaseClient;
  companyId: string;
  orderId: string;
  orderCode: string;
  legacyNumber?: string | null;
  serviceDate: string;
  driverName?: string | null;
  motoristaAmount: string;
  ajudanteAmount: string;
}): Promise<LaunchLegacyInlineResult> {
  const motorista = parsePositiveAmount(params.motoristaAmount);
  const ajudante = parsePositiveAmount(params.ajudanteAmount);

  if (motorista == null && ajudante == null) {
    return {
      launched: [],
      skipped: [],
      error: "Informe o valor do motorista e/ou do ajudante antes de lançar.",
    };
  }
  if (!params.serviceDate?.trim()) {
    return { launched: [], skipped: [], error: "OS sem data — não é possível lançar." };
  }
  if (!params.orderId?.trim()) {
    return { launched: [], skipped: [], error: "OS inválida." };
  }

  const { data: accountsRaw, error: accountsError } = await params.supabase
    .from("chart_of_accounts")
    .select("id, name, transaction_type")
    .eq("company_id", params.companyId)
    .eq("status", "Ativo");

  if (accountsError) {
    return { launched: [], skipped: [], error: accountsError.message };
  }

  const accounts = (accountsRaw ?? []).map((a) => ({
    value: a.id as string,
    label: (a.name as string) || "",
    transaction_type: (a.transaction_type as string) || "",
  }));

  const motoristaAccountId = pickDreAccountIdForDriverExpense(accounts, "motorista");
  const ajudanteAccountId = pickDreAccountIdForDriverExpense(accounts, "ajudante");

  const { byOrder, error: existingError } = await fetchExistingDriverAssistantExpenses(
    params.supabase,
    params.companyId,
    [params.orderId]
  );
  if (existingError) {
    return { launched: [], skipped: [], error: existingError };
  }
  const existing = byOrder.get(params.orderId) ?? [];

  const launched: DriverAssistantLaunchKind[] = [];
  const skipped: Array<{ kind: DriverAssistantLaunchKind; reason: string }> = [];

  const tryOne = async (
    kind: DriverAssistantLaunchKind,
    amount: number | null,
    accountId: string
  ) => {
    if (amount == null) return;
    if (!accountId) {
      skipped.push({
        kind,
        reason: `Conta DRE «${kind === "ajudante" ? "Ajudante" : "Motorista"}» não encontrada no plano.`,
      });
      return;
    }
    if (hasLaunchedKind(existing, kind)) {
      skipped.push({
        kind,
        reason: alreadyLaunchedDriverExpenseMessage(kind, params.orderCode),
      });
      return;
    }

    const parts = [
      `OS ${params.orderCode}`,
      params.legacyNumber?.trim() ? `legado ${params.legacyNumber.trim()}` : null,
      params.driverName?.trim() || null,
      kind === "ajudante" ? "pagamento ajudante (OS legado)" : "pagamento motorista (OS legado)",
    ].filter(Boolean);

    const result = await createCompanyLedgerEntry(params.supabase, params.companyId, {
      transactionDate: params.serviceDate.slice(0, 10),
      amount,
      chartOfAccountId: accountId,
      description: parts.join(" · "),
      serviceOrderId: params.orderId,
      legacyNumber: params.legacyNumber ?? null,
    });

    if (result.error) {
      skipped.push({ kind, reason: result.error });
      return;
    }
    launched.push(kind);
  };

  await tryOne("motorista", motorista, motoristaAccountId);
  await tryOne("ajudante", ajudante, ajudanteAccountId);

  if (!launched.length && skipped.length) {
    return {
      launched,
      skipped,
      error: skipped.map((s) => s.reason).join(" "),
    };
  }

  if (!launched.length) {
    return { launched, skipped, error: "Nenhum lançamento foi gravado." };
  }

  return { launched, skipped, error: null };
}
