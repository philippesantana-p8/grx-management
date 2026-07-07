"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCompany } from "@/lib/company-context";

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
    <header className="app-shell-header app-header-shell">
      <div className="app-header-company">
        <p className="app-header-company-label">Empresa</p>
        <p className="app-header-company-name">
          {company?.trade_name || company?.name || "—"}
        </p>
      </div>
      <button type="button" className="app-header-btn" onClick={handleLogout}>
        Sair
      </button>
    </header>
  );
}
