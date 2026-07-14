/**
 * Campos do formulário/voucher da OS conforme o tipo de operação.
 * Passageiros e traslado (voo) só em Transporte — nunca em Frete,
 * Estacionamento, Lava-rápido ou Outro.
 * Rota / frete ANTT: Frete e Transporte.
 */

function normalizeServiceType(serviceType: string): string {
  return String(serviceType ?? "").trim();
}

/** Passageiros só quando o tipo de operação é Transporte. */
export function serviceOrderShowsPassengers(
  serviceType: string,
  categories?: string[] | null
): boolean {
  const type = normalizeServiceType(serviceType);
  if (type !== "Transporte") return false;
  // Se a natureza DRE foi marcada sem Transporte (ex.: só Frete), também esconde.
  if (Array.isArray(categories) && categories.length > 0 && !categories.includes("Transporte")) {
    return false;
  }
  return true;
}

export function serviceOrderShowsFlightData(
  serviceType: string,
  categories?: string[] | null
): boolean {
  return serviceOrderShowsPassengers(serviceType, categories);
}

export function serviceOrderShowsRoutePanel(serviceType: string): boolean {
  const type = normalizeServiceType(serviceType);
  return type === "Frete" || type === "Transporte";
}

/** Foto do motorista no voucher: Transporte e Frete. */
export function serviceOrderShowsDriverPhoto(serviceType: string): boolean {
  const type = normalizeServiceType(serviceType);
  return type === "Frete" || type === "Transporte";
}
