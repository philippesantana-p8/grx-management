import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberRole } from "@/lib/access-context";

export type ManageableRole = "admin" | "operacional";

export type CompanyMemberRow = {
  id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  email: string | null;
  full_name: string | null;
  /** Papel simplificado na UI MVP. */
  ui_role: ManageableRole;
  can_approve_launches: boolean;
};

export function toUiRole(role: string | null | undefined): ManageableRole {
  return role === "admin" ? "admin" : "operacional";
}

export function roleLabel(role: string | null | undefined): string {
  if (role === "admin") return "Administrador";
  if (role === "financeiro") return "Operacional (financeiro)";
  if (role === "socio") return "Operacional (sócio)";
  return "Operacional";
}

export async function listCompanyMembers(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ rows: CompanyMemberRow[]; error: string | null }> {
  const { data: members, error } = await supabase
    .from("company_members")
    .select("id, user_id, role, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) {
    return { rows: [], error: error.message };
  }

  const list = members ?? [];
  const userIds = list.map((m) => m.user_id);
  const profileById = new Map<string, { email: string | null; full_name: string | null }>();

  if (userIds.length > 0) {
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);

    if (profileErr) {
      return { rows: [], error: profileErr.message };
    }

    for (const p of profiles ?? []) {
      profileById.set(p.id, {
        email: p.email ?? null,
        full_name: p.full_name ?? null,
      });
    }
  }

  const rows: CompanyMemberRow[] = list.map((m) => {
    const profile = profileById.get(m.user_id);
    const role = (m.role as MemberRole) ?? "operacional";
    const ui_role = toUiRole(role);
    return {
      id: m.id,
      user_id: m.user_id,
      role,
      created_at: m.created_at,
      email: profile?.email ?? null,
      full_name: profile?.full_name ?? null,
      ui_role,
      can_approve_launches: ui_role === "admin",
    };
  });

  return { rows, error: null };
}

export async function setCompanyMemberRole(
  supabase: SupabaseClient,
  companyId: string,
  memberId: string,
  nextUiRole: ManageableRole
): Promise<{ error: string | null }> {
  const nextRole: MemberRole = nextUiRole === "admin" ? "admin" : "operacional";

  const { data: target, error: targetErr } = await supabase
    .from("company_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (targetErr) return { error: targetErr.message };
  if (!target) return { error: "Usuário não encontrado nesta empresa." };

  if (toUiRole(target.role) === "admin" && nextRole !== "admin") {
    const { count, error: countErr } = await supabase
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("role", "admin");

    if (countErr) return { error: countErr.message };
    if ((count ?? 0) <= 1) {
      return {
        error:
          "Não é possível remover o último administrador. Promova outra pessoa a Admin antes.",
      };
    }
  }

  const { error } = await supabase
    .from("company_members")
    .update({ role: nextRole })
    .eq("id", memberId)
    .eq("company_id", companyId);

  if (error) return { error: error.message };
  return { error: null };
}
