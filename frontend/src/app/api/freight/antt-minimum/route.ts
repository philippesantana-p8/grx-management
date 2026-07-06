import { NextResponse } from "next/server";
import {
  calculateAnttMinimumLocal,
  fetchAnttMinimumRemote,
  type AnttFreightInput,
} from "@/lib/antt-freight";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as Partial<AnttFreightInput>;

  const input: AnttFreightInput = {
    distanceKm: Number(body.distanceKm),
    cargoTypeId: Number(body.cargoTypeId ?? 5),
    axles: Number(body.axles ?? 5),
    composicaoVeicular: Boolean(body.composicaoVeicular ?? true),
    altoDesempenho: Boolean(body.altoDesempenho ?? false),
    retornoVazio: Boolean(body.retornoVazio ?? false),
  };

  if (!input.distanceKm || input.distanceKm < 1) {
    return NextResponse.json({ error: "Distância inválida." }, { status: 400 });
  }

  const token = process.env.CIOT_ONLINE_API_TOKEN;
  let result = token ? await fetchAnttMinimumRemote(input, token) : null;

  if (!result) {
    result = calculateAnttMinimumLocal(input);
  }

  if (!result && input.cargoTypeId !== 5) {
    return NextResponse.json(
      {
        error:
          "Tipo de carga não disponível no cálculo local. Configure CIOT_ONLINE_API_TOKEN para todos os tipos.",
      },
      { status: 422 }
    );
  }

  if (!result) {
    return NextResponse.json({ error: "Não foi possível calcular o piso mínimo ANTT." }, { status: 422 });
  }

  return NextResponse.json({ result });
}
