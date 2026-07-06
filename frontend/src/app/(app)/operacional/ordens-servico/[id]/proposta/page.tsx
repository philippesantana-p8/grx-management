"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ServiceOrderProposalView } from "@/components/operacional/ServiceOrderProposalView";
import { Loading, Alert } from "@/components/ui/Badge";
import { useCompany } from "@/lib/company-context";
import { createClient } from "@/lib/supabase/client";
import type { ServiceOrder } from "@/types/database";

export default function ServiceOrderPropostaPage() {
  const params = useParams();
  const orderId = String(params.id ?? "");
  const { company } = useCompany();
  const supabase = createClient();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [dreAccountName, setDreAccountName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    void (async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("service_orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (fetchError || !data) {
        setError(fetchError?.message ?? "Ordem de serviço não encontrada.");
        setLoading(false);
        return;
      }

      const row = data as ServiceOrder;
      setOrder(row);

      if (row.driver_id) {
        const { data: driver } = await supabase
          .from("drivers")
          .select("name")
          .eq("id", row.driver_id)
          .maybeSingle();
        setDriverName((driver as { name?: string } | null)?.name ?? null);
      }

      if (row.chart_of_account_id) {
        const { data: account } = await supabase
          .from("chart_of_accounts")
          .select("name")
          .eq("id", row.chart_of_account_id)
          .maybeSingle();
        setDreAccountName((account as { name?: string } | null)?.name ?? null);
      }

      setLoading(false);
    })();
  }, [orderId, supabase]);

  if (loading) return <Loading />;
  if (error || !order) return <Alert variant="error">{error ?? "OS não encontrada."}</Alert>;

  return (
    <div className="space-y-4">
      <Link
        href="/operacional/ordens-servico"
        className="proposal-toolbar text-sm text-blue-700 underline print:hidden"
      >
        ← Voltar às ordens de serviço
      </Link>
      <ServiceOrderProposalView
        order={order}
        context={{
          companyName: company?.trade_name || company?.name || "GRX Management",
          driverName,
          dreAccountName,
        }}
      />
    </div>
  );
}
