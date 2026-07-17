/** Export Excel do Dashboard — abas por produto + razão receita/despesa. */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addToTotals,
  classifyBucket,
  DASHBOARD_DEMO_ENTRY_SOURCE,
  DASHBOARD_DEMO_PREFIX,
  emptyTotals,
  type BucketTotals,
  type DashboardFilters,
  type FtRow,
} from "@/lib/dashboard-metrics";
import { SERVICE_ORDER_TYPE_LABELS } from "@/types/database";

const PAGE_SIZE = 1000;

export const DASHBOARD_EXPORT_SHEETS = [
  "Resumo",
  "Frete Transporte",
  "Estacionamento",
  "Lava rapido",
  "Despesas",
  "Receitas",
] as const;

export type DashboardExportOsRow = {
  code: string;
  serviceType: string;
  plate: string;
  serviceDate: string;
  entryDate: string;
  exitDate: string;
  clientName: string;
  amount: number | null;
  status: string;
  dreAccount: string;
};

export type DashboardExportPatioRow = {
  code: string;
  plate: string;
  entryDate: string;
  exitDate: string;
  modality: string;
  amount: number | null;
  status: string;
  revenueDate: string;
  clientName: string;
};

export type DashboardExportLedgerRow = {
  transactionDate: string;
  serviceDate: string;
  type: string;
  account: string;
  amount: number;
  plate: string;
  osCode: string;
  source: string;
  description: string;
  product: string;
  isDemo: boolean;
};

export type DashboardExportPayload = {
  from: string;
  to: string;
  filters: DashboardFilters;
  includeDemo: boolean;
  frete: BucketTotals;
  estacionamento: BucketTotals;
  lava: BucketTotals;
  outros: BucketTotals;
  freteOs: DashboardExportOsRow[];
  parking: DashboardExportPatioRow[];
  lavaRows: DashboardExportPatioRow[];
  expenses: DashboardExportLedgerRow[];
  revenues: DashboardExportLedgerRow[];
  demoExcluded: number;
};

function isDemoFt(row: {
  entry_source: string | null;
  description: string | null;
}): boolean {
  if (row.entry_source === DASHBOARD_DEMO_ENTRY_SOURCE) return true;
  return String(row.description ?? "").startsWith(DASHBOARD_DEMO_PREFIX);
}

async function fetchPaged<T>(
  run: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await run(offset, offset + PAGE_SIZE - 1);
    if (error) return { rows: [], error: error.message };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return { rows, error: null };
}

function plateMatches(plate: string, filterPlate: string): boolean {
  if (!filterPlate) return true;
  return plate.replace(/\s+/g, "").toUpperCase() === filterPlate.replace(/\s+/g, "").toUpperCase();
}

export async function fetchDashboardExportPayload(
  supabase: SupabaseClient,
  companyId: string,
  from: string,
  to: string,
  filters: DashboardFilters = { plate: "", partnerId: "", ownershipPct: "" },
  includeDemo = false
): Promise<{ payload: DashboardExportPayload | null; error: string | null }> {
  const ftRes = await fetchPaged<Record<string, unknown>>(async (offset, end) => {
    const rich = await supabase
      .from("financial_transactions")
      .select(
        `
        id,
        transaction_date,
        service_date,
        amount,
        transaction_type,
        classification,
        description,
        entry_source,
        allocation_vehicle_id,
        service_order_id,
        chart_of_account_id,
        chart_of_accounts ( name ),
        service_orders ( code, plate ),
        vehicles!financial_transactions_allocation_vehicle_id_fkey ( plate )
      `
      )
      .eq("company_id", companyId)
      .gte("transaction_date", from)
      .lte("transaction_date", to)
      .order("transaction_date", { ascending: true })
      .range(offset, end);

    if (!rich.error) {
      return {
        data: (rich.data as unknown as Record<string, unknown>[] | null) ?? null,
        error: null,
      };
    }

    // Fallback if FK aliases / service_date column differ across environments.
    const basic = await supabase
      .from("financial_transactions")
      .select(
        `
        id,
        transaction_date,
        amount,
        transaction_type,
        classification,
        description,
        entry_source,
        allocation_vehicle_id,
        chart_of_account_id,
        chart_of_accounts ( name )
      `
      )
      .eq("company_id", companyId)
      .gte("transaction_date", from)
      .lte("transaction_date", to)
      .order("transaction_date", { ascending: true })
      .range(offset, end);

    return {
      data: (basic.data as unknown as Record<string, unknown>[] | null) ?? null,
      error: basic.error,
    };
  });
  if (ftRes.error) return { payload: null, error: ftRes.error };

  const osRes = await fetchPaged<Record<string, unknown>>(async (offset, end) => {
    const { data, error } = await supabase
      .from("service_orders")
      .select(
        `
        code,
        service_type,
        plate,
        service_date,
        entry_date,
        exit_date,
        client_name,
        service_amount,
        freight_agreed_amount,
        status,
        chart_of_accounts ( name )
      `
      )
      .eq("company_id", companyId)
      .in("service_type", ["Frete", "Transporte"])
      .gte("service_date", from)
      .lte("service_date", to)
      .order("service_date", { ascending: true })
      .range(offset, end);
    return { data: (data as unknown as Record<string, unknown>[] | null) ?? null, error };
  });
  if (osRes.error) return { payload: null, error: osRes.error };

  const parkingRes = await fetchPaged<Record<string, unknown>>(async (offset, end) => {
    const { data, error } = await supabase
      .from("parking_entries")
      .select(
        "code, plate, entry_date, exit_date, billing_mode, total_amount, status, client_name, financial_transaction_id"
      )
      .eq("company_id", companyId)
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("entry_date", { ascending: true })
      .range(offset, end);
    return { data: (data as unknown as Record<string, unknown>[] | null) ?? null, error };
  });
  if (parkingRes.error) return { payload: null, error: parkingRes.error };

  const lavaRes = await fetchPaged<Record<string, unknown>>(async (offset, end) => {
    const { data, error } = await supabase
      .from("car_wash_services")
      .select(
        "code, plate, service_date, entry_date, exit_date, service_amount, status, client_name, financial_transaction_id"
      )
      .eq("company_id", companyId)
      .gte("service_date", from)
      .lte("service_date", to)
      .order("service_date", { ascending: true })
      .range(offset, end);
    return { data: (data as unknown as Record<string, unknown>[] | null) ?? null, error };
  });
  if (lavaRes.error) return { payload: null, error: lavaRes.error };

  let demoExcluded = 0;
  const ledger: DashboardExportLedgerRow[] = [];
  const frete = emptyTotals();
  const estacionamento = emptyTotals();
  const lava = emptyTotals();
  const outros = emptyTotals();

  for (const raw of ftRes.rows) {
    const accountRel = raw.chart_of_accounts as { name?: string } | null;
    const osRel = raw.service_orders as { code?: string; plate?: string } | null;
    const vehicleRel = raw.vehicles as { plate?: string } | null;
    const demo = isDemoFt({
      entry_source: (raw.entry_source as string | null) ?? null,
      description: (raw.description as string | null) ?? null,
    });
    if (demo && !includeDemo) {
      demoExcluded += 1;
      continue;
    }

    const ft: FtRow = {
      id: String(raw.id),
      transaction_date: String(raw.transaction_date),
      amount: Number(raw.amount) || 0,
      transaction_type: String(raw.transaction_type),
      classification: (raw.classification as string | null) ?? null,
      description: (raw.description as string | null) ?? null,
      entry_source: (raw.entry_source as string | null) ?? null,
      allocation_vehicle_id: (raw.allocation_vehicle_id as string | null) ?? null,
      chart_of_account_id: String(raw.chart_of_account_id ?? ""),
      account_name: accountRel?.name ?? null,
    };

    const plate = String(vehicleRel?.plate || osRel?.plate || "").trim();
    if (!plateMatches(plate, filters.plate)) continue;

    const bucket = classifyBucket(ft);
    if (bucket === "frete") addToTotals(frete, ft);
    else if (bucket === "estacionamento") addToTotals(estacionamento, ft);
    else if (bucket === "lava") addToTotals(lava, ft);
    else addToTotals(outros, ft);

    const row: DashboardExportLedgerRow = {
      transactionDate: ft.transaction_date,
      serviceDate: raw.service_date ? String(raw.service_date) : "",
      type: ft.transaction_type,
      account: ft.account_name ?? "",
      amount: ft.amount,
      plate,
      osCode: osRel?.code ? String(osRel.code) : "",
      source: ft.entry_source ?? "",
      description: ft.description ?? "",
      product: bucket,
      isDemo: demo,
    };
    ledger.push(row);
  }

  const freteOs: DashboardExportOsRow[] = osRes.rows
    .filter((raw) => plateMatches(String(raw.plate ?? ""), filters.plate))
    .map((raw) => {
      const account = raw.chart_of_accounts as { name?: string } | null;
      const agreed = raw.freight_agreed_amount != null ? Number(raw.freight_agreed_amount) : null;
      const serviceAmount = raw.service_amount != null ? Number(raw.service_amount) : null;
      const type = String(raw.service_type ?? "");
      return {
        code: String(raw.code ?? ""),
        serviceType: SERVICE_ORDER_TYPE_LABELS[type] ?? type,
        plate: String(raw.plate ?? ""),
        serviceDate: String(raw.service_date ?? ""),
        entryDate: raw.entry_date ? String(raw.entry_date) : "",
        exitDate: raw.exit_date ? String(raw.exit_date) : "",
        clientName: String(raw.client_name ?? ""),
        amount: agreed ?? serviceAmount,
        status: String(raw.status ?? ""),
        dreAccount: account?.name ?? "",
      };
    });

  const parkingFtDates = new Map<string, string>();
  for (const raw of ftRes.rows) {
    if (raw.id) parkingFtDates.set(String(raw.id), String(raw.transaction_date ?? ""));
  }

  const parking: DashboardExportPatioRow[] = parkingRes.rows
    .filter((raw) => plateMatches(String(raw.plate ?? ""), filters.plate))
    .map((raw) => {
      const ftId = raw.financial_transaction_id ? String(raw.financial_transaction_id) : "";
      return {
        code: String(raw.code ?? ""),
        plate: String(raw.plate ?? ""),
        entryDate: String(raw.entry_date ?? ""),
        exitDate: raw.exit_date ? String(raw.exit_date) : "",
        modality: String(raw.billing_mode ?? ""),
        amount: raw.total_amount != null ? Number(raw.total_amount) : null,
        status: String(raw.status ?? ""),
        revenueDate: ftId ? parkingFtDates.get(ftId) ?? "" : "",
        clientName: String(raw.client_name ?? ""),
      };
    });

  const lavaRows: DashboardExportPatioRow[] = lavaRes.rows
    .filter((raw) => plateMatches(String(raw.plate ?? ""), filters.plate))
    .map((raw) => {
      const ftId = raw.financial_transaction_id ? String(raw.financial_transaction_id) : "";
      return {
        code: String(raw.code ?? ""),
        plate: String(raw.plate ?? ""),
        entryDate: raw.entry_date
          ? String(raw.entry_date)
          : raw.service_date
            ? String(raw.service_date)
            : "",
        exitDate: raw.exit_date ? String(raw.exit_date) : "",
        modality: "Lava-rápido",
        amount: raw.service_amount != null ? Number(raw.service_amount) : null,
        status: String(raw.status ?? ""),
        revenueDate: ftId
          ? parkingFtDates.get(ftId) ?? String(raw.service_date ?? "")
          : String(raw.service_date ?? ""),
        clientName: String(raw.client_name ?? ""),
      };
    });

  return {
    payload: {
      from,
      to,
      filters,
      includeDemo,
      frete,
      estacionamento,
      lava,
      outros,
      freteOs,
      parking,
      lavaRows,
      expenses: ledger.filter((r) => r.type === "Despesa"),
      revenues: ledger.filter((r) => r.type === "Receita"),
      demoExcluded,
    },
    error: null,
  };
}

function styleHeader(row: import("exceljs").Row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
}

function addSheet(
  wb: import("exceljs").Workbook,
  name: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
) {
  const sheet = wb.addWorksheet(name.slice(0, 31));
  sheet.addRow(headers);
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow(row.map((cell) => (cell == null ? "" : cell)));
  }
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = Math.min(len + 2, 42);
    });
    col.width = max;
  });
  return sheet;
}

export function createSampleExportPayload(): DashboardExportPayload {
  return {
    from: "2026-07-01",
    to: "2026-07-17",
    filters: { plate: "", partnerId: "", ownershipPct: "" },
    includeDemo: false,
    frete: { revenue: 1500, expense: 400, result: 1100 },
    estacionamento: { revenue: 80, expense: 0, result: 80 },
    lava: { revenue: 45, expense: 0, result: 45 },
    outros: { revenue: 0, expense: 100, result: -100 },
    freteOs: [
      {
        code: "OS001",
        serviceType: "Frete",
        plate: "ABC1D23",
        serviceDate: "2026-07-10",
        entryDate: "2026-07-10",
        exitDate: "2026-07-10",
        clientName: "Cliente Teste",
        amount: 1500,
        status: "Concluido",
        dreAccount: "Receita Caminhão",
      },
    ],
    parking: [
      {
        code: "EST001",
        plate: "XYZ9A88",
        entryDate: "2026-07-11",
        exitDate: "2026-07-12",
        modality: "Diária",
        amount: 80,
        status: "Finalizado",
        revenueDate: "2026-07-12",
        clientName: "Pátio",
      },
    ],
    lavaRows: [
      {
        code: "LAV001",
        plate: "XYZ9A88",
        entryDate: "2026-07-12",
        exitDate: "2026-07-12",
        modality: "Lava-rápido",
        amount: 45,
        status: "Concluido",
        revenueDate: "2026-07-12",
        clientName: "Cliente Lava",
      },
    ],
    expenses: [
      {
        transactionDate: "2026-07-10",
        serviceDate: "2026-07-10",
        type: "Despesa",
        account: "Combustível",
        amount: 400,
        plate: "ABC1D23",
        osCode: "OS001",
        source: "vehicle_expense",
        description: "Abastecimento",
        product: "frete",
        isDemo: false,
      },
      {
        transactionDate: "2026-07-05",
        serviceDate: "",
        type: "Despesa",
        account: "Material de escritório",
        amount: 100,
        plate: "",
        osCode: "",
        source: "company_ledger",
        description: "Papelaria",
        product: "outros",
        isDemo: false,
      },
    ],
    revenues: [
      {
        transactionDate: "2026-07-12",
        serviceDate: "2026-07-12",
        type: "Receita",
        account: "Receita Estacionamento",
        amount: 80,
        plate: "XYZ9A88",
        osCode: "",
        source: "parking",
        description: "EST001",
        product: "estacionamento",
        isDemo: false,
      },
      {
        transactionDate: "2026-07-12",
        serviceDate: "2026-07-12",
        type: "Receita",
        account: "Receita Lava Rápido",
        amount: 45,
        plate: "XYZ9A88",
        osCode: "",
        source: "car_wash",
        description: "LAV001",
        product: "lava",
        isDemo: false,
      },
    ],
    demoExcluded: 0,
  };
}

export async function buildDashboardWorkbook(
  payload: DashboardExportPayload
): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "GRX Management";
  wb.created = new Date();

  const totalRevenue =
    payload.frete.revenue +
    payload.estacionamento.revenue +
    payload.lava.revenue +
    payload.outros.revenue;
  const totalExpense =
    payload.frete.expense +
    payload.estacionamento.expense +
    payload.lava.expense +
    payload.outros.expense;

  addSheet(
    wb,
    "Resumo",
    ["Produto", "Receita", "Despesa", "Resultado"],
    [
      ["Período de", payload.from, "até", payload.to],
      ["Filtro placa", payload.filters.plate || "(todas)", "", ""],
      ["DEMO excluídos", payload.demoExcluded, "", ""],
      [],
      ["Frete/Transporte", payload.frete.revenue, payload.frete.expense, payload.frete.result],
      [
        "Estacionamento",
        payload.estacionamento.revenue,
        payload.estacionamento.expense,
        payload.estacionamento.result,
      ],
      ["Lava-rápido", payload.lava.revenue, payload.lava.expense, payload.lava.result],
      ["Outros (empresa)", payload.outros.revenue, payload.outros.expense, payload.outros.result],
      ["TOTAL", totalRevenue, totalExpense, totalRevenue - totalExpense],
      [],
      ["OS Frete/Transporte (linhas)", payload.freteOs.length, "", ""],
      ["Estacionamento (linhas)", payload.parking.length, "", ""],
      ["Lava-rápido (linhas)", payload.lavaRows.length, "", ""],
      ["Despesas razão (linhas)", payload.expenses.length, "", ""],
      ["Receitas razão (linhas)", payload.revenues.length, "", ""],
    ]
  );

  addSheet(
    wb,
    "Frete Transporte",
    [
      "Código OS",
      "Tipo",
      "Placa",
      "Data serviço",
      "Entrada",
      "Saída",
      "Cliente",
      "Valor OS",
      "Status",
      "Conta DRE (OS)",
    ],
    payload.freteOs.map((r) => [
      r.code,
      r.serviceType,
      r.plate,
      r.serviceDate,
      r.entryDate,
      r.exitDate,
      r.clientName,
      r.amount,
      r.status,
      r.dreAccount,
    ])
  );

  addSheet(
    wb,
    "Estacionamento",
    [
      "Código",
      "Placa",
      "Entrada",
      "Saída",
      "Modalidade",
      "Valor",
      "Status",
      "Data receita DRE",
      "Cliente",
    ],
    payload.parking.map((r) => [
      r.code,
      r.plate,
      r.entryDate,
      r.exitDate,
      r.modality,
      r.amount,
      r.status,
      r.revenueDate,
      r.clientName,
    ])
  );

  addSheet(
    wb,
    "Lava rapido",
    [
      "Código",
      "Placa",
      "Data/Entrada",
      "Saída",
      "Modalidade",
      "Valor",
      "Status",
      "Data receita DRE",
      "Cliente",
    ],
    payload.lavaRows.map((r) => [
      r.code,
      r.plate,
      r.entryDate,
      r.exitDate,
      r.modality,
      r.amount,
      r.status,
      r.revenueDate,
      r.clientName,
    ])
  );

  const ledgerHeaders = [
    "Data lançamento",
    "Data serviço",
    "Tipo",
    "Conta DRE",
    "Valor",
    "Placa",
    "OS",
    "Origem",
    "Produto",
    "Descrição",
    "DEMO",
  ];

  addSheet(
    wb,
    "Despesas",
    ledgerHeaders,
    payload.expenses.map((r) => [
      r.transactionDate,
      r.serviceDate,
      r.type,
      r.account,
      r.amount,
      r.plate,
      r.osCode,
      r.source,
      r.product,
      r.description,
      r.isDemo ? "Sim" : "",
    ])
  );

  addSheet(
    wb,
    "Receitas",
    ledgerHeaders,
    payload.revenues.map((r) => [
      r.transactionDate,
      r.serviceDate,
      r.type,
      r.account,
      r.amount,
      r.plate,
      r.osCode,
      r.source,
      r.product,
      r.description,
      r.isDemo ? "Sim" : "",
    ])
  );

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export function downloadExcelBytes(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function dashboardExportFilename(from: string, to: string): string {
  return `GRX_Dashboard_${from}_${to}.xlsx`;
}

export async function exportDashboardExcel(options: {
  supabase: SupabaseClient;
  companyId: string;
  from: string;
  to: string;
  filters?: DashboardFilters;
  includeDemo?: boolean;
}): Promise<{ error: string | null; filename: string | null; rowCounts: Record<string, number> | null }> {
  const { payload, error } = await fetchDashboardExportPayload(
    options.supabase,
    options.companyId,
    options.from,
    options.to,
    options.filters,
    options.includeDemo ?? false
  );
  if (error || !payload) {
    return { error: error ?? "Falha ao montar export.", filename: null, rowCounts: null };
  }

  const bytes = await buildDashboardWorkbook(payload);
  const filename = dashboardExportFilename(payload.from, payload.to);
  downloadExcelBytes(bytes, filename);

  return {
    error: null,
    filename,
    rowCounts: {
      freteOs: payload.freteOs.length,
      parking: payload.parking.length,
      lava: payload.lavaRows.length,
      expenses: payload.expenses.length,
      revenues: payload.revenues.length,
      demoExcluded: payload.demoExcluded,
    },
  };
}
