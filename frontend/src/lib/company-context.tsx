"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/types/database";

type CompanyContextValue = {
  company: Company | null;
  companyId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue>({
  company: null,
  companyId: null,
  loading: true,
  refresh: async () => {},
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const refresh = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCompany(null);
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id, companies(*)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membership?.companies) {
      const c = membership.companies as unknown as Company;
      setCompany(c);
    } else {
      setCompany(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <CompanyContext.Provider
      value={{ company, companyId: company?.id ?? null, loading, refresh }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
