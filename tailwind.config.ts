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
        }
      },
      boxShadow: {
        soft: "0 8px 24px rgba(24, 33, 47, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
