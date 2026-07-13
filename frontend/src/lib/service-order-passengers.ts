import type { ServiceOrderPassenger } from "@/types/database";

function coercePassengerRow(row: unknown): ServiceOrderPassenger | null {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const name = String(item.name ?? "");
  const document_number = String(item.document_number ?? "");
  const document_issuer = String(item.document_issuer ?? "").trim();
  return {
    name,
    document_number,
    ...(document_issuer ? { document_issuer } : {}),
  };
}

/** Mantém linhas em branco para edição no formulário. */
export function coercePassengersForForm(value: unknown): ServiceOrderPassenger[] {
  if (!Array.isArray(value)) return [];
  const result: ServiceOrderPassenger[] = [];
  for (const row of value) {
    const item = coercePassengerRow(row);
    if (item) result.push(item);
  }
  return result;
}

/** Remove linhas vazias — usar ao salvar / exibir voucher. */
export function normalizePassengers(value: unknown): ServiceOrderPassenger[] {
  return coercePassengersForForm(value)
    .map((row) => ({
      name: row.name.trim(),
      document_number: row.document_number.trim(),
      ...(row.document_issuer?.trim() ? { document_issuer: row.document_issuer.trim() } : {}),
    }))
    .filter((row) => row.name || row.document_number);
}

export function emptyPassengerRow(): ServiceOrderPassenger {
  return { name: "", document_number: "" };
}

export function formatPassengerLine(passenger: ServiceOrderPassenger, index: number): string {
  const parts = [passenger.name, passenger.document_number, passenger.document_issuer]
    .filter(Boolean)
    .join(" — ");
  return `${index + 1}. ${parts || "—"}`;
}
