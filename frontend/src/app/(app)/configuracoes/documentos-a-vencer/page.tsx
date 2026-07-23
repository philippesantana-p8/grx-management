"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Loading } from "@/components/ui/Badge";
import { useCompany } from "@/lib/company-context";
import {
  documentDisplayName,
  resolveComplianceSituation,
  type ComplianceDocument,
} from "@/lib/compliance-documents";
import {
  listExpiringDocumentsReport,
  listUnreadComplianceAlerts,
  markComplianceAlertRead,
  seedDefaultDocumentTypes,
} from "@/lib/compliance-documents-api";
import { formatExpiryDateBR } from "@/lib/expiry-status";
import { glassFilterPanel } from "@/lib/liquid-glass-styles";
import { createClient } from "@/lib/supabase/client";

export default function DocumentosAVencerPage() {
  const { companyId } = useCompany();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ComplianceDocument[]>([]);
  const [alerts, setAlerts] = useState<
    Array<{ id: string; title: string; body: string; alert_tier: string; created_at: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    await seedDefaultDocumentTypes(supabase, companyId);
    const [rep, al] = await Promise.all([
      listExpiringDocumentsReport(supabase, companyId),
      listUnreadComplianceAlerts(supabase, companyId),
    ]);
    if (rep.error) setError(rep.error);
    setRows(rep.rows);
    setAlerts(al.rows);
    setLoading(false);
  }, [companyId, supabase]);

  useEffect(() => {
    void load();
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [load, supabase.auth]);

  if (!companyId || loading) return <Loading />;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Documentos a vencer</h1>
        <p className="text-sm text-slate-600">
          Relatório e central de alertas documentais.{" "}
          <Link href="/configuracoes/documentos-licencas" className="text-sky-700 underline">
            Voltar aos parâmetros
          </Link>
        </p>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className={`space-y-2 ${glassFilterPanel()}`}>
        <h2 className="text-sm font-semibold">Notificações (não lidas)</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum alerta pendente nesta semana.</p>
        ) : (
          alerts.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-slate-500">{a.body}</p>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-sky-700 underline"
                onClick={async () => {
                  await markComplianceAlertRead(supabase, companyId, a.id, userId);
                  await load();
                }}
              >
                Marcar lido
              </button>
            </div>
          ))
        )}
      </section>

      <section className={`overflow-x-auto ${glassFilterPanel()}`}>
        <h2 className="mb-2 text-sm font-semibold">Documentos em atenção</h2>
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2">Documento</th>
              <th className="px-2 py-2">Escopo</th>
              <th className="px-2 py-2">Nº</th>
              <th className="px-2 py-2">Validade</th>
              <th className="px-2 py-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-slate-500">
                  Nenhum documento vencido ou a vencer.
                </td>
              </tr>
            ) : (
              rows.map((doc) => {
                const view = resolveComplianceSituation(doc, doc.document_type);
                return (
                  <tr key={doc.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-medium">
                      {documentDisplayName(doc.document_type)}
                    </td>
                    <td className="px-2 py-2">
                      {doc.owner_type === "company" ? "Empresa" : "Veículo"}
                    </td>
                    <td className="px-2 py-2">{doc.document_number || "—"}</td>
                    <td className="px-2 py-2">
                      {doc.no_expiry ? "—" : formatExpiryDateBR(doc.expires_at)}
                      {view.daysLeft != null ? ` (${view.daysLeft}d)` : ""}
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant={view.badge}>{view.label}</Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
