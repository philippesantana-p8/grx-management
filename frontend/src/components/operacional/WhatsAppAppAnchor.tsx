"use client";

import type { ReactNode, MouseEvent } from "react";
import { isWhatsAppNativeHref } from "@/lib/service-order-proposal";

type Props = {
  href: string;
  className?: string;
  title?: string;
  "aria-label"?: string;
  children: ReactNode;
  /** Roda no clique sem cancelar a navegação nativa do protocolo. */
  onOpen?: () => void;
};

/**
 * Mesmo padrão da proposta ao cliente: anchor whatsapp:// sem preventDefault.
 * O Chrome entrega o protocolo ao app do PC pelo clique nativo do link.
 * Não usar target=_blank nem location.href — isso vira WhatsApp Web.
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

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onOpen?.();
    if (native) {
      // Deixa o browser abrir o WhatsApp Desktop (app). Não preventDefault.
      return;
    }
    // Mobile / HTTPS: navegação normal (nova aba).
    if (!event.defaultPrevented) {
      /* default OK */
    }
  };

  return (
    <a
      href={href}
      title={title}
      aria-label={ariaLabel}
      className={className}
      data-whatsapp-target={native ? "desktop-app" : "https"}
      {...(native ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
