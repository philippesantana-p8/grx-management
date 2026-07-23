"use client";

import { Input } from "@/components/ui/Input";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { glassField, glassFilterPanel } from "@/lib/liquid-glass-styles";
import {
  PROPOSAL_RESPONSE_LABELS,
  SERVICE_ORDER_STATUS,
  SERVICE_ORDER_TYPE_LABELS,
  SERVICE_ORDER_TYPES,
} from "@/types/database";
import { DRIVER_ASSIGNMENT_RESPONSE_LABELS } from "@/lib/service-order-driver-assignment";

const SERVICE_ORDER_STATUS_FILTER = [
  ...SERVICE_ORDER_STATUS,
  PROPOSAL_RESPONSE_LABELS.accepted,
  PROPOSAL_RESPONSE_LABELS.rejected,
  "Aguardando designação motorista",
  DRIVER_ASSIGNMENT_RESPONSE_LABELS.pending,
  DRIVER_ASSIGNMENT_RESPONSE_LABELS.accepted,
  DRIVER_ASSIGNMENT_RESPONSE_LABELS.rejected,
] as const;

type Props = {
  search: string;
  status: string;
  serviceType: string;
  pendingProposals: boolean;
  dateFrom: string;
  dateTo: string;
  allDates: boolean;
  hideImportedHistory: boolean;
  totalCount: number;
  visibleCount: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onServiceTypeChange: (value: string) => void;
  onPendingProposalsChange: (value: boolean) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onAllDatesChange: (value: boolean) => void;
  onHideImportedHistoryChange: (value: boolean) => void;
};

export function ServiceOrderListFilters({
  search,
  status,
  serviceType,
  pendingProposals,
  dateFrom,
  dateTo,
  allDates,
  hideImportedHistory,
  totalCount,
  visibleCount,
  onSearchChange,
  onStatusChange,
  onServiceTypeChange,
  onPendingProposalsChange,
  onDateFromChange,
  onDateToChange,
  onAllDatesChange,
  onHideImportedHistoryChange,
}: Props) {
  return (
    <div className={`flex flex-wrap items-end gap-4 ${glassFilterPanel()}`}>
      <div className="min-w-[240px] flex-1">
        <Input
          label="Pesquisar"
          placeholder="Código, nº legado (Invoice/COT), placa, cliente…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <label className="block min-w-[150px]">
        <span className="mb-1 block text-sm font-medium text-slate-700">Data de</span>
        <input
          type="date"
          className={glassField(false)}
          value={dateFrom}
          disabled={allDates}
          onChange={(e) => onDateFromChange(e.target.value)}
        />
      </label>

      <label className="block min-w-[150px]">
        <span className="mb-1 block text-sm font-medium text-slate-700">Data até</span>
        <input
          type="date"
          className={glassField(false)}
          value={dateTo}
          disabled={allDates}
          onChange={(e) => onDateToChange(e.target.value)}
        />
      </label>

      <GlassSelect
        label="Status"
        className="min-w-[180px]"
        value={status}
        onChange={onStatusChange}
        options={[
          { value: "", label: "Todos" },
          ...SERVICE_ORDER_STATUS_FILTER.map((item) => ({ value: item, label: item })),
        ]}
      />

      <GlassSelect
        label="Tipo"
        className="min-w-[180px]"
        value={serviceType}
        onChange={onServiceTypeChange}
        options={[
          { value: "", label: "Todos" },
          ...SERVICE_ORDER_TYPES.map((item) => ({
            value: item,
            label: SERVICE_ORDER_TYPE_LABELS[item] ?? item,
          })),
        ]}
      />

      <label className="flex items-center gap-2 pb-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={allDates}
          onChange={(e) => onAllDatesChange(e.target.checked)}
        />
        <span className="text-sm text-slate-700">Todas as datas</span>
      </label>

      <label className="flex items-center gap-2 pb-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={hideImportedHistory}
          onChange={(e) => onHideImportedHistoryChange(e.target.checked)}
        />
        <span className="text-sm text-slate-700">Ocultar histórico importado</span>
      </label>

      <label className="flex items-center gap-2 pb-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={pendingProposals}
          onChange={(e) => onPendingProposalsChange(e.target.checked)}
        />
        <span className="text-sm text-slate-700">Propostas pendentes</span>
      </label>

      <p className="pb-2 text-sm text-slate-500">
        Exibindo {visibleCount} de {totalCount} ordem(ns)
      </p>
    </div>
  );
}
