"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { IntegrationModule, IntegrationStatus } from "@/lib/integrations";

type ModuleWithStatus = IntegrationModule & {
  status: IntegrationStatus;
  configured: boolean;
};

type StatusPayload = {
  plan: string;
  planLabel: string;
  modules: ModuleWithStatus[];
  setupHint: string;
};

function statusBadge(status: IntegrationStatus) {
  switch (status) {
    case "active":
      return (
        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          Ativo
        </span>
      );
    case "inactive":
      return (
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          Disponível — aguardando configuração
        </span>
      );
    default:
      return (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          Opcional
        </span>
      );
  }
}

function tierLabel(tier: IntegrationModule["tier"]) {
  if (tier === "free") return "Gratuito";
  if (tier === "paid") return "Plano pago";
  return "Opcional";
}

export default function IntegracoesPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/integrations/status");
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Erro ao carregar integrações.");
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar integrações.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integrações</h1>
        <p className="mt-1 text-sm text-slate-500">
          Módulos do sistema — modo gratuito por padrão. Ative planos pagos conforme a demanda.
        </p>
      </div>

      {loading && <p className="text-sm text-slate-500">Carregando status...</p>}
      {error && <Alert variant="error">{error}</Alert>}

      {data && (
        <>
          <Card>
            <CardHeader
              title={`Plano atual: ${data.planLabel}`}
              description="O frete e o transporte funcionam no modo gratuito: distância, piso ANTT local e pedágio informado manualmente."
            />
            <CardBody className="space-y-3 text-sm text-slate-700">
              <p>
                Quando o volume de rotas crescer, contrate o <strong>QualP Pro</strong> e configure o
                token no servidor — os pedágios passam a ser calculados automaticamente nas Ordens de
                Serviço, sem alterar o fluxo do Rafael.
              </p>
              <p className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-900">
                {data.setupHint}
              </p>
            </CardBody>
          </Card>

          <div className="space-y-4">
            {data.modules.map((module) => (
              <Card key={module.id}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">{module.name}</h2>
                      <p className="mt-1 text-sm text-slate-600">{module.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {tierLabel(module.tier)}
                      </span>
                      {statusBadge(module.status)}
                    </div>
                  </div>

                  <ul className="list-inside list-disc text-sm text-slate-600">
                    {module.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>

                  {module.envVar && (
                    <p className="text-xs text-slate-500">
                      Variável de ambiente: <code className="rounded bg-slate-100 px-1">{module.envVar}</code>
                      {module.configured ? " — configurada" : " — não configurada"}
                    </p>
                  )}

                  {module.pricingHint && (
                    <p className="text-xs text-amber-800">{module.pricingHint}</p>
                  )}

                  {module.id === "qualp-tolls" && module.status === "inactive" && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      {module.upgradeUrl && (
                        <a
                          href={module.upgradeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-brand-700 underline"
                        >
                          Contratar QualP Pro →
                        </a>
                      )}
                      {module.contactEmail && (
                        <span className="text-xs text-slate-500">{module.contactEmail}</span>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            Ordens de Serviço (Frete / Transporte):{" "}
            <Link href="/operacional/ordens-servico" className="text-brand-700 underline">
              abrir tela
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
