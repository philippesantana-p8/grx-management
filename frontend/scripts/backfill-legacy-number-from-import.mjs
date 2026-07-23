/**
 * Após apply-058: preenche legacy_number nos lançamentos [IMPORTAÇÃO TESTE]
 * a partir de "COT: xxx" na descrição (quando ainda vazio).
 *
 *   node scripts/backfill-legacy-number-from-import.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPANY_ID = "4787a893-6b62-4d36-87ce-57c15338ea11";

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await sb
  .from("financial_transactions")
  .select("id, description, legacy_number")
  .eq("company_id", COMPANY_ID)
  .eq("entry_source", "import_historico_teste")
  .is("legacy_number", null)
  .limit(5000);

if (error) {
  console.error(error.message);
  console.error("Aplique apply-058-legacy-number.sql se a coluna não existir.");
  process.exit(1);
}

let updated = 0;
for (const row of data ?? []) {
  const m = String(row.description || "").match(/COT:\s*([^·]+)/i);
  const cot = m?.[1]?.trim();
  if (!cot) continue;
  const { error: upErr } = await sb
    .from("financial_transactions")
    .update({ legacy_number: cot })
    .eq("id", row.id);
  if (upErr) {
    console.error(upErr.message);
    process.exit(1);
  }
  updated++;
}
console.log(`legacy_number preenchido em ${updated} lançamentos.`);
