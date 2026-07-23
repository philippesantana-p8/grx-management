import { NextResponse } from "next/server";
import { requireCompanyMember } from "@/lib/billing-server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type Body = {
  alertId?: string;
  companyId?: string;
};

async function sendResendEmail(input: {
  to: string[];
  subject: string;
  text: string;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.AUDIT_ALERT_FROM_EMAIL?.trim() ||
    "Logistics AI <onboarding@resend.dev>";

  if (!apiKey) {
    return { ok: true, skipped: true };
  }

  if (input.to.length === 0) {
    return { ok: true, skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: text || `Resend HTTP ${res.status}` };
  }

  return { ok: true };
}

export async function POST(request: Request) {
  const auth = await requireCompanyMember();
  if (auth.error || !auth.membership || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Não autenticado." }, { status: auth.status });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const companyId = body.companyId || auth.membership.company_id;
  if (companyId !== auth.membership.company_id) {
    return NextResponse.json({ error: "Empresa inválida." }, { status: 403 });
  }

  if (!body.alertId) {
    return NextResponse.json({ error: "alertId obrigatório." }, { status: 400 });
  }

  const { data: alert, error: alertError } = await auth.supabase
    .from("deletion_alert_outbox")
    .select("id, company_id, title, body, email_status")
    .eq("id", body.alertId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (alertError || !alert) {
    return NextResponse.json(
      { error: alertError?.message ?? "Alerta não encontrado." },
      { status: 404 }
    );
  }

  if (alert.email_status === "sent") {
    return NextResponse.json({ ok: true, status: "already_sent" });
  }

  const { data: admins, error: adminsError } = await auth.supabase
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("role", "admin");

  if (adminsError) {
    return NextResponse.json({ error: adminsError.message }, { status: 500 });
  }

  const adminIds = (admins ?? [])
    .map((row) => row.user_id as string | null)
    .filter((id): id is string => Boolean(id));

  const service = createServiceClient();
  const emails: string[] = [];

  if (service && adminIds.length > 0) {
    for (const userId of adminIds) {
      const { data, error } = await service.auth.admin.getUserById(userId);
      if (!error && data.user?.email) emails.push(data.user.email);
    }
  } else if (auth.user.email) {
    // fallback: pelo menos o solicitante/admin da sessão
    emails.push(auth.user.email);
  }

  const uniqueEmails = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const send = await sendResendEmail({
    to: uniqueEmails,
    subject: `[Auditoria] ${alert.title}`,
    text: `${alert.body}\n\n— Logistics AI Platform\nEmpresa: ${companyId}`,
  });

  const emailStatus = send.skipped ? "skipped" : send.ok ? "sent" : "failed";
  await auth.supabase
    .from("deletion_alert_outbox")
    .update({
      email_status: emailStatus,
      email_error: send.error ?? null,
      emailed_at: send.ok && !send.skipped ? new Date().toISOString() : null,
    })
    .eq("id", alert.id)
    .eq("company_id", companyId);

  return NextResponse.json({
    ok: send.ok,
    status: emailStatus,
    recipients: uniqueEmails.length,
    error: send.error ?? null,
    hint: send.skipped
      ? "RESEND_API_KEY não configurada — alerta ficou só in-app."
      : null,
  });
}
