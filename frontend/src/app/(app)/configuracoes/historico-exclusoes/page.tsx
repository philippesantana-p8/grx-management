"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Loading } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DeleteReasonModal } from "@/components/ui/DeleteReasonModal";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { useAccess } from "@/lib/access-context";
import { APP_SCREENS } from "@/lib/app-screens";
import { useCompany } from "@/lib/company-context";
import {
  canRestoreDeletionEvent,
  DELETION_REASON_OPTIONS,
  detectAbnormalDeletions,
  entityTypeLabel,
  exportDeletionAuditExcel,
  formatSnapshotLines,
  listDeletionAuditEvents,
  restoreSoftDeletedFromAudit,
  type DeletionAuditEvent,
} from "@/lib/deletion-audit";
import { glassField, glassFilterPanel } from "@/lib/liquid-glass-styles";
import { createClient } from "@/lib/supabase/client";
import { formatDateBR } from "@/lib/utils";

function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function screenLabel(screenKey: string | null): string {
  if (!screenKey) return "—";
  return APP_SCREENS.find((s) => s.key === screenKey)?.label ?? screenKey;
}

const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "Todos os módulos" },
  { value: "clients", label: "Cliente" },
  { value: "suppliers", label: "Fornecedor" },
  { value: "vehicles", label: "Veículo" },
  { value: "partners", label: "Sócio" },
  { value: "drivers", label: "Motorista" },
  { value: "service_orders", label: "Ordem de serviço" },
  { value: "traffic_infractions", label: "Infração" },
  { value: "financial_transactions", label: "Lançamento DRE" },
  { value: "vehicle_ownership", label: "Participação" },
  { value: "chart_of_accounts", label: "Conta DRE" },
];

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function HistoricoExclusoesPage() {
  const { companyId, company } = useCompany();
  const { isAdmin, loading: accessLoading } = useAccess();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<DeletionAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deleteMode, setDeleteMode] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [actorQuery, setActorQuery] = useState("");
  const [recordCode, setRecordCode] = useState("");
  const [reasonQuery, setReasonQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [missingHardening, setMissingHardening] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<DeletionAuditEvent | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!companyId || !isAdmin) return;
    setLoading(true);
    setError(null);
    setMissingHardening(false);
    const result = await listDeletionAuditEvents(supabase, companyId, {
      entityType: entityType || null,
      fromDate: fromDate || null,
      toDate: toDate || null,
      deleteMode: deleteMode === "soft" || deleteMode === "hard" ? deleteMode : null,
      restored: statusFilter === "restored" ? true : statusFilter === "deleted" ? false : null,
      reasonCode: reasonCode || null,
      actorQuery: actorQuery || null,
      recordCode: recordCode || null,
      reasonQuery: reasonQuery || null,
      limit: 500,
    });
    if (result.error) setError(result.error);
    setMissingHardening(Boolean(result.missingHardening));
    setRows(result.rows);
    setLoading(false);
  }, [
    actorQuery,
    companyId,
    deleteMode,
    entityType,
    fromDate,
    isAdmin,
    reasonCode,
    reasonQuery,
    recordCode,
    statusFilter,
    supabase,
    toDate,
  ]);

  useEffect(() => {
    if (accessLoading) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void load();
  }, [accessLoading, isAdmin, load]);

  const abnormalAlerts = useMemo(() => detectAbnormalDeletions(rows), [rows]);

  if (accessLoading || !companyId) return <Loading />;

  if (!isAdmin) {
    return (
      <Alert variant="warning">
        Histórico de Exclusões disponível apenas para administradores da empresa.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Histórico de Exclusões</h1>
          <p className="mt-1 text-sm text-slate-500">
            Auditoria imutável: quem excluiu, quando, motivo, snapshot e restauração (soft-delete).
            {company?.trade_name || company?.name
              ? ` Empresa: ${company.trade_name || company.name}.`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={loading || exporting || rows.length === 0}
          onClick={() => {
            void (async () => {
              setExporting(true);
              setError(null);
              try {
                await exportDeletionAuditExcel(rows);
                setMsg("Excel gerado.");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Falha ao exportar Excel.");
              } finally {
                setExporting(false);
              }
            })();
          }}
        >
          {exporting ? "Exportando…" : "Exportar Excel"}
        </Button>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="info">{msg}</Alert> : null}
      {missingHardening ? (
        <Alert variant="warning">
          Colunas de restauração / motivo padronizado ainda não existem no Supabase. Rode no SQL
          Editor o script{" "}
          <code className="text-xs">frontend/scripts/apply-054-deletion-audit-hardening.sql</code>.
          Até lá, a lista funciona no modo básico (sem status Restaurado).
        </Alert>
      ) : null}

      {abnormalAlerts.length > 0 ? (
        <Alert variant="warning">
          <p className="font-medium">Possíveis exclusões anormais (últimas 24h no filtro atual):</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {abnormalAlerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <section className={`space-y-3 ${glassFilterPanel()}`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <GlassSelect
            label="Módulo"
            value={entityType}
            onChange={setEntityType}
            options={ENTITY_TYPE_OPTIONS}
          />
          <GlassSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "", label: "Todos" },
              { value: "deleted", label: "Excluído" },
              { value: "restored", label: "Restaurado" },
            ]}
          />
          <GlassSelect
            label="Modo"
            value={deleteMode}
            onChange={setDeleteMode}
            options={[
              { value: "", label: "Soft e Hard" },
              { value: "soft", label: "Soft" },
              { value: "hard", label: "Hard" },
            ]}
          />
          <GlassSelect
            label="Motivo (código)"
            value={reasonCode}
            onChange={setReasonCode}
            options={[
              { value: "", label: "Todos os motivos" },
              ...DELETION_REASON_OPTIONS.map((o) => ({ value: o.code, label: o.label })),
            ]}
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Data inicial</span>
            <input
              type="date"
              className={glassField(false)}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Data final</span>
            <input
              type="date"
              className={glassField(false)}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Usuário</span>
            <input
              type="search"
              className={glassField(false)}
              value={actorQuery}
              placeholder="Nome ou e-mail"
              onChange={(e) => setActorQuery(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Código do registro</span>
            <input
              type="search"
              className={glassField(false)}
              value={recordCode}
              placeholder="Ex.: 00000001"
              onChange={(e) => setRecordCode(e.target.value)}
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Texto do motivo</span>
            <input
              type="search"
              className={glassField(false)}
              value={reasonQuery}
              placeholder="Buscar na observação"
              onChange={(e) => setReasonQuery(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <Button type="button" onClick={() => void load()} disabled={loading}>
              Filtrar
            </Button>
          </div>
        </div>
      </section>

      {loading ? <Loading /> : null}

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Data / hora</th>
              <th className="px-3 py-2">Usuário</th>
              <th className="px-3 py-2">Tela</th>
              <th className="px-3 py-2">Módulo</th>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Resumo</th>
              <th className="min-w-[12rem] px-3 py-2">Motivo</th>
              <th className="px-3 py-2">Modo</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const restorable = canRestoreDeletionEvent(row);
              return (
                <Fragment key={row.id}>
                  <tr className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">
                      {formatOccurredAt(row.occurred_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{row.actor_name || "—"}</div>
                      {row.actor_email ? (
                        <div className="text-xs text-slate-500">{row.actor_email}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{screenLabel(row.screen_key)}</td>
                    <td className="px-3 py-2">{entityTypeLabel(row.entity_type)}</td>
                    <td className="px-3 py-2">
                      {row.entity_code ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.entity_code}</span>
                          <button
                            type="button"
                            className="text-xs text-brand-700 hover:underline"
                            onClick={() => {
                              void copyText(row.entity_code!).then((ok) => {
                                setMsg(ok ? "Código copiado." : "Não foi possível copiar.");
                              });
                            }}
                          >
                            Copiar
                          </button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-2 text-slate-700" title={row.summary ?? undefined}>
                      {row.summary || "—"}
                    </td>
                    <td className="min-w-[12rem] max-w-md px-3 py-2">
                      {row.reason ? (
                        <p className="whitespace-pre-wrap text-sm font-medium text-slate-900">
                          {row.reason}
                        </p>
                      ) : (
                        <span className="text-sm text-slate-400">Sem observação</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={row.delete_mode === "soft" ? "warning" : "danger"}>
                        {row.delete_mode === "soft" ? "Soft" : "Hard"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={row.restored ? "success" : "danger"}>
                        {row.restored ? "Restaurado" : "Excluído"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setExpandedId((cur) => (cur === row.id ? null : row.id))
                          }
                        >
                          {expandedId === row.id ? "Ocultar" : "Detalhe"}
                        </Button>
                        {restorable ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setMsg(null);
                              setPendingRestore(row);
                            }}
                          >
                            Restaurar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {expandedId === row.id ? (
                    <tr className="border-t border-slate-50 bg-slate-50/80">
                      <td colSpan={10} className="px-3 py-3">
                        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                          <p>
                            <span className="font-semibold">Excluído em:</span>{" "}
                            {formatOccurredAt(row.occurred_at)}
                          </p>
                          <p className="mt-1">
                            <span className="font-semibold">Por:</span> {row.actor_name || "—"}
                            {row.actor_email ? ` (${row.actor_email})` : ""}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">
                            <span className="font-semibold">Motivo:</span> {row.reason || "—"}
                          </p>
                          {row.restored ? (
                            <>
                              <p className="mt-2">
                                <span className="font-semibold">Restaurado em:</span>{" "}
                                {row.restored_at ? formatOccurredAt(row.restored_at) : "—"}
                              </p>
                              <p className="mt-1">
                                <span className="font-semibold">Por:</span>{" "}
                                {row.restored_by_name || "—"}
                                {row.restored_by_email ? ` (${row.restored_by_email})` : ""}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap">
                                <span className="font-semibold">Motivo da restauração:</span>{" "}
                                {row.restoration_reason || "—"}
                              </p>
                            </>
                          ) : null}
                          {restorable ? (
                            <p className="mt-2 text-xs text-amber-900">
                              Este registro soft-deleted pode ser restaurado. O histórico permanece.
                            </p>
                          ) : null}
                        </div>

                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Conteúdo no momento da exclusão
                        </p>
                        {row.payload_json ? (
                          <dl className="mb-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
                            {formatSnapshotLines(row.payload_json).map((line) => (
                              <div key={`${row.id}-${line.label}`}>
                                <dt className="text-xs font-medium text-slate-500">{line.label}</dt>
                                <dd className="text-sm text-slate-900">{line.value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="mb-3 text-sm text-slate-500">
                            Snapshot não disponível neste evento.
                          </p>
                        )}

                        {row.payload_json ? (
                          <details className="text-xs text-slate-600">
                            <summary className="cursor-pointer font-medium text-slate-700">
                              JSON técnico
                            </summary>
                            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">
                              {JSON.stringify(row.payload_json, null, 2)}
                            </pre>
                          </details>
                        ) : null}

                        <p className="mt-2 text-xs text-slate-500">
                          ID: {row.entity_id}
                          {row.payload_json &&
                          typeof (row.payload_json as { created_at?: string }).created_at ===
                            "string"
                            ? ` · Criado em ${formatDateBR(
                                (row.payload_json as { created_at: string }).created_at
                              )}`
                            : ""}
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                  Nenhuma exclusão registrada com estes filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <DeleteReasonModal
        open={Boolean(pendingRestore)}
        confirming={restoring}
        useReasonCodes={false}
        title="Restaurar registro"
        description="O cadastro volta à lista ativa. O evento de exclusão permanece no histórico (imutável), com status Restaurado."
        confirmLabel="Restaurar com registro"
        onCancel={() => {
          if (!restoring) setPendingRestore(null);
        }}
        onConfirm={async (payload) => {
          if (!pendingRestore) return;
          setRestoring(true);
          setError(null);
          setMsg(null);
          const result = await restoreSoftDeletedFromAudit(
            supabase,
            pendingRestore.id,
            payload.reason
          );
          setRestoring(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          setPendingRestore(null);
          setMsg("Registro restaurado. O histórico de exclusão foi mantido.");
          await load();
        }}
      />
    </div>
  );
}
