import { createClient } from "@/lib/supabase/client";
import { buildActiveServiceOrderMap, type ActiveServiceOrderByDriver } from "@/lib/driver-filters";

export async function fetchActiveServiceOrdersByDriver(
  companyId: string
): Promise<ActiveServiceOrderByDriver> {
  const supabase = createClient();

  const probe = await supabase
    .from("service_orders")
    .select("driver_id, code")
    .eq("company_id", companyId)
    .eq("status", "Aberto")
    .not("driver_id", "is", null)
    .limit(1);

  if (probe.error) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("service_orders")
    .select("driver_id, code")
    .eq("company_id", companyId)
    .eq("status", "Aberto")
    .not("driver_id", "is", null);

  if (error || !data) return new Map();
  return buildActiveServiceOrderMap(data);
}
