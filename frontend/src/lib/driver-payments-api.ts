import type { SupabaseClient } from "@supabase/supabase-js";

export type DriverPaymentRow = {
  id: string;
  code: string;
  service_date: string;
  status: string;
  driver_id: string;
  driver_code: string;
  driver_name: string;
  pix_key: string | null;
  bank_code: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  driver_assignment_pay_amount: number;
  driver_assignment_assistant_pay_amount: number | null;
  driver_payment_paid_at: string | null;
};

export type DriverPaymentFilter = "all" | "pending" | "paid";

type DriverBanking = {
  code: string;
  name: string;
  pix_key: string | null;
  bank_code: string | null;
  bank_agency: string | null;
  bank_account: string | null;
};

const ORDER_FIELDS =
  "id, code, service_date, status, driver_id, driver_assignment_pay_amount, driver_assignment_assistant_pay_amount, driver_payment_paid_at";

async function fetchDriversWithBanking(
  supabase: SupabaseClient,
  driverIds: string[]
): Promise<Map<string, DriverBanking>> {
  const byId = new Map<string, DriverBanking>();
  if (!driverIds.length) return byId;

  const full = await supabase
    .from("drivers")
    .select("id, code, name, pix_key, bank_code, bank_agency, bank_account")
    .in("id", driverIds);

  let drivers = full.data;

  if (full.error?.message.includes("pix_key") || full.error?.message.includes("bank_code")) {
    const basic = await supabase.from("drivers").select("id, code, name").in("id", driverIds);
    drivers = (basic.data ?? []).map((d) => ({
      ...d,
      pix_key: null,
      bank_code: null,
      bank_agency: null,
      bank_account: null,
    }));
  } else if (full.error) {
    return byId;
  }

  for (const driver of drivers ?? []) {
    byId.set(driver.id as string, {
      code: (driver.code as string) ?? "—",
      name: (driver.name as string) ?? "—",
      pix_key: (driver.pix_key as string | null) ?? null,
      bank_code: (driver.bank_code as string | null) ?? null,
      bank_agency: (driver.bank_agency as string | null) ?? null,
      bank_account: (driver.bank_account as string | null) ?? null,
    });
  }

  return byId;
}

export async function fetchDriverPaymentRows(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ rows: DriverPaymentRow[]; error: string | null; schemaWarning: string | null }> {
  const { data, error } = await supabase
    .from("service_orders")
    .select(ORDER_FIELDS)
    .eq("company_id", companyId)
    .eq("driver_assignment_response", "accepted")
    .not("driver_id", "is", null)
    .not("driver_assignment_pay_amount", "is", null)
    .is("deleted_at", null)
    .order("service_date", { ascending: false });

  if (error) {
    if (
      error.message.includes("driver_assignment_pay_amount") ||
      error.message.includes("driver_payment_paid_at")
    ) {
      return {
        rows: [],
        error: null,
        schemaWarning:
          "Colunas de pagamento ao motorista ainda não existem no Supabase. Rode o script apply-all-driver-designation-flow.sql.",
      };
    }
    return { rows: [], error: error.message, schemaWarning: null };
  }

  const driverIds = [
    ...new Set((data ?? []).map((row) => row.driver_id as string).filter(Boolean)),
  ];
  const driversById = await fetchDriversWithBanking(supabase, driverIds);

  let schemaWarning: string | null = null;
  if (driverIds.length && driversById.size === 0) {
    schemaWarning =
      "Não foi possível carregar dados bancários dos motoristas. Verifique a migration 031 no Supabase.";
  }

  const rows: DriverPaymentRow[] = (data ?? [])
    .map((row) => {
      const payAmount = Number(row.driver_assignment_pay_amount);
      if (!Number.isFinite(payAmount) || payAmount <= 0) return null;

      const driver = driversById.get(row.driver_id as string);

      return {
        id: row.id as string,
        code: row.code as string,
        service_date: row.service_date as string,
        status: row.status as string,
        driver_id: row.driver_id as string,
        driver_code: driver?.code ?? "—",
        driver_name: driver?.name ?? "—",
        pix_key: driver?.pix_key ?? null,
        bank_code: driver?.bank_code ?? null,
        bank_agency: driver?.bank_agency ?? null,
        bank_account: driver?.bank_account ?? null,
        driver_assignment_pay_amount: payAmount,
        driver_assignment_assistant_pay_amount:
          row.driver_assignment_assistant_pay_amount != null
            ? Number(row.driver_assignment_assistant_pay_amount)
            : null,
        driver_payment_paid_at: (row.driver_payment_paid_at as string | null) ?? null,
      };
    })
    .filter(Boolean) as DriverPaymentRow[];

  return { rows, error: null, schemaWarning };
}

export async function markDriverPaymentPaid(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ paidAt: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("mark_driver_payment_paid", {
    p_order_id: orderId,
  });

  if (error) {
    const message = error.message.includes("mark_driver_payment_paid")
      ? "Função mark_driver_payment_paid não encontrada. Rode apply-all-driver-designation-flow.sql no Supabase."
      : error.message;
    return { paidAt: null, error: message };
  }

  const payload = data as { driver_payment_paid_at?: string } | null;
  return { paidAt: payload?.driver_payment_paid_at ?? null, error: null };
}

export function filterDriverPaymentRows(
  rows: DriverPaymentRow[],
  filter: DriverPaymentFilter
): DriverPaymentRow[] {
  if (filter === "pending") {
    return rows.filter((row) => !row.driver_payment_paid_at);
  }
  if (filter === "paid") {
    return rows.filter((row) => Boolean(row.driver_payment_paid_at));
  }
  return rows;
}

export function driverPaymentTotal(row: DriverPaymentRow): number {
  const assistant = row.driver_assignment_assistant_pay_amount ?? 0;
  return row.driver_assignment_pay_amount + assistant;
}
