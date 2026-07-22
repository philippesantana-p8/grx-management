/**
 * Soft-delete de CNPJ/CPF duplicados + cria índices únicos via SQL no Supabase.
 * Uso: node frontend/scripts/apply-053-unique-party-documents.mjs
 *
 * Preferência: cole o conteúdo de apply-053-unique-party-documents.sql no SQL Editor.
 * Este script faz a limpeza via API (service role) quando não há execução SQL direta.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = join(__dirname, "../../.env.local");
const localEnv = join(__dirname, "../.env.local");

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

const env = { ...loadEnv(rootEnv), ...loadEnv(localEnv) };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const digits = (v) => String(v ?? "").replace(/\D/g, "");

async function softDeleteDuplicates(table, field = "document") {
  const { data, error } = await sb
    .from(table)
    .select(`id, company_id, ${field}, created_at, notes, status`)
    .is("deleted_at", null);
  if (error) throw new Error(`${table}: ${error.message}`);

  const groups = new Map();
  for (const row of data ?? []) {
    const d = digits(row[field]);
    if (!d) continue;
    const key = `${row.company_id}::${d}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
    const [, ...dupes] = list;
    for (const row of dupes) {
      const note = `${row.notes ?? ""}\n[sistema] Soft-delete: CNPJ/CPF duplicado (053).`.trim();
      const { error: updErr } = await sb
        .from(table)
        .update({
          deleted_at: new Date().toISOString(),
          status: "Inativo",
          notes: note,
        })
        .eq("id", row.id);
      if (updErr) throw new Error(`${table} update ${row.id}: ${updErr.message}`);
      removed += 1;
      console.log(`soft-deleted ${table} ${row.id} (kept ${list[0].id})`);
    }
  }
  console.log(`${table}: removed ${removed} duplicate(s)`);
}

await softDeleteDuplicates("clients");
await softDeleteDuplicates("suppliers");
await softDeleteDuplicates("drivers");
await softDeleteDuplicates("partners", "cpf");

console.log(`
Cleanup via API concluído.
Ainda é necessário rodar o SQL de índices no Supabase SQL Editor:
  frontend/scripts/apply-053-unique-party-documents.sql
`);
