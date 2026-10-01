"use client";

import { useState } from "react";
import { fmt, Legenda } from "./base";

/** Composição do total de pallets nos 3 estoques (barra empilhada com vão de 2px). */
export function BarraComposicao({ itens }: { itens: { rotulo: string; valor: number; cor: string }[] }) {
  const total = itens.reduce((s, i) => s + Math.max(i.valor, 0), 0);
  const [foco, setFoco] = useState<number | null>(null);
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Composição do total por estoque">
        {total === 0 ? (
          <div className="h-full w-full rounded-full bg-[var(--viz-grade)]" />
        ) : (
          itens.map((i, idx) =>
            i.valor > 0 ? (
              <div
                key={i.rotulo}
                className="h-full transition-opacity first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(i.valor / total) * 100}%`, background: i.cor, opacity: foco === null || foco === idx ? 1 : 0.4 }}
                title={`${i.rotulo}: ${fmt(i.valor)} (${Math.round((i.valor / total) * 100)}%)`}
                onMouseEnter={() => setFoco(idx)}
                onMouseLeave={() => setFoco(null)}
              />
            ) : null,
          )
        )}
      </div>
      <div className="mt-3">
        <Legenda
          itens={itens.map((i) => ({
            cor: i.cor,
            rotulo: i.rotulo,
            valor: `${fmt(i.valor)}${total ? ` · ${Math.round((Math.max(i.valor, 0) / total) * 100)}%` : ""}`,
          }))}
        />
      </div>
    </div>
  );
}
