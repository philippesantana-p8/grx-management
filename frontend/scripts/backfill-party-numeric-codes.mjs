/**
 * Converte códigos legados (SOC001, MOT001…) para numérico 8 dígitos (00000001…).
 * Uso:
 *   node frontend/scripts/backfill-party-numeric-codes.mjs partners
 *   node frontend/scripts/backfill-party-numeric-codes.mjs drivers
 *   node frontend/scripts/backfill-party-numeric-codes.mjs all
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
    );
  } catch {
    return {};
  }
}

const env = {
  ...loadEnv(join(__dirname, "../../.env.local")),
  ...loadEnv(join(__dirname, "../.env.local")),
};
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const companyId = process.env.COMPANY_ID || "4787a893-6b62-4d36-87ce-57c15338ea11";
const arg = (process.argv[2] || "all").toLowerCase();
const tables =
  arg === "all" ? ["partners", "drivers"] : arg === "partners" || arg === "drivers" ? [arg] : null;

if (!tables) {
  console.error("Uso: node backfill-party-numeric-codes.mjs [partners|drivers|all]");
  process.exit(1);
}

async function backfill(table) {
  const { data, error } = await sb
    .from(table)
    .select("id, code, name, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`${table}: ${error.message}`);
  const rows = data ?? [];
  if (!rows.length) {
    console.log(`${table}: nenhum registro`);
    return;
  }

  const already = rows.every((r) => /^\d{8}$/.test(String(r.code ?? "")));
  if (already) {
    console.log(`${table}: já estão no padrão 8 dígitos (${rows.length})`);
    return;
  }

  let seq = 0;
  for (const row of rows) {
    seq += 1;
    const temp = `__TMP_${table}_${seq}`;
    const { error: e1 } = await sb.from(table).update({ code: temp }).eq("id", row.id);
    if (e1) throw new Error(`${table} temp ${row.id}: ${e1.message}`);
  }

  seq = 0;
  for (const row of rows) {
    seq += 1;
    const code = String(seq).padStart(8, "0");
    const { error: e2 } = await sb.from(table).update({ code }).eq("id", row.id);
    if (e2) throw new Error(`${table} final ${row.id}: ${e2.message}`);
    console.log(`${table} ${row.name}: ${row.code} -> ${code}`);
  }
  console.log(`${table}: atualizados ${rows.length}`);
}

for (const table of tables) {
  await backfill(table);
}
