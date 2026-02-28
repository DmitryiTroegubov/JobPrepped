import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./data/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0D0D0D",
        surface: {
          1: "#1A1A1A",
          2: "#212121",
          3: "#262626"
        },
        neon: {
          purple: "#9A6BFF",
          pink: "#FF4FD8",
          cyan: "#23E7FF"
        }
      },
      borderRadius: {
        "3xl": "1.75rem",
        "4xl": "2rem"
      },
      fontFamily: {
        sans: ["Space Grotesk", "Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.4)"
      },
      backgroundImage: {
        "neon-gradient": "linear-gradient(120deg, #9A6BFF 0%, #FF4FD8 55%, #23E7FF 100%)"
      }
    }
  },
  plugins: []
};

export default config;
