import Image from "next/image";
import { cn } from "@/lib/utils";
type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  showTagline?: boolean;
  caption?: string;
  captionTone?: "on-dark" | "on-light";
  size?: "sm" | "md" | "lg" | "proposal";
  variant?: "default" | "plaque3d";
  /** Sidebar: tighter dark frame. Page: slightly larger for login. */
  plaqueSurface?: "sidebar" | "page";
  /** Use for print/PDF to avoid Next image optimization issues. */
  unoptimized?: boolean;
  /** @deprecated Mantido por compatibilidade; logo branco não usa camadas extras. */
  performanceLite?: boolean;
};

const sizes = {
  sm: { width: 160, height: 64 },
  md: { width: 220, height: 88 },
  lg: { width: 280, height: 112 },
  proposal: { width: 240, height: 96 },
};

/** Cache bust — força navegador a carregar logo nova do Rafael. */
const BRAND_LOGO_SRC = "/grx-logo.png?v=2";

function LogoImage({
  dim,
  className,
  priority = false,
  alt = "",
  ariaHidden = true,
  unoptimized = false,
}: {
  dim: { width: number; height: number };
  className?: string;
  priority?: boolean;
  alt?: string;
  ariaHidden?: boolean;
  unoptimized?: boolean;
}) {
  return (
    <Image
      src={BRAND_LOGO_SRC}
      alt={alt}
      aria-hidden={ariaHidden}
      width={dim.width}
      height={dim.height}
      priority={priority}
      unoptimized={unoptimized}
      className={className}
    />
  );
}

export function BrandLogo({
  className,
  imageClassName,
  showTagline = false,
  caption,
  captionTone = "on-dark",
  size = "md",
  variant = "default",
  plaqueSurface = "page",
  unoptimized = false,
}: BrandLogoProps) {
  const dim = sizes[size];

  const image = (
    <Image
      src={BRAND_LOGO_SRC}
      alt="GRX Transportes e Logística"
      width={dim.width}
      height={dim.height}
      priority
      className={cn("h-auto w-auto max-w-full object-contain", imageClassName)}
    />
  );

  if (variant === "plaque3d") {
    const isSidebar = plaqueSurface === "sidebar";

    return (
      <div className={cn("brand-logo-brand", className)}>
        <div
          className={cn(
            "brand-logo-plaque",
            isSidebar ? "brand-logo-plaque--sidebar" : "brand-logo-plaque--page"
          )}
        >
          <div
            className={cn(
              "brand-logo-3d-stage",
              isSidebar && "brand-logo-3d-stage--sidebar"
            )}
          >
            <LogoImage
              dim={dim}
              priority
              unoptimized={unoptimized}
              alt="GRX Transportes e Logística"
              ariaHidden={false}
              className={cn("brand-logo-image brand-logo-image--front", imageClassName)}
            />
          </div>
        </div>
        {caption ? (
          <p
            className={cn(
              "brand-logo-caption",
              captionTone === "on-light" && "brand-logo-caption--light"
            )}
          >
            {caption}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {image}
      {showTagline && (
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
          Gestão financeira e operacional
        </p>
      )}
    </div>
  );
}
