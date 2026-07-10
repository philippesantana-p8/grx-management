import type { SupabaseClient } from "@supabase/supabase-js";

export type DreDriverExpenseRow = {
  id: string;
  transaction_date: string;
  amount: number;
  dre_account_name: string;
  driver_name: string | null;
  driver_code: string | null;
  service_order_code: string | null;
  description: string | null;
};

export type DreDriverExpenseSummary = {
  motoristaTotal: number;
  ajudanteTotal: number;
  combinedTotal: number;
};

const DRE_DRIVER_EXPENSE_ACCOUNTS = ["Motorista", "Ajudante"] as const;

export async function fetchDreDriverExpenses(
  supabase: SupabaseClient,
  companyId: string,
  options?: { year?: number; month?: number }
): Promise<{ rows: DreDriverExpenseRow[]; summary: DreDriverExpenseSummary; error: string | null }> {
  let query = supabase
    .from("financial_transactions")
    .select(
      `
      id,
      transaction_date,
      amount,
      description,
      driver:drivers!financial_transactions_driver_id_fkey (code, name),
      service_order:service_orders!financial_transactions_service_order_id_fkey (code),
      chart_of_account:chart_of_accounts!financial_transactions_chart_of_account_id_fkey (name)
    `
    )
    .eq("company_id", companyId)
    .eq("transaction_type", "Despesa")
    .order("transaction_date", { ascending: false });

  if (options?.year && options?.month) {
    const start = `${options.year}-${String(options.month).padStart(2, "0")}-01`;
    const endMonth = options.month === 12 ? 1 : options.month + 1;
    const endYear = options.month === 12 ? options.year + 1 : options.year;
    const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    query = query.gte("transaction_date", start).lt("transaction_date", end);
  }

  const { data, error } = await query;

  if (error) {
    return {
      rows: [],
      summary: { motoristaTotal: 0, ajudanteTotal: 0, combinedTotal: 0 },
      error: error.message,
    };
  }

  const rows: DreDriverExpenseRow[] = [];
  let motoristaTotal = 0;
  let ajudanteTotal = 0;

  for (const item of data ?? []) {
    const accountName = (item.chart_of_account as { name?: string } | null)?.name ?? "";
    if (!DRE_DRIVER_EXPENSE_ACCOUNTS.includes(accountName as (typeof DRE_DRIVER_EXPENSE_ACCOUNTS)[number])) {
      continue;
    }

    const amount = Number(item.amount);
    if (!Number.isFinite(amount)) continue;

    if (accountName === "Motorista") motoristaTotal += amount;
    if (accountName === "Ajudante") ajudanteTotal += amount;

    const driver = item.driver as { code?: string; name?: string } | null;
    const serviceOrder = item.service_order as { code?: string } | null;

    rows.push({
      id: item.id as string,
      transaction_date: item.transaction_date as string,
      amount,
      dre_account_name: accountName,
      driver_name: driver?.name ?? null,
      driver_code: driver?.code ?? null,
      service_order_code: serviceOrder?.code ?? null,
      description: (item.description as string | null) ?? null,
    });
  }

  return {
    rows,
    summary: {
      motoristaTotal,
      ajudanteTotal,
      combinedTotal: motoristaTotal + ajudanteTotal,
    },
    error: null,
  };
}
