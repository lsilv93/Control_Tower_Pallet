import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Boxes, CalendarClock, ClipboardCheck, Factory, Hammer, Recycle, Scale, Trash2 } from "lucide-react";
import { AtualizacaoTV } from "@/components/AtualizacaoTV";
import { BotaoTelaCheia } from "@/components/BotaoTelaCheia";
import { requireCD } from "@/lib/auth";
import { formatarNumero as n, numeroAgenda, rotuloStatusAgenda, rotuloTipoUnidade } from "@/lib/formatos";
import { tem } from "@/lib/permissoes";
import { dadosTV, versaoTV } from "@/lib/tv";

export const metadata: Metadata = { title: "Tela TV · Control Center" };
export const dynamic = "force-dynamic";

const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

function Kpi({ rotulo, valor, detalhe, cor, icone: Icone, grande }: {
  rotulo: string;
  valor: number;
  detalhe?: string;
  cor: string;
  icone: typeof Boxes;
  grande?: boolean;
}) {
  return (
    <section className="card relative overflow-hidden p-5">
      <Icone className={clsx("pointer-events-none absolute -bottom-6 -right-4 h-32 w-32 opacity-[0.07]", cor)} />
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-t3">{rotulo}</p>
      <p className={clsx("num mt-2 font-semibold leading-none", cor, grande ? "text-[clamp(52px,5.2vw,96px)]" : "text-[clamp(40px,3.8vw,68px)]")}>{n(valor)}</p>
      {detalhe && <p className="mt-2 text-[13px] text-t3">{detalhe}</p>}
    </section>
  );
}

function Periodos({ rotulo, valores, cor, icone: Icone }: { rotulo: string; valores: { dia: number; mes: number; geral: number }; cor: string; icone: typeof Boxes }) {
  return (
    <section className="card p-5">
      <p className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-t3">
        <Icone className={clsx("h-4 w-4", cor)} /> {rotulo}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {([["Dia", valores.dia], ["Mês", valores.mes], ["Geral", valores.geral]] as const).map(([r, v]) => (
          <div key={r} className="poco px-3 py-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.12em] text-t4">{r}</p>
            <p className={clsx("num text-[clamp(24px,2.6vw,38px)] font-semibold leading-tight", r === "Dia" ? cor : "text-t1")}>{n(v)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Barras({ itens, cor, vazio }: { itens: { chave: string; rotulo: string; sub?: string; valor: number; alerta?: string }[]; cor: string; vazio: string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  if (!itens.length) return <p className="poco px-4 py-6 text-center text-[13px] text-t3">{vazio}</p>;
  return (
    <ul className="space-y-3">
      {itens.map((i) => (
        <li key={i.chave}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[14px] font-medium text-t1" title={i.rotulo}>
              {i.rotulo} {i.sub && <span className="text-[11px] text-t4">· {i.sub}</span>}
            </span>
            <span className="num flex-none text-[20px] font-semibold text-t1">
              {n(i.valor)}
              {i.alerta && <span className="ml-2 text-[12px] font-semibold text-erro">{i.alerta}</span>}
            </span>
          </div>
          <div className="poco h-3 overflow-hidden !rounded-full">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(3, (i.valor / max) * 100)}%`, background: cor }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Quadro({ titulo, icone: Icone, total, children, className }: { titulo: string; icone: typeof Boxes; total?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("card flex min-h-0 flex-col p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[0.12em] text-t2">
          <Icone className="h-4 w-4 text-lima" /> {titulo}
        </h2>
        {total && <span className="num text-[14px] font-semibold text-t1">{total}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto pr-1">{children}</div>
    </section>
  );
}

/**
 * Tela TV (Control Center) para monitores da gerência: indicadores do CD em tempo real,
 * com auto-refresh assim que houver um novo lançamento (e a cada minuto, por garantia).
 */
export default async function TelaTV() {
  const u = await requireCD();
  if (!tem(u, "tv") && !tem(u, "dashboard")) redirect("/sem-acesso");
  const [d, versao] = await Promise.all([dadosTV(u.cd.id), versaoTV(u.cd.id)]);
  const recebidosHoje = d.recebidosHoje.reduce((s, r) => s + r.quantidade, 0);
  const faltasHoje = d.recebidosHoje.reduce((s, r) => s + r.falta, 0);
  const retiradaHoje = d.agendas.reduce((s, a) => s + a.quantidade, 0);

  return (
    <main className="min-h-screen p-[14px] lg:p-5" data-testid="tela-tv">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="btn-icone" title="Voltar ao sistema" aria-label="Voltar ao sistema"><ArrowLeft className="h-5 w-5" /></Link>
          <span className="fill-lima flex h-12 w-12 items-center justify-center rounded-2xl"><Boxes className="h-6 w-6" /></span>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-t3">Control Center · Pallets PBR</p>
            <h1 className="text-[clamp(22px,2.4vw,34px)] font-semibold leading-tight text-t1">
              CD <span className="num text-lima">{u.cd.codigo}</span> · {u.cd.nome}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <AtualizacaoTV versaoInicial={versao} />
          <BotaoTelaCheia />
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Pallets vazios" valor={d.saldos.vazios} detalhe="saldo atual do pulmão" cor="text-lima" icone={Boxes} grande />
        <Kpi rotulo="Pallets quebrados" valor={d.saldos.quebrados} detalhe="aguardando reparo ou descarte" cor="text-ouro" icone={Hammer} grande />
        <Kpi rotulo="Vales pendentes · fornecedores" valor={d.saldos.fornecedores} detalhe={`${d.saldos.valesFornecedorEmAberto} vale(s) a pagar`} cor="text-t1" icone={Factory} />
        <Kpi rotulo="Saldo devedor · CDs e Cross" valor={d.saldos.devedor} detalhe={`${d.devedores.length} unidade(s) devendo`} cor="text-t1" icone={Scale} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Periodos rotulo="Recuperados (reparo)" valores={d.recuperados} cor="text-lima" icone={Recycle} />
        <Periodos rotulo="Descartados / destruídos" valores={d.descartados} cor="text-erro" icone={Trash2} />
        <Periodos rotulo="Entradas de fornecedores" valores={d.entradas} cor="text-lima" icone={Factory} />
        <Periodos rotulo="Enviados a CDs / Cross" valores={d.enviados} cor="text-lima" icone={Scale} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Quadro titulo="Saldo devedor por unidade" icone={Scale} total={n(d.saldos.devedor)} className="xl:h-[max(18rem,calc(100vh-31rem))]">
          <Barras
            cor="var(--viz-vazios)"
            vazio="Nenhum saldo devedor em aberto."
            itens={d.devedores.map((x) => ({
              chave: x.unidade.id,
              rotulo: `${x.unidade.codigo} · ${x.unidade.nome}`,
              sub: `${rotuloTipoUnidade[x.unidade.tipo]}${x.idade !== null ? ` · ${x.idade}d` : ""}`,
              valor: x.saldo,
            }))}
          />
        </Quadro>
        <Quadro titulo="Vales pendentes por fornecedor" icone={Factory} total={n(d.saldos.fornecedores)} className="xl:h-[max(18rem,calc(100vh-31rem))]">
          <Barras
            cor="var(--viz-quebrados)"
            vazio="Nenhum vale de fornecedor pendente."
            itens={d.pendencias.map((p) => ({ chave: p.fornecedor.id, rotulo: p.fornecedor.nome, sub: `${p.vales} vale(s)`, valor: p.total }))}
          />
        </Quadro>
        <Quadro titulo="Recebidos hoje" icone={ClipboardCheck} total={`${n(recebidosHoje)}${faltasHoje ? ` · falta ${n(faltasHoje)}` : ""}`} className="xl:h-[max(18rem,calc(100vh-31rem))]">
          <Barras
            cor="var(--viz-entrada)"
            vazio="Nenhum retorno recebido hoje."
            itens={d.recebidosHoje.map((r) => ({
              chave: r.unidade.id,
              rotulo: `${r.unidade.codigo} · ${r.unidade.nome}`,
              sub: `${rotuloTipoUnidade[r.unidade.tipo]} · ${r.conferencias} conferência(s)`,
              valor: r.quantidade,
              alerta: r.falta ? `falta ${n(r.falta)}` : undefined,
            }))}
          />
        </Quadro>
        <Quadro titulo="Retiradas de hoje" icone={CalendarClock} total={n(retiradaHoje)} className="xl:h-[max(18rem,calc(100vh-31rem))]">
          {d.agendas.length === 0 ? (
            <p className="poco px-4 py-6 text-center text-[13px] text-t3">Nenhuma retirada agendada para hoje.</p>
          ) : (
            <ul className="space-y-2">
              {d.agendas.map((a) => (
                <li key={a.id} className="poco flex items-center gap-4 px-4 py-3">
                  <span className="num text-[22px] font-semibold text-lima">{hora(a.dataPrevista)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-t1">{a.fornecedor}</span>
                    <span className="text-[11px] text-t4">{numeroAgenda(a.numero)} · {rotuloStatusAgenda[a.status]}</span>
                  </span>
                  <span className="num text-[20px] font-semibold text-t1">{n(a.quantidade)}</span>
                </li>
              ))}
            </ul>
          )}
        </Quadro>
      </div>
    </main>
  );
}
