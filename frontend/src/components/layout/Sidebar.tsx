"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  {
    label: "Operacional",
    children: [
      { href: "/operacional/ordens-servico", label: "Ordens de Serviço" },
      { href: "/operacional/infracoes", label: "Infrações de Trânsito" },
    ],
  },
  {
    label: "Cadastros",
    children: [
      { href: "/cadastros/socios", label: "Sócios" },
      { href: "/cadastros/veiculos", label: "Veículos" },
      { href: "/cadastros/participacoes", label: "Participações" },
      { href: "/cadastros/contas-dre", label: "Contas DRE" },
      { href: "/cadastros/motoristas", label: "Motoristas" },
      { href: "/cadastros/clientes", label: "Clientes" },
      { href: "/cadastros/fornecedores", label: "Fornecedores" },
    ],
  },
  {
    label: "Configurações",
    children: [{ href: "/configuracoes/integracoes", label: "Integrações" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-slate-900 text-white">
      <div className="border-b border-slate-700 px-6 py-5">
        <h1 className="text-lg font-bold tracking-tight">GRX Management</h1>
        <p className="text-xs text-slate-400">PSCS Informática</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) =>
          item.href ? (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                pathname === item.href
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ) : (
            <div key={item.label} className="pt-3">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {item.label}
              </p>
              {item.children?.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm transition-colors",
                    pathname === child.href
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  {child.label}
                </Link>
              ))}
            </div>
          )
        )}
      </nav>
    </aside>
  );
}
