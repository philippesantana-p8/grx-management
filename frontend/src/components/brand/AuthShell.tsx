import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
      <div className="mb-8">
        <BrandLogo
          variant="plaque3d"
          plaqueSurface="page"
          size="lg"
          caption="Gestão financeira e operacional"
          captionTone="on-light"
        />
      </div>
      {children}
    </div>
  );
}
