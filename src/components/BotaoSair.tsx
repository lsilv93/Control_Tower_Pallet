"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { encerrarSessao } from "@/actions/auth";

/**
 * Botão Sair: encerra a sessão no servidor (cookies apagados e token revogado), limpa o
 * armazenamento do navegador e recarrega a tela de login por completo, descartando o
 * cache de páginas do roteador (o botão Voltar não reexibe telas protegidas).
 */
export function BotaoSair({ variante = "icone" }: { variante?: "icone" | "botao" }) {
  const [saindo, iniciar] = useTransition();
  function sairAgora() {
    iniciar(async () => {
      let destino = "/login";
      try {
        destino = (await encerrarSessao()).destino;
      } finally {
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();
        } catch {
          // navegação privada pode bloquear o acesso ao armazenamento
        }
        window.location.replace(destino);
      }
    });
  }
  if (variante === "botao") {
    return (
      <button type="button" className="btn-secondary w-full" onClick={sairAgora} disabled={saindo} data-testid="botao-sair">
        <LogOut className="h-4 w-4" /> {saindo ? "Saindo..." : "Sair"}
      </button>
    );
  }
  return (
    <button type="button" className="btn-icone hover:!text-erro" onClick={sairAgora} disabled={saindo} aria-label="Sair do sistema" title="Sair do sistema">
      <LogOut className="h-5 w-5" />
    </button>
  );
}
