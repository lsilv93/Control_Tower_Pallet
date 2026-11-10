"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Encaixe da tabela na altura disponível da TV (sem rolagem vertical): mede a área, mostra
 * só as linhas que cabem e alterna automaticamente as páginas a cada `intervalo` segundos.
 * Abaixo de `lg` (celular/tablet) mostra todas as linhas e a página rola normalmente.
 */
export function PaginadorTV({ children, intervalo = 12, testid }: { children: React.ReactNode; intervalo?: number; testid?: string }) {
  const area = useRef<HTMLDivElement>(null);
  const pagina = useRef(0);
  const [info, setInfo] = useState({ atual: 0, total: 1 });

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const telaGrande = window.matchMedia("(min-width: 1024px)");

    const aplicar = (avancar = false) => {
      const linhas = [...el.querySelectorAll<HTMLTableRowElement>("tbody > tr")];
      if (!telaGrande.matches || linhas.length === 0) {
        linhas.forEach((l) => (l.style.display = ""));
        pagina.current = 0;
        setInfo({ atual: 0, total: 1 });
        return;
      }
      // Mede com todas as linhas da página atual visíveis para obter a altura real de uma linha.
      linhas.forEach((l) => (l.style.display = ""));
      const cabecalho = el.querySelector("thead")?.getBoundingClientRect().height ?? 0;
      const alturaLinha = Math.max(...linhas.map((l) => l.getBoundingClientRect().height), 1);
      const porPagina = Math.max(1, Math.floor((el.clientHeight - cabecalho - 4) / alturaLinha));
      const total = Math.max(1, Math.ceil(linhas.length / porPagina));
      pagina.current = avancar ? (pagina.current + 1) % total : Math.min(pagina.current, total - 1);
      const inicio = pagina.current * porPagina;
      linhas.forEach((l, i) => (l.style.display = i >= inicio && i < inicio + porPagina ? "" : "none"));
      setInfo({ atual: pagina.current, total });
    };

    aplicar();
    const obs = new ResizeObserver(() => aplicar());
    obs.observe(el);
    const mut = new MutationObserver(() => aplicar());
    const corpo = el.querySelector("tbody");
    if (corpo) mut.observe(corpo, { childList: true });
    telaGrande.addEventListener("change", () => aplicar());
    const giro = setInterval(() => aplicar(true), intervalo * 1000);
    return () => {
      obs.disconnect();
      mut.disconnect();
      clearInterval(giro);
    };
  }, [intervalo]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid={testid ? `${testid}-area` : undefined}>
      <div ref={area} className="min-h-0 flex-1 overflow-x-auto lg:overflow-y-hidden">
        {children}
      </div>
      <p className="num hidden h-5 flex-none text-right text-[11px] font-semibold text-t3 lg:block" data-testid={testid ? `${testid}-pagina` : undefined}>
        {info.total > 1 ? `Página ${info.atual + 1}/${info.total} · troca automática` : ""}
      </p>
    </div>
  );
}
