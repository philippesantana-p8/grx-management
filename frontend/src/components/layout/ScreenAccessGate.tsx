"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loading } from "@/components/ui/Badge";
import { useAccess } from "@/lib/access-context";
import { firstAllowedHref, screenKeyFromPath } from "@/lib/app-screens";

/**
 * Impede abrir rota sem permissão (ex.: login/logo mandam para /dashboard
 * mesmo com Dashboard desmarcado na Senha Máster).
 */
export function ScreenAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, canViewScreen } = useAccess();
  const screenKey = screenKeyFromPath(pathname);
  const denied = Boolean(screenKey && !loading && !canViewScreen(screenKey));

  useEffect(() => {
    if (loading || !denied) return;
    const next = firstAllowedHref(canViewScreen);
    router.replace(next ?? "/login?error=sem-acesso");
  }, [loading, denied, canViewScreen, router]);

  if (loading || denied) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-sm text-slate-600">
        <Loading />
        {denied ? <span>Redirecionando para uma tela permitida…</span> : null}
      </div>
    );
  }

  return children;
}
