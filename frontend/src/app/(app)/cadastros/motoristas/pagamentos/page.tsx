"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DriverPaymentsTable } from "@/components/motoristas/DriverPaymentsTable";
import { Loading } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { fetchDriverPaymentRows, type DriverPaymentFilter } from "@/lib/driver-payments-api";
import { useCompany } from "@/lib/company-context";
import { createClient } from "@/lib/supabase/client";

export default function MotoristasPagamentosPage() {
  const { companyId } = useCompany();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchDriverPaymentRows>>["rows"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);
  const [filter, setFilter] = useState<DriverPaymentFilter>("pending");

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

  return (
    <Card>
      <CardHeader
        title="Acompanhamento de pagamentos"
        description="OS com motorista confirmado. Use os dados bancários para pagar, anexe o comprovante (ícone de clipe) e marque como pago para lançar no DRE."
      />
      <CardBody>
        {schemaWarning ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Configuração pendente no Supabase</p>
            <p className="mt-1">{schemaWarning}</p>
            <p className="mt-2">
              Execute{" "}
              <code className="rounded bg-amber-100 px-1">scripts/apply-all-driver-designation-flow.sql</code>{" "}
              no SQL Editor.
            </p>
          </div>
        ) : null}
        {loading ? (
          <Loading />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <DriverPaymentsTable
            companyId={companyId ?? ""}
            supabase={supabase}
            rows={rows}
            filter={filter}
            showFilterTabs
            onFilterChange={setFilter}
            onRowsChange={setRows}
            emptyMessage="Nenhum pagamento encontrado. Designe um motorista com valores e aguarde a confirmação."
          />
        )}
        <p className="mt-4 text-xs text-slate-500">
          Cadastre Pix e conta em{" "}
          <Link href="/cadastros/motoristas" className="text-brand-700 hover:underline">
            Motoristas → Cadastro
          </Link>
          .
        </p>
      </CardBody>
    </Card>
  );
}
