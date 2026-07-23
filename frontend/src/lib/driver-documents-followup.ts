import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatCnh,
  formatCnhExpiryDate,
  getCnhExpiryStatus,
  isCnhExpiryDanger,
  type CnhExpiryStatus,
} from "@/lib/cnh";
import { resolveDriverDocFolder } from "@/lib/driver-document-folders";

export type DriverFollowupRow = {
  id: string;
  code: string | null;
  name: string;
  cnhNumber: string | null;
  cnhExpiry: string | null;
  cnhStatus: CnhExpiryStatus;
  cnhLabel: string;
  hasCnhFolder: boolean;
  hasCnhAvcFolder: boolean;
  needsAttention: boolean;
  reasons: string[];
};

function cnhStatusLabel(status: CnhExpiryStatus): string {
  if (status === "expired") return "Vencida";
  if (status === "critical") return "Vence em até 1 mês";
  if (status === "warning") return "Vence em até 2 meses";
  if (status === "none") return "Sem validade";
  return "Em dia";
}

export async function listDriverDocumentsFollowup(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ rows: DriverFollowupRow[]; error: string | null }> {
  const [driversRes, attachmentsRes] = await Promise.all([
    supabase
      .from("drivers")
      .select("id, code, name, cnh_number, cnh_expiry_date, status")
      .eq("company_id", companyId)
      .order("name", { ascending: true }),
    supabase
      .from("attachments")
      .select("entity_id, description")
      .eq("company_id", companyId)
      .eq("entity_type", "driver"),
  ]);

  if (driversRes.error) {
    return { rows: [], error: driversRes.error.message };
  }

  const folderCounts = new Map<string, { cnh: number; avc: number }>();
  for (const att of attachmentsRes.data ?? []) {
    const entityId = String(att.entity_id);
    const folder = resolveDriverDocFolder(att.description as string | null);
    const current = folderCounts.get(entityId) ?? { cnh: 0, avc: 0 };
    if (folder === "CNH") current.cnh += 1;
    if (folder === "CNH-AVC") current.avc += 1;
    folderCounts.set(entityId, current);
  }

  const rows: DriverFollowupRow[] = (driversRes.data ?? [])
    .filter((d) => String(d.status ?? "active") !== "inactive")
    .map((d) => {
      const id = String(d.id);
      const folders = folderCounts.get(id) ?? { cnh: 0, avc: 0 };
      const cnhExpiry = d.cnh_expiry_date ? String(d.cnh_expiry_date) : null;
      const cnhStatus = getCnhExpiryStatus(cnhExpiry);
      const hasCnhFolder = folders.cnh > 0;
      const hasCnhAvcFolder = folders.avc > 0;
      const reasons: string[] = [];

      if (cnhStatus === "none") reasons.push("CNH sem data de validade");
      else if (cnhStatus === "expired") reasons.push("CNH vencida");
      else if (cnhStatus === "critical" || cnhStatus === "warning") {
        reasons.push("CNH a vencer");
      }
      if (!hasCnhFolder) reasons.push("Pasta CNH sem anexo");
      if (!hasCnhAvcFolder) reasons.push("Pasta CNH-AVC sem anexo");

      return {
        id,
        code: d.code == null ? null : String(d.code),
        name: String(d.name ?? ""),
        cnhNumber: d.cnh_number ? formatCnh(String(d.cnh_number)) : null,
        cnhExpiry,
        cnhStatus,
        cnhLabel: cnhStatusLabel(cnhStatus),
        hasCnhFolder,
        hasCnhAvcFolder,
        needsAttention: reasons.length > 0,
        reasons,
      };
    });

  return {
    rows,
    error: attachmentsRes.error?.message ?? null,
  };
}

export function driverFollowupBadgeVariant(
  status: CnhExpiryStatus
): "default" | "success" | "warning" | "danger" {
  if (isCnhExpiryDanger(status) || status === "none") return "danger";
  if (status === "warning") return "warning";
  if (status === "ok") return "success";
  return "default";
}

export function formatDriverFollowupExpiry(date: string | null): string {
  return formatCnhExpiryDate(date);
}
