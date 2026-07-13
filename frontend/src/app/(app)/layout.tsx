import { AccessProvider } from "@/lib/access-context";
import { CompanyProvider } from "@/lib/company-context";
import { AppShell } from "@/components/layout/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanyProvider>
      <AccessProvider>
        <AppShell>{children}</AppShell>
      </AccessProvider>
    </CompanyProvider>
  );
}
