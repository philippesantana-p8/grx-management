/** Referência orientativa para transporte de passageiros em van (ANTT não se aplica). */
export type VanTransportReferenceRow = {
  id: string;
  profile: string;
  ratePerKm: number;
  hint: string;
};

export const VAN_TRANSPORT_REFERENCE_TABLE: VanTransportReferenceRow[] = [
  {
    id: "economico",
    profile: "Econômico",
    ratePerKm: 2.5,
    hint: "Rotas curtas, alta ocupação ou retorno garantido",
  },
  {
    id: "padrao",
    profile: "Padrão GRX",
    ratePerKm: 3.2,
    hint: "Fretamento típico — referência equilibrada para negociação",
  },
  {
    id: "premium",
    profile: "Premium",
    ratePerKm: 4.0,
    hint: "Viagens longas, conforto ou urgência",
  },
];

export const VAN_TRANSPORT_KM_RATE_OPTIONS = VAN_TRANSPORT_REFERENCE_TABLE.map((row) => ({
  value: row.ratePerKm,
  label: `${row.profile} — R$ ${row.ratePerKm.toFixed(2).replace(".", ",")}/km`,
}));

export const DEFAULT_VAN_KM_RATE = 3.2;

export function isTruckCategory(category: string | null | undefined): boolean {
  return category === "Caminhao";
}

export function parseKmRate(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveVanKmRate(value: unknown): number {
  return parseKmRate(value) ?? DEFAULT_VAN_KM_RATE;
}

export function estimateVanTransportReference(
  distanceKm: number,
  ratePerKm = DEFAULT_VAN_KM_RATE
): number {
  if (!distanceKm || distanceKm <= 0) return 0;
  return Math.round(distanceKm * ratePerKm * 100) / 100;
}

export function formatKmRate(rate: number): string {
  return `R$ ${rate.toFixed(2).replace(".", ",")}/km`;
}

export function resolveQualpAxlesForTolls(
  vehicleCategory: string | null | undefined,
  configuredAxles?: number | null
): number {
  if (isTruckCategory(vehicleCategory) && configuredAxles) {
    return configuredAxles;
  }
  return 2;
}
