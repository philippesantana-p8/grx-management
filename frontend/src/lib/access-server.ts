import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_SCREENS, screenKeyFromPath } from "@/lib/app-screens";

type Membership = {
  company_id: string;
  role: string | null;
  partner_id: string | null;
};

/**
 * Se o usuário não pode ver a rota atual, devolve o href da primeira tela liberada.
 * Admin / sem partner_id (legado) → null (sem redirect).
 */
export async function resolveForbiddenRedirect(
  supabase: SupabaseClient,
  userId: string,
  pathname: string
): Promise<string | null> {
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, role, partner_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const member = membership as Membership | null;
  if (!member?.company_id) return null;
  if (member.role === "admin" || !member.partner_id) return null;

  const screenKey = screenKeyFromPath(pathname);
  if (!screenKey) return null;

  if (
    screenKey === "configuracoes.parametros" ||
    screenKey === "configuracoes.historico-exclusoes"
  ) {
    return firstAllowedPath(supabase, member.company_id, member.partner_id);
  }

  const { data: perm } = await supabase
    .from("partner_screen_permissions")
    .select("can_view")
    .eq("company_id", member.company_id)
    .eq("partner_id", member.partner_id)
    .eq("screen_key", screenKey)
    .maybeSingle();

  if (perm?.can_view) return null;
  return firstAllowedPath(supabase, member.company_id, member.partner_id);
}

/** Destino pós-login para sócio com permissões finas. */
export async function resolvePostLoginPath(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, role, partner_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const member = membership as Membership | null;
  if (!member?.company_id || member.role === "admin" || !member.partner_id) {
    return "/dashboard";
  }

  return (
    (await firstAllowedPath(supabase, member.company_id, member.partner_id)) ??
    "/login?error=sem-acesso"
  );
}

async function firstAllowedPath(
  supabase: SupabaseClient,
  companyId: string,
  partnerId: string
): Promise<string | null> {
  const { data: rows } = await supabase
    .from("partner_screen_permissions")
    .select("screen_key, can_view")
    .eq("company_id", companyId)
    .eq("partner_id", partnerId)
    .eq("can_view", true);

  const allowed = new Set(
    (rows ?? [])
      .filter((r) => r.can_view)
      .map((r) => r.screen_key as string)
  );

  for (const screen of APP_SCREENS) {
    if (
      screen.key === "configuracoes.parametros" ||
      screen.key === "configuracoes.historico-exclusoes"
    ) {
      continue;
    }
    if (allowed.has(screen.key)) return screen.href;
  }
  return null;
}
