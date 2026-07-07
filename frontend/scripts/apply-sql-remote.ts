/**
 * Aplica scripts/apply-migrations-and-os001.sql no Supabase remoto.
 *
 * Requer SUPABASE_ACCESS_TOKEN em .env.local (token pessoal em supabase.com/dashboard/account/tokens)
 *
 * Uso: npx tsx scripts/apply-sql-remote.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    // .env.local opcional se vars já estiverem no ambiente
  }
  return env;
}

const fileEnv = loadEnvLocal();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const token = process.env.SUPABASE_ACCESS_TOKEN ?? fileEnv.SUPABASE_ACCESS_TOKEN;
const sqlPath = resolve(process.cwd(), "scripts/apply-migrations-and-os001.sql");

if (!url) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ausente em .env.local");
  process.exit(1);
}

const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!ref) {
  console.error("Não foi possível extrair project ref da URL:", url);
  process.exit(1);
}

if (!token) {
  console.error(
    "SUPABASE_ACCESS_TOKEN ausente.\n" +
      "Crie em https://supabase.com/dashboard/account/tokens e adicione em frontend/.env.local:\n" +
      "SUPABASE_ACCESS_TOKEN=seu_token"
  );
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");

async function main() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("Falha ao aplicar SQL:", res.status, body);
    process.exit(1);
  }

  console.log("SQL aplicado com sucesso.");
  console.log(body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
