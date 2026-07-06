export const ANTT_AXLE_OPTIONS = [2, 3, 4, 5, 6, 7, 9] as const;

export type AnttAxle = (typeof ANTT_AXLE_OPTIONS)[number];

export const ANTT_CARGO_TYPES = [
  { id: 1, label: "Granel sólido" },
  { id: 2, label: "Granel líquido" },
  { id: 3, label: "Frigorificada ou aquecida" },
  { id: 4, label: "Conteinerizada" },
  { id: 5, label: "Carga geral" },
  { id: 6, label: "Neogranel" },
  { id: 7, label: "Perigosa (granel sólido)" },
  { id: 8, label: "Perigosa (granel líquido)" },
  { id: 9, label: "Perigosa (frigorificada ou aquecida)" },
  { id: 10, label: "Perigosa (conteinerizada)" },
  { id: 11, label: "Perigosa (carga geral)" },
  { id: 12, label: "Granel pressurizada" },
] as const;

type CoefficientRow = Record<AnttAxle, { ccd: number; cc: number }>;

/** Resolução ANTT 6.076/2026 — Tabela A (composição veicular), carga geral. */
const TABLE_A_CARGA_GERAL: CoefficientRow = {
  2: { ccd: 3.6815, cc: 436.39 },
  3: { ccd: 4.7062, cc: 523.33 },
  4: { ccd: 5.3386, cc: 568.72 },
  5: { ccd: 6.1604, cc: 635.08 },
  6: { ccd: 6.7774, cc: 648.95 },
  7: { ccd: 7.4902, cc: 803.22 },
  9: { ccd: 8.5104, cc: 872.44 },
};

/** Tabela B (apenas unidade de tração), carga geral. */
const TABLE_B_CARGA_GERAL: CoefficientRow = {
  2: { ccd: 3.1044, cc: 166.6 },
  3: { ccd: 3.9493, cc: 189.11 },
  4: { ccd: 4.5189, cc: 205.98 },
  5: { ccd: 5.186, cc: 220.28 },
  6: { ccd: 5.7707, cc: 223.27 },
  7: { ccd: 6.1662, cc: 263.47 },
  9: { ccd: 7.0435, cc: 281.43 },
};

/** Tabela C (alto desempenho + composição), carga geral. */
const TABLE_C_CARGA_GERAL: CoefficientRow = {
  2: { ccd: 3.1044, cc: 166.6 },
  3: { ccd: 3.9493, cc: 189.11 },
  4: { ccd: 4.5189, cc: 205.98 },
  5: { ccd: 5.186, cc: 220.28 },
  6: { ccd: 5.7707, cc: 223.27 },
  7: { ccd: 6.1662, cc: 263.47 },
  9: { ccd: 7.0435, cc: 281.43 },
};

/** Tabela D (alto desempenho + tração), carga geral — coeficientes reduzidos. */
const TABLE_D_CARGA_GERAL: CoefficientRow = {
  2: { ccd: 2.7717, cc: 166.6 },
  3: { ccd: 3.9488, cc: 189.03 },
  4: { ccd: 4.5283, cc: 207.54 },
  5: { ccd: 5.186, cc: 220.28 },
  6: { ccd: 5.7707, cc: 223.27 },
  7: { ccd: 6.1662, cc: 263.47 },
  9: { ccd: 7.0435, cc: 281.43 },
};

export type AnttFreightInput = {
  distanceKm: number;
  cargoTypeId: number;
  axles: number;
  composicaoVeicular: boolean;
  altoDesempenho: boolean;
  retornoVazio: boolean;
};

export type AnttFreightResult = {
  pisoMinimo: number;
  parteDeslocamento: number;
  parteCargaDescarga: number;
  coefDeslocamento: number;
  coefCargaDescarga: number;
  tabela: "A" | "B" | "C" | "D";
  eixosUtilizado: AnttAxle;
  formula: string;
  fonte: string;
  aviso: string;
};

function resolveAxle(axles: number): AnttAxle | null {
  if (ANTT_AXLE_OPTIONS.includes(axles as AnttAxle)) return axles as AnttAxle;
  const sorted = [...ANTT_AXLE_OPTIONS];
  const lower = sorted.filter((a) => a <= axles).pop();
  if (lower) return lower;
  return sorted.find((a) => a >= axles) ?? null;
}

function pickTable(input: AnttFreightInput): "A" | "B" | "C" | "D" {
  if (input.altoDesempenho) return input.composicaoVeicular ? "C" : "D";
  return input.composicaoVeicular ? "A" : "B";
}

function getCoefficients(
  table: "A" | "B" | "C" | "D",
  cargoTypeId: number,
  axle: AnttAxle
): { ccd: number; cc: number } | null {
  if (cargoTypeId !== 5) return null;
  const map = {
    A: TABLE_A_CARGA_GERAL,
    B: TABLE_B_CARGA_GERAL,
    C: TABLE_C_CARGA_GERAL,
    D: TABLE_D_CARGA_GERAL,
  }[table];
  return map[axle] ?? null;
}

export function calculateAnttMinimumLocal(input: AnttFreightInput): AnttFreightResult | null {
  if (!input.distanceKm || input.distanceKm < 1) return null;

  const axle = resolveAxle(input.axles);
  if (!axle) return null;

  const table = pickTable(input);
  const coeffs = getCoefficients(table, input.cargoTypeId, axle);
  if (!coeffs) return null;

  const distanceFactor = input.retornoVazio ? 1.92 : 1;
  const parteDeslocamento = coeffs.ccd * input.distanceKm * distanceFactor;
  const parteCargaDescarga = coeffs.cc;
  const pisoMinimo = Math.round((parteDeslocamento + parteCargaDescarga) * 100) / 100;

  return {
    pisoMinimo,
    parteDeslocamento: Math.round(parteDeslocamento * 100) / 100,
    parteCargaDescarga,
    coefDeslocamento: coeffs.ccd,
    coefCargaDescarga: coeffs.cc,
    tabela: table,
    eixosUtilizado: axle,
    formula: `piso = CCD × km × ${distanceFactor} + CC`,
    fonte: "Resolução ANTT 6.076/2026 (referência local — carga geral)",
    aviso:
      "Referência legal do piso mínimo. Pedágio e tributos não estão incluídos. Para outros tipos de carga, configure CIOT_ONLINE_API_TOKEN.",
  };
}

export async function fetchAnttMinimumRemote(
  input: AnttFreightInput,
  token?: string
): Promise<AnttFreightResult | null> {
  const params = new URLSearchParams({
    distancia_km: String(Math.round(input.distanceKm)),
    tipo_carga: String(input.cargoTypeId),
    eixos: String(input.axles),
    composicao_veicular: String(input.composicaoVeicular),
    alto_desempenho: String(input.altoDesempenho),
    retorno_vazio: String(input.retornoVazio),
  });

  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`https://ciotonline.com.br/api/v1/piso-frete?${params}`, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    ok?: boolean;
    data?: {
      piso_minimo: number;
      coef_deslocamento: number;
      coef_carga_descarga: number;
      tabela: string;
      eixos_utilizado: number;
      detalhe?: {
        parte_deslocamento?: number;
        parte_carga_descarga?: number;
        formula?: string;
      };
      fonte?: string;
      aviso?: string;
    };
  };

  if (!payload.ok || !payload.data) return null;
  const data = payload.data;

  return {
    pisoMinimo: data.piso_minimo,
    parteDeslocamento: data.detalhe?.parte_deslocamento ?? 0,
    parteCargaDescarga: data.detalhe?.parte_carga_descarga ?? data.coef_carga_descarga,
    coefDeslocamento: data.coef_deslocamento,
    coefCargaDescarga: data.coef_carga_descarga,
    tabela: data.tabela as AnttFreightResult["tabela"],
    eixosUtilizado: data.eixos_utilizado as AnttAxle,
    formula: data.detalhe?.formula ?? "piso = CCD × km + CC",
    fonte: data.fonte ?? "Tabela oficial ANTT (CIOT Online)",
    aviso: data.aviso ?? "",
  };
}

export function buildFreightSuggestedTotal(
  pisoMinimo: number,
  tollAmount: number
): number {
  return Math.round((pisoMinimo + tollAmount) * 100) / 100;
}
