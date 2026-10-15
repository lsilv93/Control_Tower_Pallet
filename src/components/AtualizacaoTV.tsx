"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Auto-refresh da Tela TV: consulta a versão dos dados a cada `consulta` segundos e
 * recarrega assim que houver um novo lançamento; recarrega também a cada `maximo`
 * segundos (garantia). Mostra relógio e o horário da última atualização.
 */
export function AtualizacaoTV({ versaoInicial, consulta = 10, maximo = 60 }: { versaoInicial: string; consulta?: number; maximo?: number }) {
  const router = useRouter();
  const versao = useRef(versaoInicial);
  const ultimaCarga = useRef(Date.now());
  const [agora, setAgora] = useState<Date | null>(null);
  const [atualizado, setAtualizado] = useState<Date | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    versao.current = versaoInicial;
    ultimaCarga.current = Date.now();
    setAtualizado(new Date());
  }, [versaoInicial]);

  useEffect(() => {
    setAgora(new Date());
    const relogio = setInterval(() => setAgora(new Date()), 1000);
    const verificar = setInterval(async () => {
      try {
        const r = await fetch("/api/tv/versao", { cache: "no-store" });
        if (r.status === 401) {
          window.location.href = "/login";
          return;
        }
        const { versao: nova } = (await r.json()) as { versao?: string };
        setFalhou(false);
        if ((nova && nova !== versao.current) || Date.now() - ultimaCarga.current > maximo * 1000) {
          versao.current = nova ?? versao.current;
          ultimaCarga.current = Date.now();
          router.refresh();
        }
      } catch {
        setFalhou(true);
      }
    }, consulta * 1000);
    return () => {
      clearInterval(relogio);
      clearInterval(verificar);
    };
  }, [router, consulta, maximo]);

  const hora = (d: Date | null, seg = true) =>
    d ? d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", ...(seg ? { second: "2-digit" } : {}) }) : "--:--";

  return (
    <div className="flex items-center gap-4 text-right">
      <div>
        <p className="num text-[34px] font-semibold leading-none text-t1" suppressHydrationWarning>{hora(agora, false)}</p>
        <p className="text-[11px] text-t3" suppressHydrationWarning>
          {agora ? agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long" }) : ""}
        </p>
      </div>
      <span className={`pill ${falhou ? "bg-erro/10 text-erro" : "bg-lima/10 text-lima"}`}>
        <span className="ponto ponto-pulsante" /> {falhou ? "Sem conexão" : `Ao vivo · ${hora(atualizado)}`}
      </span>
    </div>
  );
}
