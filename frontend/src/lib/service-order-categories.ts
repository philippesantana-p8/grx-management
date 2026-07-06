export const SERVICE_ORDER_CATEGORY_OPTIONS = [
  {
    value: "Transporte",
    label: "Transporte",
    dreAccountName: "Receita Van",
    hint: "Passageiros / van e micro-ônibus",
  },
  {
    value: "Frete",
    label: "Frete",
    dreAccountName: "Receita Caminhão",
    hint: "Carga e caminhões",
  },
  {
    value: "Estacionamento",
    label: "Estacionamento",
    dreAccountName: "Receita Estacionamento",
    hint: "Vaga e permanência",
  },
  {
    value: "Lavagem",
    label: "Lavagem rápida",
    dreAccountName: "Receita Lava Rápido",
    hint: "Serviços de lava-rápido",
  },
  {
    value: "Outros",
    label: "Outros",
    dreAccountName: "Receita diversas",
    hint: "Demais receitas operacionais",
  },
] as const;

export type ServiceOrderCategory = (typeof SERVICE_ORDER_CATEGORY_OPTIONS)[number]["value"];

const DRE_PRIORITY: ServiceOrderCategory[] = [
  "Frete",
  "Transporte",
  "Estacionamento",
  "Lavagem",
  "Outros",
];

export function toggleServiceCategory(categories: string[], value: string): string[] {
  const set = new Set(categories);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return SERVICE_ORDER_CATEGORY_OPTIONS.map((o) => o.value).filter((v) => set.has(v));
}

export function formatServiceCategories(categories: string[]): string {
  const labels = SERVICE_ORDER_CATEGORY_OPTIONS.filter((o) => categories.includes(o.value)).map(
    (o) => o.label
  );
  return labels.join(", ");
}

export function resolveDreAccountName(categories: string[]): string | null {
  for (const key of DRE_PRIORITY) {
    if (categories.includes(key)) {
      return (
        SERVICE_ORDER_CATEGORY_OPTIONS.find((o) => o.value === key)?.dreAccountName ?? null
      );
    }
  }
  return null;
}

export function getCategoryHint(categories: string[]): string | null {
  const selected = SERVICE_ORDER_CATEGORY_OPTIONS.filter((o) => categories.includes(o.value));
  if (selected.length === 0) return null;
  return selected.map((o) => `${o.label}: ${o.hint}`).join(" · ");
}

const SERVICE_TYPE_TO_CATEGORY: Record<string, ServiceOrderCategory> = {
  Frete: "Frete",
  Transporte: "Transporte",
  Estacionamento: "Estacionamento",
  CarWash: "Lavagem",
  Outro: "Outros",
};

export function categoriesForServiceType(serviceType: string): string[] {
  const category = SERVICE_TYPE_TO_CATEGORY[serviceType];
  return category ? [category] : [];
}
