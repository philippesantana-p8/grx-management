type EmlInlineImage = {
  cid: string;
  mimeType: string;
  base64: string;
};

function encodeQuotedPrintableUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let out = "";
  let lineLen = 0;

  const append = (chunk: string) => {
    for (const char of chunk) {
      if (lineLen + char.length > 75) {
        out += "=\r\n";
        lineLen = 0;
      }
      out += char;
      lineLen += char.length;
    }
  };

  for (const byte of bytes) {
    if (
      (byte >= 33 && byte <= 60) ||
      (byte >= 62 && byte <= 126) ||
      byte === 9 ||
      byte === 32
    ) {
      append(String.fromCharCode(byte));
    } else if (byte === 13 || byte === 10) {
      out += "\r\n";
      lineLen = 0;
    } else {
      append(`=${byte.toString(16).toUpperCase().padStart(2, "0")}`);
    }
  }

  return out;
}

function encodeSubjectUtf8(subject: string): string {
  const bytes = new TextEncoder().encode(subject);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function wrapBase64(base64: string): string {
  return base64.replace(/(.{76})/g, "$1\r\n").trim();
}

/** Substitui data URLs por cid: e extrai anexos inline para multipart/related. */
export function inlineHtmlImagesForEml(html: string): {
  html: string;
  images: EmlInlineImage[];
} {
  const images: EmlInlineImage[] = [];
  let index = 0;

  const htmlWithCids = html.replace(
    /src="(data:image\/(png|jpeg|jpg|gif);base64,([^"]+))"/gi,
    (_match, _dataUrl, subtype, base64) => {
      const cid = `grx-img-${index}`;
      index += 1;
      const mimeType = subtype.toLowerCase() === "jpg" ? "image/jpeg" : `image/${subtype.toLowerCase()}`;
      images.push({ cid, mimeType, base64 });
      return `src="cid:${cid}"`;
    }
  );

  return { html: htmlWithCids, images };
}

export function buildProposalEmlContent(options: {
  subject: string;
  plainBody: string;
  htmlBody: string;
  to?: string | null;
  from?: string;
}): string {
  const boundary = `grx-eml-${Date.now().toString(16)}`;
  const from = options.from ?? "GRX Transportes <propostas@grx-management.vercel.app>";
  const { html, images } = inlineHtmlImagesForEml(options.htmlBody);

  const headers = [
    `From: ${from}`,
    options.to?.trim() ? `To: ${options.to.trim()}` : null,
    `Subject: ${encodeSubjectUtf8(options.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${boundary}"`,
    "",
  ]
    .filter(Boolean)
    .join("\r\n");

  const parts: string[] = [];

  parts.push(`--${boundary}`);
  parts.push("Content-Type: multipart/alternative; boundary=\"grx-alt\"");
  parts.push("");

  parts.push("--grx-alt");
  parts.push("Content-Type: text/plain; charset=UTF-8");
  parts.push("Content-Transfer-Encoding: quoted-printable");
  parts.push("");
  parts.push(encodeQuotedPrintableUtf8(options.plainBody));
  parts.push("");

  parts.push("--grx-alt");
  parts.push("Content-Type: text/html; charset=UTF-8");
  parts.push("Content-Transfer-Encoding: quoted-printable");
  parts.push("");
  parts.push(encodeQuotedPrintableUtf8(`<!DOCTYPE html><html><body>${html}</body></html>`));
  parts.push("");
  parts.push("--grx-alt--");
  parts.push("");

  for (const image of images) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: ${image.mimeType}`);
    parts.push("Content-Transfer-Encoding: base64");
    parts.push(`Content-ID: <${image.cid}>`);
    parts.push(`Content-Disposition: inline; filename="${image.cid}"`);
    parts.push("");
    parts.push(wrapBase64(image.base64));
    parts.push("");
  }

  parts.push(`--${boundary}--`);
  parts.push("");

  return `${headers}\r\n${parts.join("\r\n")}`;
}

export function openEmlInDefaultMailClient(emlContent: string, filename: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const safeName = filename.endsWith(".eml") ? filename : `${filename}.eml`;
    const file = new File([emlContent], safeName, { type: "message/rfc822" });
    const url = URL.createObjectURL(file);

    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return true;
  } catch {
    return false;
  }
}
