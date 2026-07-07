import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GRX Management",
  description: "Gestão financeira e operacional GRX Transportes e Logística",
  icons: {
    icon: "/grx-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={rubik.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
