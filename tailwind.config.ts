import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#f8fafc",
        app: {
          surface: "#ffffff",
          border: "#dfe3e8",
          text: "#18212f",
          muted: "#667085",
          blue: "#2563eb",
          green: "#15803d",
          amber: "#d97706",
          red: "#dc2626",
          violet: "#6d28d9"
        },
        background: "var(--ds-background)",
        "background-100": "var(--ds-background-100)",
        "background-200": "var(--ds-background-200)",
        "gray-1000": "var(--ds-gray-1000)",
        "gray-900": "var(--ds-gray-900)",
        "gray-alpha-400": "var(--ds-gray-alpha-400)"
      },
      boxShadow: {
        soft: "0 8px 24px rgba(24, 33, 47, 0.06)"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out"
      }
    }
  },
  plugins: []
};

export default config;
