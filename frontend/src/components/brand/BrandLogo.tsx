import type { CSSProperties } from "react";
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
  /** Menos camadas 3D — carrega mais rápido na tela. */
  performanceLite?: boolean;
};

const sizes = {
  sm: { width: 160, height: 64 },
  md: { width: 220, height: 88 },
  lg: { width: 280, height: 112 },
  proposal: { width: 240, height: 96 },
};

const LOGO_DEPTH_LAYERS_FULL = [5, 4, 3, 2, 1] as const;
const LOGO_DEPTH_LAYERS_LITE = [2, 1] as const;

function LogoImage({
  dim,
  className,
  depth,
  priority = false,
  alt = "",
  ariaHidden = true,
  unoptimized = false,
}: {
  dim: { width: number; height: number };
  className?: string;
  depth?: number;
  priority?: boolean;
  alt?: string;
  ariaHidden?: boolean;
  unoptimized?: boolean;
}) {
  return (
    <Image
      src="/grx-logo.png"
      alt={alt}
      aria-hidden={ariaHidden}
      width={dim.width}
      height={dim.height}
      priority={priority}
      unoptimized={unoptimized}
      style={
        depth !== undefined ? ({ ["--depth"]: depth } as CSSProperties) : undefined
      }
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
  performanceLite = false,
}: BrandLogoProps) {
  const dim = sizes[size];
  const depthLayers = performanceLite ? LOGO_DEPTH_LAYERS_LITE : LOGO_DEPTH_LAYERS_FULL;

  const image = (
    <Image
      src="/grx-logo.png"
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
            <div className="brand-logo-3d-stack">
              {depthLayers.map((depth) => (
                <LogoImage
                  key={depth}
                  dim={dim}
                  depth={depth}
                  unoptimized={unoptimized}
                  className="brand-logo-depth-layer"
                />
              ))}
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
