/** Constantes e helpers do módulo Estacionamento / Lava-rápido. */

export const PATIO_MODALITIES = ["Estacionamento", "Lava Rápido"] as const;
export type PatioModality = (typeof PATIO_MODALITIES)[number];

export const PATIO_BILLING_UNITS = ["Diária", "Mensal", "Serviço", "Hora"] as const;
export type PatioBillingUnit = (typeof PATIO_BILLING_UNITS)[number];

export const PARKING_BILLING_MODES = ["Diária", "Mensal"] as const;
export type ParkingBillingMode = (typeof PARKING_BILLING_MODES)[number];

export const PARKING_STATUSES = ["Aberto", "Finalizado", "Cancelado"] as const;
export const CAR_WASH_STATUSES = ["Aberto", "Concluido", "Cancelado"] as const;

export const CAR_WASH_SERVICE_NAMES = [
  "Lavagem Simples",
  "Lavagem Completa",
  "Lavagem Técnica",
  "Higienização Interna",
  "Polimento",
] as const;

export const PARKING_SERVICE_NAMES = {
  diaria: "Diária Estacionamento",
  mensal: "Mensalidade Estacionamento",
} as const;

export const PATIO_PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão", "Faturado", "Outros"] as const;

export const PATIO_ENTRY_SOURCE_PARKING = "parking";
export const PATIO_ENTRY_SOURCE_WASH = "car_wash";

export type PatioVehicleType = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  usage_category: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
};

export type PatioPriceRow = {
  id: string;
  company_id: string;
  code: string;
  modality: PatioModality | string;
  vehicle_type_id: string;
  service_name: string;
  price: number;
  billing_unit: PatioBillingUnit | string;
  valid_from: string;
  valid_until: string | null;
  status: string;
  notes: string | null;
  vehicle_type_name?: string;
};

export type ParkingEntryRow = {
  id: string;
  company_id: string;
  code: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  vehicle_type: string | null;
  vehicle_type_id: string | null;
  client_name: string | null;
  phone: string | null;
  entry_date: string;
  entry_time: string | null;
  exit_date: string | null;
  exit_time: string | null;
  daily_count: number | null;
  daily_rate: number | null;
  total_amount: number | null;
  billing_mode: ParkingBillingMode | string | null;
  status: string;
  notes: string | null;
  financial_transaction_id: string | null;
};

export type CarWashServiceRow = {
  id: string;
  company_id: string;
  code: string;
  service_date: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  vehicle_type: string | null;
  vehicle_type_id: string | null;
  client_name: string | null;
  phone: string | null;
  service_name: string;
  service_amount: number | null;
  status: string;
  entry_date: string | null;
  entry_time: string | null;
  exit_date: string | null;
  exit_time: string | null;
  attendant: string | null;
  payment_method: string | null;
  notes: string | null;
  financial_transaction_id: string | null;
};

/** RN-082: mínimo 1 diária. */
export function calcParkingDailyCount(entryDate: string, exitDate: string): number {
  const a = new Date(`${entryDate}T00:00:00`);
  const b = new Date(`${exitDate}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 1;
  const days = Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1;
  return Math.max(1, days);
}

export function allowsWash(usageCategory: string): boolean {
  return usageCategory === "Estacionamento/Lava Rápido" || usageCategory === "Lava Rápido";
}

export function allowsParking(usageCategory: string): boolean {
  return (
    usageCategory === "Estacionamento/Lava Rápido" || usageCategory === "Estacionamento"
  );
}
