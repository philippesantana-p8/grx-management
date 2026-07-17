import { NextResponse } from "next/server";
import { LICENSE_TERMS_VERSION } from "@/lib/license-terms";
import { defaultBillingRow, loadBillingSettings, requireCompanyMember } from "@/lib/billing-server";

export const runtime = "nodejs";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip")?.trim() || null;
}

export async function POST(request: Request) {
  const auth = await requireCompanyMember();
  if (auth.error || !auth.user || !auth.membership) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as {
    accepted?: boolean;
    termsVersion?: string;
  } | null;

  if (!body?.accepted) {
    return NextResponse.json(
      { error: "É necessário marcar o aceite do termo." },
      { status: 400 }
    );
  }

  const termsVersion = (body.termsVersion || LICENSE_TERMS_VERSION).trim();
  if (termsVersion !== LICENSE_TERMS_VERSION) {
    return NextResponse.json(
      { error: "Versão do termo desatualizada. Recarregue a página e aceite novamente." },
      { status: 400 }
    );
  }

  const current = await loadBillingSettings(auth.supabase, auth.membership.company_id);
  const defaults = defaultBillingRow(auth.membership.company_id);
  const acceptedAt = new Date().toISOString();
  const acceptedIp = clientIp(request);

  const { data, error } = await auth.supabase
    .from("company_billing_settings")
    .upsert(
      {
        ...defaults,
        ...current,
        company_id: auth.membership.company_id,
        terms_version: termsVersion,
        terms_accepted_at: acceptedAt,
        terms_accepted_by: auth.user.id,
        terms_accepted_ip: acceptedIp,
        updated_by: auth.user.id,
      },
      { onConflict: "company_id" }
    )
    .select("*")
    .single();

  if (error) {
    const missingColumn =
      error.message.includes("terms_version") ||
      error.message.includes("terms_accepted") ||
      error.code === "42703";
    return NextResponse.json(
      {
        error: missingColumn
          ? "Colunas de aceite ainda não existem. Aplique o SQL apply-050-license-terms-acceptance.sql no Supabase."
          : error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    settings: data,
    message: `Aceite do termo ${termsVersion} registrado com sucesso.`,
  });
}
