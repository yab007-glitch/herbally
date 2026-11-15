import { ImageResponse } from "next/og";

// Default Node runtime — self-hosted standalone builds have no Edge sandbox.
export const alt = "HerbAlly - Your Trusted Guide to Medicinal Herbs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function TwitterImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Background pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.1,
          backgroundImage:
            "radial-gradient(circle at 25% 25%, #10b981 0%, transparent 50%), radial-gradient(circle at 75% 75%, #14b8a6 0%, transparent 50%)",
        }}
      />

      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 120,
          height: 120,
          borderRadius: 24,
          background: "linear-gradient(135deg, #10b981, #14b8a6)",
          marginBottom: 32,
        }}
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 4C9 7 6 10 6 15C6 17 7 18.5 8 19.5C8.5 17.5 10 15.5 12 13.5C14 15.5 15.5 17.5 16 19.5C17 18.5 18 17 18 15C18 10 15 7 12 4Z"
            fill="white"
            opacity="0.95"
          />
          <path
            d="M12 8V16"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 72,
          fontWeight: "bold",
          background: "linear-gradient(135deg, #10b981, #14b8a6)",
          backgroundClip: "text",
          color: "transparent",
          marginBottom: 16,
        }}
      >
        HerbAlly
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 28,
          color: "#94a3b8",
          textAlign: "center",
          maxWidth: 800,
        }}
      >
        Your Trusted Guide to Medicinal Herbs
      </div>

      {/* Stats */}
      <div
        style={{
          display: "flex",
          gap: 48,
          marginTop: 48,
        }}
      >
        {[
          { label: "2,700+", sublabel: "Herbs" },
          { label: "Free", sublabel: "Forever" },
          { label: "AI", sublabel: "Herbalist" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: 36,
                fontWeight: "bold",
                color: "#10b981",
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontSize: 18,
                color: "#64748b",
              }}
            >
              {stat.sublabel}
            </div>
          </div>
        ))}
      </div>

      {/* URL */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          fontSize: 20,
          color: "#475569",
        }}
      >
        herbally.app
      </div>
    </div>,
    { ...size }
  );
}
