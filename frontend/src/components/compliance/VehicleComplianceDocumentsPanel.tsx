"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  attachComplianceFile,
  ComplianceDocumentEditor,
} from "@/components/compliance/ComplianceDocumentEditor";
import { AttachmentGallery } from "@/components/drivers/AttachmentGallery";
import { Alert, Badge, Loading } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  buildIndicators,
  documentDisplayName,
  resolveComplianceSituation,
  type ComplianceDocument,
  type DocumentType,
} from "@/lib/compliance-documents";
import {
  createComplianceDocument,
  listCompanyDocumentsForVehicleView,
  listComplianceDocuments,
  listDocumentTypes,
  renewComplianceDocument,
  seedDefaultDocumentTypes,
  syncComplianceAlerts,
  updateComplianceDocument,
  type ComplianceDocInput,
} from "@/lib/compliance-documents-api";
import { formatExpiryDateBR } from "@/lib/expiry-status";
import { glassFilterPanel } from "@/lib/liquid-glass-styles";
import { createClient } from "@/lib/supabase/client";

type Props = {
  companyId: string;
  vehicleId: string | null;
  vehicleCategory?: string | null;
  canEdit?: boolean;
};

export function VehicleComplianceDocumentsPanel({
  companyId,
  vehicleId,
  vehicleCategory,
  canEdit = true,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<DocumentType[]>([]);
  const [vehicleDocs, setVehicleDocs] = useState<ComplianceDocument[]>([]);
  const [companyDocs, setCompanyDocs] = useState<ComplianceDocument[]>([]);
  const [editor, setEditor] = useState<{
    mode: "create" | "edit" | "renew";
    doc?: ComplianceDocument | null;
  } | null>(null);
  const [historyRootId, setHistoryRootId] = useState<string | null>(null);
  const [history, setHistory] = useState<ComplianceDocument[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    await seedDefaultDocumentTypes(supabase, companyId);
    const [typesRes, companyRes] = await Promise.all([
      listDocumentTypes(supabase, companyId, "vehicle"),
      listCompanyDocumentsForVehicleView(supabase, companyId),
    ]);
    if (typesRes.error) setError(typesRes.error);
    setVehicleTypes(typesRes.rows.filter((t) => t.is_active));
    setCompanyDocs(companyRes.rows);

    if (vehicleId) {
      const docsRes = await listComplianceDocuments(supabase, companyId, {
        ownerType: "vehicle",
        ownerId: vehicleId,
        currentOnly: true,
      });
      if (docsRes.error) setError(docsRes.error);
      setVehicleDocs(docsRes.rows);
      await syncComplianceAlerts(supabase, companyId, [
        ...docsRes.rows,
        ...companyRes.rows,
      ]);
    } else {
      setVehicleDocs([]);
    }
    setLoading(false);
  }, [companyId, vehicleId, supabase]);

  useEffect(() => {
    void load();
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [load, supabase.auth]);

  const indicators = useMemo(
    () => buildIndicators(vehicleTypes, vehicleDocs, vehicleCategory),
    [vehicleTypes, vehicleDocs, vehicleCategory]
  );

  const openHistory = async (doc: ComplianceDocument) => {
    const root = doc.root_id ?? doc.id;
    setHistoryRootId(root);
    const res = await listComplianceDocuments(supabase, companyId, {
      ownerType: "vehicle",
      ownerId: vehicleId!,
      currentOnly: false,
      rootId: root,
    });
    setHistory(res.rows);
  };

  const saveEditor = async (input: ComplianceDocInput, file?: File | null) => {
    if (!vehicleId) return "Salve o veículo antes de cadastrar documentos.";
    if (!editor) return "Editor indisponível.";

    if (editor.mode === "create") {
      const { id, error: err } = await createComplianceDocument(
        supabase,
        companyId,
        "vehicle",
        vehicleId,
        input,
        userId
      );
      if (err || !id) return err ?? "Falha ao criar";
      if (file) {
        const up = await attachComplianceFile(companyId, id, file);
        if (up) return up;
      }
    } else if (editor.mode === "edit" && editor.doc) {
      const err = await updateComplianceDocument(
        supabase,
        companyId,
        editor.doc.id,
        input,
        userId
      );
      if (err) return err;
      if (file) {
        const up = await attachComplianceFile(companyId, editor.doc.id, file);
        if (up) return up;
      }
    } else if (editor.mode === "renew" && editor.doc) {
      const { id, error: err } = await renewComplianceDocument(
        supabase,
        companyId,
        editor.doc,
        input,
        userId
      );
      if (err || !id) return err ?? "Falha ao renovar";
      if (file) {
        const up = await attachComplianceFile(companyId, id, file);
        if (up) return up;
      }
    }

    setEditor(null);
    await load();
    return null;
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      {error ? <Alert variant="error">{error}</Alert> : null}

      {!vehicleId ? (
        <Alert variant="info">
          Salve o veículo primeiro para cadastrar documentos com validade e histórico.
        </Alert>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-5">
        {[
          { label: "Válidos", value: indicators.valid, tone: "text-emerald-700" },
          { label: "A vencer", value: indicators.expiring, tone: "text-amber-700" },
          { label: "Vencidos", value: indicators.expired, tone: "text-red-700" },
          { label: "Em renovação", value: indicators.inRenewal, tone: "text-sky-700" },
          { label: "Não cadastrados", value: indicators.missing, tone: "text-slate-700" },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl px-3 py-2 ${glassFilterPanel()}`}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {k.label}
            </p>
            <p className={`text-xl font-bold tabular-nums ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* A — Documentos do veículo */}
      <section className={`space-y-3 ${glassFilterPanel()}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">A. Documentos do veículo</h3>
          {canEdit && vehicleId ? (
            <Button type="button" onClick={() => setEditor({ mode: "create", doc: null })}>
              Novo documento
            </Button>
          ) : null}
        </div>

        {editor ? (
          <ComplianceDocumentEditor
            companyId={companyId}
            types={vehicleTypes}
            initial={editor.doc}
            mode={editor.mode}
            onCancel={() => setEditor(null)}
            onSave={saveEditor}
          />
        ) : null}

        <div className="space-y-2">
          {vehicleDocs.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum documento cadastrado neste veículo.</p>
          ) : (
            vehicleDocs.map((doc) => {
              const view = resolveComplianceSituation(doc, doc.document_type);
              return (
                <div
                  key={doc.id}
                  className="rounded-xl border border-slate-200 bg-white/70 px-3 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {documentDisplayName(doc.document_type)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {doc.issuing_body || doc.document_type?.issuing_body || "—"}
                        {doc.document_number ? ` · Nº ${doc.document_number}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        Validade:{" "}
                        {doc.no_expiry
                          ? "Sem vencimento"
                          : formatExpiryDateBR(doc.expires_at)}
                        {view.daysLeft != null ? ` · ${view.daysLeft} dia(s)` : ""}
                      </p>
                    </div>
                    <Badge variant={view.badge}>{view.label}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {canEdit ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setEditor({ mode: "edit", doc })}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setEditor({ mode: "renew", doc })}
                        >
                          Renovar
                        </Button>
                      </>
                    ) : null}
                    <Button type="button" variant="secondary" onClick={() => void openHistory(doc)}>
                      Histórico
                    </Button>
                  </div>
                  <div className="mt-2">
                    <AttachmentGallery
                      companyId={companyId}
                      entityType="compliance_document"
                      entityId={doc.id}
                      title="Anexo"
                      refreshKey={0}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* B — Empresa (consulta) */}
      <section className={`space-y-3 ${glassFilterPanel()}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            B. Documentos da empresa (consulta)
          </h3>
          <Link
            href="/configuracoes/documentos-licencas"
            className="text-sm font-medium text-sky-700 underline"
          >
            Gerenciar em Parâmetros → Documentos e licenças
          </Link>
        </div>
        <p className="text-xs text-slate-500">
          TA, CADASTUR e demais licenças da empresa aparecem aqui sem duplicar em cada veículo.
        </p>
        {companyDocs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum documento da empresa cadastrado.</p>
        ) : (
          companyDocs.map((doc) => {
            const view = resolveComplianceSituation(doc, doc.document_type);
            return (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{documentDisplayName(doc.document_type)}</p>
                  <p className="text-xs text-slate-500">
                    Validade:{" "}
                    {doc.no_expiry ? "Sem vencimento" : formatExpiryDateBR(doc.expires_at)}
                  </p>
                </div>
                <Badge variant={view.badge}>{view.label}</Badge>
              </div>
            );
          })
        )}
      </section>

      {/* C — Histórico */}
      <section className={`space-y-3 ${glassFilterPanel()}`}>
        <h3 className="text-sm font-semibold text-slate-900">C. Histórico de renovações</h3>
        {!historyRootId ? (
          <p className="text-sm text-slate-500">
            Clique em Histórico em um documento para ver versões anteriores.
          </p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">Sem versões anteriores.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="rounded-lg border border-slate-100 px-3 py-2">
                <p className="font-medium">
                  v{h.version_number}
                  {h.is_current ? " (atual)" : ""} · Nº {h.document_number || "—"}
                </p>
                <p className="text-xs text-slate-500">
                  Emissão {formatExpiryDateBR(h.issued_at)} · Venc.{" "}
                  {h.no_expiry ? "—" : formatExpiryDateBR(h.expires_at)} · Incluído{" "}
                  {formatExpiryDateBR(h.created_at.slice(0, 10))}
                </p>
                <AttachmentGallery
                  companyId={companyId}
                  entityType="compliance_document"
                  entityId={h.id}
                  title="Anexo da versão"
                  refreshKey={0}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
