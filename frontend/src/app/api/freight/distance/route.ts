import { NextResponse } from "next/server";
import { calculateRouteDistance } from "@/lib/freight-route";
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

  const body = (await request.json()) as {
    originAddress?: string;
    destinationAddress?: string;
  };

  if (!body.originAddress?.trim() || !body.destinationAddress?.trim()) {
    return NextResponse.json(
      { error: "Informe o endereço do ponto A e do ponto B." },
      { status: 400 }
    );
  }

  try {
    const route = await calculateRouteDistance(
      body.originAddress.trim(),
      body.destinationAddress.trim()
    );
    return NextResponse.json({ route });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao calcular rota." },
      { status: 422 }
    );
  }
}
