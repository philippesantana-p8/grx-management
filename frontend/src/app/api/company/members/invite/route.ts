import { NextResponse } from "next/server";
import { requireCompanyMember } from "@/lib/billing-server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type Body = {
  email?: string;
  role?: "admin" | "operacional";
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  const auth = await requireCompanyMember();
  if (auth.error || !auth.user || !auth.membership) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (auth.membership.role !== "admin") {
    return NextResponse.json(
      { error: "Somente administrador pode convidar usuários." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const email = body?.email ? normalizeEmail(body.email) : "";
  const role = body?.role === "admin" ? "admin" : "operacional";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json(
      {
        error:
          "Convite indisponível: SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.",
      },
      { status: 503 }
    );
  }

  const companyId = auth.membership.company_id;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://grx-management.vercel.app";

  const { data: invited, error: inviteErr } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl.replace(/\/$/, "")}/login`,
  });

  let userId = invited?.user?.id ?? null;

  // Usuário já existente: invite falha — localizar em profiles
  if (!userId) {
    const { data: profile, error: profileErr } = await service
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (profileErr || !profile?.id) {
      return NextResponse.json(
        {
          error:
            inviteErr?.message ||
            profileErr?.message ||
            "Não foi possível convidar nem localizar este e-mail. Verifique se o Auth está configurado.",
        },
        { status: 400 }
      );
    }
    userId = profile.id;
  }

  const { data: existing } = await service
    .from("company_members")
    .select("id, role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      already_member: true,
      message: "Este e-mail já está vinculado à empresa.",
      member_id: existing.id,
      role: existing.role,
    });
  }

  const { data: inserted, error: insertErr } = await service
    .from("company_members")
    .insert({
      company_id: companyId,
      user_id: userId,
      role,
    })
    .select("id, role")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    already_member: false,
    message:
      invited?.user?.id
        ? "Convite enviado. A pessoa receberá e-mail para definir senha e acessar."
        : "Usuário existente vinculado à empresa.",
    member_id: inserted.id,
    role: inserted.role,
  });
}
