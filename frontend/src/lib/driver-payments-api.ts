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

export async function fetchDriverPaymentRows(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ rows: DriverPaymentRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("service_orders")
    .select(
      `
      id,
      code,
      service_date,
      status,
      driver_id,
      driver_assignment_pay_amount,
      driver_assignment_assistant_pay_amount,
      driver_payment_paid_at,
      driver:drivers!service_orders_driver_id_fkey (
        code,
        name,
        pix_key,
        bank_code,
        bank_agency,
        bank_account
      )
    `
    )
    .eq("company_id", companyId)
    .eq("driver_assignment_response", "accepted")
    .not("driver_id", "is", null)
    .not("driver_assignment_pay_amount", "is", null)
    .is("deleted_at", null)
    .order("service_date", { ascending: false });

  if (error) return { rows: [], error: error.message };

  const rows: DriverPaymentRow[] = (data ?? [])
    .map((row) => {
      const driver = row.driver as {
        code?: string;
        name?: string;
        pix_key?: string | null;
        bank_code?: string | null;
        bank_agency?: string | null;
        bank_account?: string | null;
      } | null;

      const payAmount = Number(row.driver_assignment_pay_amount);
      if (!Number.isFinite(payAmount) || payAmount <= 0) return null;

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

  return { rows, error: null };
}

export async function markDriverPaymentPaid(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ paidAt: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("mark_driver_payment_paid", {
    p_order_id: orderId,
  });

  if (error) return { paidAt: null, error: error.message };

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
