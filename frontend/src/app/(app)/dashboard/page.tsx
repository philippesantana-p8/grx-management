import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fase 1 — Cadastros mestres. Dashboards completos na Fase 4.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Sócios", href: "/cadastros/socios", desc: "Participação societária" },
          { title: "Veículos", href: "/cadastros/veiculos", desc: "Frota e placas" },
          { title: "Contas DRE", href: "/cadastros/contas-dre", desc: "Plano de contas" },
          { title: "Motoristas", href: "/cadastros/motoristas", desc: "Operação e agregados" },
          { title: "Clientes", href: "/cadastros/clientes", desc: "Quem gera receita" },
          { title: "Fornecedores", href: "/cadastros/fornecedores", desc: "Postos, oficinas, etc." },
        ].map((item) => (
          <a key={item.href} href={item.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader title={item.title} description={item.desc} />
              <CardBody>
                <span className="text-sm font-medium text-blue-600">Gerenciar →</span>
              </CardBody>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
