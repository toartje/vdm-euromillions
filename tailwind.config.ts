import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        pool: {
          50: "#eff8ff",
          100: "#d9eeff",
          200: "#b4ddff",
          300: "#83c4ff",
          400: "#4ea0f0",
          500: "#2d7de6",
          600: "#225fc1",
          700: "#1f4d9c",
          800: "#1e417e",
          900: "#1c3767"
        }
      },
      boxShadow: {
        soft: "0 16px 50px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
