"use client";

import { AttachmentGallery } from "@/components/drivers/AttachmentGallery";
import { Badge } from "@/components/ui/Badge";
import {
  documentDisplayName,
  resolveComplianceSituation,
  type ComplianceDocument,
} from "@/lib/compliance-documents";
import { formatExpiryDateBR } from "@/lib/expiry-status";
import { glassFilterPanel } from "@/lib/liquid-glass-styles";

type Props = {
  companyId: string;
  versions: ComplianceDocument[];
  loading?: boolean;
  emptyHint?: string;
};

/** Histórico de versões (renovações) — Teste 11. */
export function ComplianceDocumentHistory({
  companyId,
  versions,
  loading = false,
  emptyHint = "Clique em Histórico em um documento para ver as versões.",
}: Props) {
  return (
    <section className={`space-y-3 ${glassFilterPanel()}`}>
      <h3 className="text-sm font-semibold text-slate-900">Histórico de renovações</h3>
      {loading ? (
        <p className="text-sm text-slate-500">Carregando histórico…</p>
      ) : versions.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {versions.map((h) => {
            const view = resolveComplianceSituation(h, h.document_type);
            return (
              <li key={h.id} className="rounded-lg border border-slate-100 px-3 py-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      v{h.version_number}
                      {h.is_current ? " (atual)" : " (anterior)"} ·{" "}
                      {documentDisplayName(h.document_type)} · Nº{" "}
                      {h.document_number || "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Emissão {formatExpiryDateBR(h.issued_at)} · Validade{" "}
                      {h.no_expiry ? "sem vencimento" : formatExpiryDateBR(h.expires_at)} ·
                      Incluído {formatExpiryDateBR(h.created_at.slice(0, 10))}
                      {h.is_current ? "" : " · arquivada (is_current = false)"}
                    </p>
                  </div>
                  <Badge variant={view.badge}>{view.label}</Badge>
                </div>
                <div className="mt-2">
                  <AttachmentGallery
                    companyId={companyId}
                    entityType="compliance_document"
                    entityId={h.id}
                    title="Anexo da versão"
                    refreshKey={0}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
