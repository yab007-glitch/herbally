import { ImageResponse } from "next/og";

// Runs on the default Node runtime: the Edge sandbox is Vercel-specific and
// self-hosted standalone builds do not provide it.

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// Image generation
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "6px",
        background: "linear-gradient(135deg, #10b981, #14b8a6)",
      }}
    >
      <svg
        width="24"
        height="24"
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
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    { ...size }
  );
}
