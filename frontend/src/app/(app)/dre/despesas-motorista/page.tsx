"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loading } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { fetchDreDriverExpenses } from "@/lib/dre-driver-expenses-api";
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
  const [summary, setSummary] = useState({
    motoristaTotal: 0,
    ajudanteTotal: 0,
    combinedTotal: 0,
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    const result = await fetchDreDriverExpenses(supabase, companyId, { year, month });
    if (result.error) {
      setError(result.error);
      setRows([]);
      setSummary({ motoristaTotal: 0, ajudanteTotal: 0, combinedTotal: 0 });
    } else {
      setRows(result.rows);
      setSummary(result.summary);
    }
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
        description="Lançamentos DRE nas contas «Motorista» e «Ajudante», gerados ao marcar pagamento em Motoristas → Acompanhamento de pagamentos."
      />
      <CardBody className="space-y-4">
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
          <Link
            href="/cadastros/motoristas/pagamentos"
            className="text-sm text-brand-700 hover:underline"
          >
            Acompanhamento de pagamentos
          </Link>
        </div>

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

        {loading ? (
          <Loading />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum lançamento neste período. Marque um pagamento como pago em{" "}
            <Link href="/cadastros/motoristas/pagamentos" className="text-brand-700 hover:underline">
              Motoristas → Acompanhamento de pagamentos
            </Link>
            . Certifique-se de que as contas «Motorista» e «Ajudante» existem em Contas DRE.
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
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">{formatDate(row.transaction_date)}</td>
                    <td className="px-3 py-2 font-medium">{row.dre_account_name}</td>
                    <td className="px-3 py-2">{row.service_order_code ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row.driver_code && row.driver_name
                        ? `${row.driver_code} — ${row.driver_name}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 font-medium">{formatCurrency(row.amount)}</td>
                    <td className="px-3 py-2 text-slate-600">{row.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
