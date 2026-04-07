import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--bg-primary)",
        card: "var(--bg-card)",
        glass: "var(--bg-glass)",
        subtle: "var(--border-subtle)",
        green: "var(--green)",
        yellow: "var(--yellow)",
        red: "var(--red)",
        "text-primary": "var(--text-primary)",
        "text-muted": "var(--text-muted)",
      },
      fontFamily: {
        sans: ['var(--font-space-grotesk)', 'sans-serif'],
        mono: ['var(--font-share-tech-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
