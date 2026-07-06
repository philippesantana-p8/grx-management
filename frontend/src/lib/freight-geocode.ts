import { normalizeText } from "@/lib/utils";

export type GeoPoint = {
  lat: number;
  lon: number;
  label: string;
};

export type GeocodePrecision = "exact" | "approximate";

export type GeocodeResult = GeoPoint & {
  precision: GeocodePrecision;
  queryUsed: string;
};

const UF_BY_NAME: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

const UF_NAMES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

type ParsedAddress = {
  street?: string;
  neighborhood?: string;
  city?: string;
  stateUf?: string;
  stateName?: string;
};

function cleanPart(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function resolveStateToken(token: string): { uf?: string; name?: string } | null {
  const trimmed = cleanPart(token);
  if (!trimmed) return null;

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const uf = trimmed.toUpperCase();
    return UF_NAMES[uf] ? { uf, name: UF_NAMES[uf] } : null;
  }

  const key = normalizeText(trimmed);
  const uf = UF_BY_NAME[key];
  if (uf) return { uf, name: UF_NAMES[uf] };

  const byName = Object.entries(UF_NAMES).find(([_, name]) => normalizeText(name) === key);
  if (byName) return { uf: byName[0], name: byName[1] };

  return null;
}

function looksLikeStreet(value: string): boolean {
  const lower = normalizeText(value);
  return /^(rua|av|avenida|rod|rodovia|estrada|travessa|alameda|praca|praça|via|br|sp|mg|rj)/.test(lower)
    || /\d/.test(value);
}

export function parseBrazilAddress(address: string): ParsedAddress {
  const parts = address.split(",").map(cleanPart).filter(Boolean);
  if (parts.length === 0) return {};

  const parsed: ParsedAddress = {};
  const remaining = [...parts];

  const lastState = resolveStateToken(remaining[remaining.length - 1] ?? "");
  if (lastState) {
    parsed.stateUf = lastState.uf;
    parsed.stateName = lastState.name;
    remaining.pop();
  }

  if (remaining.length === 0) return parsed;

  if (remaining.length === 1) {
    const only = remaining[0]!;
    if (looksLikeStreet(only)) parsed.street = only;
    else parsed.city = only;
    return parsed;
  }

  const first = remaining[0]!;
  const last = remaining[remaining.length - 1]!;

  if (looksLikeStreet(first)) {
    parsed.street = first;
    if (remaining.length === 2) {
      parsed.city = last;
    } else {
      parsed.neighborhood = remaining[1];
      parsed.city = last;
    }
    return parsed;
  }

  if (remaining.length >= 2) {
    parsed.city = remaining[0];
    parsed.neighborhood = remaining.slice(1).join(", ");
    return parsed;
  }

  parsed.city = first;
  return parsed;
}

function buildGeocodeQueries(address: string): string[] {
  const parsed = parseBrazilAddress(address);
  const queries: string[] = [];
  const trimmed = cleanPart(address);

  if (parsed.street && parsed.city) {
    const cityState = [parsed.city, parsed.stateUf ?? parsed.stateName].filter(Boolean).join(", ");
    queries.push(`${parsed.street}, ${cityState}, Brasil`);
    queries.push(`${parsed.street}, ${parsed.city}, Brasil`);
  }

  if (parsed.city) {
    const cityState = [parsed.city, parsed.stateUf ?? parsed.stateName].filter(Boolean).join(", ");
    queries.push(`${cityState}, Brasil`);
    if (parsed.neighborhood) {
      queries.push(`${parsed.neighborhood}, ${cityState}, Brasil`);
    }
  }

  queries.push(`${trimmed}, Brasil`);
  queries.push(trimmed);

  if (parsed.stateUf) queries.push(`${trimmed}, ${parsed.stateUf}, Brasil`);
  if (parsed.stateName) queries.push(`${trimmed}, ${parsed.stateName}, Brasil`);

  return [...new Set(queries.filter(Boolean))];
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function geocodeNominatimQuery(query: string): Promise<GeoPoint | null> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    countrycodes: "br",
    addressdetails: "1",
  });

  const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": "GRX-Management/1.0 (freight-calculator)",
      "Accept-Language": "pt-BR",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const results = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const hit = results[0];
  if (!hit) return null;

  return {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    label: hit.display_name,
  };
}

async function geocodeNominatimStructured(parsed: ParsedAddress): Promise<GeoPoint | null> {
  if (!parsed.city && !parsed.street) return null;

  const params = new URLSearchParams({
    format: "json",
    limit: "1",
    countrycodes: "br",
    addressdetails: "1",
    country: "Brasil",
  });

  if (parsed.street) params.set("street", parsed.street);
  if (parsed.city) params.set("city", parsed.city);
  if (parsed.stateName) params.set("state", parsed.stateName);

  const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": "GRX-Management/1.0 (freight-calculator)",
      "Accept-Language": "pt-BR",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const results = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const hit = results[0];
  if (!hit) return null;

  return {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    label: hit.display_name,
  };
}

async function geocodePhoton(query: string): Promise<GeoPoint | null> {
  const params = new URLSearchParams({
    q: query,
    limit: "1",
    lang: "en",
  });

  const response = await fetchWithTimeout(`https://photon.komoot.io/api/?${params}`, { cache: "no-store" });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    features?: Array<{
      geometry: { coordinates: [number, number] };
      properties: Record<string, string | undefined>;
    }>;
  };

  const feature = data.features?.[0];
  if (!feature) return null;

  const props = feature.properties;
  const label = [props.name, props.street, props.city, props.state, props.country]
    .filter(Boolean)
    .join(", ");

  return {
    lon: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
    label: label || query,
  };
}

export async function geocodeBrazilAddress(address: string): Promise<GeocodeResult | null> {
  const parsed = parseBrazilAddress(address);
  const queries = buildGeocodeQueries(address);
  const cityOnlyQueries = new Set<string>();

  if (parsed.city) {
    cityOnlyQueries.add(`${parsed.city}, Brasil`);
    const cityState = [parsed.city, parsed.stateUf ?? parsed.stateName].filter(Boolean).join(", ");
    cityOnlyQueries.add(`${cityState}, Brasil`);
    if (parsed.neighborhood) {
      cityOnlyQueries.add(`${parsed.neighborhood}, ${cityState}, Brasil`);
    }
  }

  const nominatimLimit = parsed.street ? 3 : 4;

  for (const [index, query] of queries.entries()) {
    if (index >= nominatimLimit) break;
    const hit = await geocodeNominatimQuery(query);
    if (hit) {
      return {
        ...hit,
        precision: parsed.street && cityOnlyQueries.has(query) ? "approximate" : "exact",
        queryUsed: query,
      };
    }
    if (index < nominatimLimit - 1) await sleep(200);
  }

  const structured = await geocodeNominatimStructured(parsed);
  if (structured) {
    return { ...structured, precision: parsed.street ? "approximate" : "exact", queryUsed: "structured" };
  }

  for (const query of queries.slice(0, 2)) {
    const hit = await geocodePhoton(query);
    if (hit) {
      return {
        ...hit,
        precision: parsed.street && cityOnlyQueries.has(query) ? "approximate" : "exact",
        queryUsed: query,
      };
    }
  }

  if (parsed.city) {
    const cityQueries = [
      `${parsed.city}, ${parsed.stateUf ?? parsed.stateName ?? ""}, Brasil`.replace(", ,", ","),
      `${parsed.city}, Brasil`,
    ];
    for (const query of cityQueries) {
      const hit = (await geocodeNominatimQuery(query)) ?? (await geocodePhoton(query));
      if (hit) {
        return {
          ...hit,
          precision: "approximate",
          queryUsed: query,
        };
      }
      await sleep(200);
    }
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatGeocodeHint(pointLabel: "A" | "B", result: GeocodeResult): string | null {
  if (result.precision === "exact") return null;
  return `Ponto ${pointLabel}: localização aproximada (${result.label}). A rua informada não foi encontrada — a rota usa a cidade/bairro.`;
}
