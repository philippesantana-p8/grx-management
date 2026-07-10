"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Loading } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  driverPaymentTotal,
  fetchDriverPaymentRows,
  filterDriverPaymentRows,
  markDriverPaymentPaid,
  type DriverPaymentFilter,
  type DriverPaymentRow,
} from "@/lib/driver-payments-api";
import { useCompany } from "@/lib/company-context";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

function formatDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function MotoristasPagamentosPage() {
  const { companyId } = useCompany();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<DriverPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);
  const [filter, setFilter] = useState<DriverPaymentFilter>("pending");
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setSchemaWarning(null);
    const { rows: data, error: fetchError, schemaWarning: warning } = await fetchDriverPaymentRows(
      supabase,
      companyId
    );
    if (fetchError) {
      setError(fetchError);
      setRows([]);
    } else {
      setRows(data);
      setSchemaWarning(warning);
    }
    setLoading(false);
  }, [companyId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => filterDriverPaymentRows(rows, filter), [rows, filter]);

  const handleMarkPaid = async (row: DriverPaymentRow) => {
    if (
      !window.confirm(
        `Registrar pagamento de ${formatCurrency(driverPaymentTotal(row))} ao motorista ${row.driver_name} (OS ${row.code})?`
      )
    ) {
      return;
    }

    setMarkingId(row.id);
    const { paidAt, error: markError } = await markDriverPaymentPaid(supabase, row.id);
    setMarkingId(null);

    if (markError) {
      window.alert(markError);
      return;
    }

    setRows((current) =>
      current.map((item) =>
        item.id === row.id ? { ...item, driver_payment_paid_at: paidAt ?? new Date().toISOString() } : item
      )
    );
  };

  return (
    <Card>
      <CardHeader
        title="Acompanhamento de pagamentos"
        description="OS com motorista confirmado e valor informado na designação. Exibe Pix e dados bancários cadastrados em Motoristas → Cadastro. Ao marcar pago, lança despesas DRE."
      />
      <CardBody>
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["pending", "Pendentes"],
              ["paid", "Pagos"],
              ["all", "Todos"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === value
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {schemaWarning ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Configuração pendente no Supabase</p>
            <p className="mt-1">{schemaWarning}</p>
            <p className="mt-2">
              Abra o SQL Editor do Supabase e execute o arquivo{" "}
              <code className="rounded bg-amber-100 px-1">scripts/apply-all-driver-designation-flow.sql</code>.
            </p>
          </div>
        ) : null}
        {loading ? (
          <Loading />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : visibleRows.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum pagamento encontrado para este filtro. Designe um motorista informando os valores
            e aguarde a confirmação dele.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-3 py-2 font-medium">OS</th>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Motorista</th>
                  <th className="px-3 py-2 font-medium">Motorista (R$)</th>
                  <th className="px-3 py-2 font-medium">Ajudante (R$)</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Chave Pix</th>
                  <th className="px-3 py-2 font-medium">Banco</th>
                  <th className="px-3 py-2 font-medium">Agência</th>
                  <th className="px-3 py-2 font-medium">Conta</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const paid = Boolean(row.driver_payment_paid_at);
                  return (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">{row.code}</td>
                      <td className="px-3 py-2">{formatDate(row.service_date)}</td>
                      <td className="px-3 py-2">
                        {row.driver_code} — {row.driver_name}
                      </td>
                      <td className="px-3 py-2">{formatCurrency(row.driver_assignment_pay_amount)}</td>
                      <td className="px-3 py-2">
                        {row.driver_assignment_assistant_pay_amount
                          ? formatCurrency(row.driver_assignment_assistant_pay_amount)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-medium">{formatCurrency(driverPaymentTotal(row))}</td>
                      <td className="px-3 py-2">
                        {row.pix_key ?? (
                          <Link
                            href="/cadastros/motoristas"
                            className="text-xs text-brand-700 hover:underline"
                          >
                            Cadastrar Pix
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.bank_code ?? "—"}</td>
                      <td className="px-3 py-2">{row.bank_agency ?? "—"}</td>
                      <td className="px-3 py-2">{row.bank_account ?? "—"}</td>
                      <td className="px-3 py-2">
                        {paid ? (
                          <Badge variant="success">Pago</Badge>
                        ) : (
                          <Badge variant="warning">Pendente</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {!paid ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={markingId === row.id}
                            onClick={() => void handleMarkPaid(row)}
                          >
                            {markingId === row.id ? "Registrando…" : "Marcar pago"}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {row.driver_payment_paid_at
                              ? new Date(row.driver_payment_paid_at).toLocaleString("pt-BR")
                              : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
