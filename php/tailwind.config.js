// Ferramenta de desenvolvimento: gera php/public/assets/app.css (CSS puro) a partir das
// classes usadas nas telas PHP. Mesmo tema do sistema original (MB Soft UI).
// Uso: npx tailwindcss -c php/tailwind.config.js -i php/assets-src/app.css -o php/public/assets/app.css --minify
module.exports = {
  content: ["./php/app/**/*.php", "./php/public/assets/*.js"],
  theme: {
    screens: { sm: "820px", md: "820px", lg: "1024px", xl: "1280px" },
    extend: {
      colors: {
        fundo: "rgb(var(--c-fundo) / <alpha-value>)",
        lima: { DEFAULT: "rgb(var(--c-lima) / <alpha-value>)", hover: "rgb(var(--c-lima-hover) / <alpha-value>)" },
        ouro: { DEFAULT: "rgb(var(--c-ouro) / <alpha-value>)", rotulo: "rgb(var(--c-ouro-rotulo) / <alpha-value>)" },
        erro: { DEFAULT: "rgb(var(--c-erro) / <alpha-value>)", claro: "rgb(var(--c-erro-claro) / <alpha-value>)" },
        tinta: "#000E19",
        t1: "rgb(var(--c-t1) / <alpha-value>)",
        t2: "rgb(var(--c-t2) / <alpha-value>)",
        t3: "rgb(var(--c-t3) / <alpha-value>)",
        t4: "rgb(var(--c-t4) / <alpha-value>)",
        sulco: "var(--sulco)",
      },
      fontFamily: {
        sans: ["'Helvetica Neue'", "Helvetica", "Arial", "sans-serif"],
        mono: ["ui-monospace", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
