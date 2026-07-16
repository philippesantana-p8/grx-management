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
  const { loading, canViewScreen, isAdmin, partnerId } = useAccess();
  const screenKey = screenKeyFromPath(pathname);
  const restricted = Boolean(partnerId) && !isAdmin;
  const denied = Boolean(
    restricted && screenKey && !canViewScreen(screenKey)
  );

  useEffect(() => {
    if (loading || !denied) return;
    const next = firstAllowedHref(canViewScreen);
    router.replace(next ?? "/login?error=sem-acesso");
  }, [loading, denied, canViewScreen, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <Loading />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-slate-600">
        Redirecionando para uma tela permitida…
      </div>
    );
  }

  return children;
}
