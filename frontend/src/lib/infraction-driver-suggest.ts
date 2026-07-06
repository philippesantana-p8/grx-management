import { createClient } from "@/lib/supabase/client";
import { normalizePlate } from "@/lib/utils";

export type InfractionDriverSuggestion = {
  driver_id: string;
  driver_name: string;
  source: "service_order" | "financial_transaction";
  service_order_id?: string;
  service_order_code?: string;
  reason: string;
};

function isDateWithinRange(date: string, start: string | null, end: string | null): boolean {
  if (!start) return false;
  const endDate = end ?? start;
  return date >= start && date <= endDate;
}

async function getDriverName(driverId: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.from("drivers").select("name").eq("id", driverId).maybeSingle();
  return data?.name ?? "Motorista";
}

export async function suggestDriverForInfraction(
  companyId: string,
  vehicleId: string,
  infractionDate: string
): Promise<InfractionDriverSuggestion | null> {
  if (!companyId || !vehicleId || !infractionDate) return null;

  const supabase = createClient();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("plate")
    .eq("id", vehicleId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!vehicle?.plate) return null;
  const normalizedPlate = normalizePlate(vehicle.plate);

  const { data: orders } = await supabase
    .from("service_orders")
    .select("id, code, driver_id, plate, service_date, entry_date, exit_date, status, service_type")
    .eq("company_id", companyId)
    .not("driver_id", "is", null)
    .in("status", ["Aberto", "Concluido"])
    .order("service_date", { ascending: false });

  for (const order of orders ?? []) {
    if (!order.driver_id || normalizePlate(order.plate) !== normalizedPlate) continue;

    const start = order.entry_date ?? order.service_date;
    const end = order.exit_date ?? order.service_date ?? order.entry_date;

    if (isDateWithinRange(infractionDate, start, end)) {
      return {
        driver_id: order.driver_id,
        driver_name: await getDriverName(order.driver_id),
        source: "service_order",
        service_order_id: order.id,
        service_order_code: order.code,
        reason: `OS ${order.code} — período ${start}${end && end !== start ? ` a ${end}` : ""}`,
      };
    }
  }

  const { data: transactions } = await supabase
    .from("financial_transactions")
    .select("driver_id, service_date, transaction_date")
    .eq("company_id", companyId)
    .eq("operational_vehicle_id", vehicleId)
    .not("driver_id", "is", null)
    .or(`service_date.eq.${infractionDate},transaction_date.eq.${infractionDate}`)
    .limit(1);

  const transaction = transactions?.[0];
  if (transaction?.driver_id) {
    const usedDate = transaction.service_date ?? transaction.transaction_date ?? infractionDate;
    return {
      driver_id: transaction.driver_id,
      driver_name: await getDriverName(transaction.driver_id),
      source: "financial_transaction",
      reason: `Lançamento financeiro na data ${usedDate}`,
    };
  }

  return null;
}
