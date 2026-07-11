"use client";

import { Input } from "@/components/ui/Input";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { glassFilterPanel } from "@/lib/liquid-glass-styles";
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
  totalCount: number;
  visibleCount: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onServiceTypeChange: (value: string) => void;
  onPendingProposalsChange: (value: boolean) => void;
};

export function ServiceOrderListFilters({
  search,
  status,
  serviceType,
  pendingProposals,
  totalCount,
  visibleCount,
  onSearchChange,
  onStatusChange,
  onServiceTypeChange,
  onPendingProposalsChange,
}: Props) {
  return (
    <div className={`flex flex-wrap items-end gap-4 ${glassFilterPanel()}`}>
      <div className="min-w-[240px] flex-1">
        <Input
          label="Pesquisar"
          placeholder="Código (ex.: OS001), placa, cliente, rota…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

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
