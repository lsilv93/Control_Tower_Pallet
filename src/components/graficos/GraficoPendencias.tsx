"use client";

import { useState } from "react";
import { barra, Dica, escalaLimpa, fmt, useLargura } from "./base";

type Farol = "VERMELHO" | "AMARELO" | "VERDE";
export type BarraPendencia = { id: string; nome: string; total: number; vales: number; farol: Farol; maisAntigo: string };

const STATUS: Record<Farol, { cor: string; rotulo: string }> = {
  VERMELHO: { cor: "var(--viz-critico)", rotulo: "Crítico" },
  AMARELO: { cor: "var(--viz-alerta)", rotulo: "Atenção" },
  VERDE: { cor: "var(--viz-bom)", rotulo: "Normal" },
};

/**
 * Pallets pendentes de devolução por fornecedor (barras horizontais, maior primeiro).
 * A cor é o farol (status) e vem sempre com o rótulo de texto. Linhas de referência
 * nos limites do farol (50 e 100). Fornecedor filtrado fica em destaque.
 */
export function GraficoPendencias({ dados, selecionado }: { dados: BarraPendencia[]; selecionado?: string }) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);

  if (dados.length === 0) return <p className="poco px-5 py-10 text-center text-[12px] text-t3">Nenhum pallet pendente com fornecedores.</p>;

  const W = Math.max(largura, 260);
  const NOME = Math.min(150, W * 0.38);
  const VAL = 78;
  const largBarras = W - NOME - VAL;
  const linha = 34;
  const esp = Math.min(20, linha - 12);
  const H = dados.length * linha + 22;
  const { topo } = escalaLimpa(Math.max(...dados.map((d) => d.total), 100), 4);
  const x = (v: number) => (v / topo) * largBarras;
  const d = foco !== null ? dados[foco] : null;

  return (
    <div ref={ref} className="relative">
      {largura > 0 && (
        <svg width={W} height={H} role="img" aria-label="Pallets pendentes por fornecedor">
          {[50, 100].filter((r) => r <= topo).map((r) => (
            <g key={r}>
              <line pointerEvents="none" x1={NOME + x(r)} x2={NOME + x(r)} y1={4} y2={H - 16} stroke="var(--viz-grade)" strokeWidth={1} />
              <text pointerEvents="none" x={NOME + x(r)} y={H - 4} textAnchor="middle" className="num fill-t4 text-[10px]">{r}</text>
            </g>
          ))}
          {dados.map((b, i) => {
            const y = i * linha + 6;
            const apagado = selecionado && b.id !== selecionado ? 0.3 : 1;
            return (
              <g
                key={b.id}
                opacity={apagado}
                tabIndex={0}
                onMouseEnter={() => setFoco(i)}
                onMouseLeave={() => setFoco(null)}
                onFocus={() => setFoco(i)}
                onBlur={() => setFoco(null)}
                aria-label={`${b.nome}: ${b.total} pallets pendentes, ${STATUS[b.farol].rotulo}`}
              >
                <rect x={0} y={y - 4} width={W} height={linha} fill={foco === i ? "var(--viz-grade)" : "transparent"} rx={8} />
                <text pointerEvents="none" x={NOME - 10} y={y + esp / 2 + 4} textAnchor="end" className="fill-t1 text-[11px]">
                  {b.nome.length > 22 ? `${b.nome.slice(0, 21)}…` : b.nome}
                </text>
                <path d={barra(NOME, y, Math.max(x(b.total), 2), esp, "direita")} fill={STATUS[b.farol].cor} />
                <text pointerEvents="none" x={NOME + x(b.total) + 8} y={y + esp / 2 + 4} className="num fill-t1 text-[11px] font-semibold">
                  {fmt(b.total)}
                </text>
                <text pointerEvents="none" x={NOME + x(b.total) + 8 + String(fmt(b.total)).length * 7 + 6} y={y + esp / 2 + 4} className="fill-t3 text-[10px]">
                  {STATUS[b.farol].rotulo}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {d && foco !== null && (
        <Dica x={NOME + x(d.total)} y={foco * linha} largura={W}>
          <p className="mb-1 font-semibold text-t1">{d.nome}</p>
          <div className="flex justify-between gap-4"><span>Pallets pendentes</span><strong className="num text-t1">{fmt(d.total)}</strong></div>
          <div className="flex justify-between gap-4"><span>Vales em aberto</span><strong className="num text-t1">{d.vales}</strong></div>
          <div className="flex justify-between gap-4"><span>Vale mais antigo</span><strong className="num text-t1">{d.maisAntigo}</strong></div>
          <div className="flex justify-between gap-4"><span>Farol</span><strong className="text-t1">{STATUS[d.farol].rotulo}</strong></div>
        </Dica>
      )}
    </div>
  );
}
