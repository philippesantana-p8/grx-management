"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { glassTabLink, glassTabsNav } from "@/lib/liquid-glass-styles";

const TABS = [
  { href: "/cadastros/motoristas", label: "Cadastro", exact: true },
  { href: "/cadastros/motoristas/pagamentos", label: "Acompanhamento de pagamentos", exact: false },
] as const;

export function MotoristasSubNav() {
  const pathname = usePathname();

  return (
    <nav className={glassTabsNav()}>
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={glassTabLink(active)}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
