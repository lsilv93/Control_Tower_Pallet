"use client";

import { useState } from "react";
import { fmt } from "./base";

export type FatiaRosca = { id: string; rotulo: string; valor: number; cor: string; detalhe?: string };

const pct = (v: number, t: number) => (t > 0 ? (v / t) * 100 : 0);
const fmtPct = (p: number) => `${p.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: p > 0 && p < 10 ? 1 : 0 })}%`;

/** Arco de rosca entre dois ângulos (radianos, 0 = topo, sentido horário). */
function arco(cx: number, cy: number, rExt: number, rInt: number, a0: number, a1: number) {
  const ponto = (r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = ponto(rExt, a0);
  const [x1, y1] = ponto(rExt, a1);
  const [x2, y2] = ponto(rInt, a1);
  const [x3, y3] = ponto(rInt, a0);
  return `M${x0},${y0}A${rExt},${rExt} 0 ${grande} 1 ${x1},${y1}L${x2},${y2}A${rInt},${rInt} 0 ${grande} 0 ${x3},${y3}Z`;
}

/**
 * Rosca com legenda lateral (valor e % sempre visíveis — a cor nunca carrega a
 * informação sozinha). Fatias separadas por um vão da cor do fundo; hover ou foco
 * destaca a fatia e a linha da legenda e mostra o detalhe no centro.
 */
export function GraficoRosca({
  dados,
  rotuloTotal,
  unidade = "pallets",
  vazio,
}: {
  dados: FatiaRosca[];
  rotuloTotal: string;
  unidade?: string;
  vazio: string;
}) {
  const [foco, setFoco] = useState<string | null>(null);
  const total = dados.reduce((s, d) => s + d.valor, 0);
  if (total <= 0) return <p className="poco px-5 py-10 text-center text-[12px] text-t3">{vazio}</p>;

  const T = 200;
  const c = T / 2;
  const rExt = 92;
  const rInt = 62;
  const vao = dados.length > 1 ? 0.012 : 0; // vão de ~2px entre fatias
  let acc = 0;
  const fatias = dados.map((d) => {
    const a0 = (acc / total) * Math.PI * 2;
    acc += d.valor;
    const a1 = (acc / total) * Math.PI * 2;
    return { ...d, a0: a0 + vao / 2, a1: Math.max(a1 - vao / 2, a0 + vao / 2 + 0.0001) };
  });
  const ativa = fatias.find((f) => f.id === foco) ?? null;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center xl:flex-col">
      <div className="relative flex-none" style={{ width: T, height: T }}>
        <svg width={T} height={T} viewBox={`0 0 ${T} ${T}`} role="img" aria-label={`${rotuloTotal}: ${fmt(total)} ${unidade}`}>
          {fatias.length === 1 ? (
            <circle cx={c} cy={c} r={(rExt + rInt) / 2} fill="none" stroke={fatias[0].cor} strokeWidth={rExt - rInt} />
          ) : (
            fatias.map((f) => (
              <path
                key={f.id}
                d={arco(c, c, foco === f.id ? rExt + 4 : rExt, rInt, f.a0, f.a1)}
                fill={f.cor}
                opacity={foco && foco !== f.id ? 0.35 : 1}
                className="cursor-pointer transition-opacity duration-200"
                tabIndex={0}
                aria-label={`${f.rotulo}: ${fmt(f.valor)} ${unidade} (${fmtPct(pct(f.valor, total))})`}
                onMouseEnter={() => setFoco(f.id)}
                onMouseLeave={() => setFoco(null)}
                onFocus={() => setFoco(f.id)}
                onBlur={() => setFoco(null)}
              />
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
          {ativa ? (
            <>
              <span className="num text-[24px] font-semibold leading-none text-t1">{fmtPct(pct(ativa.valor, total))}</span>
              <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-t2">{ativa.rotulo}</span>
              <span className="num mt-0.5 text-[10px] text-t3">{fmt(ativa.valor)} {unidade}</span>
            </>
          ) : (
            <>
              <span className="num text-[26px] font-semibold leading-none text-t1">{fmt(total)}</span>
              <span className="mt-1 text-[10px] uppercase tracking-[0.12em] text-t3">{rotuloTotal}</span>
            </>
          )}
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1 xl:grid xl:grid-cols-2 xl:gap-x-2 xl:space-y-0">
        {fatias.map((f) => (
          <li
            key={f.id}
            onMouseEnter={() => setFoco(f.id)}
            onMouseLeave={() => setFoco(null)}
            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12px] transition-colors ${foco === f.id ? "bg-[var(--viz-grade)]" : ""}`}
          >
            <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: f.cor }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 leading-tight text-t1" title={f.rotulo}>{f.rotulo}</span>
              {f.detalhe && <span className="mt-0.5 block text-[10px] leading-tight text-t4">{f.detalhe}</span>}
            </span>
            <span className="num flex-none text-right text-t1">
              <strong>{fmtPct(pct(f.valor, total))}</strong>
              <span className="block text-[10px] font-normal text-t3">{fmt(f.valor)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
