import { DRIVERS_SEED, type DriverSeedRow } from "@/lib/drivers-seed";
import { normalizeText } from "@/lib/utils";

export type DriversImportResult = {
  imported: number;
  skipped: number;
  merged: number;
  warnings: string[];
  errors: string[];
};

function toPayload(
  companyId: string,
  row: DriverSeedRow,
  schema: { cnh: boolean; categories: boolean }
) {
  const payload: Record<string, unknown> = {
    company_id: companyId,
    code: row.code,
    name: row.name,
    name_normalized: normalizeText(row.name),
    driver_type: row.driver_type,
    status: row.status,
    phone: row.phone,
    document: row.document,
    active_for_operations: row.active_for_operations,
    notes: row.notes,
  };

  if (schema.cnh) {
    payload.cnh_number = null;
    payload.cnh_expiry_date = null;
  }
  if (schema.categories) {
    payload.cnh_categories = [];
  }

  return payload;
}

async function getDriversCnhSchema(
  supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>
): Promise<{ cnh: boolean; categories: boolean }> {
  const full = await supabase.from("drivers").select("cnh_expiry_date, cnh_categories").limit(1);
  if (!full.error) return { cnh: true, categories: true };

  const cnhOnly = await supabase.from("drivers").select("cnh_expiry_date").limit(1);
  return { cnh: !cnhOnly.error, categories: false };
}

export async function importDriversFromSpreadsheet(
  companyId: string,
  supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>
): Promise<DriversImportResult> {
  const { data: existing, error: existingError } = await supabase
    .from("drivers")
    .select("code")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (existingError) {
    return {
      imported: 0,
      skipped: 0,
      merged: 0,
      warnings: [],
      errors: [existingError.message],
    };
  }

  const existingCodes = new Set((existing ?? []).map((row) => row.code));
  const pending = DRIVERS_SEED.filter((row) => !existingCodes.has(row.code));
  const skipped = DRIVERS_SEED.length - pending.length;

  if (pending.length === 0) {
    return {
      imported: 0,
      skipped,
      merged: 0,
      warnings: [],
      errors: skipped > 0 ? [] : ["Nenhum motorista para importar."],
    };
  }

  const schema = await getDriversCnhSchema(supabase);
  const payload = pending.map((row) => toPayload(companyId, row, schema));
  const { error } = await supabase.from("drivers").upsert(payload, {
    onConflict: "company_id,code",
  });

  if (error) {
    return {
      imported: 0,
      skipped,
      merged: 0,
      warnings: [],
      errors: [error.message],
    };
  }

  return {
    imported: pending.length,
    skipped,
    merged: 0,
    warnings: [
      ...(skipped > 0 ? [`${skipped} motorista(s) já existiam (código) e foram ignorados.`] : []),
      ...(!schema.cnh
        ? ["Colunas CNH ainda não existem no banco — aplique a migration 005_drivers_cnh.sql."]
        : []),
      ...(schema.cnh && !schema.categories
        ? ["Coluna cnh_categories ausente — aplique a migration 007_drivers_cnh_categories.sql."]
        : []),
    ],
    errors: [],
  };
}

export { DRIVERS_SEED };
