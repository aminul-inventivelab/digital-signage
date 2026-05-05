import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "var(--theme-faint-25)",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        brand: {
          DEFAULT: "var(--theme)",
          contrast: "var(--theme-contrast)",
          hover: "var(--theme-hover)",
          soft: "var(--theme-soft)",
          softer: "var(--theme-softer)",
          softest: "var(--theme-softest)",
          faint20: "var(--theme-faint-20)",
          faint25: "var(--theme-faint-25)",
          faint30: "var(--theme-faint-30)",
          muted: "var(--theme-foreground-muted)",
          strong: "var(--theme-foreground-strong)",
          badge: "var(--theme-foreground-badge)",
          onDark: "var(--theme-foreground-on-dark)",
          onDarkSoft: "var(--theme-foreground-on-dark-soft)",
          heading: "var(--theme-foreground-on-light-heading)",
        },
        primary: {
          DEFAULT: "var(--theme)",
          foreground: "var(--theme-contrast)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
    },
  },
  plugins: [animate],
};

export default config;
