"use client";

import type { ReactNode, MouseEvent } from "react";
import { isWhatsAppNativeHref } from "@/lib/service-order-proposal";

type Props = {
  href: string;
  className?: string;
  title?: string;
  "aria-label"?: string;
  children: ReactNode;
  /** Roda no clique (antes da navegação). */
  onOpen?: () => void;
};

function isDesktopBridgeHref(href: string): boolean {
  return href.startsWith("/abrir-whatsapp");
}

/**
 * Abre o WhatsApp do PC:
 * - `/abrir-whatsapp#…` → navegação completa → whatsapp:// (melhor com app já aberto)
 * - `whatsapp://…` → protocolo direto
 * Nunca usar api.whatsapp.com / Web neste componente.
 */
export function WhatsAppAppAnchor({
  href,
  className,
  title,
  "aria-label": ariaLabel,
  children,
  onOpen,
}: Props) {
  const native = isWhatsAppNativeHref(href);
  const bridge = isDesktopBridgeHref(href);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onOpen?.();

    if (bridge) {
      // Evita soft-nav do Next.js; precisa ser navegação completa para a ponte.
      event.preventDefault();
      window.location.assign(href);
      return;
    }

    if (native) {
      // Clique nativo no protocolo — não preventDefault.
      return;
    }
  };

  return (
    <a
      href={href}
      title={title}
      aria-label={ariaLabel}
      className={className}
      data-whatsapp-target={bridge ? "desktop-bridge" : native ? "desktop-app" : "https"}
      {...(native || bridge ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
