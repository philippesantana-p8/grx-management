/**
 * Executa importações da planilha sem criar duplicidades (upsert / ignora códigos existentes).
 *
 * Uso:
 *   set IMPORT_EMAIL=seu@email.com
 *   set IMPORT_PASSWORD=sua_senha
 *   npx tsx scripts/run-imports.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { importDriversFromSpreadsheet } from "../src/lib/import-drivers";
import { importOwnershipFromSpreadsheet } from "../src/lib/import-ownership";
import { DRE_SEED } from "../src/lib/dre-seed";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.IMPORT_EMAIL;
const password = process.env.IMPORT_PASSWORD;

if (!url || !anonKey) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local");
  process.exit(1);
}

if (!email || !password) {
  console.error("Defina IMPORT_EMAIL e IMPORT_PASSWORD para autenticar.");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function getCompanyId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data?.company_id) {
    throw new Error("Empresa não encontrada para o usuário.");
  }
  return data.company_id;
}

async function importDre(companyId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("dre_accounts")
    .select("name")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (existingError) throw new Error(existingError.message);

  const existingNames = new Set((existing ?? []).map((row) => row.name));
  const pending = DRE_SEED.filter((row) => !existingNames.has(row.name));

  if (pending.length === 0) {
    console.log(`DRE: 0 novas (${DRE_SEED.length} já existiam)`);
    return;
  }

  const { error } = await supabase.from("dre_accounts").upsert(
    pending.map((row) => ({
      company_id: companyId,
      name: row.name,
      classification: row.classification,
      transaction_type: row.transaction_type,
      status: "Ativo",
    })),
    { onConflict: "company_id,name", ignoreDuplicates: true }
  );

  if (error) throw new Error(error.message);
  console.log(`DRE: ${pending.length} importada(s), ${DRE_SEED.length - pending.length} ignorada(s)`);
}

async function main() {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !auth.user) {
    console.error("Login falhou:", authError?.message ?? "usuário inválido");
    process.exit(1);
  }

  const companyId = await getCompanyId(auth.user.id);
  console.log("Empresa:", companyId);

  const ownership = await importOwnershipFromSpreadsheet(companyId, supabase as never);
  console.log(
    `Participações: ${ownership.imported} importada(s), ${ownership.skipped} ignorada(s)`,
    ownership.errors.length ? ownership.errors : ""
  );

  const drivers = await importDriversFromSpreadsheet(companyId, supabase as never);
  console.log(
    `Motoristas: ${drivers.imported} importado(s), ${drivers.skipped} ignorado(s)`,
    drivers.errors.length ? drivers.errors : ""
  );

  await importDre(companyId);
  console.log("Importações concluídas.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
