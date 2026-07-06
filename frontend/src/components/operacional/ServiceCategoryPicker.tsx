"use client";

import {
  formatServiceCategories,
  SERVICE_ORDER_CATEGORY_OPTIONS,
  toggleServiceCategory,
} from "@/lib/service-order-categories";

type Props = {
  categories: string[];
  onChange: (categories: string[]) => void;
  dreAccountLabel?: string | null;
};

export function ServiceCategoryPicker({ categories, onChange, dreAccountLabel }: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
      <div>
        <p className="text-sm font-medium text-slate-800">Natureza do serviço (DRE)</p>
        <p className="text-xs text-slate-500">
          Marque o que foi prestado — Transporte e Frete separados das demais opções para alimentar as contas de receita.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {SERVICE_ORDER_CATEGORY_OPTIONS.map((option) => {
          const checked = categories.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                checked
                  ? "border-blue-500 bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={checked}
                onChange={() => onChange(toggleServiceCategory(categories, option.value))}
              />
              <span>
                <span className="font-medium">{option.label}</span>
                <span className="block text-xs text-slate-500">{option.hint}</span>
              </span>
            </label>
          );
        })}
      </div>

      {categories.length > 0 && (
        <p className="text-sm text-slate-700">
          Selecionado: <strong>{formatServiceCategories(categories)}</strong>
        </p>
      )}

      {dreAccountLabel && (
        <p className="text-xs text-green-700">
          Conta DRE sugerida: <strong>{dreAccountLabel}</strong>
        </p>
      )}

      {categories.length === 0 && (
        <p className="text-xs text-amber-700">Selecione ao menos uma natureza de serviço.</p>
      )}
    </div>
  );
}
