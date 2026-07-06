import type { Driver } from "@/types/database";

export type DriverAvailabilityFilter = "all" | "available" | "in_service";

export type DriverListRow = Driver & {
  active_service_order_code?: string | null;
};

export type ActiveServiceOrderByDriver = Map<string, string>;

export function buildActiveServiceOrderMap(
  rows: Array<{ driver_id: string | null; code: string }>
): ActiveServiceOrderByDriver {
  const map: ActiveServiceOrderByDriver = new Map();
  for (const row of rows) {
    if (row.driver_id) map.set(row.driver_id, row.code);
  }
  return map;
}

export function enrichDriversWithServiceOrders(
  drivers: Driver[],
  activeOrders: ActiveServiceOrderByDriver
): DriverListRow[] {
  return drivers.map((driver) => ({
    ...driver,
    active_service_order_code: activeOrders.get(driver.id) ?? null,
  }));
}

export function driverHasCategory(driver: Driver, category: string): boolean {
  if (!category) return true;
  return (driver.cnh_categories ?? []).includes(category);
}

export function isDriverInActiveServiceOrder(driver: DriverListRow): boolean {
  return Boolean(driver.active_service_order_code);
}

/** Disponível para contato e oferta de transporte. */
export function isDriverAvailableForContact(driver: DriverListRow): boolean {
  return (
    driver.status === "Ativo" &&
    driver.active_for_operations &&
    !driver.active_service_order_code
  );
}

export function matchesDriverFilters(
  driver: DriverListRow,
  filters: {
    category: string;
    availability: DriverAvailabilityFilter;
  }
): boolean {
  if (!driverHasCategory(driver, filters.category)) return false;

  if (filters.availability === "available") {
    return isDriverAvailableForContact(driver);
  }

  if (filters.availability === "in_service") {
    return isDriverInActiveServiceOrder(driver);
  }

  return true;
}
