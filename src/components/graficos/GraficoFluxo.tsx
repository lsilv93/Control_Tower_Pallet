"use client";

import { useState } from "react";
import { barra, Dica, escalaLimpa, fmt, Legenda, LinhaDica, useLargura } from "./base";

export type PontoSerie = { inicio: string; entradas: number; saidas: number };
type Granularidade = "dia" | "semana" | "mes";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function rotuloX(inicio: string, g: Granularidade) {
  const [a, m, d] = inicio.split("-");
  return g === "mes" ? `${MESES[Number(m) - 1]}/${a.slice(2)}` : `${d}/${m}`;
}
function rotuloLongo(inicio: string, g: Granularidade) {
  const [a, m, d] = inicio.split("-");
  if (g === "mes") return `${MESES[Number(m) - 1]} de ${a}`;
  if (g === "semana") return `Semana de ${d}/${m}/${a}`;
  return `${d}/${m}/${a}`;
}

const ESQ = 44;
const DIR = 12;

/**
 * Extrato da conta corrente: colunas divergentes (entradas acima, saídas abaixo
 * da linha zero) e, num gráfico separado com o mesmo eixo X, o saldo total dos
 * estoques ao fim de cada período (sem eixo duplo).
 */
export function GraficoFluxo({
  serie,
  granularidade,
  saldoInicial,
}: {
  serie: PontoSerie[];
  granularidade: Granularidade;
  /** Saldo total antes do período; null quando há filtro de fornecedor (saldo não se aplica). */
  saldoInicial: number | null;
}) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);

  if (serie.length === 0) {
    return <p className="poco px-5 py-10 text-center text-[12px] text-t3">Sem entradas ou saídas no período.</p>;
  }

  const W = Math.max(largura, 280);
  const n = serie.length;
  const slot = (W - ESQ - DIR) / n;
  const col = Math.min(24, Math.max(3, slot * 0.6));
  const xCentro = (i: number) => ESQ + slot * i + slot / 2;

  // Colunas: escala simétrica em torno do zero
  const H1 = 190;
  const meio = H1 / 2;
  const maxVal = Math.max(...serie.map((p) => Math.max(p.entradas, p.saidas)), 1);
  const { topo, passo } = escalaLimpa(maxVal, 2);
  const y1 = (v: number) => (v / topo) * (meio - 10);

  // Saldo acumulado ao fim de cada período
  const saldos: number[] = [];
  if (saldoInicial !== null) {
    let acc = saldoInicial;
    for (const p of serie) saldos.push((acc += p.entradas - p.saidas));
  }
  const H2 = 110;
  const minS = saldos.length ? Math.min(...saldos, saldoInicial ?? 0) : 0;
  const maxS = saldos.length ? Math.max(...saldos, saldoInicial ?? 0) : 1;
  const escS = escalaLimpa(maxS - Math.min(minS, 0), 2);
  const baseS = Math.min(minS, 0);
  const y2 = (v: number) => H2 - 16 - ((v - baseS) / escS.topo) * (H2 - 30);

  const cadaN = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - ESQ) / 56))));
  const totalE = serie.reduce((s, p) => s + p.entradas, 0);
  const totalS = serie.reduce((s, p) => s + p.saidas, 0);
  const ticks = [-topo, -topo + passo, 0, topo - passo, topo].filter((v, i, a) => a.indexOf(v) === i);

  const alvo = (i: number) => ({
    onMouseEnter: () => setFoco(i),
    onFocus: () => setFoco(i),
    onMouseLeave: () => setFoco(null),
    onBlur: () => setFoco(null),
  });
  const p = foco !== null ? serie[foco] : null;

  return (
    <div ref={ref} className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Legenda
          itens={[
            { cor: "var(--viz-entrada)", rotulo: "Entradas", valor: fmt(totalE) },
            { cor: "var(--viz-saida)", rotulo: "Saídas", valor: fmt(totalS) },
          ]}
        />
        <span className="text-[11px] text-t3">
          Líquido no período: <strong className="num text-t1">{totalE - totalS > 0 ? "+" : ""}{fmt(totalE - totalS)}</strong>
        </span>
      </div>
      {largura > 0 && (
        <svg width={W} height={H1} role="img" aria-label="Entradas e saídas por período">
          {ticks.map((t) => (
            <g key={t}>
              <line pointerEvents="none" x1={ESQ} x2={W - DIR} y1={meio - y1(t)} y2={meio - y1(t)} stroke="var(--viz-grade)" strokeWidth={1} />
              <text pointerEvents="none" x={ESQ - 8} y={meio - y1(t) + 3.5} textAnchor="end" className="num fill-t3 text-[10px]">
                {t === 0 ? "0" : fmt(Math.abs(t))}
              </text>
            </g>
          ))}
          {serie.map((pt, i) => (
            <g key={pt.inicio} {...alvo(i)} tabIndex={0} aria-label={`${rotuloLongo(pt.inicio, granularidade)}: entradas ${pt.entradas}, saídas ${pt.saidas}`}>
              <rect x={xCentro(i) - slot / 2} y={0} width={slot} height={H1} fill={foco === i ? "var(--viz-grade)" : "transparent"} />
              <path d={barra(xCentro(i) - col / 2, meio - 1 - y1(pt.entradas), col, y1(pt.entradas), "cima")} fill="var(--viz-entrada)" />
              <path d={barra(xCentro(i) - col / 2, meio + 1, col, y1(pt.saidas), "baixo")} fill="var(--viz-saida)" />
            </g>
          ))}
          <line pointerEvents="none" x1={ESQ} x2={W - DIR} y1={meio} y2={meio} stroke="var(--c-t3-hex, currentColor)" className="text-t4" strokeWidth={1} />
        </svg>
      )}

      {saldoInicial !== null && largura > 0 && (
        <>
          <p className="label mb-1 mt-4">Saldo total dos estoques (Vazios + CD + Quebrados) ao fim de cada período</p>
          <svg width={W} height={H2} role="img" aria-label="Saldo total ao longo do período">
            {[baseS, baseS + escS.topo / 2, baseS + escS.topo].map((t) => (
              <g key={t}>
                <line pointerEvents="none" x1={ESQ} x2={W - DIR} y1={y2(t)} y2={y2(t)} stroke="var(--viz-grade)" strokeWidth={1} />
                <text pointerEvents="none" x={ESQ - 8} y={y2(t) + 3.5} textAnchor="end" className="num fill-t3 text-[10px]">{fmt(t)}</text>
              </g>
            ))}
            <path
              d={`M${xCentro(0)},${y2(baseS)} ${saldos.map((s, i) => `L${xCentro(i)},${y2(s)}`).join(" ")} L${xCentro(n - 1)},${y2(baseS)}Z`}
              fill="var(--viz-vazios)"
              opacity={0.1}
            />
            <path d={saldos.map((s, i) => `${i ? "L" : "M"}${xCentro(i)},${y2(s)}`).join(" ")} fill="none" stroke="var(--viz-vazios)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {foco !== null && <line pointerEvents="none" x1={xCentro(foco)} x2={xCentro(foco)} y1={6} y2={H2 - 16} stroke="var(--viz-grade)" strokeWidth={1} />}
            {saldos.map((s, i) =>
              i === n - 1 || foco === i ? (
                <circle key={i} cx={xCentro(i)} cy={y2(s)} r={4} fill="var(--viz-vazios)" stroke="var(--opcao)" strokeWidth={2} />
              ) : null,
            )}
            <text pointerEvents="none" x={Math.min(xCentro(n - 1), W - DIR - 4)} y={y2(saldos[n - 1]) - 9} textAnchor="end" className="num fill-t1 text-[11px] font-semibold">
              {fmt(saldos[n - 1])}
            </text>
            {serie.map((pt, i) => (
              <rect key={pt.inicio} x={xCentro(i) - slot / 2} y={0} width={slot} height={H2} fill="transparent" {...alvo(i)} />
            ))}
          </svg>
        </>
      )}

      {largura > 0 && (
        <svg width={W} height={18} aria-hidden>
          {serie.map((pt, i) =>
            i % cadaN === 0 ? (
              <text key={pt.inicio} x={xCentro(i)} y={12} textAnchor="middle" className="num fill-t3 text-[10px]">
                {rotuloX(pt.inicio, granularidade)}
              </text>
            ) : null,
          )}
        </svg>
      )}

      {p && foco !== null && (
        <Dica x={xCentro(foco)} y={10} largura={W}>
          <p className="mb-1 font-semibold text-t1">{rotuloLongo(p.inicio, granularidade)}</p>
          <LinhaDica cor="var(--viz-entrada)" rotulo="Entradas" valor={fmt(p.entradas)} />
          <LinhaDica cor="var(--viz-saida)" rotulo="Saídas" valor={fmt(p.saidas)} />
          <LinhaDica rotulo="Líquido" valor={`${p.entradas - p.saidas > 0 ? "+" : ""}${fmt(p.entradas - p.saidas)}`} />
          {saldos.length > 0 && <LinhaDica cor="var(--viz-vazios)" rotulo="Saldo ao fim" valor={fmt(saldos[foco])} />}
        </Dica>
      )}
    </div>
  );
}
