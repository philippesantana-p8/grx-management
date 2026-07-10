import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Designação GRX Transportes e Logística";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
  "https://grx-management.vercel.app"
).replace(/\/$/, "");

const LOGO_DEPTH_LAYERS = [5, 4, 3, 2, 1] as const;

export default async function DriverAssignmentOpenGraphImage() {
  const logoUrl = `${APP_URL}/grx-logo.png`;

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
          background: "linear-gradient(165deg, #181818 0%, #0a0a0a 52%, #050505 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(165deg, #181818 0%, #0a0a0a 52%, #050505 100%)",
            borderRadius: 20,
            padding: "40px 64px",
            boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 420,
              height: 168,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {[...LOGO_DEPTH_LAYERS].reverse().map((depth) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`depth-${depth}`}
                src={logoUrl}
                alt=""
                width={420}
                height={168}
                style={{
                  position: "absolute",
                  left: depth * 2.5,
                  top: depth * 2.5,
                  opacity: depth === 1 ? 1 : 0.35,
                  filter: depth === 1 ? "none" : "brightness(0.35)",
                }}
              />
            ))}
          </div>
        </div>
        <p
          style={{
            marginTop: 36,
            fontSize: 30,
            color: "#f8fafc",
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
