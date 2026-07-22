"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCpfCnpj, onlyDigits } from "@/lib/br-documents";
import { cnpjInfoToFormPatch, fetchCompanyByCnpj } from "@/lib/cnpj";
import { glassField } from "@/lib/liquid-glass-styles";
import {
  formatDuplicateDocumentError,
  isPartyDocumentTaken,
} from "@/lib/party-document-uniqueness";

type Props = {
  form: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
  /** Se false, não altera o campo name (ex.: empresa usa razão social separado). */
  fillName?: boolean;
  fillPhone?: boolean;
  mapStatusToCadastro?: boolean;
  /** Se false, não renderiza o input de documento (já existe no formulário pai). */
  showDocumentInput?: boolean;
  /** Para avisar na consulta se o CNPJ/CPF já está cadastrado. */
  companyId?: string | null;
  partyTable?: "clients" | "suppliers";
  excludeId?: string | null;
};

export function CnpjLookupSection({
  form,
  set,
  fillName = true,
  fillPhone = true,
  mapStatusToCadastro = true,
  showDocumentInput = true,
  companyId = null,
  partyTable,
  excludeId = null,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState<string | null>(null);

  const documentValue = String(form.document ?? "");
  const digits = onlyDigits(documentValue);

  const applyLookup = async () => {
    if (digits.length !== 14) {
      setError("Informe o CNPJ completo com 14 dígitos para consultar.");
      setOkMessage(null);
      setDupWarning(null);
      return;
    }

    setLoading(true);
    setError(null);
    setOkMessage(null);
    setDupWarning(null);
    try {
      if (companyId && partyTable) {
        const dup = await isPartyDocumentTaken(partyTable, companyId, digits, excludeId);
        if (dup.taken) {
          setDupWarning(formatDuplicateDocumentError("CNPJ"));
        }
      }

      const info = await fetchCompanyByCnpj(documentValue);
      const patch = cnpjInfoToFormPatch(info, { fillName, fillPhone, mapStatusToCadastro });
      for (const [key, value] of Object.entries(patch)) {
        set(key, value);
      }
      const base = info.isActive
        ? "CNPJ ATIVO na Receita. Dados preenchidos — salve para gravar no banco."
        : `Situação na Receita: ${info.status}. Dados preenchidos — salve para gravar no banco.`;
      const parts: string[] = [];
      if (info.stateRegistrationFound && info.stateRegistration) {
        parts.push(`IE: ${info.stateRegistration}.`);
      } else {
        parts.push("IE não encontrada — preencha manualmente se houver.");
      }
      if (info.addressEnriched && info.addressNumber) {
        parts.push("Endereço e número completados.");
      } else if (info.streetFromCep) {
        parts.push("Logradouro completado pelo CEP — confira o número.");
      } else if (!info.street || !info.addressNumber) {
        parts.push("Endereço incompleto — confira logradouro/número.");
      }
      setOkMessage(`${base} ${parts.join(" ")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao consultar CNPJ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-sky-200/70 bg-sky-50/40 p-4 sm:col-span-2">
      <div>
        <p className="text-sm font-medium text-slate-800">Consulta CNPJ</p>
        <p className="text-xs text-slate-500">
          Digite o CNPJ e clique em Consultar para buscar razão social, endereço, inscrição
          estadual (IE) e situação cadastral. Se a IE não aparecer, preencha manualmente.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {showDocumentInput ? (
          <label className="block min-w-0 flex-1 space-y-1">
            <span className="text-sm font-medium text-slate-700">CNPJ / CPF</span>
            <input
              className={glassField(false)}
              value={documentValue}
              onChange={(e) => {
                set("document", formatCpfCnpj(e.target.value));
                setError(null);
                setOkMessage(null);
                setDupWarning(null);
              }}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
            />
          </label>
        ) : (
          <p className="min-w-0 flex-1 text-sm text-slate-600">
            Documento atual:{" "}
            <span className="font-medium text-slate-800">{documentValue || "—"}</span>
          </p>
        )}
        <Button
          type="button"
          variant="primary"
          disabled={loading}
          onClick={() => void applyLookup()}
          className="shrink-0"
        >
          {loading ? "Consultando..." : "Consultar CNPJ"}
        </Button>
      </div>

      {digits.length > 0 && digits.length < 14 ? (
        <p className="text-xs text-amber-700">
          Digite o CNPJ completo (14 dígitos). CPF não consulta Receita.
        </p>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}
      {dupWarning ? <Alert variant="error">{dupWarning}</Alert> : null}
      {okMessage ? <Alert variant="success">{okMessage}</Alert> : null}

      {form.cnpj_status ? (
        <p className="text-xs text-slate-600">
          Situação cadastral:{" "}
          <span className="font-semibold text-slate-800">{String(form.cnpj_status)}</span>
          {form.cnpj_checked_at
            ? ` · consultado em ${new Date(String(form.cnpj_checked_at)).toLocaleString("pt-BR")}`
            : null}
        </p>
      ) : null}
    </div>
  );
}
