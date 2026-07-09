import QRCode from "qrcode";
import { buildPublicProposalUrl } from "@/lib/service-order-proposal";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const proposalUrl = buildPublicProposalUrl(token.trim());

  try {
    const png = await QRCode.toBuffer(proposalUrl, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    });

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("QR unavailable", { status: 500 });
  }
}
