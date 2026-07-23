import { formatServiceCategories } from "@/lib/service-order-categories";
import {
  isPendingClientProposal,
  matchesServiceOrderStatusFilter,
} from "@/lib/service-order-display-status";
import type { ServiceOrder } from "@/types/database";
import { SERVICE_ORDER_TYPE_LABELS } from "@/types/database";

export type ServiceOrderListRow = ServiceOrder & {
  driver_name?: string;
  proposed_driver_code?: string;
  dre_account_name?: string;
};

export function isPendingProposalRow(row: ServiceOrderListRow): boolean {
  return isPendingClientProposal(row);
}

export function normalizeServiceOrderSearchTerm(term: string): string {
  return term.trim().toLowerCase();
}

/** Data local `YYYY-MM-DD` (evita deslocar o dia por UTC). */
export function localIsoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Padrão: mês corrente — novas OS aparecem sem carregar o histórico legado inteiro. */
export function defaultServiceOrderDateRange(now = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: localIsoDate(from), dateTo: localIsoDate(now) };
}

function serviceOrderSearchHaystack(row: ServiceOrderListRow): string {
  const typeLabel = SERVICE_ORDER_TYPE_LABELS[row.service_type] ?? row.service_type;
  const nature = row.service_categories?.length
    ? formatServiceCategories(row.service_categories)
    : row.service_name;

  return [
    row.code,
    row.legacy_number,
    row.plate,
    row.client_name,
    row.driver_name,
    row.phone,
    row.notes,
    typeLabel,
    nature,
    row.freight_origin_address,
    row.freight_destination_address,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesServiceOrderFilters(
  row: ServiceOrderListRow,
  filters: {
    search: string;
    status: string;
    serviceType: string;
    pendingProposals?: boolean;
    /** Quando true, ignora dateFrom/dateTo. */
    allDates?: boolean;
    dateFrom?: string;
    dateTo?: string;
    /** Oculta OS da importação teste de eventos/legado. */
    hideImportedHistory?: boolean;
  }
): boolean {
  if (filters.pendingProposals && !isPendingProposalRow(row)) return false;
  if (!matchesServiceOrderStatusFilter(row, filters.status)) return false;
  if (filters.serviceType && row.service_type !== filters.serviceType) return false;

  if (filters.hideImportedHistory) {
    const notes = String(row.notes ?? "");
    if (notes.includes("[IMPORTAÇÃO TESTE OS]")) return false;
  }

  if (!filters.allDates) {
    const serviceDate = String(row.service_date ?? "").slice(0, 10);
    if (filters.dateFrom && serviceDate && serviceDate < filters.dateFrom) return false;
    if (filters.dateTo && serviceDate && serviceDate > filters.dateTo) return false;
  }

  const term = normalizeServiceOrderSearchTerm(filters.search);
  if (!term) return true;

  return serviceOrderSearchHaystack(row).includes(term);
}
