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
import {
  glassField,
  glassFilterCard,
  glassFilterPanel,
  type GlassStatTone,
} from "@/lib/liquid-glass-styles";

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
    tone: GlassStatTone;
  }> = [
    {
      key: "awaitingAuthority",
      label: "Aguardando órgão autuador",
      filter: "pending_authority",
      tone: "amber",
    },
    {
      key: "authorityRefused",
      label: "Indicação recusada",
      filter: "authority-refused",
      tone: "red",
    },
    {
      key: "awaitingPaymentProof",
      label: "Aguardando comprovante",
      filter: "awaiting-payment-proof",
      tone: "amber",
    },
    {
      key: "paymentToValidate",
      label: "Comprovante a validar",
      filter: "validate-payment",
      tone: "brand",
    },
    {
      key: "readyForClosure",
      label: "Prontas para baixa/arquivo",
      filter: "ready_any",
      tone: "green",
    },
    {
      key: "archived",
      label: "Arquivadas",
      filter: "archived",
      tone: "slate",
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
            className={glassFilterCard(isActive, card.tone)}
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
    <div className={`space-y-4 ${glassFilterPanel()}`}>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block min-w-[280px] flex-1 space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Filtrar por pendência ou acompanhamento
          </span>
          <select
            className={glassField()}
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

      <div className={`rounded-md px-3 py-2 ${glassFilterPanel()}`}>
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
