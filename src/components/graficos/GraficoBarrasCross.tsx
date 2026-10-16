"use client";

import { useState } from "react";
import { barra, Dica, escalaLimpa, fmt, useLargura } from "./base";

export type BarraCross = { id: string; codigo: string; nome: string; saldo: number; vales: number; maisAntigo: string; idade: number | null };

/**
 * Saldo devedor por Ponto de Cross: barras horizontais (série única, uma cor), maior
 * primeiro, valor na ponta da barra, eixo com grade discreta e tooltip por barra.
 */
export function GraficoBarrasCross({ dados }: { dados: BarraCross[] }) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);

  if (dados.length === 0) {
    return <p className="poco px-5 py-10 text-center text-[12px] text-t3">Nenhum saldo devedor em Pontos de Cross.</p>;
  }

  const total = dados.reduce((s, d) => s + d.saldo, 0);
  const W = Math.max(largura, 280);
  const NOME = Math.min(170, W * 0.36);
  const VAL = 64;
  const largBarras = Math.max(W - NOME - VAL, 60);
  const linha = 38;
  const esp = 22;
  const EIXO = 22;
  const H = dados.length * linha + EIXO + 4;
  const { topo, passo } = escalaLimpa(Math.max(...dados.map((d) => d.saldo), 1), 4);
  const x = (v: number) => (v / topo) * largBarras;
  const ticks = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const d = foco !== null ? dados[foco] : null;

  return (
    <div ref={ref} className="relative" data-testid="grafico-barras-cross">
      {largura > 0 && (
        <svg width={W} height={H} role="img" aria-label="Saldo devedor por Ponto de Cross">
          {ticks.map((t) => (
            <g key={t} pointerEvents="none">
              <line x1={NOME + x(t)} x2={NOME + x(t)} y1={2} y2={H - EIXO} stroke="var(--viz-grade)" strokeWidth={1} />
              <text x={NOME + x(t)} y={H - 6} textAnchor="middle" className="num fill-t4 text-[10px]">{fmt(t)}</text>
            </g>
          ))}
          {dados.map((b, i) => {
            const y = i * linha + 8;
            return (
              <g
                key={b.id}
                tabIndex={0}
                onMouseEnter={() => setFoco(i)}
                onMouseLeave={() => setFoco(null)}
                onFocus={() => setFoco(i)}
                onBlur={() => setFoco(null)}
                aria-label={`${b.codigo} ${b.nome}: ${b.saldo} pallets devidos, ${b.vales} vale(s) pendente(s)`}
                className="cursor-pointer outline-none"
              >
                <rect x={0} y={y - 8} width={W} height={linha} rx={10} fill={foco === i ? "var(--viz-grade)" : "transparent"} />
                <text pointerEvents="none" x={NOME - 12} y={y + esp / 2 - 1} textAnchor="end" className="num fill-t1 text-[11px] font-semibold">
                  {b.codigo}
                </text>
                <text pointerEvents="none" x={NOME - 12} y={y + esp / 2 + 11} textAnchor="end" className="fill-t3 text-[10px]">
                  {b.nome.length > 22 ? `${b.nome.slice(0, 21)}…` : b.nome}
                </text>
                <path d={barra(NOME, y, Math.max(x(b.saldo), 3), esp, "direita")} fill="var(--viz-cat-1)" />
                <text pointerEvents="none" x={NOME + x(b.saldo) + 8} y={y + esp / 2 + 4} className="num fill-t1 text-[12px] font-semibold">
                  {fmt(b.saldo)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {d && foco !== null && (
        <Dica x={NOME + x(d.saldo)} y={foco * linha} largura={W}>
          <p className="mb-1 font-semibold text-t1">{d.codigo} · {d.nome}</p>
          <div className="flex justify-between gap-4"><span>Saldo devedor</span><strong className="num text-t1">{fmt(d.saldo)} pallets</strong></div>
          <div className="flex justify-between gap-4"><span>Participação no total</span><strong className="num text-t1">{total ? ((d.saldo / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : 0}%</strong></div>
          <div className="flex justify-between gap-4"><span>Vales pendentes</span><strong className="num text-t1">{d.vales}</strong></div>
          <div className="flex justify-between gap-4"><span>Mais antigo</span><strong className="num whitespace-nowrap text-t1">{d.maisAntigo}{d.idade !== null ? ` (${d.idade}d)` : ""}</strong></div>
        </Dica>
      )}
    </div>
  );
}
