import {
  formatGeocodeHint,
  geocodeBrazilAddress,
  type GeoPoint,
  type GeocodeResult,
} from "@/lib/freight-geocode";

export type { GeoPoint } from "@/lib/freight-geocode";

export type RouteDistanceResult = {
  distanceKm: number;
  durationMinutes: number;
  origin: GeoPoint;
  destination: GeoPoint;
  provider: string;
  geocodeWarnings?: string[];
};

async function routeOsrm(origin: GeoPoint, destination: GeoPoint): Promise<RouteDistanceResult | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    routes?: Array<{ distance: number; duration: number }>;
  };

  const route = data.routes?.[0];
  if (!route) return null;

  return {
    distanceKm: Math.round((route.distance / 1000) * 100) / 100,
    durationMinutes: Math.round(route.duration / 60),
    origin,
    destination,
    provider: "OSRM / OpenStreetMap",
  };
}

function buildGeocodeError(label: "A" | "B", address: string): string {
  return `Não foi possível localizar o ponto ${label}. Tente: rua, cidade e UF (ex.: Rua X, Itapecerica da Serra, SP). CEP não é obrigatório. Valor informado: "${address}".`;
}

export async function calculateRouteDistance(
  originAddress: string,
  destinationAddress: string
): Promise<RouteDistanceResult> {
  const originResult = await geocodeBrazilAddress(originAddress);
  const destinationResult = await geocodeBrazilAddress(destinationAddress);

  if (!originResult) {
    throw new Error(buildGeocodeError("A", originAddress));
  }
  if (!destinationResult) {
    throw new Error(buildGeocodeError("B", destinationAddress));
  }

  const origin = toGeoPoint(originResult);
  const destination = toGeoPoint(destinationResult);

  const routed = await routeOsrm(origin, destination);
  if (!routed) {
    throw new Error("Não foi possível calcular a rota entre os pontos informados.");
  }

  const warnings = [
    formatGeocodeHint("A", originResult),
    formatGeocodeHint("B", destinationResult),
  ].filter((item): item is string => Boolean(item));

  return warnings.length ? { ...routed, geocodeWarnings: warnings } : routed;
}

function toGeoPoint(result: GeocodeResult): GeoPoint {
  return {
    lat: result.lat,
    lon: result.lon,
    label: result.label,
  };
}
