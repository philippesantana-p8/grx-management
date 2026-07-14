"use client";

import { glassField, glassFilterPanel } from "@/lib/liquid-glass-styles";

type Props = {
  form: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
  /** Dados de voo / traslado — só Transporte */
  showFlightData?: boolean;
};

export function ServiceOrderOperationalPanel({
  form,
  set,
  showFlightData = true,
}: Props) {
  return (
    <div className={`space-y-4 sm:col-span-2 ${glassFilterPanel()}`}>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Dados operacionais (voucher motorista)</h3>
        <p className="mt-1 text-xs text-slate-600">
          Horário de apresentação, observações e contatos usados no voucher após aceite do motorista.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Data de apresentação</span>
          <input
            type="date"
            className={glassField(true)}
            required
            value={String(form.entry_date ?? form.service_date ?? "")}
            onChange={(e) => set("entry_date", e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Horário de apresentação</span>
          <input
            type="time"
            className={glassField(true)}
            required
            value={String(form.entry_time ?? "").slice(0, 5)}
            onChange={(e) => set("entry_time", e.target.value || null)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Hora de saída</span>
          <input
            type="time"
            className={glassField(true)}
            required
            value={String(form.exit_time ?? "").slice(0, 5)}
            onChange={(e) => set("exit_time", e.target.value || null)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Responsável / atendente</span>
          <input
            className={glassField(true)}
            required
            value={String(form.attendant ?? "")}
            placeholder="Nome de quem solicitou o serviço"
            onChange={(e) => set("attendant", e.target.value)}
          />
        </label>
        {showFlightData ? (
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Dados do voo (traslado)</span>
            <input
              className={glassField(false)}
              value={String(form.flight_data ?? "")}
              placeholder="Ex.: CGH — Congonhas, voo G3 1234"
              onChange={(e) => set("flight_data", e.target.value)}
            />
          </label>
        ) : null}
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Monitoria / coordenador 24h</span>
          <input
            className={glassField(true)}
            required
            value={String(form.monitoring_contact ?? "")}
            placeholder="Nome e telefone para contato durante o serviço"
            onChange={(e) => set("monitoring_contact", e.target.value)}
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Observações operacionais</span>
          <textarea
            className={`${glassField(false)} min-h-[120px]`}
            rows={5}
            value={String(form.notes ?? "")}
            placeholder="Endereço completo, apto, referências, instruções ao motorista…"
            onChange={(e) => set("notes", e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
