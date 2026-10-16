"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

type DocCompat = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type ElCompat = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const emTelaCheia = () => {
  const d = document as DocCompat;
  return !!(d.fullscreenElement ?? d.webkitFullscreenElement);
};

/**
 * Expande a Tela TV para tela cheia (API Fullscreen do navegador: some com abas, barra
 * de endereço e menus). O Esc é tratado pelo próprio navegador para sair; o botão
 * acompanha o estado pelo evento `fullscreenchange`.
 */
export function BotaoTelaCheia() {
  const [cheia, setCheia] = useState(false);
  const [suportado, setSuportado] = useState(true);

  useEffect(() => {
    const el = document.documentElement as ElCompat;
    setSuportado(!!(el.requestFullscreen || el.webkitRequestFullscreen));
    const atualizar = () => setCheia(emTelaCheia());
    // O navegador já sai da tela cheia com Esc; este atalho garante o mesmo
    // comportamento em navegadores/quiosques que repassam a tecla para a página.
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && emTelaCheia()) {
        const d = document as DocCompat;
        void (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.())?.catch(() => {});
      }
    };
    document.addEventListener("fullscreenchange", atualizar);
    document.addEventListener("webkitfullscreenchange", atualizar);
    document.addEventListener("keydown", aoTeclar);
    atualizar();
    return () => {
      document.removeEventListener("fullscreenchange", atualizar);
      document.removeEventListener("webkitfullscreenchange", atualizar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  async function alternar() {
    const d = document as DocCompat;
    const el = document.documentElement as ElCompat;
    try {
      if (emTelaCheia()) {
        await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      } else {
        await (el.requestFullscreen?.({ navigationUI: "hide" }) ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      // Navegador bloqueou (ex.: sem gesto do usuário); nada a fazer.
    }
  }

  if (!suportado) return null;
  return (
    <button
      type="button"
      onClick={alternar}
      className={cheia ? "btn-secondary" : "btn-primary"}
      title={cheia ? "Sair da tela cheia (Esc)" : "Expandir para tela cheia"}
      aria-pressed={cheia}
      data-testid="botao-tela-cheia"
    >
      {cheia ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      {cheia ? "Sair (Esc)" : "Tela cheia"}
    </button>
  );
}
