/**
 * Integration smoke test against the real workbook builder.
 * Run: npx tsx scripts/test-dashboard-excel-export.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import {
  buildDashboardWorkbook,
  createSampleExportPayload,
  DASHBOARD_EXPORT_SHEETS,
} from "../src/lib/dashboard-export";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(__dirname, "..", ".tmp-video-frames", "dashboard-export-lib-test.xlsx");

async function main() {
  const payload = createSampleExportPayload();
  const bytes = await buildDashboardWorkbook(payload);
  if (bytes.byteLength < 2000) {
    throw new Error(`Workbook too small: ${bytes.byteLength}`);
  }

  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, bytes);

  const reader = new ExcelJS.Workbook();
  await reader.xlsx.load(Buffer.from(bytes));
  const names = reader.worksheets.map((s) => s.name);

  for (const expected of DASHBOARD_EXPORT_SHEETS) {
    if (!names.includes(expected)) {
      throw new Error(`Missing sheet "${expected}". Found: ${names.join(", ")}`);
    }
  }

  const frete = reader.getWorksheet("Frete Transporte");
  if (!frete) throw new Error("Frete Transporte missing");
  if (String(frete.getRow(2).getCell(1).value) !== "OS001") {
    throw new Error("Frete sheet missing sample OS001");
  }

  const despesas = reader.getWorksheet("Despesas");
  if (!despesas || despesas.rowCount < 3) throw new Error("Despesas incomplete");

  const receitas = reader.getWorksheet("Receitas");
  if (!receitas || receitas.rowCount < 3) throw new Error("Receitas incomplete");

  console.log("OK lib dashboard Excel export");
  console.log("Sheets:", names.join(" | "));
  console.log("Bytes:", bytes.byteLength);
  console.log("File:", outFile);
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
