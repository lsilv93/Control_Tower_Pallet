"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type Tema = "dark" | "light";
export const COOKIE_TEMA = "ctp_tema";

/** Alterna entre tema escuro e claro; a escolha fica num cookie (lido no servidor). */
export function BotaoTema({ inicial, comRotulo = false }: { inicial: Tema; comRotulo?: boolean }) {
  const [tema, setTema] = useState<Tema>(inicial);

  useEffect(() => {
    const atual = document.documentElement.dataset.theme;
    if (atual === "light" || atual === "dark") setTema(atual);
  }, []);

  function alternar() {
    const novo: Tema = tema === "dark" ? "light" : "dark";
    setTema(novo);
    document.documentElement.dataset.theme = novo;
    document.cookie = `${COOKIE_TEMA}=${novo}; path=/; max-age=31536000; samesite=lax`;
  }

  const rotulo = tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro";
  const Icone = tema === "dark" ? Sun : Moon;
  if (comRotulo) {
    return (
      <button type="button" onClick={alternar} className="btn-secondary w-full" aria-label={rotulo} title={rotulo}>
        <Icone className="h-4 w-4" />
        {tema === "dark" ? "Tema claro" : "Tema escuro"}
      </button>
    );
  }
  return (
    <button type="button" onClick={alternar} className="btn-icone" aria-label={rotulo} title={rotulo}>
      <Icone className="h-5 w-5" />
    </button>
  );
}
