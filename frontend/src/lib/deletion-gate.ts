import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMasterSessionUnlocked,
  verifyMasterPassword,
} from "@/lib/master-password";

/** Gate para exclusão crítica: aprovação (não-admin) ou Senha Máster (admin). */
export async function assertCriticalDeleteGate(input: {
  supabase: SupabaseClient;
  companyId: string;
  isAdmin: boolean;
  masterPassword?: string;
}): Promise<
  | { ok: true; mode: "approval" }
  | { ok: true; mode: "execute" }
  | { ok: false; error: string }
> {
  if (!input.isAdmin) {
    return { ok: true, mode: "approval" };
  }

  const {
    data: { user },
  } = await input.supabase.auth.getUser();
  if (user?.id && isMasterSessionUnlocked(input.companyId, user.id)) {
    return { ok: true, mode: "execute" };
  }

  const { data: security } = await input.supabase
    .from("company_security_settings")
    .select("master_password_salt, master_password_hash")
    .eq("company_id", input.companyId)
    .maybeSingle();

  if (!security?.master_password_salt || !security?.master_password_hash) {
    return {
      ok: false,
      error:
        "Cadastre a Senha Máster em Configurações → Parâmetros antes de excluir registros críticos.",
    };
  }

  const ok = await verifyMasterPassword(
    input.masterPassword ?? "",
    security.master_password_salt as string,
    security.master_password_hash as string
  );
  if (!ok) {
    return { ok: false, error: "Senha Máster incorreta. Exclusão crítica não executada." };
  }

  return { ok: true, mode: "execute" };
}
