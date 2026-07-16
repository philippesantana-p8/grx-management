"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCompany } from "@/lib/company-context";
import { clearMasterSession } from "@/lib/master-password";

type HeaderProps = {
  onMenuClick?: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
  const { company } = useCompany();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    clearMasterSession();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="app-shell-header app-header-shell sticky top-0 z-30">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          type="button"
          className="app-header-menu-btn lg:hidden"
          aria-label="Abrir menu"
          onClick={onMenuClick}
        >
          <span className="app-header-menu-icon" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </button>
        <div className="app-header-company min-w-0">
          <p className="app-header-company-label">Empresa</p>
          <p className="app-header-company-name truncate">
            {company?.trade_name || company?.name || "—"}
          </p>
        </div>
      </div>
      <button type="button" className="app-header-btn shrink-0" onClick={handleLogout}>
        Sair
      </button>
    </header>
  );
}
