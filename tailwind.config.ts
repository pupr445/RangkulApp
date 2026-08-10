import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F5F7F8",
        surface: "#FFFFFF",
        surfaceAlt: "#EEF2F3",
        ink: "#16323C",
        inkMuted: "#5C7079",
        border: "#DEE5E7",
        flash: "#E8A33D",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(22,50,60,0.06), 0 4px 14px rgba(22,50,60,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
