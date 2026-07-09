/**
 * Node script — validates mailto/WhatsApp URL sizes and HTML structure (no browser).
 * Run: node scripts/validate-share-payloads.mjs
 */

const WHATSAPP_URL_TEXT_BUDGET = 2800;
const MAX_MAILTO_HREF_LENGTH = 2040;

function encodeBody(body) {
  return encodeURIComponent(body);
}

function buildMailtoHref(subject, body) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeBody(body)}`;
}

function buildWhatsAppHref(text, phone) {
  const encoded = encodeURIComponent(text);
  return phone
    ? `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
}

const samplePlainBody = `Olá, Cliente,



Tudo bem?



Segue a proposta para análise.

Proposta OS OS-001 — GRX Transportes
Cliente: ACME
Tipo: Frete
Data: 09/07/2026
Placa: ABC1D23

Rota
A: São Paulo
B: Rio de Janeiro
Distância: 430 km
Valor proposto: R$ 5.000,00

Caso concorde, acesse o link que publico abaixo e confirme o aceite da proposta.

https://grx-management.vercel.app/proposta/0672deaaa1bd494790bbc28d5ed3b4c3882ee279931d4fb28a0b736f7449e6b5

Escaneie o QR Code abaixo para abrir a proposta no celular.

Fico no aguardo,
Obrigado pela atenção!

GRX Transportes e Logística`;

const sampleWhatsApp = samplePlainBody.replace(/\*/g, "");
const qrStub =
  "data:image/png;base64," + "A".repeat(8000);
const logoStub =
  "data:image/jpeg;base64," + "B".repeat(12000);

const htmlSample = `<div>Hello<br><img src="${qrStub}" width="220" /><img src="${logoStub}" width="200" /></div>`;
const wrapped = `<html><body><!--StartFragment-->${htmlSample}<!--EndFragment--></body></html>`;

const mailtoHref = buildMailtoHref("Proposta OS OS-001", samplePlainBody.slice(0, 900));
const waHref = buildWhatsAppHref(sampleWhatsApp, "5511999999999");

console.log("=== Share payload validation ===");
console.log("Plain body chars:", samplePlainBody.length);
console.log("Mailto href chars:", mailtoHref.length, mailtoHref.length <= MAX_MAILTO_HREF_LENGTH ? "OK" : "TOO LONG");
console.log(
  "WhatsApp encoded chars:",
  encodeURIComponent(sampleWhatsApp).length,
  encodeURIComponent(sampleWhatsApp).length <= WHATSAPP_URL_TEXT_BUDGET ? "OK" : "TRUNCATE"
);
console.log("WhatsApp href chars:", waHref.length);
console.log("HTML clipboard chars (with stub images):", wrapped.length);
console.log("HTML has img tags:", (wrapped.match(/<img /g) || []).length);
console.log("HTML has StartFragment:", wrapped.includes("StartFragment"));
