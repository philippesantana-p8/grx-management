"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ServiceOrderProposalView } from "@/components/operacional/ServiceOrderProposalView";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Alert, Loading } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { fetchPublicProposal, respondToProposal } from "@/lib/service-order-proposal-api";
import { formatServiceDate, resolveProposalAmount } from "@/lib/service-order-proposal";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { PROPOSAL_RESPONSE_LABELS, type ServiceOrder } from "@/types/database";

type Props = {
  token: string;
};

export function PublicProposalClient({ token }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [companyName, setCompanyName] = useState("GRX Transportes e Logística");
  const [driverName, setDriverName] = useState<string | null>(null);
  const [proposalResponse, setProposalResponse] = useState<"pending" | "accepted" | "rejected">(
    "pending"
  );
  const [canRespond, setCanRespond] = useState(false);
  const [responding, setResponding] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchPublicProposal(supabase, token);

    if (fetchError) {
      setError(fetchError);
      setLoading(false);
      return;
    }

    if (!data?.found || !data.order) {
      setError("Proposta não encontrada ou link inválido.");
      setLoading(false);
      return;
    }

    setOrder(data.order as ServiceOrder);
    setCompanyName(data.company_name ?? "GRX Transportes e Logística");
    setDriverName(data.driver_name ?? null);
    setProposalResponse(data.proposal_response ?? "pending");
    setCanRespond(Boolean(data.can_respond));
    setLoading(false);
  }, [supabase, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRespond = async (action: "accept" | "reject") => {
    const label = action === "accept" ? "aceitar" : "recusar";
    if (!window.confirm(`Confirma ${label} esta proposta?`)) return;

    setResponding(true);
    const { proposalResponse: next, status, error: respondError } = await respondToProposal(
      supabase,
      token,
      action
    );
    setResponding(false);

    if (respondError) {
      window.alert(respondError);
      return;
    }

    setProposalResponse(next ?? (action === "accept" ? "accepted" : "rejected"));
    setCanRespond(false);
    if (order && status) {
      setOrder({ ...order, status });
    }
  };

  if (loading) return <Loading />;
  if (error || !order) return <Alert variant="error">{error ?? "Proposta indisponível."}</Alert>;

  const amount = resolveProposalAmount(order);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex justify-center">
          <BrandLogo variant="plaque3d" plaqueSurface="page" size="md" performanceLite />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            Proposta de ordem de serviço
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">OS {order.code}</h1>
          <p className="mt-1 text-sm text-slate-600">{companyName}</p>

          <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            {order.client_name && (
              <p>
                <span className="font-medium text-slate-900">Cliente:</span> {order.client_name}
              </p>
            )}
            <p>
              <span className="font-medium text-slate-900">Data:</span>{" "}
              {formatServiceDate(order.service_date)}
            </p>
            <p>
              <span className="font-medium text-slate-900">Placa:</span> {order.plate}
            </p>
            {(order.freight_origin_address || order.freight_destination_address) && (
              <p>
                <span className="font-medium text-slate-900">Rota:</span>{" "}
                {order.freight_origin_address ?? "—"} → {order.freight_destination_address ?? "—"}
              </p>
            )}
            {amount != null && (
              <p className="text-base font-semibold text-brand-700">
                Valor proposto: {formatCurrency(amount)}
              </p>
            )}
          </div>

          {canRespond && (
            <div className="mt-6 space-y-4 rounded-lg border-2 border-brand-200 bg-brand-50 p-5">
              <p className="text-sm font-medium text-slate-800">
                Por favor, confirme se você aceita ou recusa esta proposta:
              </p>
              <div className="flex flex-wrap gap-3">
                <Button type="button" disabled={responding} onClick={() => void handleRespond("accept")}>
                  Aceitar proposta
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={responding}
                  onClick={() => void handleRespond("reject")}
                >
                  Recusar proposta
                </Button>
              </div>
            </div>
          )}

          {proposalResponse !== "pending" && (
            <div
              className={`mt-6 rounded-lg px-4 py-3 text-sm ${
                proposalResponse === "accepted"
                  ? "bg-green-50 text-green-900"
                  : "bg-slate-100 text-slate-800"
              }`}
            >
              <p className="font-medium">{PROPOSAL_RESPONSE_LABELS[proposalResponse]}</p>
              <p className="mt-1">
                {proposalResponse === "accepted"
                  ? "Sua resposta já foi registrada. A equipe GRX dará continuidade e poderá designar o motorista."
                  : "Sua resposta já foi registrada. Nossa equipe entrará em contato para uma nova negociação."}
              </p>
              <p className="mt-2 text-xs opacity-80">
                Os botões Aceitar / Recusar só aparecem enquanto a proposta estiver aguardando sua
                resposta.
              </p>
            </div>
          )}

          {!canRespond && proposalResponse === "pending" && (
            <Alert variant="warning">
              Esta proposta ainda não foi liberada para resposta. Aguarde o envio formal pela GRX.
            </Alert>
          )}
        </div>

        <div className="text-center">
          <button
            type="button"
            className="text-sm font-medium text-brand-700 underline"
            onClick={() => setShowDetails((value) => !value)}
          >
            {showDetails ? "Ocultar detalhes completos" : "Ver proposta completa (PDF)"}
          </button>
        </div>

        {showDetails && (
          <ServiceOrderProposalView
            variant="public"
            order={order}
            context={{ companyName, driverName }}
            proposalResponse={proposalResponse}
          />
        )}
      </div>
    </div>
  );
}
