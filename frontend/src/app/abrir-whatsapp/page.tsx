"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { copyTextToClipboardSync } from "@/lib/service-order-proposal";

/**
 * Ponte Windows: o Chrome entrega o clique aqui; o segundo clique no &lt;a whatsapp://&gt;
 * abre o app. Com o Desktop já aberto, whatsapp:// direto só foca a tela inicial.
 */
export default function AbrirWhatsAppPage() {
  const [chatOnlyHref, setChatOnlyHref] = useState<string | null>(null);
  const [withTextHref, setWithTextHref] = useState<string | null>(null);
  const [phoneLabel, setPhoneLabel] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(raw);
    const phone = (params.get("phone") || "").replace(/\D/g, "");
    const text = (params.get("text") || "").trim();

    if (phone.length < 10 || phone.length > 15) {
      setError("Telefone inválido para abrir o WhatsApp.");
      return;
    }

    setPhoneLabel(phone);
    setMessage(text);
    setChatOnlyHref(`whatsapp://send?phone=${phone}`);
    setWithTextHref(
      text ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}` : null
    );
  }, []);

  const handleOpenMouseDown = () => {
    if (message) copyTextToClipboardSync(message);
  };

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-semibold text-slate-900">Abrir WhatsApp do PC</h1>
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Clique no botão verde para abrir o <strong>app</strong> no chat do número{" "}
            <strong>{phoneLabel || "…"}</strong>. Não usa WhatsApp Web.
          </p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Se o WhatsApp só voltar à <strong>tela inicial</strong> (lista de conversas): clique com o
            botão direito no ícone do WhatsApp na bandeja → <strong>Sair</strong>. Depois clique de
            novo no botão verde abaixo.
          </p>
        </>
      )}
      {chatOnlyHref ? (
        <div className="flex w-full flex-col gap-2">
          <a
            href={chatOnlyHref}
            onMouseDown={handleOpenMouseDown}
            className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-5 py-3 text-base font-semibold text-white shadow hover:bg-emerald-700"
          >
            Abrir chat no app WhatsApp
          </a>
          {withTextHref ? (
            <a
              href={withTextHref}
              onMouseDown={handleOpenMouseDown}
              className="inline-flex w-full items-center justify-center rounded-lg border border-emerald-700 bg-white px-5 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              Tentar de novo com a mensagem no texto
            </a>
          ) : null}
          <p className="text-xs text-slate-600">
            A mensagem da designação já foi copiada neste clique. Se a caixa do WhatsApp vier vazia,
            use Ctrl+V no chat do motorista.
          </p>
        </div>
      ) : !error ? (
        <p className="text-sm text-slate-500">Preparando link…</p>
      ) : null}
      <Link href="/operacional/ordens-servico" className="text-sm font-medium text-red-700 underline">
        Voltar às ordens de serviço
      </Link>
    </main>
  );
}
