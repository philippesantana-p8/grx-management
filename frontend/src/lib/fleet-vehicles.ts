import type { createClient } from "@/lib/supabase/client";
import type { Vehicle } from "@/types/database";

type SupabaseClient = ReturnType<typeof createClient>;

export async function fetchActiveFleetVehicles(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ vehicles: Vehicle[]; error: string | null }> {
  const result = await supabase
    .from("vehicles")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "Ativo")
    .is("deleted_at", null)
    .order("plate");

  if (result.error) {
    return { vehicles: [], error: result.error.message };
  }

  return { vehicles: (result.data as Vehicle[]) ?? [], error: null };
}

export function fleetVehicleLabel(vehicle: Vehicle): string {
  const plate = vehicle.plate_display ?? vehicle.plate;
  const detail = vehicle.model ?? vehicle.vehicle_category ?? "Veículo";
  return `${plate} — ${detail}`;
}
