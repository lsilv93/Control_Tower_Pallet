"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { CalendarDays, CalendarRange, Infinity as InfinityIcon, CalendarClock, Calendar } from "lucide-react";
import { NOMES_MESES, rotuloSemana, semanasNoAno, type TipoPeriodo } from "@/lib/periodo";

type Valores = { tipo: TipoPeriodo; dia: string; ano: number; semana: number; mes: number; de: string; ate: string };

const opcoes: { tipo: TipoPeriodo; rotulo: string; icone: typeof Calendar }[] = [
  { tipo: "dia", rotulo: "Dia", icone: CalendarDays },
  { tipo: "semana", rotulo: "Semana do Ano", icone: CalendarClock },
  { tipo: "mes", rotulo: "Mês", icone: Calendar },
  { tipo: "intervalo", rotulo: "Intervalo", icone: CalendarRange },
  { tipo: "todos", rotulo: "Geral", icone: InfinityIcon },
];

/** Filtro temporal global do Dashboard. A seleção vai para a URL (compartilhável e mantida no auto-refresh). */
export function FiltroPeriodo({
  atual,
  rotulo,
  anoAtual,
  fornecedores,
  fornecedor,
}: {
  atual: Valores;
  rotulo: string;
  anoAtual: number;
  fornecedores?: { id: string; nome: string }[];
  fornecedor?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [v, setV] = useState<Valores>(atual);
  const [carregando, iniciar] = useTransition();
  const [forn, setForn] = useState(fornecedor ?? "");
  const anos = Array.from({ length: 6 }, (_, i) => anoAtual - 4 + i).filter((a) => a <= anoAtual + 1);

  function aplicar(novo: Valores) {
    setV(novo);
    const q = new URLSearchParams({ periodo: novo.tipo });
    if (forn) q.set("fornecedor", forn);
    if (novo.tipo === "dia") q.set("dia", novo.dia);
    if (novo.tipo === "semana") {
      q.set("ano", String(novo.ano));
      q.set("semana", String(novo.semana));
    }
    if (novo.tipo === "mes") {
      q.set("ano", String(novo.ano));
      q.set("mes", String(novo.mes));
    }
    if (novo.tipo === "intervalo") {
      q.set("de", novo.de);
      q.set("ate", novo.ate);
    }
    iniciar(() => router.push(`${pathname}?${q.toString()}`, { scroll: false }));
  }

  // "Intervalo" só aplica pelo botão (precisa das duas datas); os demais aplicam ao mudar.
  function trocarTipo(tipo: TipoPeriodo) {
    if (tipo === "intervalo") setV({ ...v, tipo });
    else aplicar({ ...v, tipo });
  }

  return (
    <section className="card mb-6 p-4 sm:p-5" aria-label="Filtro de período">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="abas" aria-label="Tipo de período">
          {opcoes.map((o) => (
            <button
              key={o.tipo}
              type="button"
              onClick={() => trocarTipo(o.tipo)}
              className={clsx("aba", v.tipo === o.tipo && "aba-ativa")}
              aria-pressed={v.tipo === o.tipo}
            >
              <o.icone className="h-4 w-4" />
              {o.rotulo}
            </button>
          ))}
        </nav>
        <p className="flex items-center gap-2 text-[12px] text-t3" aria-live="polite">
          <span className={clsx("ponto", carregando ? "ponto-pulsante text-lima" : "text-t4")} />
          {carregando ? "Atualizando..." : <>Período: <strong className="text-t1">{rotulo}</strong></>}
        </p>
      </div>

      {(v.tipo !== "todos" || fornecedores) && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {v.tipo === "dia" && (
            <div>
              <label className="label" htmlFor="filtro-dia">Dia</label>
              <input id="filtro-dia" type="date" className="input" value={v.dia} onChange={(e) => e.target.value && aplicar({ ...v, dia: e.target.value })} />
            </div>
          )}
          {(v.tipo === "semana" || v.tipo === "mes") && (
            <div>
              <label className="label" htmlFor="filtro-ano">Ano</label>
              <select
                id="filtro-ano"
                className="input num"
                value={v.ano}
                onChange={(e) => {
                  const ano = Number(e.target.value);
                  aplicar({ ...v, ano, semana: Math.min(v.semana, semanasNoAno(ano)) });
                }}
              >
                {anos.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}
          {v.tipo === "semana" && (
            <div className="min-w-[16rem]">
              <label className="label" htmlFor="filtro-semana">Semana do ano</label>
              <select id="filtro-semana" className="input" value={v.semana} onChange={(e) => aplicar({ ...v, semana: Number(e.target.value) })}>
                {Array.from({ length: semanasNoAno(v.ano) }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>{rotuloSemana(v.ano, s)}</option>
                ))}
              </select>
            </div>
          )}
          {v.tipo === "mes" && (
            <div>
              <label className="label" htmlFor="filtro-mes">Mês</label>
              <select id="filtro-mes" className="input" value={v.mes} onChange={(e) => aplicar({ ...v, mes: Number(e.target.value) })}>
                {NOMES_MESES.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
          )}
          {fornecedores && (
            <div className="min-w-[14rem]">
              <label className="label" htmlFor="filtro-fornecedor">Fornecedor</label>
              <select
                id="filtro-fornecedor"
                className="input"
                value={forn}
                onChange={(e) => {
                  const novo = e.target.value;
                  setForn(novo);
                  const q = new URLSearchParams(window.location.search);
                  if (novo) q.set("fornecedor", novo);
                  else q.delete("fornecedor");
                  if (!q.get("periodo")) q.set("periodo", v.tipo);
                  iniciar(() => router.push(`${pathname}?${q.toString()}`, { scroll: false }));
                }}
              >
                <option value="">Todos os fornecedores</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
          )}
          {v.tipo === "intervalo" && (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                aplicar(v);
              }}
            >
              <div>
                <label className="label" htmlFor="filtro-de">De</label>
                <input id="filtro-de" type="date" className="input" required value={v.de} max={v.ate} onChange={(e) => setV({ ...v, de: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="filtro-ate">Até</label>
                <input id="filtro-ate" type="date" className="input" required value={v.ate} min={v.de} onChange={(e) => setV({ ...v, ate: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary" disabled={carregando || !v.de || !v.ate}>
                Aplicar
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
