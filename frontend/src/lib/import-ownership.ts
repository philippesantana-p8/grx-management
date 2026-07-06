import {
  getOwnershipDbSchema,
  toDbOwnershipPayload,
} from "@/lib/vehicle-ownership-db";
import {
  OWNERSHIP_SEED,
  PARTNER_SEED,
  VEHICLE_SEED,
  type OwnershipSeedRow,
} from "@/lib/ownership-seed";
import { normalizePlate, normalizeText } from "@/lib/utils";
import type { Partner, Vehicle } from "@/types/database";

export type OwnershipImportResult = {
  imported: number;
  skipped: number;
  partnersCreated: number;
  vehiclesCreated: number;
  operationalUpdated: number;
  warnings: string[];
  errors: string[];
};

function findPartner(partners: Partner[], name: string): Partner | undefined {
  const target = normalizeText(name);
  return partners.find((p) => normalizeText(p.name) === target);
}

function findVehicle(vehicles: Vehicle[], plate: string): Vehicle | undefined {
  const target = normalizePlate(plate);
  return vehicles.find((v) => normalizePlate(v.plate) === target);
}

export function buildOwnershipImportRows(
  seed: OwnershipSeedRow[],
  companyId: string,
  vehicles: Vehicle[],
  partners: Partner[]
): {
  rows: Record<string, unknown>[];
  operationalUpdates: { vehicleId: string; partnerId: string }[];
  warnings: string[];
  errors: string[];
} {
  const rows: Record<string, unknown>[] = [];
  const operationalUpdates: { vehicleId: string; partnerId: string }[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const item of seed) {
    const vehicle = findVehicle(vehicles, item.plate);
    const partner = findPartner(partners, item.partner);

    if (!vehicle) {
      errors.push(`Veículo não encontrado: ${item.plate}`);
      continue;
    }
    if (!partner) {
      errors.push(`Sócio não encontrado: ${item.partner} (placa ${item.plate})`);
      continue;
    }

    rows.push({
      company_id: companyId,
      vehicle_id: vehicle.id,
      partner_id: partner.id,
      ownership_percentage: item.ownership_percentage,
      effective_date: item.effective_date,
      end_date: null,
      status: item.status,
    });

    if (item.operational) {
      operationalUpdates.push({ vehicleId: vehicle.id, partnerId: partner.id });
    }
  }

  const platesInSeed = new Set(seed.map((s) => normalizePlate(s.plate)));
  const vehiclePlates = new Set(vehicles.map((v) => normalizePlate(v.plate)));
  for (const plate of vehiclePlates) {
    if (!platesInSeed.has(plate)) {
      warnings.push(`Placa ${plate} sem participação na planilha (cadastre manualmente se necessário).`);
    }
  }

  return { rows, operationalUpdates, warnings, errors };
}

async function ensurePartners(
  companyId: string,
  supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>
): Promise<{ partners: Partner[]; created: number }> {
  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  const existing = (data as Partner[]) ?? [];
  const missing = PARTNER_SEED.filter(
    (seed) => !existing.some((p) => normalizeText(p.name) === normalizeText(seed.name))
  );

  if (missing.length > 0) {
    const { error: insertError } = await supabase.from("partners").upsert(
      missing.map((seed) => ({
        company_id: companyId,
        code: seed.code,
        name: seed.name,
        partner_type: seed.partner_type,
        status: "Ativo",
        use_in_allocation: true,
      })),
      { onConflict: "company_id,code", ignoreDuplicates: true }
    );
    if (insertError) throw new Error(insertError.message);
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("partners")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (refreshError) throw new Error(refreshError.message);

  return { partners: (refreshed as Partner[]) ?? [], created: missing.length };
}

async function ensureVehicles(
  companyId: string,
  supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>
): Promise<{ vehicles: Vehicle[]; created: number }> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  const existing = (data as Vehicle[]) ?? [];
  const missing = VEHICLE_SEED.filter(
    (seed) => !existing.some((v) => normalizePlate(v.plate) === normalizePlate(seed.plate))
  );

  if (missing.length > 0) {
    const { error: insertError } = await supabase.from("vehicles").upsert(
      missing.map((seed) => ({
        company_id: companyId,
        code: seed.code,
        plate: seed.plate,
        plate_display: seed.plate,
        vehicle_category: seed.vehicle_category,
        status: seed.status,
      })),
      { onConflict: "company_id,code", ignoreDuplicates: true }
    );
    if (insertError) throw new Error(insertError.message);
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (refreshError) throw new Error(refreshError.message);

  return { vehicles: (refreshed as Vehicle[]) ?? [], created: missing.length };
}

export async function importOwnershipFromSpreadsheet(
  companyId: string,
  supabase: ReturnType<typeof import("@/lib/supabase/client").createClient>
): Promise<OwnershipImportResult> {
  const schema = await getOwnershipDbSchema(supabase);
  const { partners, created: partnersCreated } = await ensurePartners(companyId, supabase);
  const { vehicles, created: vehiclesCreated } = await ensureVehicles(companyId, supabase);

  const { data: existingOwnership, error: existingError } = await supabase
    .from("vehicle_ownership")
    .select("vehicle_id, partner_id")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (existingError) throw new Error(existingError.message);

  const existingKeys = new Set(
    (existingOwnership ?? []).map((row) => `${row.vehicle_id}:${row.partner_id}`)
  );

  const { rows, operationalUpdates, warnings, errors } = buildOwnershipImportRows(
    OWNERSHIP_SEED,
    companyId,
    vehicles,
    partners
  );

  const pending = rows.filter((row) => {
    const key = `${row.vehicle_id}:${row.partner_id}`;
    return !existingKeys.has(key);
  });
  const skipped = rows.length - pending.length;

  if (pending.length === 0) {
    return {
      imported: 0,
      skipped: OWNERSHIP_SEED.length,
      partnersCreated,
      vehiclesCreated,
      operationalUpdated: 0,
      warnings: [
        ...warnings,
        ...(skipped > 0 ? [`${skipped} participação(ões) já existiam e foram ignoradas.`] : []),
      ],
      errors: errors.length
        ? errors
        : skipped > 0
          ? []
          : ["Nenhum registro importado. Verifique os cadastros de veículos e sócios."],
    };
  }

  const dbRows = pending.map((row) => toDbOwnershipPayload(row, schema));

  const { error: upsertError } = await supabase.from("vehicle_ownership").upsert(dbRows, {
    onConflict: schema.conflictColumns,
  });

  if (upsertError) throw new Error(upsertError.message);

  let operationalUpdated = 0;
  for (const update of operationalUpdates) {
    const { error } = await supabase
      .from("vehicles")
      .update({ operational_partner_id: update.partnerId })
      .eq("id", update.vehicleId);
    if (!error) operationalUpdated += 1;
  }

  return {
    imported: pending.length,
    skipped: OWNERSHIP_SEED.length - pending.length,
    partnersCreated,
    vehiclesCreated,
    operationalUpdated,
    warnings: [
      ...warnings,
      ...(skipped > 0 ? [`${skipped} participação(ões) já existiam e foram ignoradas.`] : []),
    ],
    errors,
  };
}

export { OWNERSHIP_SEED };
