import {
  fromDbPercent,
  getOwnershipDbSchema,
  ownershipOrderColumn,
} from "@/lib/vehicle-ownership-db";
import { createClient } from "@/lib/supabase/client";

type AppSupabase = ReturnType<typeof createClient>;

export type OsRateioPartnerShare = {
  partnerId: string;
  partnerName: string;
  ownershipPct: number;
  revenueShare: number;
  expenseShare: number;
  resultShare: number;
};

export type OsRateioRow = {
  serviceOrderId: string;
  code: string;
  serviceDate: string;
  plate: string;
  vehicleId: string | null;
  clientName: string | null;
  serviceType: string;
  status: string;
  revenue: number;
  expense: number;
  result: number;
  ownershipTotalPct: number;
  shares: OsRateioPartnerShare[];
  warnings: string[];
};

export type OsRateioPartnerTotal = {
  partnerId: string;
  partnerName: string;
  revenueShare: number;
  expenseShare: number;
  resultShare: number;
  osCount: number;
};

export type OsRateioSnapshot = {
  rows: OsRateioRow[];
  partnerTotals: OsRateioPartnerTotal[];
  summary: {
    osCount: number;
    totalRevenue: number;
    totalExpense: number;
    totalResult: number;
  };
  error: string | null;
};

function monthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 1);
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

function resolveOsRevenue(order: {
  freight_agreed_amount?: number | null;
  service_amount?: number | null;
}): number {
  const agreed = Number(order.freight_agreed_amount);
  const service = Number(order.service_amount);
  const value = Number.isFinite(agreed) && agreed > 0 ? agreed : service;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function ownershipActiveOnDate(
  row: { start: string; end: string | null },
  serviceDate: string
): boolean {
  if (row.start && row.start > serviceDate) return false;
  if (row.end && row.end < serviceDate) return false;
  return true;
}

export async function fetchOsRateio(
  supabase: AppSupabase,
  companyId: string,
  options: {
    year: number;
    month: number;
    vehicleId?: string;
    partnerId?: string;
  }
): Promise<OsRateioSnapshot> {
  const empty: OsRateioSnapshot = {
    rows: [],
    partnerTotals: [],
    summary: { osCount: 0, totalRevenue: 0, totalExpense: 0, totalResult: 0 },
    error: null,
  };

  try {
    const { start, end } = monthBounds(options.year, options.month);
    const schema = await getOwnershipDbSchema(supabase);
    const dateCol = ownershipOrderColumn(schema);

    let ordersQuery = supabase
      .from("service_orders")
      .select(
        "id, code, service_date, plate, vehicle_id, client_name, service_type, status, service_amount, freight_agreed_amount"
      )
      .eq("company_id", companyId)
      .gte("service_date", start)
      .lt("service_date", end)
      .neq("status", "Cancelado")
      .in("service_type", ["Frete", "Transporte"])
      .order("service_date", { ascending: false })
      .order("code", { ascending: false });

    if (options.vehicleId) {
      ordersQuery = ordersQuery.eq("vehicle_id", options.vehicleId);
    }

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) return { ...empty, error: ordersError.message };

    if (!orders?.length) return empty;

    const orderIds = orders.map((o) => o.id as string);
    const vehicleIds = [
      ...new Set(orders.map((o) => o.vehicle_id as string | null).filter(Boolean) as string[]),
    ];

    const expenseByOrder = new Map<string, number>();
    if (orderIds.length) {
      const { data: txs, error: txError } = await supabase
        .from("financial_transactions")
        .select("service_order_id, amount, transaction_type")
        .eq("company_id", companyId)
        .eq("transaction_type", "Despesa")
        .in("service_order_id", orderIds);

      if (txError) {
        // Continua sem despesas se a query falhar (ex.: coluna ausente em ambiente antigo)
        console.warn("rateio-os despesas:", txError.message);
      } else {
        for (const tx of txs ?? []) {
          const orderId = tx.service_order_id as string | null;
          if (!orderId) continue;
          const amount = Number(tx.amount);
          if (!Number.isFinite(amount) || amount <= 0) continue;
          expenseByOrder.set(orderId, (expenseByOrder.get(orderId) ?? 0) + amount);
        }
      }
    }

    type OwnRow = {
      vehicle_id: string;
      partner_id: string;
      partner_name: string;
      ownership_percentage: number;
      start: string;
      end: string | null;
      status: string;
    };

    const partnerNameById = new Map<string, string>();
    {
      const { data: partners } = await supabase
        .from("partners")
        .select("id, name")
        .eq("company_id", companyId);
      for (const p of partners ?? []) {
        partnerNameById.set(p.id as string, (p.name as string) || "Sócio");
      }
    }

    const ownershipByVehicle = new Map<string, OwnRow[]>();
    if (vehicleIds.length) {
      const { data: ownershipRaw, error: ownError } = await supabase
        .from("vehicle_ownership")
        .select(`vehicle_id, partner_id, ownership_percentage, status, end_date, ${dateCol}`)
        .eq("company_id", companyId)
        .eq("status", "Ativo")
        .in("vehicle_id", vehicleIds);

      if (ownError) return { ...empty, error: ownError.message };

      for (const raw of ownershipRaw ?? []) {
        const vehicleId = raw.vehicle_id as string;
        const partnerId = raw.partner_id as string;
        const start = String((raw as Record<string, unknown>)[dateCol] ?? "").slice(0, 10);
        const row: OwnRow = {
          vehicle_id: vehicleId,
          partner_id: partnerId,
          partner_name: partnerNameById.get(partnerId) ?? "Sócio",
          ownership_percentage: fromDbPercent(Number(raw.ownership_percentage), schema),
          start,
          end: raw.end_date ? String(raw.end_date).slice(0, 10) : null,
          status: String(raw.status ?? "Ativo"),
        };
        const list = ownershipByVehicle.get(vehicleId) ?? [];
        list.push(row);
        ownershipByVehicle.set(vehicleId, list);
      }
    }

    const rows: OsRateioRow[] = [];
    const partnerMap = new Map<string, OsRateioPartnerTotal>();

    for (const order of orders) {
      const serviceDate = String(order.service_date).slice(0, 10);
      const vehicleId = (order.vehicle_id as string | null) ?? null;
      const revenue = resolveOsRevenue(order);
      const expense = expenseByOrder.get(order.id as string) ?? 0;
      const result = revenue - expense;
      const warnings: string[] = [];

      let ownerships = vehicleId ? ownershipByVehicle.get(vehicleId) ?? [] : [];
      ownerships = ownerships.filter((o) => ownershipActiveOnDate(o, serviceDate));

      if (!vehicleId) {
        warnings.push("OS sem veículo vinculado — rateio não aplicado.");
      } else if (!ownerships.length) {
        warnings.push("Sem participação ativa vigente nesta data.");
      }

      const ownershipTotalPct = ownerships.reduce((s, o) => s + o.ownership_percentage, 0);
      if (ownerships.length && Math.abs(ownershipTotalPct - 100) > 0.51) {
        warnings.push(`Soma das participações = ${ownershipTotalPct.toFixed(2)}% (esperado 100%).`);
      }

      let shares: OsRateioPartnerShare[] = ownerships.map((o) => {
        const pct = o.ownership_percentage / 100;
        return {
          partnerId: o.partner_id,
          partnerName: o.partner_name,
          ownershipPct: o.ownership_percentage,
          revenueShare: revenue * pct,
          expenseShare: expense * pct,
          resultShare: result * pct,
        };
      });

      if (options.partnerId) {
        shares = shares.filter((s) => s.partnerId === options.partnerId);
        if (!shares.length) continue;
      }

      for (const share of shares) {
        const cons = partnerMap.get(share.partnerId) ?? {
          partnerId: share.partnerId,
          partnerName: share.partnerName,
          revenueShare: 0,
          expenseShare: 0,
          resultShare: 0,
          osCount: 0,
        };
        cons.revenueShare += share.revenueShare;
        cons.expenseShare += share.expenseShare;
        cons.resultShare += share.resultShare;
        cons.osCount += 1;
        partnerMap.set(share.partnerId, cons);
      }

      rows.push({
        serviceOrderId: order.id as string,
        code: String(order.code ?? ""),
        serviceDate,
        plate: String(order.plate ?? "").toUpperCase(),
        vehicleId,
        clientName: (order.client_name as string | null) ?? null,
        serviceType: String(order.service_type ?? ""),
        status: String(order.status ?? ""),
        revenue,
        expense,
        result,
        ownershipTotalPct,
        shares,
        warnings,
      });
    }

    const partnerTotals = [...partnerMap.values()].sort((a, b) => b.resultShare - a.resultShare);

    // Com filtro de sócio, o resumo usa a cota do sócio (não a OS inteira).
    const filteredByPartner = Boolean(options.partnerId);
    const totalRevenue = filteredByPartner
      ? partnerTotals.reduce((s, p) => s + p.revenueShare, 0)
      : rows.reduce((s, r) => s + r.revenue, 0);
    const totalExpense = filteredByPartner
      ? partnerTotals.reduce((s, p) => s + p.expenseShare, 0)
      : rows.reduce((s, r) => s + r.expense, 0);

    return {
      rows,
      partnerTotals,
      summary: {
        osCount: rows.length,
        totalRevenue,
        totalExpense,
        totalResult: totalRevenue - totalExpense,
      },
      error: null,
    };
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : "Falha ao calcular rateio por OS.",
    };
  }
}
