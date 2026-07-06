import type { GeoPoint, RouteDistanceResult } from "@/lib/freight-route";

export type FreightTollPlaza = {
  order: number;
  name: string;
  city?: string;
  state?: string;
  concessionaire?: string;
  amount: number;
  tagAmount?: number;
};

export type FreightRouteWithTolls = RouteDistanceResult & {
  tolls: FreightTollPlaza[];
  tollCount: number;
  tollTotal: number;
  tollTagTotal?: number;
  qualpLink?: string;
  tollSource: "qualp" | "manual";
};

const QUALP_API_URL = "https://api.qualp.com.br/rotas/v4";

const ANTT_TO_QUALP_LOAD: Record<number, string> = {
  1: "granel_solido",
  2: "granel_liquido",
  3: "frigorificada",
  4: "conteineirizada",
  5: "geral",
  6: "neogranel",
  7: "perigosa_granel_solido",
  8: "perigosa_granel_liquido",
  9: "perigosa_frigorificada",
  10: "perigosa_conteineirizada",
  11: "perigosa_geral",
  12: "perigosa_pressurizada",
};

export function mapAnttCargoToQualpLoad(cargoTypeId: number): string {
  return ANTT_TO_QUALP_LOAD[cargoTypeId] ?? "geral";
}

export function resolveQualpFreightCategory(
  composicaoVeicular: boolean,
  altoDesempenho: boolean
): string {
  if (composicaoVeicular && altoDesempenho) return "C";
  if (composicaoVeicular) return "A";
  if (altoDesempenho) return "D";
  return "B";
}

export type QualpRouteInput = {
  originAddress: string;
  destinationAddress: string;
  axles: number;
  cargoTypeId?: number;
  composicaoVeicular?: boolean;
  altoDesempenho?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickDistanceKm(data: Record<string, unknown>): number | null {
  const candidates: unknown[] = [
    data.distance_km,
    data.distanceKm,
    data.distancia_km,
    data.distanciaKm,
  ];

  const resumo = asRecord(data.resumo) ?? asRecord(data.summary) ?? asRecord(data.route_summary);
  if (resumo) {
    candidates.push(resumo.distance_km, resumo.distanceKm, resumo.distancia_km, resumo.distanciaKm);
    candidates.push(resumo.distance, resumo.distancia, resumo.total_distance);
  }

  const routes = data.routes ?? data.rotas;
  if (Array.isArray(routes) && routes[0]) {
    const route = asRecord(routes[0]);
    if (route) {
      candidates.push(route.distance_km, route.distanceKm, route.distancia_km, route.distanciaKm);
      candidates.push(route.distance, route.distancia);
      const routeSummary = asRecord(route.summary) ?? asRecord(route.resumo);
      if (routeSummary) {
        candidates.push(routeSummary.distance_km, routeSummary.distanceKm, routeSummary.distancia_km);
        candidates.push(routeSummary.distance, routeSummary.distancia);
      }
    }
  }

  for (const candidate of candidates) {
    const direct = asNumber(candidate);
    if (direct != null && direct > 0) {
      return direct > 1000 ? Math.round((direct / 1000) * 100) / 100 : Math.round(direct * 100) / 100;
    }

    const nested = asRecord(candidate);
    if (nested) {
      const value = asNumber(nested.value ?? nested.valor ?? nested.metros ?? nested.meters);
      if (value != null && value > 0) {
        return value > 1000 ? Math.round((value / 1000) * 100) / 100 : Math.round(value * 100) / 100;
      }
    }
  }

  return null;
}

function pickDurationMinutes(data: Record<string, unknown>): number | null {
  const candidates: unknown[] = [data.duration, data.duracao, data.duration_minutes, data.duracao_minutos];

  const resumo = asRecord(data.resumo) ?? asRecord(data.summary);
  if (resumo) {
    candidates.push(resumo.duration, resumo.duracao, resumo.duration_minutes, resumo.duracao_minutos);
  }

  const routes = data.routes ?? data.rotas;
  if (Array.isArray(routes) && routes[0]) {
    const route = asRecord(routes[0]);
    if (route) {
      candidates.push(route.duration, route.duracao);
      const routeSummary = asRecord(route.summary) ?? asRecord(route.resumo);
      if (routeSummary) {
        candidates.push(routeSummary.duration, routeSummary.duracao);
      }
    }
  }

  for (const candidate of candidates) {
    const direct = asNumber(candidate);
    if (direct != null && direct > 0) {
      return direct > 500 ? Math.round(direct / 60) : Math.round(direct);
    }

    const nested = asRecord(candidate);
    if (nested) {
      const value = asNumber(nested.value ?? nested.valor ?? nested.segundos ?? nested.seconds);
      if (value != null && value > 0) {
        return Math.round(value / 60);
      }
    }
  }

  return null;
}

function extractTollList(data: unknown, depth = 0): unknown[] {
  if (depth > 4) return [];
  const obj = asRecord(data);
  if (!obj) return [];

  for (const key of ["pedagios", "tolls", "pracas", "praças"]) {
    if (Array.isArray(obj[key]) && obj[key].length > 0) return obj[key] as unknown[];
  }

  const tollInfo = asRecord(obj.informacaoPedagios) ?? asRecord(obj.toll_info) ?? asRecord(obj.tolls_info);
  if (tollInfo) {
    const fromInfo = extractTollList(tollInfo, depth + 1);
    if (fromInfo.length) return fromInfo;
    const result = asRecord(tollInfo.result);
    if (result) {
      const fromResult = extractTollList(result, depth + 1);
      if (fromResult.length) return fromResult;
    }
  }

  for (const key of ["routes", "rotas", "data", "result", "results"]) {
    const nested = obj[key];
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const found = extractTollList(item, depth + 1);
        if (found.length) return found;
      }
    } else {
      const found = extractTollList(nested, depth + 1);
      if (found.length) return found;
    }
  }

  return [];
}

function parseTollItem(item: unknown, index: number): FreightTollPlaza | null {
  const obj = asRecord(item);
  if (!obj) return null;

  const amount = asNumber(obj.valor ?? obj.value ?? obj.price ?? obj.tarifa ?? obj.cash ?? obj.total) ?? 0;
  const name = String(obj.nome ?? obj.name ?? obj.praca ?? obj.plaza ?? "").trim();
  if (!name && amount <= 0) return null;

  return {
    order: asNumber(obj.ordemPassagem ?? obj.order ?? obj.ordem ?? index + 1) ?? index + 1,
    name: name || `Praça ${index + 1}`,
    city: obj.cidade != null ? String(obj.cidade) : obj.city != null ? String(obj.city) : undefined,
    state: obj.uf != null ? String(obj.uf) : obj.state != null ? String(obj.state) : undefined,
    concessionaire:
      obj.concessionaria != null
        ? String(obj.concessionaria)
        : obj.concessionaire != null
          ? String(obj.concessionaire)
          : undefined,
    amount: Math.round(amount * 100) / 100,
    tagAmount:
      obj.valorTag != null
        ? Math.round((asNumber(obj.valorTag) ?? 0) * 100) / 100
        : obj.tag_value != null
          ? Math.round((asNumber(obj.tag_value) ?? 0) * 100) / 100
          : undefined,
  };
}

function pickTollTotals(data: Record<string, unknown>, tolls: FreightTollPlaza[]) {
  const totalCandidates = [
    data.totalPedagio,
    data.total_pedagio,
    data.total_toll,
    data.toll_total,
    data.valorPedagio,
  ];

  const resumo = asRecord(data.resumo) ?? asRecord(data.summary);
  if (resumo) {
    totalCandidates.push(resumo.totalPedagio, resumo.total_pedagio, resumo.valorPedagio, resumo.toll_total);
  }

  const tollInfo = asRecord(data.informacaoPedagios);
  if (tollInfo) {
    totalCandidates.push(tollInfo.totalPedagio, tollInfo.total_pedagio);
    const result = asRecord(tollInfo.result);
    if (result) totalCandidates.push(result.totalPedagio, result.total_pedagio);
  }

  let tollTotal = 0;
  for (const candidate of totalCandidates) {
    const value = asNumber(candidate);
    if (value != null && value > 0) {
      tollTotal = Math.round(value * 100) / 100;
      break;
    }
  }
  if (tollTotal <= 0) {
    tollTotal = Math.round(tolls.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  }

  const tagCandidates = [data.totalPedagioTag, data.total_pedagio_tag, data.toll_tag_total];
  if (resumo) tagCandidates.push(resumo.totalPedagioTag, resumo.total_pedagio_tag);
  if (tollInfo) {
    tagCandidates.push(tollInfo.totalPedagioTag);
    const result = asRecord(tollInfo.result);
    if (result) tagCandidates.push(result.totalPedagioTag);
  }

  let tollTagTotal: number | undefined;
  for (const candidate of tagCandidates) {
    const value = asNumber(candidate);
    if (value != null && value > 0) {
      tollTagTotal = Math.round(value * 100) / 100;
      break;
    }
  }
  if (tollTagTotal == null && tolls.some((t) => t.tagAmount != null)) {
    tollTagTotal = Math.round(tolls.reduce((sum, item) => sum + (item.tagAmount ?? item.amount), 0) * 100) / 100;
  }

  return { tollTotal, tollTagTotal };
}

export function parseQualpRouteResponse(
  raw: unknown,
  origin: GeoPoint,
  destination: GeoPoint
): Omit<FreightRouteWithTolls, "tollSource"> {
  const root = asRecord(raw) ?? {};
  const distanceKm = pickDistanceKm(root) ?? 0;
  const durationMinutes = pickDurationMinutes(root) ?? 0;

  const tollItems = extractTollList(root)
    .map((item, index) => parseTollItem(item, index))
    .filter((item): item is FreightTollPlaza => item != null)
    .sort((a, b) => a.order - b.order);

  const { tollTotal, tollTagTotal } = pickTollTotals(root, tollItems);

  const qualpLink =
    typeof root.link_to_qualp === "string"
      ? root.link_to_qualp
      : typeof root.link_qualp === "string"
        ? root.link_qualp
        : undefined;

  return {
    distanceKm,
    durationMinutes,
    origin,
    destination,
    provider: "QualP",
    tolls: tollItems,
    tollCount: tollItems.length,
    tollTotal,
    tollTagTotal,
    qualpLink,
  };
}

function buildQualpPayload(input: QualpRouteInput) {
  const axles = String(input.axles || 5);
  const composicao = input.composicaoVeicular ?? true;
  const altoDesempenho = input.altoDesempenho ?? false;

  return {
    locations: [input.originAddress.trim(), input.destinationAddress.trim()],
    config: {
      vehicle: {
        type: "truck",
        axis: axles,
      },
      freight_table: {
        category: resolveQualpFreightCategory(composicao, altoDesempenho),
        freight_load: mapAnttCargoToQualpLoad(input.cargoTypeId ?? 5),
        axis: axles,
      },
      route: {
        calculate_return: false,
      },
      private_places: {
        max_distance_from_location_to_route: 1000,
        categories: false,
        areas: false,
        contacts: false,
        products: false,
        services: false,
      },
      router: "qualp",
    },
    show: {
      polyline: false,
      simplified_polyline: false,
      private_places: false,
      static_image: false,
      freight_table: false,
      link_to_qualp: true,
      tolls: true,
    },
    format: "json",
  };
}

async function callQualpApi(payload: Record<string, unknown>, token: string): Promise<unknown> {
  const jsonQuery = encodeURIComponent(JSON.stringify(payload));

  const getResponse = await fetch(`${QUALP_API_URL}?json=${jsonQuery}`, {
    method: "GET",
    headers: {
      "Access-Token": token,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (getResponse.ok) {
    return getResponse.json();
  }

  const getError = await getResponse.text();

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    body.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }

  const postResponse = await fetch(QUALP_API_URL, {
    method: "POST",
    headers: {
      "Access-Token": token,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!postResponse.ok) {
    throw new Error(
      getError || (await postResponse.text()) || `QualP retornou status ${postResponse.status}.`
    );
  }

  return postResponse.json();
}

export async function calculateRouteWithQualp(
  input: QualpRouteInput,
  token: string,
  origin: GeoPoint,
  destination: GeoPoint
): Promise<FreightRouteWithTolls> {
  const payload = buildQualpPayload(input);
  const raw = await callQualpApi(payload, token);

  const parsed = parseQualpRouteResponse(raw, origin, destination);
  if (!parsed.distanceKm || parsed.distanceKm < 1) {
    throw new Error("QualP não retornou a distância da rota. Verifique os endereços informados.");
  }

  return { ...parsed, tollSource: "qualp" };
}
