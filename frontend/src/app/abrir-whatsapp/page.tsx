"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import {
  copyTextToClipboardSync,
  formatWhatsAppPhoneDisplay,
} from "@/lib/service-order-proposal";

/**
 * Ponte Windows — só protocolo do app (whatsapp://). Nunca api.whatsapp.com / Web:
 * isso abre o chat errado e manda texto truncado.
 */
export default function AbrirWhatsAppPage() {
  const [phone, setPhone] = useState("");
  const [shortText, setShortText] = useState("");
  const [fullMessage, setFullMessage] = useState("");
  const [chatOnlyHref, setChatOnlyHref] = useState<string | null>(null);
  const [withTextHref, setWithTextHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(raw);
    const phoneDigits = (params.get("phone") || "").replace(/\D/g, "");
    const text = (params.get("text") || "").trim();
    const full = (params.get("full") || text).trim();

    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setError("Telefone inválido para abrir o WhatsApp.");
      return;
    }

    setPhone(phoneDigits);
    setShortText(text);
    setFullMessage(full);
    setChatOnlyHref(`whatsapp://send?phone=${phoneDigits}`);
    setWithTextHref(
      text ? `whatsapp://send?phone=${phoneDigits}&text=${encodeURIComponent(text)}` : null
    );

    // Já deixa a mensagem completa na área de transferência ao chegar na página.
    if (full) copyTextToClipboardSync(full);
  }, []);

  const clipboardText = fullMessage || shortText;

  const copyMessage = () => {
    if (!clipboardText) return;
    const ok = copyTextToClipboardSync(clipboardText);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 2500);
  };

  const launchNative = (href: string) => {
    copyMessage();

    try {
      window.location.href = href;
    } catch {
      /* ignore */
    }

    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = href;
      document.body.appendChild(iframe);
      window.setTimeout(() => {
        try {
          iframe.remove();
        } catch {
          /* ignore */
        }
      }, 2500);
    } catch {
      /* ignore */
    }

    try {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch {
      /* ignore */
    }

    setTried(true);
  };

  const handleNativeClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();
    launchNative(href);
  };

  const phoneLabel = formatWhatsAppPhoneDisplay(phone) || phone;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-semibold text-slate-900">Abrir WhatsApp do PC</h1>
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Destino: chat do motorista <strong>{phoneLabel}</strong> ({phone}).{" "}
            <strong>Não usa WhatsApp Web</strong> — só o app do PC.
          </p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            1) Bandeja → WhatsApp → <strong>Sair</strong>
            <br />
            2) Clique no botão verde abaixo
            <br />
            3) Se o chat abrir sem texto, Ctrl+V (mensagem completa já copiada)
          </p>
        </>
      )}

      {chatOnlyHref ? (
        <div className="flex w-full flex-col gap-2">
          <a
            href={chatOnlyHref}
            onClick={(event) => handleNativeClick(event, chatOnlyHref)}
            className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-5 py-3 text-base font-semibold text-white shadow hover:bg-emerald-700"
          >
            Abrir chat do motorista no app
          </a>
          {withTextHref ? (
            <a
              href={withTextHref}
              onClick={(event) => handleNativeClick(event, withTextHref)}
              className="inline-flex w-full items-center justify-center rounded-lg border border-emerald-700 bg-white px-5 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              Tentar de novo com texto curto no app
            </a>
          ) : null}

          <button
            type="button"
            onClick={copyMessage}
            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {copied ? "Mensagem completa copiada" : "Copiar mensagem completa"}
          </button>

          {clipboardText ? (
            <textarea
              readOnly
              rows={8}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
              value={clipboardText}
            />
          ) : null}

          {tried ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Se o app não abriu o chat de <strong>{phoneLabel}</strong>: abra o WhatsApp do PC
              manualmente, busque esse número, cole com Ctrl+V e envie. Não use WhatsApp Web — o
              Web abre no chat errado e corta a mensagem.
            </p>
          ) : null}
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
