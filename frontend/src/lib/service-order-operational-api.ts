import type { SupabaseClient } from "@supabase/supabase-js";

function operationalRpcError(errorMessage: string, functionName: string, scriptName: string): string {
  if (errorMessage.includes(functionName)) {
    return `Função ${functionName} não encontrada no Supabase. Rode o script ${scriptName} no SQL Editor.`;
  }
  return errorMessage;
}

export async function registerServiceOrderFollowUp(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ count: number; lastAt: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("register_service_order_follow_up", {
    p_order_id: orderId,
  });

  if (error) {
    return {
      count: 0,
      lastAt: null,
      error: operationalRpcError(
        error.message,
        "register_service_order_follow_up",
        "apply-029-service-order-completion.sql"
      ),
    };
  }

  const payload = data as {
    service_follow_up_count?: number;
    service_last_follow_up_at?: string;
  } | null;

  return {
    count: payload?.service_follow_up_count ?? 0,
    lastAt: payload?.service_last_follow_up_at ?? null,
    error: null,
  };
}

export async function completeServiceOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ status: string | null; completedAt: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("complete_service_order", {
    p_order_id: orderId,
  });

  if (error) {
    return {
      status: null,
      completedAt: null,
      error: operationalRpcError(error.message, "complete_service_order", "apply-029-service-order-completion.sql"),
    };
  }

  const payload = data as { status?: string; service_completed_at?: string } | null;
  return {
    status: payload?.status ?? "Concluido",
    completedAt: payload?.service_completed_at ?? null,
    error: null,
  };
}
