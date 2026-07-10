"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DriverPaymentsTable } from "@/components/motoristas/DriverPaymentsTable";
import { Loading } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { fetchDreDriverExpenses } from "@/lib/dre-driver-expenses-api";
import { fetchDriverPaymentRows } from "@/lib/driver-payments-api";
import { useCompany } from "@/lib/company-context";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

function formatDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function DreDespesasMotoristaPage() {
  const { companyId } = useCompany();
  const supabase = useMemo(() => createClient(), []);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchDreDriverExpenses>>["rows"]>([]);
  const [pendingPayments, setPendingPayments] = useState<
    Awaited<ReturnType<typeof fetchDriverPaymentRows>>["rows"]
  >([]);
  const [summary, setSummary] = useState({
    motoristaTotal: 0,
    ajudanteTotal: 0,
    combinedTotal: 0,
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);

    const [dreResult, paymentsResult] = await Promise.all([
      fetchDreDriverExpenses(supabase, companyId, { year, month }),
      fetchDriverPaymentRows(supabase, companyId),
    ]);

    if (dreResult.error) {
      setError(dreResult.error);
      setRows([]);
      setSummary({ motoristaTotal: 0, ajudanteTotal: 0, combinedTotal: 0 });
    } else {
      setRows(dreResult.rows);
      setSummary(dreResult.summary);
    }

    setPendingPayments(paymentsResult.rows.filter((row) => !row.driver_payment_paid_at));
    setLoading(false);
  }, [companyId, month, supabase, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthLabel = useMemo(
    () => new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [month, year]
  );

  return (
    <Card>
      <CardHeader
        title="Despesas motorista / ajudante"
        description="Pagamentos pendentes com dados bancários para o Rafael efetuar o PIX/transferência. Após marcar pago, os lançamentos aparecem abaixo no DRE."
      />
      <CardBody className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Mês</span>
            <input
              type="month"
              className="block rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={`${year}-${String(month).padStart(2, "0")}`}
              onChange={(event) => {
                const [y, m] = event.target.value.split("-");
                if (y && m) {
                  setYear(Number(y));
                  setMonth(Number(m));
                }
              }}
            />
          </label>
          <p className="text-sm text-slate-500">
            Período: <strong className="capitalize text-slate-700">{monthLabel}</strong>
          </p>
          <Link href="/cadastros/contas-dre" className="text-sm text-brand-700 hover:underline">
            Contas DRE
          </Link>
          <Link href="/cadastros/motoristas/pagamentos" className="text-sm text-brand-700 hover:underline">
            Acompanhamento de pagamentos
          </Link>
        </div>

        <section className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Pagamentos pendentes ao motorista</h2>
            <p className="text-xs text-slate-600">
              OS, motorista, Pix e conta corrente para efetuar o pagamento. Anexe o comprovante antes ou depois de
              marcar pago.
            </p>
          </div>
          {loading ? (
            <Loading />
          ) : (
            <DriverPaymentsTable
              companyId={companyId ?? ""}
              supabase={supabase}
              rows={pendingPayments}
              filter="all"
              onRowsChange={(next) => {
                setPendingPayments(next.filter((row) => !row.driver_payment_paid_at));
                void load();
              }}
              emptyMessage="Nenhum pagamento pendente. Quando o motorista confirmar a designação, a OS aparecerá aqui."
            />
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Motorista</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatCurrency(summary.motoristaTotal)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ajudante</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatCurrency(summary.ajudanteTotal)}
            </p>
          </div>
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Total</p>
            <p className="mt-1 text-2xl font-semibold text-brand-900">
              {formatCurrency(summary.combinedTotal)}
            </p>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Lançamentos DRE no período</h2>
          {loading ? (
            <Loading />
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <p>{error}</p>
              {error.includes("relationship") || error.includes("service_order") ? (
                <p className="mt-2">
                  Execute{" "}
                  <code className="rounded bg-red-100 px-1">scripts/apply-all-driver-designation-flow.sql</code>{" "}
                  no SQL Editor do Supabase.
                </p>
              ) : null}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum lançamento neste período. Marque um pagamento como pago na seção acima.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Conta DRE</th>
                    <th className="px-3 py-2 font-medium">OS</th>
                    <th className="px-3 py-2 font-medium">Motorista</th>
                    <th className="px-3 py-2 font-medium">Pix</th>
                    <th className="px-3 py-2 font-medium">Banco</th>
                    <th className="px-3 py-2 font-medium">Conta</th>
                    <th className="px-3 py-2 font-medium">Valor</th>
                    <th className="px-3 py-2 font-medium">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">{formatDate(row.transaction_date)}</td>
                      <td className="px-3 py-2 font-medium">{row.dre_account_name}</td>
                      <td className="px-3 py-2 font-medium">{row.service_order_code ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.driver_code && row.driver_name
                          ? `${row.driver_code} — ${row.driver_name}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">{row.pix_key ?? "—"}</td>
                      <td className="px-3 py-2">{row.bank_code ?? "—"}</td>
                      <td className="px-3 py-2">{row.bank_account ?? "—"}</td>
                      <td className="px-3 py-2 font-medium">{formatCurrency(row.amount)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.description ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </CardBody>
    </Card>
  );
}
