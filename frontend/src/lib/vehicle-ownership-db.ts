import type { VehicleOwnership } from "@/types/database";

type OwnershipDbSchema = {
  dateColumn: "effective_date" | "start_date";
  percentScale: "hundred" | "unit";
  conflictColumns: string;
};

let cachedSchema: OwnershipDbSchema | null = null;

export async function getOwnershipDbSchema(
  supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>
): Promise<OwnershipDbSchema> {
  if (cachedSchema) return cachedSchema;

  const effectiveProbe = await supabase.from("vehicle_ownership").select("effective_date").limit(1);
  if (!effectiveProbe.error) {
    cachedSchema = {
      dateColumn: "effective_date",
      percentScale: "hundred",
      conflictColumns: "company_id,vehicle_id,partner_id,effective_date",
    };
    return cachedSchema;
  }

  const startProbe = await supabase.from("vehicle_ownership").select("start_date").limit(1);
  if (!startProbe.error) {
    cachedSchema = {
      dateColumn: "start_date",
      percentScale: "unit",
      conflictColumns: "company_id,vehicle_id,partner_id,start_date",
    };
    return cachedSchema;
  }

  throw new Error(effectiveProbe.error?.message ?? startProbe.error?.message ?? "Tabela vehicle_ownership indisponível.");
}

export function toDbPercent(value: number, schema: OwnershipDbSchema) {
  return schema.percentScale === "unit" ? Number((value / 100).toFixed(4)) : value;
}

export function fromDbPercent(value: number, schema: OwnershipDbSchema) {
  return schema.percentScale === "unit" ? Number((value * 100).toFixed(2)) : Number(value);
}

export function toDbOwnershipPayload(
  row: Record<string, unknown>,
  schema: OwnershipDbSchema
): Record<string, unknown> {
  const { effective_date, ownership_percentage, ...rest } = row;
  return {
    ...rest,
    ownership_percentage: toDbPercent(Number(ownership_percentage), schema),
    [schema.dateColumn]: effective_date,
  };
}

export function fromDbOwnershipRow(
  row: Record<string, unknown>,
  schema: OwnershipDbSchema
): VehicleOwnership {
  const effectiveDate = String(row.effective_date ?? row.start_date ?? "");
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    vehicle_id: String(row.vehicle_id),
    partner_id: String(row.partner_id),
    ownership_percentage: fromDbPercent(Number(row.ownership_percentage), schema),
    effective_date: effectiveDate,
    end_date: row.end_date ? String(row.end_date) : null,
    status: String(row.status),
  };
}

export function ownershipOrderColumn(schema: OwnershipDbSchema) {
  return schema.dateColumn;
}
