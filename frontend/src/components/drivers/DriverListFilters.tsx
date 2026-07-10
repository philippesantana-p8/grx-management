"use client";

import { CNH_CATEGORIES } from "@/lib/cnh";
import type { DriverAvailabilityFilter } from "@/lib/driver-filters";
import { glassField, glassFilterPanel } from "@/lib/liquid-glass-styles";

type Props = {
  category: string;
  availability: DriverAvailabilityFilter;
  totalCount: number;
  visibleCount: number;
  onCategoryChange: (value: string) => void;
  onAvailabilityChange: (value: DriverAvailabilityFilter) => void;
};

export function DriverListFilters({
  category,
  availability,
  totalCount,
  visibleCount,
  onCategoryChange,
  onAvailabilityChange,
}: Props) {
  return (
    <div className={`flex flex-wrap items-end gap-4 ${glassFilterPanel()}`}>
      <label className="block min-w-[160px] space-y-1">
        <span className="text-sm font-medium text-slate-700">Categoria CNH</span>
        <select
          className={glassField()}
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">Todas</option>
          {CNH_CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block min-w-[220px] space-y-1">
        <span className="text-sm font-medium text-slate-700">Disponibilidade</span>
        <select
          className={glassField()}
          value={availability}
          onChange={(e) => onAvailabilityChange(e.target.value as DriverAvailabilityFilter)}
        >
          <option value="all">Todos</option>
          <option value="available">Disponíveis para contato</option>
          <option value="in_service">Em ordem de serviço</option>
        </select>
      </label>

      <p className="pb-2 text-sm text-slate-500">
        Exibindo {visibleCount} de {totalCount} motorista(s)
      </p>
    </div>
  );
}
