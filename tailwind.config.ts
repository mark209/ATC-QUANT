import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#070b1a",
        panel: "#111827",
        panelSoft: "#152033",
        line: "#20304a",
        electric: "#2f6cff",
        cyan: "#18d3ff",
        mint: "#35e58b",
        danger: "#ff6262",
        amber: "#f5b94d"
      },
      boxShadow: {
        terminal: "0 18px 50px rgba(0, 0, 0, 0.35)",
        glow: "0 0 32px rgba(47, 108, 255, 0.24)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
