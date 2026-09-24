import type { Config } from "tailwindcss";

// MB Soft UI — neomorfismo navy com acento lima.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Grids de 2+ colunas empilham abaixo de 820px.
    screens: { sm: "820px", md: "820px", lg: "1024px", xl: "1280px" },
    extend: {
      colors: {
        fundo: "#0A1B29",
        lima: { DEFAULT: "#BEF91B", hover: "#D4FF5E" },
        ouro: { DEFAULT: "#E8C547", rotulo: "#C8A94A" },
        erro: { DEFAULT: "#FF6B6B", claro: "#FFC9C9" },
        tinta: "#000E19",
        t1: "#FFFFFF",
        t2: "#A8BAC7",
        t3: "#8DA0B3",
        t4: "#6F8496",
        sulco: "rgba(43,74,99,.35)",
      },
      fontFamily: {
        sans: ["'Helvetica Neue'", "Helvetica", "Arial", "sans-serif"],
        mono: ["ui-monospace", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
