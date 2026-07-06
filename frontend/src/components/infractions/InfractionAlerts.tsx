"use client";

import { Badge } from "@/components/ui/Badge";
import {
  alertLevelToBadgeVariant,
  getFilterOption,
  getInfractionAlerts,
  INFRACTION_FILTER_OPTIONS,
  summarizeInfractionAlerts,
  type InfractionPendingFilter,
  type InfractionRowForAlert,
} from "@/lib/infraction-alerts";

export function InfractionAlertsSummary({
  rows,
  activeFilter,
  onFilterChange,
}: {
  rows: InfractionRowForAlert[];
  activeFilter: InfractionPendingFilter;
  onFilterChange: (filter: InfractionPendingFilter) => void;
}) {
  const summary = summarizeInfractionAlerts(rows);

  const cards: Array<{
    key: keyof typeof summary;
    label: string;
    filter: InfractionPendingFilter;
    tone: string;
  }> = [
    {
      key: "awaitingAuthority",
      label: "Aguardando órgão autuador",
      filter: "pending_authority",
      tone: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
    },
    {
      key: "authorityRefused",
      label: "Indicação recusada",
      filter: "authority-refused",
      tone: "border-red-200 bg-red-50 text-red-900 hover:bg-red-100",
    },
    {
      key: "awaitingPaymentProof",
      label: "Aguardando comprovante",
      filter: "awaiting-payment-proof",
      tone: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
    },
    {
      key: "paymentToValidate",
      label: "Comprovante a validar",
      filter: "validate-payment",
      tone: "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100",
    },
    {
      key: "readyForClosure",
      label: "Prontas para baixa/arquivo",
      filter: "ready_any",
      tone: "border-green-200 bg-green-50 text-green-900 hover:bg-green-100",
    },
    {
      key: "archived",
      label: "Arquivadas",
      filter: "archived",
      tone: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const isActive = activeFilter === card.filter;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onFilterChange(card.filter)}
            className={`rounded-lg border px-4 py-3 text-left transition-colors ${card.tone} ${
              isActive ? "ring-2 ring-blue-500 ring-offset-1" : ""
            }`}
          >
            <p className="text-2xl font-bold">{summary[card.key]}</p>
            <p className="text-sm">{card.label}</p>
            <p className="mt-1 text-xs opacity-80">Clique para filtrar</p>
          </button>
        );
      })}
    </div>
  );
}

export function InfractionAlertsCell({ row }: { row: InfractionRowForAlert }) {
  const alerts = getInfractionAlerts(row).filter((alert) => alert.id !== "archived").slice(0, 2);

  if (alerts.length === 0) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <div className="flex max-w-xs flex-col gap-2">
      {alerts.map((alert) => (
        <div key={alert.id} className="space-y-1">
          <Badge variant={alertLevelToBadgeVariant(alert.level)}>{alert.label}</Badge>
          <p className="text-xs leading-snug text-slate-500">{alert.footnote}</p>
        </div>
      ))}
    </div>
  );
}

export function InfractionListFilters({
  filter,
  totalCount,
  visibleCount,
  onFilterChange,
}: {
  filter: InfractionPendingFilter;
  totalCount: number;
  visibleCount: number;
  onFilterChange: (value: InfractionPendingFilter) => void;
}) {
  const selected = getFilterOption(filter);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block min-w-[280px] flex-1 space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Filtrar por pendência ou acompanhamento
          </span>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as InfractionPendingFilter)}
          >
            {INFRACTION_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <p className="pb-2 text-sm text-slate-500">
          Exibindo {visibleCount} de {totalCount} infração(ões)
        </p>
      </div>

      <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Nota do filtro selecionado</p>
        <p className="mt-1 text-sm text-slate-700">{selected.footnote}</p>
      </div>

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          Ver notas de rodapé de todas as etapas
        </summary>
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {INFRACTION_FILTER_OPTIONS.filter((option) => option.value !== "all").map((option) => (
            <div key={option.value} className="text-sm">
              <p className="font-medium text-slate-800">{option.label}</p>
              <p className="text-xs leading-relaxed text-slate-500">{option.footnote}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
