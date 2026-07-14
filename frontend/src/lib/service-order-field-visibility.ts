/**
 * Campos do formulário/voucher da OS conforme o tipo de operação.
 * Passageiros e traslado (voo) só fazem sentido em Transporte.
 * Rota / frete ANTT: Frete e Transporte.
 */

export function serviceOrderShowsPassengers(serviceType: string): boolean {
  return serviceType === "Transporte";
}

export function serviceOrderShowsFlightData(serviceType: string): boolean {
  return serviceType === "Transporte";
}

export function serviceOrderShowsRoutePanel(serviceType: string): boolean {
  return serviceType === "Frete" || serviceType === "Transporte";
}
