"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Ponte same-origin → whatsapp://
 * No Windows, com o app já aberto, o clique direto em whatsapp:// só foca a janela
 * e descarta phone/text. Uma navegação completa por esta página costuma reentregar
 * os parâmetros ao WhatsApp Desktop.
 */
export default function AbrirWhatsAppPage() {
  const [appHref, setAppHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(raw);
    const phone = (params.get("phone") || "").replace(/\D/g, "");
    const text = params.get("text") || "";

    if (phone.length < 10 || phone.length > 15) {
      setError("Telefone inválido para abrir o WhatsApp.");
      return;
    }

    const href = text
      ? `whatsapp://send/?phone=${phone}&text=${encodeURIComponent(text)}`
      : `whatsapp://send/?phone=${phone}`;
    setAppHref(href);

    // Navegação top-level para o protocolo (mesmo gesto da entrada nesta página).
    window.location.replace(href);
  }, []);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-semibold text-slate-900">Abrindo WhatsApp do PC…</h1>
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        <p className="text-sm text-slate-600">
          Se o app não for para o chat do motorista, use o botão abaixo. Se ainda ficar na tela
          inicial, feche o WhatsApp pela bandeja (Sair) e tente de novo.
        </p>
      )}
      {appHref ? (
        <a
          href={appHref}
          className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Abrir chat no app WhatsApp
        </a>
      ) : null}
      <Link href="/operacional/ordens-servico" className="text-sm text-brand-700 underline">
        Voltar às ordens de serviço
      </Link>
    </main>
  );
}
