"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { uploadEntityAttachment } from "@/lib/attachments";
import type { ComplianceDocInput } from "@/lib/compliance-documents-api";
import type { ComplianceDocument, DocumentType } from "@/lib/compliance-documents";
import { glassField, glassIconBtn } from "@/lib/liquid-glass-styles";

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export type ComplianceSaveOptions = { andNew?: boolean };

type Props = {
  companyId: string;
  types: DocumentType[];
  initial?: ComplianceDocument | null;
  mode: "create" | "edit" | "renew";
  /** Slot acima do tipo (ex.: seletor de placa). */
  leadingSlot?: ReactNode;
  allowSaveAndNew?: boolean;
  onCancel: () => void;
  onSave: (
    input: ComplianceDocInput,
    file?: File | null,
    opts?: ComplianceSaveOptions
  ) => Promise<string | null>;
};

export function ComplianceDocumentEditor({
  companyId,
  types,
  initial,
  mode,
  leadingSlot,
  allowSaveAndNew = false,
  onCancel,
  onSave,
}: Props) {
  const [typeId, setTypeId] = useState(initial?.document_type_id ?? types[0]?.id ?? "");
  const [documentNumber, setDocumentNumber] = useState(initial?.document_number ?? "");
  const [issuingBody, setIssuingBody] = useState(
    initial?.issuing_body ??
      types.find((t) => t.id === initial?.document_type_id)?.issuing_body ??
      ""
  );
  const [issuedAt, setIssuedAt] = useState(
    mode === "renew" ? "" : (initial?.issued_at ?? "")
  );
  const [expiresAt, setExpiresAt] = useState(
    mode === "renew" ? "" : (initial?.expires_at ?? "")
  );
  const [noExpiry, setNoExpiry] = useState(() => {
    if (mode === "renew") {
      const t = types.find((x) => x.id === (initial?.document_type_id ?? types[0]?.id));
      return t ? !t.requires_expiry : false;
    }
    if (initial) return Boolean(initial.no_expiry);
    const t = types.find((x) => x.id === types[0]?.id);
    return t ? !t.requires_expiry : false;
  });
  const [renewalStart, setRenewalStart] = useState(
    mode === "renew" ? "" : (initial?.renewal_start_date ?? "")
  );
  const [renewalStatus, setRenewalStatus] = useState<"none" | "in_renewal">(
    mode === "renew" ? "none" : (initial?.renewal_status ?? "none")
  );
  const [manualStatus, setManualStatus] = useState<string>(
    mode === "renew" ? "" : (initial?.manual_status ?? "")
  );
  const [responsible, setResponsible] = useState(initial?.responsible_name ?? "");
  const [notes, setNotes] = useState(mode === "renew" ? "" : (initial?.notes ?? ""));
  const [alertFirst, setAlertFirst] = useState(
    String(
      initial?.alert_days_first ??
        types.find((t) => t.id === typeId)?.alert_days_first ??
        60
    )
  );
  const [showAdvanced, setShowAdvanced] = useState(mode === "edit");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedType = types.find((t) => t.id === typeId);
  const expiryRequired = Boolean(selectedType?.requires_expiry) && !noExpiry;

  useEffect(() => {
    if (initial || !selectedType) return;
    setIssuingBody(selectedType.issuing_body ?? "");
    setAlertFirst(String(selectedType.alert_days_first ?? 60));
    if (selectedType.requires_expiry) {
      setNoExpiry(false);
    } else {
      setNoExpiry(true);
      setExpiresAt("");
    }
  }, [typeId, selectedType, initial]);

  const title =
    mode === "renew" ? "Renovar documento" : mode === "edit" ? "Editar documento" : "Novo documento";

  const submit = async (andNew: boolean) => {
    if (!noExpiry && !expiresAt && selectedType?.requires_expiry) {
      setError("Informe a data de vencimento ou marque sem vencimento.");
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    const input: ComplianceDocInput = {
      document_type_id: typeId,
      document_number: documentNumber || null,
      issuing_body: issuingBody || null,
      issued_at: issuedAt || null,
      expires_at: expiresAt || null,
      no_expiry: noExpiry,
      renewal_start_date: renewalStart || null,
      renewal_status: renewalStatus,
      manual_status: (manualStatus || null) as ComplianceDocInput["manual_status"],
      alert_days_first: Number(alertFirst) || null,
      alert_days_second: selectedType?.alert_days_second ?? 30,
      alert_days_critical: selectedType?.alert_days_critical ?? 15,
      alert_days_urgent: selectedType?.alert_days_urgent ?? 7,
      responsible_name: responsible || null,
      notes: notes || null,
      is_active: true,
    };
    const err = await onSave(input, file, { andNew });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    if (andNew) {
      setOkMsg("Salvo. Pode cadastrar o próximo tipo nesta mesma placa.");
      setDocumentNumber("");
      setIssuedAt("");
      setExpiresAt("");
      setRenewalStart("");
      setRenewalStatus("none");
      setManualStatus("");
      setNotes("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // avança para o próximo tipo da lista (se houver)
      const idx = types.findIndex((t) => t.id === typeId);
      const next = types[idx + 1];
      if (next) setTypeId(next.id);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white/80 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {mode === "renew" ? (
        <Alert variant="info">
          Renovação cria uma nova versão (versão anterior fica no histórico). Informe novo
          número (se houver), nova data de vencimento e anexe a nova digitalização. A validade
          antiga permanece na versão arquivada.
        </Alert>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {okMsg ? <Alert variant="success">{okMsg}</Alert> : null}

      {leadingSlot}

      <GlassSelect
        label="Tipo de documento"
        value={typeId}
        onChange={setTypeId}
        disabled={mode === "renew"}
        options={types.map((t) => ({
          value: t.id,
          label: t.acronym ? `${t.acronym} — ${t.name}` : t.name,
        }))}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">
            {selectedType?.acronym === "PREFIXO" ? "Número do prefixo" : "Número"}
          </span>
          <input
            className={glassField()}
            value={documentNumber}
            placeholder={selectedType?.acronym === "PREFIXO" ? "Ex.: 0123" : undefined}
            onChange={(e) => setDocumentNumber(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Órgão emissor</span>
          <input
            className={glassField()}
            value={issuingBody}
            onChange={(e) => setIssuingBody(e.target.value)}
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-sm font-medium text-slate-900">
            Data de vencimento
            {expiryRequired ? <span className="text-red-600"> *</span> : null}
          </span>
          <input
            type="date"
            className={glassField()}
            value={expiresAt}
            disabled={noExpiry}
            required={expiryRequired}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          <span className="text-xs text-slate-500">
            Usada nos alertas automáticos{" "}
            {selectedType
              ? `${selectedType.alert_days_first}/${selectedType.alert_days_second}/${selectedType.alert_days_critical}/${selectedType.alert_days_urgent}`
              : "60/30/15/7"}{" "}
            dias. Não precisa cadastrar 2º alerta — já é automático.
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={noExpiry}
            onChange={(e) => {
              setNoExpiry(e.target.checked);
              if (e.target.checked) setExpiresAt("");
            }}
          />
          Documento sem vencimento
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Data de emissão</span>
          <input
            type="date"
            className={glassField()}
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
          />
        </label>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-3 py-3">
        <p className="text-sm font-medium text-slate-900">Digitalização (clipe)</p>
        <p className="mb-2 text-xs text-slate-500">
          Anexe PDF ou foto agora. Depois de salvar, o clipe também aparece na linha da
          tabela para incluir ou abrir o arquivo.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/jpg"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={glassIconBtn()}
            title="Anexar digitalização"
            aria-label="Anexar digitalização"
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="text-sm font-medium text-sky-700 underline"
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? "Trocar arquivo" : "Selecionar arquivo"}
          </button>
          <span className="text-xs text-slate-600">
            {file ? file.name : "Nenhum arquivo selecionado"}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="text-sm font-medium text-sky-700 underline"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? "Ocultar opções avançadas" : "Opções avançadas (renovação / alertas)"}
      </button>

      {showAdvanced ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Início da renovação</span>
            <input
              type="date"
              className={glassField()}
              value={renewalStart}
              onChange={(e) => setRenewalStart(e.target.value)}
            />
          </label>
          <div className="space-y-1">
            <GlassSelect
              label="Situação da renovação"
              value={renewalStatus}
              onChange={(v) => setRenewalStatus(v as "none" | "in_renewal")}
              options={[
                { value: "none", label: "Normal" },
                { value: "in_renewal", label: "Em renovação" },
              ]}
            />
            <p className="text-xs text-slate-500">
              Em renovação: aparece no relatório Documentos a vencer sem apagar a data de
              vencimento. Pode alterar depois em Editar.
            </p>
          </div>
          <div className="space-y-1">
            <GlassSelect
              label="Situação manual"
              value={manualStatus}
              onChange={setManualStatus}
              options={[
                { value: "", label: "Automática (por validade)" },
                { value: "suspended", label: "Suspenso" },
                { value: "not_applicable", label: "Não aplicável" },
              ]}
            />
            <p className="text-xs text-slate-500">
              Suspenso também entra no relatório; a validade original continua visível.
            </p>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">1º alerta (dias)</span>
            <input
              type="number"
              className={glassField()}
              value={alertFirst}
              onChange={(e) => setAlertFirst(e.target.value)}
            />
            <span className="text-xs text-slate-500">
              2º/3º/4º alertas vêm do tipo (
              {selectedType
                ? `${selectedType.alert_days_second}/${selectedType.alert_days_critical}/${selectedType.alert_days_urgent}`
                : "30/15/7"}
              ) — sem campo extra.
            </span>
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Responsável</span>
            <input
              className={glassField()}
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Observações</span>
            <textarea
              className={glassField()}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={saving || !typeId}
          onClick={() => void submit(false)}
        >
          {saving ? "Salvando…" : "Salvar"}
        </Button>
        {allowSaveAndNew && mode === "create" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={saving || !typeId}
            onClick={() => void submit(true)}
          >
            Salvar e próximo tipo
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
      <p className="text-xs text-slate-500">Empresa: {companyId.slice(0, 8)}…</p>
    </div>
  );
}

export async function attachComplianceFile(
  companyId: string,
  documentId: string,
  file: File
): Promise<string | null> {
  const { error } = await uploadEntityAttachment({
    companyId,
    entityType: "compliance_document",
    entityId: documentId,
    file,
    description: "Documento / licença",
  });
  return error;
}
