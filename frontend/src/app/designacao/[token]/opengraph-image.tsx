import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Designação GRX Transportes e Logística";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
  "https://grx-management.vercel.app"
).replace(/\/$/, "");

export default async function DriverAssignmentOpenGraphImage() {
  const logoUrl = `${APP_URL}/grx-logo.png?v=2`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            borderRadius: 20,
            padding: "48px 72px",
            boxShadow: "0 8px 28px rgba(15,23,42,0.12)",
            border: "1px solid rgba(15,23,42,0.06)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" width={440} height={176} />
        </div>
        <p
          style={{
            marginTop: 40,
            fontSize: 28,
            color: "#0f172a",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Designação GRX — Transportes e Logística
        </p>
      </div>
    ),
    { ...size }
  );
}
