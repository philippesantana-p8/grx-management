"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { GlassSelect } from "@/components/ui/GlassSelect";
import {
  composeDeletionReason,
  DELETION_REASON_OPTIONS,
  validateDeletionReason,
} from "@/lib/deletion-audit";
import { glassField } from "@/lib/liquid-glass-styles";

export type DeleteReasonConfirmPayload = {
  reason: string;
  reasonCode: string;
};

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  confirming?: boolean;
  /** Exibe aviso reforçado (sócio, veículo, motorista, etc.). */
  critical?: boolean;
  confirmLabel?: string;
  /** Quando true, usa lista padronizada de motivos. */
  useReasonCodes?: boolean;
  onCancel: () => void;
  onConfirm: (payload: DeleteReasonConfirmPayload) => void | Promise<void>;
};

export function DeleteReasonModal({
  open,
  title = "Confirmar exclusão",
  description = "Informe o motivo da exclusão. Esse texto fica registrado no histórico.",
  confirming = false,
  critical = false,
  confirmLabel = "Excluir com registro",
  useReasonCodes = true,
  onCancel,
  onConfirm,
}: Props) {
  const reasonId = useId();
  const [reasonCode, setReasonCode] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const auditStampLabel = useMemo(() => {
    if (!open) return "";
    return new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [open]);

  useEffect(() => {
    if (!open) {
      setReasonCode("");
      setDetail("");
      setLocalError(null);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (useReasonCodes) {
      const composed = composeDeletionReason(reasonCode, detail);
      if (composed.error) {
        setLocalError(composed.error);
        return;
      }
      setLocalError(null);
      await onConfirm({ reason: composed.reason, reasonCode: composed.reasonCode });
      return;
    }

    const trimmed = detail.trim().replace(/\s+/g, " ");
    const validationError = validateDeletionReason(trimmed);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError(null);
    await onConfirm({ reason: trimmed, reasonCode: "outro" });
  };

  const detailRequired = !useReasonCodes || reasonCode === "outro";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${reasonId}-title`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirming) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 id={`${reasonId}-title`} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>

        <div className="mt-3 space-y-2">
          <Alert variant="warning">
            Atenção: antes da exclusão, o sistema registra automaticamente{" "}
            <strong>seu nome/usuário</strong>, a <strong>data e a hora</strong>
            {auditStampLabel ? (
              <>
                {" "}
                (agora: <strong>{auditStampLabel}</strong>)
              </>
            ) : null}{" "}
            e o motivo abaixo no Histórico de Exclusões. Essa informação não pode ser apagada nem
            editada.
          </Alert>
          {critical ? (
            <Alert variant="error">
              Exclusão crítica: este tipo de registro (sócio, veículo, motorista, cliente ou
              financeiro) exige justificativa clara. Confirme que não há movimentação vinculada
              antes de continuar.
            </Alert>
          ) : null}
        </div>

        {useReasonCodes ? (
          <div className="mt-4">
            <GlassSelect
              label="Motivo da exclusão *"
              value={reasonCode}
              onChange={setReasonCode}
              options={[
                { value: "", label: "Selecione…" },
                ...DELETION_REASON_OPTIONS.map((o) => ({ value: o.code, label: o.label })),
              ]}
            />
          </div>
        ) : null}

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            {detailRequired ? "Detalhe / observação *" : "Detalhe (opcional)"}
          </span>
          <textarea
            id={reasonId}
            className={`${glassField(detailRequired)} min-h-[6rem] resize-y`}
            value={detail}
            disabled={confirming}
            placeholder={
              detailRequired
                ? "Descreva o motivo com uma justificativa clara"
                : "Complemento opcional (ex.: código do cadastro substituto)"
            }
            onChange={(e) => {
              setDetail(e.target.value);
              if (localError) setLocalError(null);
            }}
            autoFocus={!useReasonCodes}
          />
          <span className="text-xs text-slate-500">
            {detailRequired
              ? "Use uma justificativa real. Não aceita só letras/números repetidos."
              : "Com motivo da lista, o detalhe é opcional — exceto em «Outro»."}
          </span>
        </label>
        {localError ? <p className="mt-2 text-sm text-red-600">{localError}</p> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" disabled={confirming} onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" disabled={confirming} onClick={() => void submit()}>
            {confirming ? "Excluindo…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
