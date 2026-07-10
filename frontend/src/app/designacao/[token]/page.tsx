import type { Metadata } from "next";
import { PublicDriverAssignmentClient } from "./PublicDriverAssignmentClient";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
  "https://grx-management.vercel.app"
).replace(/\/$/, "");

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const pageUrl = `${APP_URL}/designacao/${token}`;
  const ogImage = `${APP_URL}/designacao/${token}/opengraph-image?v=1`;

  return {
    metadataBase: new URL(APP_URL),
    title: "Designação GRX — Transportes e Logística",
    description:
      "Designação de ordem de serviço GRX Transportes e Logística. Confirme aceite ou recusa pelo link.",
    openGraph: {
      title: "Designação GRX — Transportes e Logística",
      description: "Designação de corrida — confirme pelo link",
      url: pageUrl,
      siteName: "GRX Transportes e Logística",
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "Designação GRX Transportes e Logística",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Designação GRX",
      description: "Designação de corrida — GRX Transportes e Logística",
      images: [ogImage],
    },
  };
}

export default async function PublicDriverAssignmentPage({ params }: Props) {
  const { token } = await params;
  return <PublicDriverAssignmentClient token={token} />;
}
