import { formatCurrency } from "@/lib/utils";
import { normalizePerDiemDetail, perDiemDayTotal, perDiemChargeLabel, isPerDiemClientCharge } from "@/lib/freight-per-diem";
import { SERVICE_ORDER_TYPE_LABELS } from "@/types/database";
import type { ServiceOrder } from "@/types/database";

export type ServiceOrderProposalContext = {
  companyName: string;
  driverName?: string | null;
  dreAccountName?: string | null;
};

export function formatServiceDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function resolveProposalAmount(order: ServiceOrder): number | null {
  return order.freight_agreed_amount ?? order.service_amount ?? null;
}

export function buildProposalUrl(orderId: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/operacional/ordens-servico/${orderId}/proposta`;
}

export function buildWhatsAppProposalText(
  order: ServiceOrder,
  context: ServiceOrderProposalContext,
  proposalUrl: string
): string {
  const amount = resolveProposalAmount(order);
  const lines = [
    `*Proposta OS ${order.code}* — ${context.companyName}`,
    ``,
    `Cliente: ${order.client_name ?? "—"}`,
    `Tipo: ${SERVICE_ORDER_TYPE_LABELS[order.service_type] ?? order.service_type}`,
    `Data: ${formatServiceDate(order.service_date)}`,
    `Placa: ${order.plate}`,
  ];

  if (order.freight_origin_address || order.freight_destination_address) {
    lines.push(
      ``,
      `*Rota*`,
      `A: ${order.freight_origin_address ?? "—"}`,
      `B: ${order.freight_destination_address ?? "—"}`
    );
    if (order.freight_distance_km) {
      lines.push(`Distância: ${order.freight_distance_km} km`);
    }
    if (order.freight_toll_amount) {
      lines.push(`Pedágio: ${formatCurrency(order.freight_toll_amount)}`);
    }
    if (order.freight_antt_minimum) {
      lines.push(`Piso ANTT: ${formatCurrency(order.freight_antt_minimum)}`);
    }
    if (order.freight_per_diem_total) {
      lines.push(
        `Despesas de viagem: ${formatCurrency(order.freight_per_diem_total)}${
          order.freight_travel_days ? ` (${order.freight_travel_days} dia(s))` : ""
        } · ${perDiemChargeLabel(order.freight_per_diem_charge_to)}`
      );
      if (!isPerDiemClientCharge(order.freight_per_diem_charge_to)) {
        lines.push(`(Não repassado ao cliente — custo GRX)`);
      }
      const perDiemDays = normalizePerDiemDetail(order.freight_per_diem_detail);
      for (const day of perDiemDays) {
        lines.push(
          `  Dia ${day.day}: hosp. ${formatCurrency(day.lodging)} · café ${formatCurrency(day.breakfast)} · almoço ${formatCurrency(day.meals)} · jantar ${formatCurrency(day.dinner)} · diária ${formatCurrency(day.daily_allowance)} = ${formatCurrency(perDiemDayTotal(day))}`
        );
      }
    }
  }

  if (amount != null) {
    lines.push(``, `*Valor proposto: ${formatCurrency(amount)}*`);
  }

  lines.push(``, `Status: ${order.status}`, ``, `Ver proposta / PDF:`, proposalUrl);

  return lines.join("\n");
}

export function openWhatsAppShare(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

export function openEmailShare(subject: string, body: string) {
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function triggerPrintPdf() {
  window.print();
}
