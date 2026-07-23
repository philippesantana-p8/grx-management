"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Loading } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTableScroll } from "@/components/ui/DataTableScroll";
import { GlassSelect } from "@/components/ui/GlassSelect";
import { useAccess } from "@/lib/access-context";
import { useCompany } from "@/lib/company-context";
import {
  fetchOsRateio,
  type OsRateioPartnerTotal,
  type OsRateioRow,
} from "@/lib/dre-os-rateio-api";
import { glassAction, glassField, glassFilterPanel, glassStatCard } from "@/lib/liquid-glass-styles";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

function formatDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

type FlatShareRow = {
  key: string;
  order: OsRateioRow;
  partnerId: string;
  partnerName: string;
  ownershipPct: number;
  revenueShare: number;
  expenseShare: number;
  resultShare: number;
};

export default function DreRateioOsPage() {
  const { companyId } = useCompany();
  const { canViewScreen } = useAccess();
  const canView = canViewScreen("dre.rateio-os");
  const supabase = useMemo(() => createClient(), []);
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [vehicleId, setVehicleId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [vehicleOptions, setVehicleOptions] = useState<{ value: string; label: string }[]>([]);
  const [partnerOptions, setPartnerOptions] = useState<{ value: string; label: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OsRateioRow[]>([]);
  const [partnerTotals, setPartnerTotals] = useState<OsRateioPartnerTotal[]>([]);
  const [summary, setSummary] = useState({
    osCount: 0,
    totalRevenue: 0,
    totalExpense: 0,
    totalResult: 0,
  });

  const monthLabel = useMemo(
    () => new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [month, year]
  );

  const loadLookups = useCallback(async () => {
    if (!companyId) return;

    const [{ data: vehicles }, { data: partners }] = await Promise.all([
      supabase
        .from("vehicles")
        .select("id, plate, plate_display, status")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("plate"),
      supabase
        .from("partners")
        .select("id, name, status")
        .eq("company_id", companyId)
        .order("name"),
    ]);

    setVehicleOptions(
      (vehicles ?? [])
        .filter((v) => v.status !== "Inativo")
        .map((v) => ({
          value: v.id as string,
          label: ((v.plate_display as string) || (v.plate as string) || "").toUpperCase(),
        }))
    );

    setPartnerOptions(
      (partners ?? [])
        .filter((p) => p.status !== "Inativo")
        .map((p) => ({
          value: p.id as string,
          label: (p.name as string) || "Sócio",
        }))
    );
  }, [companyId, supabase]);

  const loadRateio = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    const result = await fetchOsRateio(supabase, companyId, {
      year,
      month,
      vehicleId: vehicleId || undefined,
      partnerId: partnerId || undefined,
    });
    if (result.error) {
      setError(result.error);
      setRows([]);
      setPartnerTotals([]);
      setSummary({ osCount: 0, totalRevenue: 0, totalExpense: 0, totalResult: 0 });
    } else {
      setRows(result.rows);
      setPartnerTotals(result.partnerTotals);
      setSummary(result.summary);
    }
    setLoading(false);
  }, [companyId, month, partnerId, supabase, vehicleId, year]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadRateio();
  }, [loadRateio]);

  const flatRows = useMemo<FlatShareRow[]>(() => {
    const out: FlatShareRow[] = [];
    for (const order of rows) {
      if (!order.shares.length) {
        out.push({
          key: `${order.serviceOrderId}-none`,
          order,
          partnerId: "",
          partnerName: "—",
          ownershipPct: 0,
          revenueShare: 0,
          expenseShare: 0,
          resultShare: 0,
        });
        continue;
      }
      for (const share of order.shares) {
        out.push({
          key: `${order.serviceOrderId}-${share.partnerId}`,
          order,
          partnerId: share.partnerId,
          partnerName: share.partnerName,
          ownershipPct: share.ownershipPct,
          revenueShare: share.revenueShare,
          expenseShare: share.expenseShare,
          resultShare: share.resultShare,
        });
      }
    }
    return out;
  }, [rows]);

  if (!canView) {
    return (
      <Card>
        <CardBody>
          <Alert variant="error">Você não tem permissão para ver Rateio por OS.</Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Rateio por OS"
        description="Consulta o quanto cada sócio recebe por ordem de serviço, conforme o % de participação do veículo vigente na data da OS. Base = frete acordado (ou valor do serviço); despesas = lançamentos do DRE vinculados à OS."
      />
      <CardBody className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Mês</span>
            <input
              type="month"
              className={glassField()}
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
          <div className="min-w-[200px]">
            <GlassSelect
              label="Placa"
              value={vehicleId}
              onChange={setVehicleId}
              options={[{ value: "", label: "— Todas as placas —" }, ...vehicleOptions]}
              searchable
            />
          </div>
          <div className="min-w-[220px]">
            <GlassSelect
              label="Sócio"
              value={partnerId}
              onChange={setPartnerId}
              options={[{ value: "", label: "— Todos os sócios —" }, ...partnerOptions]}
              searchable
            />
          </div>
          <p className="text-sm text-slate-500">
            Período: <strong className="capitalize text-slate-700">{monthLabel}</strong>
          </p>
          <Link href="/cadastros/participacoes" className={glassAction("brand", true)}>
            Participações
          </Link>
        </div>

        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={glassStatCard("slate")}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">OS no período</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.osCount}</p>
          </div>
          <div className={glassStatCard("green")}>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              {partnerId ? "Receita (cota)" : "Receita OS"}
            </p>
            <p className="mt-1 text-2xl font-semibold text-emerald-950">
              {formatCurrency(summary.totalRevenue)}
            </p>
          </div>
          <div className={glassStatCard("amber")}>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              {partnerId ? "Despesa (cota)" : "Despesa OS"}
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-950">
              {formatCurrency(summary.totalExpense)}
            </p>
          </div>
          <div className={glassStatCard(summary.totalResult >= 0 ? "brand" : "amber")}>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">
              {partnerId ? "Resultado (cota)" : "Resultado"}
            </p>
            <p className="mt-1 text-2xl font-semibold text-brand-950">
              {formatCurrency(summary.totalResult)}
            </p>
          </div>
        </div>

        {partnerTotals.length > 0 ? (
          <div className={`space-y-2 p-4 ${glassFilterPanel()}`}>
            <h3 className="text-sm font-semibold text-slate-900">Totais por sócio</h3>
            <DataTableScroll stickyFirst maxHeight="min(40vh, 22rem)">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-600">
                    <th className="px-2 py-1.5 font-medium">Sócio</th>
                    <th className="px-2 py-1.5 font-medium">OS</th>
                    <th className="px-2 py-1.5 font-medium">Receita</th>
                    <th className="px-2 py-1.5 font-medium">Despesa</th>
                    <th className="px-2 py-1.5 font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerTotals.map((p) => (
                    <tr key={p.partnerId} className="border-b border-slate-50">
                      <td className="px-2 py-1.5 font-medium text-slate-900">{p.partnerName}</td>
                      <td className="px-2 py-1.5 text-slate-700">{p.osCount}</td>
                      <td className="px-2 py-1.5 text-emerald-800">{formatCurrency(p.revenueShare)}</td>
                      <td className="px-2 py-1.5 text-amber-800">{formatCurrency(p.expenseShare)}</td>
                      <td className="px-2 py-1.5 font-medium text-slate-900">
                        {formatCurrency(p.resultShare)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableScroll>
          </div>
        ) : null}

        <section className="min-w-0 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Detalhe OS × sócio</h2>
          {loading ? (
            <Loading />
          ) : flatRows.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma OS de Frete/Transporte neste filtro.</p>
          ) : (
            <DataTableScroll
              stickyFirst
              hint={
                <>
                  Role o quadro (barra vertical/horizontal). Cabeçalho e coluna <strong>OS</strong>{" "}
                  ficam fixos — padrão Agenda da Frota. O menu lateral permanece visível.
                </>
              }
            >
              <table className="w-full min-w-[62rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-3 py-2.5 font-semibold text-slate-800">OS</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-800">Data</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-800">Placa</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-800">Cliente</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-800">Receita OS</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-800">Despesa OS</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-800">Sócio</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-800">%</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-800">Cota receita</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-800">Cota despesa</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-800">Cota resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {flatRows.map((row) => (
                    <tr key={row.key} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-2 font-medium text-slate-900">
                        <div className="truncate">{row.order.code || "—"}</div>
                        {row.order.warnings.length ? (
                          <p className="mt-0.5 text-[11px] leading-snug text-amber-700">
                            {row.order.warnings.join(" ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{formatDate(row.order.serviceDate)}</td>
                      <td className="truncate px-3 py-2 font-medium text-slate-900">
                        {row.order.plate || "—"}
                      </td>
                      <td className="truncate px-3 py-2 text-slate-600">
                        {row.order.clientName || "—"}
                      </td>
                      <td className="px-3 py-2 text-emerald-800">
                        {formatCurrency(row.order.revenue)}
                      </td>
                      <td className="px-3 py-2 text-amber-800">
                        {formatCurrency(row.order.expense)}
                      </td>
                      <td className="truncate px-3 py-2 text-slate-800">{row.partnerName}</td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">
                        {row.partnerId ? `${row.ownershipPct.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 font-medium text-emerald-900">
                        {formatCurrency(row.revenueShare)}
                      </td>
                      <td className="px-3 py-2 text-amber-900">{formatCurrency(row.expenseShare)}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {formatCurrency(row.resultShare)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableScroll>
          )}
        </section>
      </CardBody>
    </Card>
  );
}
