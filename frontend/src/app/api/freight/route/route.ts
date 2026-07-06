import { NextResponse } from "next/server";
import { calculateRouteDistance } from "@/lib/freight-route";
import { calculateRouteWithQualp } from "@/lib/qualp-freight";
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
    axles?: number;
    cargoTypeId?: number;
    composicaoVeicular?: boolean;
    altoDesempenho?: boolean;
  };

  if (!body.originAddress?.trim() || !body.destinationAddress?.trim()) {
    return NextResponse.json(
      { error: "Informe o endereço do ponto A e do ponto B." },
      { status: 400 }
    );
  }

  const originAddress = body.originAddress.trim();
  const destinationAddress = body.destinationAddress.trim();
  const qualpToken = process.env.QUALP_API_TOKEN?.trim();

  try {
    if (qualpToken) {
      try {
        const baseRoute = await calculateRouteDistance(originAddress, destinationAddress);
        const route = await calculateRouteWithQualp(
          {
            originAddress,
            destinationAddress,
            axles: Number(body.axles) || 5,
            cargoTypeId: Number(body.cargoTypeId) || 5,
            composicaoVeicular: Boolean(body.composicaoVeicular ?? true),
            altoDesempenho: Boolean(body.altoDesempenho ?? false),
          },
          qualpToken,
          baseRoute.origin,
          baseRoute.destination
        );

        return NextResponse.json({
          route,
          geocodeWarnings: baseRoute.geocodeWarnings,
        });
      } catch (geocodeError) {
        const route = await calculateRouteWithQualp(
          {
            originAddress,
            destinationAddress,
            axles: Number(body.axles) || 5,
            cargoTypeId: Number(body.cargoTypeId) || 5,
            composicaoVeicular: Boolean(body.composicaoVeicular ?? true),
            altoDesempenho: Boolean(body.altoDesempenho ?? false),
          },
          qualpToken,
          { lat: 0, lon: 0, label: originAddress },
          { lat: 0, lon: 0, label: destinationAddress }
        );

        return NextResponse.json({
          route,
          geocodeWarnings: [
            geocodeError instanceof Error
              ? `${geocodeError.message} Rota e pedágios calculados diretamente pela QualP.`
              : "Rota calculada diretamente pela QualP.",
          ],
        });
      }
    }

    const route = await calculateRouteDistance(originAddress, destinationAddress);
    return NextResponse.json({
      route: {
        ...route,
        tolls: [],
        tollCount: 0,
        tollTotal: 0,
        tollSource: "manual" as const,
      },
      geocodeWarnings: route.geocodeWarnings,
      warning:
        "Modo gratuito: pedágio informado manualmente. Distância via OSRM. Para pedágios automáticos, ative o QualP em Configurações → Integrações.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao calcular rota e pedágios." },
      { status: 422 }
    );
  }
}
