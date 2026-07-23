/**
 * Inspeção profunda do EVENTOS - OS - 2026
 */
import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs";

const SRC = path.join(
  "d:",
  "OneDrive",
  "Área de Trabalho",
  "GRX",
  "EVENTOS - OS - 2026 - 2° SEMESTRE.xlsx"
);

function cellRaw(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "object") {
    if (v.result != null) return cellRaw(v.result);
    if (v.text != null) return String(v.text).trim() || null;
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("").trim() || null;
  }
  return v;
}

function cellStr(v) {
  const r = cellRaw(v);
  if (r == null) return "";
  if (r instanceof Date) {
    const y = r.getFullYear();
    const m = String(r.getMonth() + 1).padStart(2, "0");
    const d = String(r.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(r).trim();
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SRC);
console.log("sheets", wb.worksheets.length);

// Sample first 8 sheets with content
let shown = 0;
for (const ws of wb.worksheets) {
  if (shown >= 8) break;
  const rows = [];
  for (let r = 1; r <= Math.min(40, ws.rowCount || 40); r++) {
    const vals = [];
    for (let c = 1; c <= 12; c++) {
      vals.push(cellStr(ws.getRow(r).getCell(c).value));
    }
    if (vals.some(Boolean)) rows.push({ r, vals });
  }
  if (rows.length < 3) continue;
  console.log("\n====", ws.name, "rowCount~", ws.rowCount, "====");
  for (const row of rows.slice(0, 25)) {
    console.log("R" + row.r, row.vals.join(" | "));
  }
  shown++;
}
