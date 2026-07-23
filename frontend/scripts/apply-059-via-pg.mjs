/**
 * Aplica apply-059 via postgres se DATABASE_URL estiver no .env.local.
 * Caso contrário, só verifica se as tabelas já existem.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const probe = await sb.from("document_types").select("id").limit(1);
if (!probe.error) {
  console.log("OK: document_types já existe.");
  process.exit(0);
}
console.log("Tabelas ainda não aplicadas:", probe.error.message);
console.log(
  "Aplique no SQL Editor do Supabase:",
  path.join(__dirname, "apply-059-compliance-documents.sql")
);
process.exit(2);
