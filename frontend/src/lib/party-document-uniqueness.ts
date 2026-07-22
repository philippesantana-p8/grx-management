import { createClient } from "@/lib/supabase/client";
import { onlyDigits } from "@/lib/br-documents";

/** Tabelas de cadastro com documento de pessoa/empresa (CNPJ/CPF). */
export const PARTY_DOCUMENT_TABLES = [
  "clients",
  "suppliers",
  "drivers",
  "partners",
] as const;

export type PartyDocumentTable = (typeof PARTY_DOCUMENT_TABLES)[number];

export function documentFieldForTable(table: string): "document" | "cpf" | null {
  if (table === "partners") return "cpf";
  if (table === "clients" || table === "suppliers" || table === "drivers") return "document";
  return null;
}

export function formatDuplicateDocumentError(documentLabel: string): string {
  return `Já existe um cadastro com este ${documentLabel} nesta empresa. Não é permitido inserir o mesmo CNPJ/CPF duas vezes.`;
}

export function documentLabelForDigits(digits: string): string {
  if (digits.length === 14) return "CNPJ";
  if (digits.length === 11) return "CPF";
  return "CNPJ/CPF";
}

/**
 * Verifica duplicidade de CNPJ/CPF (comparando só dígitos), ignorando excluídos.
 */
export async function isPartyDocumentTaken(
  table: string,
  companyId: string,
  rawDocument: string,
  excludeId?: string | null
): Promise<{ taken: boolean; digits: string; error?: string }> {
  const field = documentFieldForTable(table);
  const digits = onlyDigits(rawDocument);
  if (!field || !digits) return { taken: false, digits };

  const supabase = createClient();
  let query = supabase
    .from(table)
    .select(`id, ${field}`)
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  if (error) return { taken: false, digits, error: error.message };

  const taken = (data ?? []).some((row) => {
    const value = String((row as Record<string, unknown>)[field] ?? "");
    return onlyDigits(value) === digits;
  });

  return { taken, digits };
}
