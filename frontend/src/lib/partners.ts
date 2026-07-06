import { createClient } from "@/lib/supabase/client";

export type SoftDeletePartnerResult =
  | { ok: true; name: string; code: string }
  | { ok: false; reason: string };

export async function softDeletePartnerByCode(
  companyId: string,
  code: string
): Promise<SoftDeletePartnerResult> {
  const supabase = createClient();

  const { data: partner, error: findError } = await supabase
    .from("partners")
    .select("id, code, name")
    .eq("company_id", companyId)
    .eq("code", code)
    .is("deleted_at", null)
    .maybeSingle();

  if (findError) return { ok: false, reason: findError.message };
  if (!partner) return { ok: false, reason: `Sócio com código "${code}" não encontrado.` };

  const { count: ownershipCount, error: ownershipError } = await supabase
    .from("vehicle_ownership")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("partner_id", partner.id);

  if (ownershipError) return { ok: false, reason: ownershipError.message };
  if ((ownershipCount ?? 0) > 0) {
    return {
      ok: false,
      reason: `O sócio ${partner.name} possui ${ownershipCount} participação(ões) societária(s).`,
    };
  }

  const { count: vehicleCount, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("operational_partner_id", partner.id)
    .is("deleted_at", null);

  if (vehicleError) return { ok: false, reason: vehicleError.message };
  if ((vehicleCount ?? 0) > 0) {
    return {
      ok: false,
      reason: `O sócio ${partner.name} é responsável operacional de ${vehicleCount} veículo(s).`,
    };
  }

  const { error: deleteError } = await supabase
    .from("partners")
    .update({ deleted_at: new Date().toISOString(), status: "Inativo" })
    .eq("id", partner.id)
    .eq("company_id", companyId);

  if (deleteError) {
    const { error: fallbackError } = await supabase
      .from("partners")
      .update({ status: "Inativo", use_in_allocation: false })
      .eq("id", partner.id)
      .eq("company_id", companyId);

    if (fallbackError) return { ok: false, reason: fallbackError.message };
  }

  return { ok: true, name: partner.name, code: partner.code };
}
