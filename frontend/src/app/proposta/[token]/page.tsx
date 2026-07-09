import type { Metadata } from "next";
import { PublicProposalClient } from "./PublicProposalClient";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
  "https://grx-management.vercel.app"
).replace(/\/$/, "");

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  return {
    title: "Proposta GRX — Transportes e Logística",
    description: "Proposta de ordem de serviço GRX Transportes e Logística. Confirme pelo link.",
    openGraph: {
      title: "Proposta GRX",
      description: "Proposta de frete — GRX Transportes e Logística",
      siteName: "GRX Transportes e Logística",
      type: "website",
      images: [
        {
          url: `${APP_URL}/grx-logo.png`,
          width: 512,
          height: 512,
          alt: "GRX Transportes e Logística",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: "Proposta GRX",
      description: "Proposta de frete — GRX Transportes e Logística",
      images: [`${APP_URL}/grx-logo.png`],
    },
  };
}

export default async function PublicProposalPage({ params }: Props) {
  const { token } = await params;
  return <PublicProposalClient token={token} />;
}
