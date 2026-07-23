/** Subpastas de documentos do motorista (acompanhamento CNH / CNH-AVC). */

export const DRIVER_DOC_FOLDERS = [
  {
    key: "CNH",
    label: "CNH",
    hint: "Carteira Nacional de Habilitação (frente, verso e renovações).",
  },
  {
    key: "CNH-AVC",
    label: "CNH-AVC",
    hint: "Documentação CNH-AVC para acompanhamento separado.",
  },
] as const;

export type DriverDocFolderKey = (typeof DRIVER_DOC_FOLDERS)[number]["key"];

export function driverDocDescription(
  folder: DriverDocFolderKey,
  detail?: string | null
): string {
  const clean = detail?.trim();
  return clean ? `${folder} — ${clean}` : folder;
}

/** Classifica anexo existente pela description (inclui legado "CNH — frente"). */
export function resolveDriverDocFolder(
  description: string | null | undefined
): DriverDocFolderKey | "outros" {
  const d = (description ?? "").trim().toUpperCase();
  if (!d) return "outros";
  if (d.startsWith("CNH-AVC") || d.includes("CNH-AVC")) return "CNH-AVC";
  if (d.startsWith("CNH") || d.includes("CNH —") || d.includes("CNH -")) return "CNH";
  return "outros";
}
