"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/** Atualiza os dados da página (server components) periodicamente. */
export function AtualizacaoAutomatica({ segundos = 30 }: { segundos?: number }) {
  const router = useRouter();
  const [ultima, setUltima] = useState<Date | null>(null);

  useEffect(() => {
    setUltima(new Date());
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
        setUltima(new Date());
      }
    }, segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);

  return (
    <div className="flex items-center gap-3">
      <span className="pill bg-lima/10 text-lima">
        <span className="ponto ponto-pulsante" /> Ao vivo
      </span>
    <button
      type="button"
      onClick={() => {
        router.refresh();
        setUltima(new Date());
      }}
      className="btn-secondary"
      title={`Atualização automática a cada ${segundos}s`}
    >
      <RefreshCw className="h-4 w-4" />
      <span className="num">{ultima ? ultima.toLocaleTimeString("pt-BR") : "Atualizar"}</span>
    </button>
    </div>
  );
}
