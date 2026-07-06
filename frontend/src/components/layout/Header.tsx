"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/Button";

export function Header() {
  const { company } = useCompany();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Empresa</p>
        <p className="text-sm font-semibold text-slate-900">
          {company?.trade_name || company?.name || "—"}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Sair
      </Button>
    </header>
  );
}
