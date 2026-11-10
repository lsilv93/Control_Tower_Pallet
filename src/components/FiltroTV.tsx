"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Globe2, X } from "lucide-react";

type Opcao = { id: string; codigo: string; nome: string; tipo: "CD" | "CROSS"; hub: boolean };

/**
 * Filtro superior da Torre de Controle: "Visão Geral" (todas as unidades consolidadas) ou um
 * ou mais CDs e Pontos de Cross específicos. A seleção vai para a URL (?u=CDSP,XCPS), então a
 * TV pode ser deixada fixa em um filtro e o auto-refresh o preserva.
 */
export function FiltroTV({ opcoes, selecionados }: { opcoes: Opcao[]; selecionados: string[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [marcados, setMarcados] = useState<string[]>(selecionados);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => setMarcados(selecionados), [selecionados]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const ir = (codigos: string[]) => {
    setAberto(false);
    router.push(codigos.length ? `/tv?u=${codigos.join(",")}` : "/tv");
  };
  const alternar = (c: string) => setMarcados((m) => (m.includes(c) ? m.filter((x) => x !== c) : [...m, c]));
  const geral = selecionados.length === 0;
  const grupos = [
    { titulo: "Centros de Distribuição", itens: opcoes.filter((o) => o.tipo === "CD") },
    { titulo: "Pontos de Cross", itens: opcoes.filter((o) => o.tipo === "CROSS") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="filtro-tv">
      <button type="button" onClick={() => ir([])} className={clsx("pill gap-1.5 px-3 py-1.5 text-[12px] font-semibold", geral ? "fill-lima" : "bg-[var(--groove)] text-t2 hover:text-t1")} aria-pressed={geral} data-testid="filtro-visao-geral">
        <Globe2 className="h-3.5 w-3.5" /> Visão Geral
      </button>
      <div className="relative" ref={caixa}>
        <button type="button" onClick={() => setAberto((a) => !a)} className={clsx("pill gap-1.5 px-3 py-1.5 text-[12px] font-semibold", !geral ? "fill-lima" : "bg-[var(--groove)] text-t2 hover:text-t1")} aria-expanded={aberto} data-testid="filtro-unidades">
          {geral ? "Filtrar unidades" : `${selecionados.length} unidade(s)`} <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {aberto && (
          <div className="card absolute left-0 top-full z-30 mt-2 w-[min(92vw,420px)] p-4 shadow-2xl" role="dialog" aria-label="Filtrar unidades">
            <div className="max-h-[60vh] space-y-4 overflow-auto">
              {grupos.map((g) =>
                g.itens.length === 0 ? null : (
                  <fieldset key={g.titulo}>
                    <legend className="label mb-2">{g.titulo}</legend>
                    <div className="grid grid-cols-2 gap-1.5">
                      {g.itens.map((o) => (
                        <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-t2 hover:bg-[var(--groove)]" title={o.nome}>
                          <input type="checkbox" checked={marcados.includes(o.codigo)} onChange={() => alternar(o.codigo)} data-testid={`filtro-op-${o.codigo}`} />
                          <span className="num font-semibold text-t1">{o.codigo}</span>
                          {o.hub && <span className="text-[10px] font-bold text-lima">HUB</span>}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ),
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--groove)] pt-3">
              <button type="button" className="text-[12px] text-t3 hover:text-t1" onClick={() => setMarcados([])}>Limpar</button>
              <button type="button" className="btn-primary !py-1.5 text-[12px]" onClick={() => ir(marcados)} data-testid="filtro-aplicar">
                <Check className="h-4 w-4" /> Aplicar
              </button>
            </div>
          </div>
        )}
      </div>
      {selecionados.map((c) => (
        <button key={c} type="button" onClick={() => ir(selecionados.filter((x) => x !== c))} className="pill num gap-1 bg-[var(--groove)] px-2.5 py-1 text-[12px] font-semibold text-t1 hover:text-erro" title={`Remover ${c} do filtro`}>
          {c} <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}
