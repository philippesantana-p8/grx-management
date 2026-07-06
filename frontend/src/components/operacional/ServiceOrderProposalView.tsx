"use client";

import { Button } from "@/components/ui/Button";
import { formatServiceCategories } from "@/lib/service-order-categories";
import {
  billablePerDiemTotal,
  isPerDiemClientCharge,
  normalizePerDiemDetail,
  perDiemChargeLabel,
  perDiemDayTotal,
} from "@/lib/freight-per-diem";
import {
  buildProposalUrl,
  buildWhatsAppProposalText,
  formatServiceDate,
  openEmailShare,
  openWhatsAppShare,
  resolveProposalAmount,
  triggerPrintPdf,
  type ServiceOrderProposalContext,
} from "@/lib/service-order-proposal";
import { formatCurrency } from "@/lib/utils";
import { SERVICE_ORDER_TYPE_LABELS } from "@/types/database";
import type { ServiceOrder } from "@/types/database";

type Props = {
  order: ServiceOrder;
  context: ServiceOrderProposalContext;
};

export function ServiceOrderProposalView({ order, context }: Props) {
  const amount = resolveProposalAmount(order);
  const tolls = Array.isArray(order.freight_toll_detail) ? order.freight_toll_detail : [];
  const perDiemDays = normalizePerDiemDetail(order.freight_per_diem_detail);
  const proposalUrl = buildProposalUrl(order.id);
  const hasRoute = Boolean(order.freight_origin_address || order.freight_destination_address);

  const shareWhatsApp = () => {
    openWhatsAppShare(buildWhatsAppProposalText(order, context, proposalUrl));
  };

  const shareEmail = () => {
    const text = buildWhatsAppProposalText(order, context, proposalUrl).replace(/\*/g, "");
    openEmailShare(`Proposta OS ${order.code} — ${context.companyName}`, text);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(proposalUrl);
      window.alert("Link copiado. Cole no WhatsApp ou e-mail.");
    } catch {
      window.prompt("Copie o link da proposta:", proposalUrl);
    }
  };

  return (
    <>
      <style>{`
        @media print {
          aside, header, .proposal-toolbar { display: none !important; }
          main { padding: 0 !important; }
          .proposal-document { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="proposal-toolbar mb-6 flex flex-wrap gap-2 print:hidden">
        <Button type="button" onClick={triggerPrintPdf}>
          Salvar PDF / Imprimir
        </Button>
        <Button type="button" variant="secondary" onClick={shareWhatsApp}>
          Compartilhar WhatsApp
        </Button>
        <Button type="button" variant="secondary" onClick={shareEmail}>
          Enviar por e-mail
        </Button>
        <Button type="button" variant="secondary" onClick={() => void copyLink()}>
          Copiar link
        </Button>
      </div>

      <article className="proposal-document mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Proposta de ordem de serviço
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{context.companyName}</h1>
          <p className="mt-4 text-lg font-semibold text-slate-800">OS {order.code}</p>
          <p className="text-sm text-slate-600">
            Emitida em {formatServiceDate(order.service_date)} · Status: {order.status}
          </p>
        </header>

        <section className="grid gap-4 border-b border-slate-100 py-6 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase text-slate-500">Cliente</h2>
            <p className="mt-1 font-medium text-slate-900">{order.client_name ?? "—"}</p>
            <p className="text-sm text-slate-600">{order.phone ?? ""}</p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase text-slate-500">Operação</h2>
            <p className="mt-1 font-medium text-slate-900">
              {SERVICE_ORDER_TYPE_LABELS[order.service_type] ?? order.service_type}
            </p>
            <p className="text-sm text-slate-600">
              {order.service_categories?.length
                ? formatServiceCategories(order.service_categories)
                : order.service_name}
            </p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase text-slate-500">Veículo</h2>
            <p className="mt-1 font-medium text-slate-900">Placa {order.plate}</p>
            {context.driverName && (
              <p className="text-sm text-slate-600">Motorista: {context.driverName}</p>
            )}
          </div>
          {context.dreAccountName && (
            <div>
              <h2 className="text-xs font-semibold uppercase text-slate-500">Conta DRE</h2>
              <p className="mt-1 text-slate-800">{context.dreAccountName}</p>
            </div>
          )}
        </section>

        {hasRoute && (
          <section className="border-b border-slate-100 py-6">
            <h2 className="text-sm font-semibold text-slate-900">Rota e custos</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Origem (A)</dt>
                <dd className="font-medium text-slate-800">{order.freight_origin_address ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Destino (B)</dt>
                <dd className="font-medium text-slate-800">{order.freight_destination_address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Distância</dt>
                <dd>{order.freight_distance_km ? `${order.freight_distance_km} km` : "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Pedágio total</dt>
                <dd>
                  {order.freight_toll_amount != null
                    ? formatCurrency(order.freight_toll_amount)
                    : "—"}
                  {order.freight_toll_count
                    ? ` (${order.freight_toll_count} praça${order.freight_toll_count === 1 ? "" : "s"})`
                    : ""}
                </dd>
              </div>
              {order.freight_antt_minimum != null && (
                <div>
                  <dt className="text-slate-500">Piso mínimo ANTT</dt>
                  <dd>{formatCurrency(order.freight_antt_minimum)}</dd>
                </div>
              )}
              {order.freight_suggested_total != null && (
                <div>
                  <dt className="text-slate-500">Sugerido (piso + pedágio + despesas)</dt>
                  <dd>{formatCurrency(order.freight_suggested_total)}</dd>
                </div>
              )}
              {order.freight_per_diem_total != null && order.freight_per_diem_total > 0 && (
                <div>
                  <dt className="text-slate-500">Despesas de viagem</dt>
                  <dd>
                    {formatCurrency(order.freight_per_diem_total)}
                    {order.freight_travel_days
                      ? ` · ${order.freight_travel_days} dia(s)`
                      : ""}
                    {" · "}
                    {perDiemChargeLabel(order.freight_per_diem_charge_to)}
                  </dd>
                </div>
              )}
              {isPerDiemClientCharge(order.freight_per_diem_charge_to) &&
                order.freight_per_diem_total != null &&
                order.freight_per_diem_total > 0 && (
                <div>
                  <dt className="text-slate-500">Repasse despesas ao cliente</dt>
                  <dd>{formatCurrency(billablePerDiemTotal(order.freight_per_diem_total, order.freight_per_diem_charge_to))}</dd>
                </div>
              )}
            </dl>

            {perDiemDays.length > 0 && (
              <table className="mt-4 w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-2">Dia</th>
                    <th className="py-2 pr-2">Hospedagem</th>
                    <th className="py-2 pr-2">Café</th>
                    <th className="py-2 pr-2">Almoço</th>
                    <th className="py-2 pr-2">Jantar</th>
                    <th className="py-2 pr-2">Diária</th>
                    <th className="py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {perDiemDays.map((day) => (
                    <tr key={day.day} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2">{day.day}</td>
                      <td className="py-1.5 pr-2">{formatCurrency(day.lodging)}</td>
                      <td className="py-1.5 pr-2">{formatCurrency(day.breakfast)}</td>
                      <td className="py-1.5 pr-2">{formatCurrency(day.meals)}</td>
                      <td className="py-1.5 pr-2">{formatCurrency(day.dinner)}</td>
                      <td className="py-1.5 pr-2">{formatCurrency(day.daily_allowance)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(perDiemDayTotal(day))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tolls.length > 0 && (
              <table className="mt-4 w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Praça</th>
                    <th className="py-2 pr-2">Local</th>
                    <th className="py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {tolls.map((plaza) => (
                    <tr key={`${plaza.order}-${plaza.name}`} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2">{plaza.order}</td>
                      <td className="py-1.5 pr-2">{plaza.name}</td>
                      <td className="py-1.5 pr-2">
                        {[plaza.city, plaza.state].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td className="py-1.5 text-right">{formatCurrency(plaza.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        <section className="border-b border-slate-100 py-6">
          <h2 className="text-sm font-semibold text-slate-900">Valor para aprovação</h2>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {amount != null ? formatCurrency(amount) : "A combinar"}
          </p>
          {order.notes && (
            <p className="mt-3 text-sm text-slate-600">
              <span className="font-medium">Observações:</span> {order.notes}
            </p>
          )}
        </section>

        <footer className="pt-8">
          <p className="text-sm text-slate-600">
            Esta proposta destina-se à aprovação do cliente. Após o aceite, a ordem de serviço poderá
            ser concluída no sistema.
          </p>
          <div className="mt-10 grid gap-10 sm:grid-cols-2">
            <div>
              <div className="border-t border-slate-400 pt-2 text-sm text-slate-700">
                Aprovação do cliente
              </div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-2 text-sm text-slate-700">
                {context.companyName}
              </div>
            </div>
          </div>
          <p className="mt-8 text-xs text-slate-400 print:block hidden sm:block">
            Documento gerado pelo GRX Management · {new Date().toLocaleString("pt-BR")}
          </p>
        </footer>
      </article>
    </>
  );
}
