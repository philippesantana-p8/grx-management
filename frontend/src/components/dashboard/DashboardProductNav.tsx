"use client";

import { glassTabLink, glassTabsNav } from "@/lib/liquid-glass-styles";

export type DashboardProductTab =
  | "geral"
  | "frete"
  | "estacionamento"
  | "lava";

const TABS: { id: DashboardProductTab; label: string; hint: string }[] = [
  { id: "geral", label: "Geral", hint: "Participação dos produtos" },
  { id: "frete", label: "Frete / Transporte", hint: "Frota" },
  { id: "estacionamento", label: "Estacionamento", hint: "Pátio" },
  { id: "lava", label: "Lava-rápido", hint: "Lavagem" },
];

type Props = {
  value: DashboardProductTab;
  onChange: (tab: DashboardProductTab) => void;
};

/** Navegação por produto (subpastas do Dashboard) — Liquid Glass. */
export function DashboardProductNav({ value, onChange }: Props) {
  return (
    <nav aria-label="Produtos do dashboard" className={glassTabsNav()}>
      {TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={glassTabLink(active)}
          >
            <span className="flex flex-col items-start text-left">
              <span className="text-sm font-semibold leading-tight">{tab.label}</span>
              <span className="text-[11px] font-normal opacity-80">{tab.hint}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
