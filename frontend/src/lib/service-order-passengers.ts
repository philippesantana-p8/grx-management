import type { ServiceOrderPassenger } from "@/types/database";

export function normalizePassengers(value: unknown): ServiceOrderPassenger[] {
  if (!Array.isArray(value)) return [];

  const result: ServiceOrderPassenger[] = [];

  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const name = String(item.name ?? "").trim();
    const document_number = String(item.document_number ?? "").trim();
    const document_issuer = String(item.document_issuer ?? "").trim();
    if (!name && !document_number) continue;
    result.push({
      name,
      document_number,
      ...(document_issuer ? { document_issuer } : {}),
    });
  }

  return result;
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
