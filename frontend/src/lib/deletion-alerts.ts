import type { SupabaseClient } from "@supabase/supabase-js";

export type DeletionAlert = {
  id: string;
  company_id: string;
  alert_type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  meta_json: Record<string, unknown> | null;
  created_at: string;
  email_status: "pending" | "sent" | "skipped" | "failed";
  email_error: string | null;
  read_at: string | null;
};

export async function enqueueDeletionAlert(input: {
  supabase: SupabaseClient;
  companyId: string;
  alertType: string;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<{ id: string | null; error: string | null }> {
  const { data: authData } = await input.supabase.auth.getUser();
  const { data, error } = await input.supabase
    .from("deletion_alert_outbox")
    .insert({
      company_id: input.companyId,
      alert_type: input.alertType,
      title: input.title,
      body: input.body,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      meta_json: input.meta ?? null,
      created_by: authData.user?.id ?? null,
      email_status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    if (
      error.message.toLowerCase().includes("does not exist") ||
      error.message.toLowerCase().includes("não existe")
    ) {
      return { id: null, error: null };
    }
    return { id: null, error: error.message };
  }

  const alertId = (data?.id as string) ?? null;
  if (alertId) {
    try {
      await fetch("/api/audit/notify-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, companyId: input.companyId }),
      });
    } catch {
      // in-app permanece mesmo se o e-mail falhar
    }
  }

  return { id: alertId, error: null };
}

export async function listDeletionAlerts(
  supabase: SupabaseClient,
  companyId: string,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<{ rows: DeletionAlert[]; error: string | null }> {
  let query = supabase
    .from("deletion_alert_outbox")
    .select(
      "id, company_id, alert_type, title, body, entity_type, entity_id, meta_json, created_at, email_status, email_error, read_at"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 30);

  if (options?.unreadOnly) query = query.is("read_at", null);

  const { data, error } = await query;
  if (error) {
    if (
      error.message.toLowerCase().includes("does not exist") ||
      error.message.toLowerCase().includes("não existe")
    ) {
      return { rows: [], error: null };
    }
    return { rows: [], error: error.message };
  }

  return { rows: (data ?? []) as DeletionAlert[], error: null };
}

export async function markDeletionAlertRead(
  supabase: SupabaseClient,
  companyId: string,
  alertId: string
): Promise<{ error: string | null }> {
  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("deletion_alert_outbox")
    .update({
      read_at: new Date().toISOString(),
      read_by: authData.user?.id ?? null,
    })
    .eq("id", alertId)
    .eq("company_id", companyId);

  return { error: error?.message ?? null };
}
