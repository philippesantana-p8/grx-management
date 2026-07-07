const BRAND_LOGO_PATH = "/grx-logo.png";
const DEFAULT_PUBLIC_APP_URL = "https://grx-management.vercel.app";
const DEFAULT_COMPANY_TAGLINE = "GRX Transportes e Logística";

function resolveOrigin(origin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (origin?.trim()) return origin.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return DEFAULT_PUBLIC_APP_URL;
}

export function getBrandLogoPublicUrl(origin?: string): string {
  return `${resolveOrigin(origin)}${BRAND_LOGO_PATH}`;
}

export async function fetchBrandLogoDataUrl(origin?: string): Promise<string | null> {
  const candidates = new Set<string>();
  candidates.add(getBrandLogoPublicUrl(origin));
  if (typeof window !== "undefined") {
    candidates.add(getBrandLogoPublicUrl(window.location.origin));
  }

  for (const logoUrl of candidates) {
    try {
      const response = await fetch(logoUrl);
      if (!response.ok) continue;
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      /* tenta próxima origem */
    }
  }

  return null;
}

export function buildEmailBrandFooterHtml(
  logoSrc: string,
  companyName = DEFAULT_COMPANY_TAGLINE
): string {
  const safeCompany = companyName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return [
    `<div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:left">`,
    `<div style="display:inline-block;background:linear-gradient(180deg,#1e293b 0%,#0f172a 100%);padding:16px 28px;border-radius:12px;box-shadow:0 6px 18px rgba(15,23,42,0.28)">`,
    `<img src="${logoSrc}" alt="${safeCompany}" width="200" height="80" style="display:block;max-width:200px;height:auto" />`,
    `</div>`,
    `<p style="margin:12px 0 0;font-size:11px;color:#64748b;letter-spacing:0.06em;text-transform:uppercase">${safeCompany}</p>`,
    `</div>`,
  ].join("");
}
