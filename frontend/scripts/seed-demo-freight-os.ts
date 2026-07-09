/**
 * Cria uma OS fictícia de frete São Paulo → Espírito Santo para testar o PDF.
 *
 * Uso:
 *   set IMPORT_EMAIL=seu@email.com
 *   set IMPORT_PASSWORD=sua_senha
 *   npx tsx scripts/seed-demo-freight-os.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { calculateRouteDistance } from "../src/lib/freight-route";
import { calculateAnttMinimumLocal } from "../src/lib/antt-freight";
import { generateCode } from "../src/lib/utils";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.IMPORT_EMAIL;
const password = process.env.IMPORT_PASSWORD;

const ORIGIN = "São Paulo, SP";
const DESTINATION = "Vitória, ES";
const CLIENT_NAME = "Distribuidora Atlântica Ltda (DEMO)";
const PHONE = "(11) 98348-1803";

const DEMO_TOLLS = [
  { order: 1, name: "Imigrantes", city: "São Bernardo do Campo", state: "SP", amount: 42.5 },
  { order: 2, name: "Praça de Registro", city: "Registro", state: "SP", amount: 38.9 },
  { order: 3, name: "Praça de Caraguatatuba", city: "Caraguatatuba", state: "SP", amount: 41.2 },
  { order: 4, name: "Praça de Rio Bonito", city: "Rio Bonito", state: "RJ", amount: 36.8 },
  { order: 5, name: "Praça de Campos", city: "Campos dos Goytacazes", state: "RJ", amount: 44.1 },
  { order: 6, name: "Praça de Linhares", city: "Linhares", state: "ES", amount: 39.5 },
  { order: 7, name: "Praça de Serra", city: "Serra", state: "ES", amount: 37.6 },
];

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

async function getTruckVehicle(companyId: string) {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, plate, vehicle_category, axle_count, brand, model, year")
    .eq("company_id", companyId)
    .eq("status", "Ativo")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const truck =
    data?.find((v) => v.vehicle_category === "Caminhao") ??
    data?.find((v) => v.vehicle_category !== "Van") ??
    data?.[0];

  if (!truck) {
    throw new Error("Nenhum veículo ativo na frota. Cadastre um caminhão em Cadastros → Veículos.");
  }
  return truck;
}

async function nextOsCode(companyId: string): Promise<string> {
  const { count, error } = await supabase
    .from("service_orders")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
  return generateCode("OS", count ?? 0);
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
  const vehicle = await getTruckVehicle(companyId);
  const code = await nextOsCode(companyId);
  const axles = vehicle.axle_count ?? 5;

  console.log("Calculando rota SP → ES...");
  const route = await calculateRouteDistance(ORIGIN, DESTINATION);
  const distanceKm = route.distanceKm;

  const antt = calculateAnttMinimumLocal({
    distanceKm,
    cargoTypeId: 5,
    axles,
    composicaoVeicular: true,
    altoDesempenho: false,
    retornoVazio: false,
  });

  if (!antt) {
    throw new Error("Não foi possível calcular o piso ANTT.");
  }

  const tollAmount = Math.round(DEMO_TOLLS.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
  const suggestedTotal = Math.round((antt.pisoMinimo + tollAmount) * 100) / 100;
  const agreedAmount = Math.round((suggestedTotal * 1.08) * 100) / 100;
  const today = new Date().toISOString().slice(0, 10);

  const payload = {
    company_id: companyId,
    code,
    service_type: "Frete",
    service_date: today,
    status: "Aberto",
    vehicle_id: vehicle.id,
    plate: vehicle.plate.replace(/[\s-]/g, "").toUpperCase(),
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    vehicle_type: vehicle.vehicle_category,
    client_name: CLIENT_NAME,
    phone: PHONE,
    service_categories: ["Frete"],
    service_name: "Frete",
    service_amount: agreedAmount,
    freight_origin_address: ORIGIN,
    freight_destination_address: DESTINATION,
    freight_distance_km: distanceKm,
    freight_toll_amount: tollAmount,
    freight_toll_count: DEMO_TOLLS.length,
    freight_toll_detail: DEMO_TOLLS,
    freight_antt_cargo_type: 5,
    freight_antt_axles: axles,
    freight_antt_composicao_veicular: true,
    freight_antt_alto_desempenho: false,
    freight_antt_retorno_vazio: false,
    freight_antt_minimum: antt.pisoMinimo,
    freight_antt_detail: antt,
    freight_suggested_total: suggestedTotal,
    freight_agreed_amount: agreedAmount,
    freight_per_diem_charge_to: "Cliente",
    notes: "OS fictícia para demonstração do PDF — São Paulo (SP) → Vitória (ES).",
  };

  const { data: inserted, error: insertError } = await supabase
    .from("service_orders")
    .insert(payload)
    .select("id, code")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Falha ao inserir OS.");
  }

  const proposalUrl = `http://localhost:3002/operacional/ordens-servico/${inserted.id}/proposta`;

  console.log("");
  console.log("OS fictícia criada com sucesso!");
  console.log("-----------------------------------");
  console.log(`Número da OS: ${inserted.code}`);
  console.log(`ID:           ${inserted.id}`);
  console.log(`Distância:    ${distanceKm} km`);
  console.log(`Valor:        R$ ${agreedAmount.toFixed(2)}`);
  console.log("");
  console.log("Pesquise na listagem por:", inserted.code);
  console.log("PDF / Proposta:", proposalUrl);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
