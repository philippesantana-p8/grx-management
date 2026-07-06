import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GRX Management",
  description: "Gestão financeira e operacional GRX",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
