"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { glassTabLink, glassTabsNav } from "@/lib/liquid-glass-styles";

const TABS = [
  { href: "/operacional/ordens-servico", label: "Transporte e frete" },
  { href: "/operacional/estacionamento", label: "Estacionamento" },
  { href: "/operacional/lava-rapido", label: "Lava-rápido" },
  { href: "/operacional/agenda-veiculos", label: "Agenda da frota" },
  { href: "/operacional/infracoes", label: "Infrações" },
] as const;

export function OperacionalSubNav() {
  const pathname = usePathname();

  return (
    <nav className={glassTabsNav()}>
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} className={glassTabLink(active)}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
