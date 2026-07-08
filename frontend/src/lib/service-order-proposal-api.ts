import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProposalResponse, ServiceOrder } from "@/types/database";

export type PublicProposalPayload = {
  found: boolean;
  company_name?: string;
  driver_name?: string | null;
  proposal_response?: ProposalResponse;
  proposal_sent_at?: string | null;
  can_respond?: boolean;
  order?: Partial<ServiceOrder> & Pick<ServiceOrder, "code" | "service_type" | "service_date" | "plate">;
};

export async function ensureProposalToken(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ token: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("ensure_proposal_token", {
    p_order_id: orderId,
  });

  if (error) return { token: null, error: error.message };
  return { token: data as string, error: null };
}

export async function markProposalSent(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ token: string | null; proposalSentAt: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("mark_proposal_sent", {
    p_order_id: orderId,
  });

  if (error) return { token: null, proposalSentAt: null, error: error.message };

  const payload = data as { token?: string; proposal_sent_at?: string } | null;
  return {
    token: payload?.token ?? null,
    proposalSentAt: payload?.proposal_sent_at ?? null,
    error: null,
  };
}

export async function registerProposalFollowUp(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ count: number; lastAt: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("register_proposal_follow_up", {
    p_order_id: orderId,
  });

  if (error) return { count: 0, lastAt: null, error: error.message };

  const payload = data as {
    proposal_follow_up_count?: number;
    proposal_last_follow_up_at?: string;
  } | null;

  return {
    count: payload?.proposal_follow_up_count ?? 0,
    lastAt: payload?.proposal_last_follow_up_at ?? null,
    error: null,
  };
}

export async function fetchPublicProposal(
  supabase: SupabaseClient,
  token: string
): Promise<{ data: PublicProposalPayload | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_public_proposal", {
    p_token: token,
  });

  if (error) return { data: null, error: error.message };
  return { data: data as PublicProposalPayload, error: null };
}

export async function respondToProposal(
  supabase: SupabaseClient,
  token: string,
  action: "accept" | "reject"
): Promise<{ proposalResponse: ProposalResponse | null; status: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("respond_to_proposal", {
    p_token: token,
    p_action: action,
  });

  if (error) return { proposalResponse: null, status: null, error: error.message };

  const payload = data as { proposal_response?: ProposalResponse; status?: string } | null;
  return {
    proposalResponse: payload?.proposal_response ?? null,
    status: payload?.status ?? null,
    error: null,
  };
}

export async function acceptProposalOnBehalfOfClient(
  supabase: SupabaseClient,
  orderId: string
): Promise<{
  proposalResponse: ProposalResponse | null;
  status: string | null;
  proposalAcceptedAt: string | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("accept_proposal_on_behalf_of_client", {
    p_order_id: orderId,
  });

  if (error) {
    return { proposalResponse: null, status: null, proposalAcceptedAt: null, error: error.message };
  }

  const payload = data as {
    proposal_response?: ProposalResponse;
    status?: string;
    proposal_accepted_at?: string;
  } | null;

  return {
    proposalResponse: payload?.proposal_response ?? "accepted",
    status: payload?.status ?? "Aberto",
    proposalAcceptedAt: payload?.proposal_accepted_at ?? null,
    error: null,
  };
}

export async function rejectProposalOnBehalfOfClient(
  supabase: SupabaseClient,
  orderId: string
): Promise<{
  proposalResponse: ProposalResponse | null;
  status: string | null;
  proposalRejectedAt: string | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("reject_proposal_on_behalf_of_client", {
    p_order_id: orderId,
  });

  if (error) {
    return { proposalResponse: null, status: null, proposalRejectedAt: null, error: error.message };
  }

  const payload = data as {
    proposal_response?: ProposalResponse;
    status?: string;
    proposal_rejected_at?: string;
  } | null;

  return {
    proposalResponse: payload?.proposal_response ?? "rejected",
    status: payload?.status ?? "Aguardando aprovação cliente",
    proposalRejectedAt: payload?.proposal_rejected_at ?? null,
    error: null,
  };
}

export async function resetProposalClientResponse(
  supabase: SupabaseClient,
  orderId: string
): Promise<{ proposalResponse: ProposalResponse | null; status: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("reset_proposal_client_response", {
    p_order_id: orderId,
  });

  if (error) return { proposalResponse: null, status: null, error: error.message };

  const payload = data as { proposal_response?: ProposalResponse; status?: string } | null;
  return {
    proposalResponse: payload?.proposal_response ?? "pending",
    status: payload?.status ?? null,
    error: null,
  };
}

export function daysWaitingProposal(sentAt: string | null | undefined, now = new Date()): number | null {
  if (!sentAt) return null;
  const sent = new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return null;
  const diffMs = now.getTime() - sent.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function isProposalFollowUpOverdue(
  sentAt: string | null | undefined,
  response: ProposalResponse | string | null | undefined,
  thresholdHours = 48
): boolean {
  if (response !== "pending" || !sentAt) return false;
  const sent = new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return false;
  return Date.now() - sent.getTime() >= thresholdHours * 60 * 60 * 1000;
}
