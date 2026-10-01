"use client";

import { useEffect, useRef, useState } from "react";

/** Largura real do contêiner (o SVG é desenhado em pixels reais: texto nunca encolhe no celular). */
export function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, largura };
}

/** Escala "bonita" para o eixo: 0 / 50 / 100 … */
export function escalaLimpa(max: number, passos = 4) {
  if (max <= 0) return { topo: passos, passo: 1 };
  const bruto = max / passos;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? bruto;
  return { topo: Math.ceil(max / passo) * passo, passo };
}

export const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

/** Caminho de barra com ponta de dados arredondada (4px) e base reta. */
export function barra(x: number, y: number, w: number, h: number, ponta: "cima" | "baixo" | "direita", r = 4) {
  if (w <= 0 || h <= 0) return "";
  const rr = Math.min(r, ponta === "direita" ? h / 2 : w / 2, ponta === "direita" ? w : h);
  if (ponta === "cima")
    return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
  if (ponta === "baixo")
    return `M${x},${y}V${y + h - rr}Q${x},${y + h} ${x + rr},${y + h}H${x + w - rr}Q${x + w},${y + h} ${x + w},${y + h - rr}V${y}Z`;
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

/** Tooltip HTML posicionado sobre o gráfico (valores em destaque, rótulos depois). */
export function Dica({ x, y, largura, children }: { x: number; y: number; largura: number; children: React.ReactNode }) {
  const esquerda = Math.min(Math.max(x + 12, 4), Math.max(largura - 200, 4));
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 min-w-[11rem] rounded-2xl px-3.5 py-2.5 text-[11px] text-t2 shadow-[8px_8px_17px_var(--neu-d)]"
      style={{ left: esquerda, top: Math.max(y - 8, 0), background: "var(--opcao)" }}
    >
      {children}
    </div>
  );
}

export function LinhaDica({ cor, rotulo, valor }: { cor?: string; rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-2">
        {cor && <span className="inline-block h-[2px] w-3 rounded" style={{ background: cor }} />}
        {rotulo}
      </span>
      <strong className="num text-t1">{valor}</strong>
    </div>
  );
}

/** Legenda com chave de linha (nunca texto colorido). */
export function Legenda({ itens }: { itens: { cor: string; rotulo: string; valor?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-t2">
      {itens.map((i) => (
        <span key={i.rotulo} className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: i.cor }} />
          {i.rotulo}
          {i.valor && <strong className="num text-t1">{i.valor}</strong>}
        </span>
      ))}
    </div>
  );
}
