"use client";

import { Button } from "@/components/ui/Button";
import { glassField, glassFilterPanel } from "@/lib/liquid-glass-styles";
import { coercePassengersForForm, emptyPassengerRow } from "@/lib/service-order-passengers";
import type { ServiceOrderPassenger } from "@/types/database";

type Props = {
  passengers: unknown;
  onChange: (next: ServiceOrderPassenger[]) => void;
};

export function ServiceOrderPassengersPanel({ passengers, onChange }: Props) {
  const rows = coercePassengersForForm(passengers);
  const displayRows = rows.length > 0 ? rows : [emptyPassengerRow()];

  const updateRow = (index: number, patch: Partial<ServiceOrderPassenger>) => {
    const next = [...displayRows];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const addRow = () => {
    onChange([...displayRows, emptyPassengerRow()]);
  };

  const removeRow = (index: number) => {
    const next = displayRows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : []);
  };

  return (
    <div className={`space-y-3 sm:col-span-2 ${glassFilterPanel()}`}>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Passageiros no veículo</h3>
        <p className="mt-1 text-xs text-slate-600">
          Preencha na abertura da OS. Os dados sairão no voucher do motorista após ele aceitar a designação.
        </p>
      </div>

      <div className="space-y-3">
        {displayRows.map((row, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border border-slate-200/80 bg-white/40 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Nome</span>
              <input
                className={glassField()}
                value={row.name}
                placeholder="Nome completo"
                onChange={(e) => updateRow(index, { name: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Documento (RG/CPF)</span>
              <input
                className={glassField()}
                value={row.document_number}
                placeholder="Número"
                onChange={(e) => updateRow(index, { document_number: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Órgão emissor</span>
              <input
                className={glassField()}
                value={row.document_issuer ?? ""}
                placeholder="SSP/SP"
                onChange={(e) => updateRow(index, { document_issuer: e.target.value })}
              />
            </label>
            <div className="flex items-end pb-0.5">
              {displayRows.length > 1 && (
                <Button type="button" variant="ghost" onClick={() => removeRow(index)}>
                  Remover
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="secondary" onClick={addRow}>
        + Passageiro
      </Button>
    </div>
  );
}
