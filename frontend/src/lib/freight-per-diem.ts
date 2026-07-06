export const PER_DIEM_DISTANCE_THRESHOLD_KM = 1000;
export const PER_DIEM_KM_PER_DAY = 500;
export const PER_DIEM_CHARGE_TO = ["Cliente", "GRX"] as const;
export type PerDiemChargeTo = (typeof PER_DIEM_CHARGE_TO)[number];

export function isPerDiemClientCharge(chargeTo: string | null | undefined): boolean {
  return (chargeTo ?? "Cliente") === "Cliente";
}

export function billablePerDiemTotal(
  total: number,
  chargeTo: string | null | undefined
): number {
  return isPerDiemClientCharge(chargeTo) ? total : 0;
}

export function perDiemChargeLabel(chargeTo: string | null | undefined): string {
  return isPerDiemClientCharge(chargeTo) ? "Cliente" : "GRX (custo interno)";
}

export type FreightPerDiemDay = {
  day: number;
  lodging: number;
  breakfast: number;
  meals: number;
  dinner: number;
  daily_allowance: number;
};

export function requiresPerDiem(distanceKm: number): boolean {
  return distanceKm >= PER_DIEM_DISTANCE_THRESHOLD_KM;
}

export function suggestTravelDays(distanceKm: number): number {
  if (!requiresPerDiem(distanceKm)) return 0;
  return Math.max(2, Math.ceil(distanceKm / PER_DIEM_KM_PER_DAY));
}

export function perDiemDayTotal(day: FreightPerDiemDay): number {
  return (
    (Number(day.lodging) || 0) +
    (Number(day.breakfast) || 0) +
    (Number(day.meals) || 0) +
    (Number(day.dinner) || 0) +
    (Number(day.daily_allowance) || 0)
  );
}

export function perDiemGrandTotal(days: FreightPerDiemDay[]): number {
  return Math.round(days.reduce((sum, day) => sum + perDiemDayTotal(day), 0) * 100) / 100;
}

export function buildPerDiemDays(
  count: number,
  existing?: FreightPerDiemDay[] | null
): FreightPerDiemDay[] {
  const byDay = new Map((existing ?? []).map((day) => [day.day, day]));
  return Array.from({ length: count }, (_, index) => {
    const dayNumber = index + 1;
    const current = byDay.get(dayNumber);
    return (
      current ?? {
        day: dayNumber,
        lodging: 0,
        breakfast: 0,
        meals: 0,
        dinner: 0,
        daily_allowance: 0,
      }
    );
  });
}

export function applyDefaultRatesToDays(
  days: FreightPerDiemDay[],
  defaults: {
    lodging: number;
    breakfast: number;
    meals: number;
    dinner: number;
    daily_allowance: number;
  }
): FreightPerDiemDay[] {
  return days.map((day) => ({
    ...day,
    lodging: defaults.lodging,
    breakfast: defaults.breakfast,
    meals: defaults.meals,
    dinner: defaults.dinner,
    daily_allowance: defaults.daily_allowance,
  }));
}

export function normalizePerDiemDetail(value: unknown): FreightPerDiemDay[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const item = row as Partial<FreightPerDiemDay>;
      return {
        day: Number(item.day) || 0,
        lodging: Number(item.lodging) || 0,
        breakfast: Number(item.breakfast) || 0,
        meals: Number(item.meals) || 0,
        dinner: Number(item.dinner) || 0,
        daily_allowance: Number(item.daily_allowance) || 0,
      };
    })
    .filter((day) => day.day > 0)
    .sort((a, b) => a.day - b.day);
}
