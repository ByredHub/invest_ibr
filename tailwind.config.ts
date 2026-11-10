import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#041121", 800: "#0b1c30", 700: "#13293f", 600: "#1d3850" },
        tiffany: { DEFAULT: "#57cfcb", 50: "#effaf9", 100: "#d6f3f1", 600: "#2fa9a5", 700: "#1f6f6b" },
        paper: "#F6F5F1",
        line: "#E7E4DC",
        muted: "#6B7280",
        brick: { DEFAULT: "#B8420F", 50: "#fbf0ea" },
        sand: "#D6C7A1",
        slate2: "#8A9BA8",
      },
      fontFamily: { sans: ["var(--font-onest)", "system-ui", "sans-serif"] },
      borderRadius: { card: "12px", ctl: "8px" },
      keyframes: {
        pop: { from: { opacity: "0", transform: "translateY(6px) scale(.98)" }, to: { opacity: "1", transform: "none" } },
        fade: { from: { opacity: "0" }, to: { opacity: "1" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: { pop: "pop .18s ease-out", fade: "fade .15s ease-out" },
    },
  },
  plugins: [],
};
export default config;
