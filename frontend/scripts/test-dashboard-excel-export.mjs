/**
 * Smoke test: builds the Dashboard Excel workbook with sample rows and
 * verifies all expected sheets + key cells exist.
 *
 * Run: node scripts/test-dashboard-excel-export.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", ".tmp-video-frames");
const outFile = path.join(outDir, "dashboard-export-test.xlsx");

const EXPECTED_SHEETS = [
  "Resumo",
  "Frete Transporte",
  "Estacionamento",
  "Lava rapido",
  "Despesas",
  "Receitas",
];

function styleHeader(row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
}

function addSheet(wb, name, headers, rows) {
  const sheet = wb.addWorksheet(name.slice(0, 31));
  sheet.addRow(headers);
  styleHeader(sheet.getRow(1));
  for (const row of rows) sheet.addRow(row.map((c) => (c == null ? "" : c)));
  return sheet;
}

async function buildSampleWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GRX Management test";

  addSheet(
    wb,
    "Resumo",
    ["Produto", "Receita", "Despesa", "Resultado"],
    [
      ["Período de", "2026-07-01", "até", "2026-07-17"],
      ["Frete/Transporte", 1500, 400, 1100],
      ["Estacionamento", 80, 0, 80],
      ["Lava-rápido", 45, 0, 45],
      ["TOTAL", 1625, 400, 1225],
    ]
  );

  addSheet(
    wb,
    "Frete Transporte",
    ["Código OS", "Tipo", "Placa", "Data serviço", "Entrada", "Saída", "Cliente", "Valor OS"],
    [["OS001", "Frete", "ABC1D23", "2026-07-10", "2026-07-10", "2026-07-10", "Cliente Teste", 1500]]
  );

  addSheet(
    wb,
    "Estacionamento",
    ["Código", "Placa", "Entrada", "Saída", "Modalidade", "Valor", "Data receita DRE"],
    [["EST001", "XYZ9A88", "2026-07-11", "2026-07-12", "Diária", 80, "2026-07-12"]]
  );

  addSheet(
    wb,
    "Lava rapido",
    ["Código", "Placa", "Data/Entrada", "Valor", "Data receita DRE"],
    [["LAV001", "XYZ9A88", "2026-07-12", 45, "2026-07-12"]]
  );

  addSheet(
    wb,
    "Despesas",
    ["Data lançamento", "Conta DRE", "Valor", "Placa", "OS", "Origem"],
    [
      ["2026-07-10", "Combustível", 400, "ABC1D23", "OS001", "vehicle_expense"],
      ["2026-07-05", "Material de escritório", 100, "", "", "company_ledger"],
    ]
  );

  addSheet(
    wb,
    "Receitas",
    ["Data lançamento", "Conta DRE", "Valor", "Placa", "Origem"],
    [
      ["2026-07-12", "Receita Estacionamento", 80, "XYZ9A88", "parking"],
      ["2026-07-12", "Receita Lava Rápido", 45, "XYZ9A88", "car_wash"],
    ]
  );

  return wb.xlsx.writeBuffer();
}

async function main() {
  const bytes = await buildSampleWorkbook();
  if (!(bytes instanceof ArrayBuffer) && !Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    throw new Error("writeBuffer did not return binary data");
  }
  const size = bytes.byteLength ?? bytes.length;
  if (size < 2000) throw new Error(`Workbook too small (${size} bytes)`);

  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, Buffer.from(bytes));

  const reader = new ExcelJS.Workbook();
  await reader.xlsx.load(Buffer.from(bytes));
  const names = reader.worksheets.map((s) => s.name);

  for (const expected of EXPECTED_SHEETS) {
    if (!names.includes(expected)) {
      throw new Error(`Missing sheet "${expected}". Found: ${names.join(", ")}`);
    }
  }

  const frete = reader.getWorksheet("Frete Transporte");
  const osCode = String(frete.getRow(2).getCell(1).value ?? "");
  if (osCode !== "OS001") throw new Error(`Expected OS001, got ${osCode}`);

  const despesas = reader.getWorksheet("Despesas");
  if (despesas.rowCount < 3) throw new Error("Despesas should have header + 2 data rows");

  const receitas = reader.getWorksheet("Receitas");
  if (receitas.rowCount < 3) throw new Error("Receitas should have header + 2 data rows");

  console.log("OK dashboard Excel export test");
  console.log("Sheets:", names.join(" | "));
  console.log("Bytes:", size);
  console.log("File:", outFile);
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
