import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Boxes, Building2, Hammer, Network, Target, TriangleAlert, Truck } from "lucide-react";
import { AtualizacaoTV } from "@/components/AtualizacaoTV";
import { BotaoTelaCheia } from "@/components/BotaoTelaCheia";
import { requireUsuario } from "@/lib/auth";
import { REGRAS_FAROL_UNIDADE, type Farol } from "@/lib/farol";
import { formatarNumero as n } from "@/lib/formatos";
import { tem } from "@/lib/permissoes";
import { dadosTV, versaoTV, type LinhaTV } from "@/lib/tv";

export const metadata: Metadata = { title: "Torre de Controle · Nível Brasil" };
export const dynamic = "force-dynamic";

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const corAcur = (v: number | null) => (v === null ? "text-t4" : v >= 0.98 ? "text-lima" : v >= 0.95 ? "text-ouro" : "text-erro");

const FAROL: Record<Farol, { cor: string; fundo: string; rotulo: string }> = {
  VERDE: { cor: "bg-[#22c55e]", fundo: "bg-[#22c55e]/10 text-[#22c55e]", rotulo: "Normal" },
  AMARELO: { cor: "bg-[#eab308]", fundo: "bg-[#eab308]/10 text-[#eab308]", rotulo: "Atenção" },
  VERMELHO: { cor: "bg-[#ef4444]", fundo: "bg-[#ef4444]/10 text-[#ef4444]", rotulo: "Crítico" },
};

function Luz({ farol }: { farol: Farol }) {
  return (
    <span className="inline-flex items-center gap-2" title={FAROL[farol].rotulo}>
      <span className={clsx("h-4 w-4 flex-none rounded-full shadow-[0_0_12px_currentColor]", FAROL[farol].cor, farol === "VERMELHO" && "animate-pulse")} aria-hidden />
      <span className="sr-only">{FAROL[farol].rotulo}</span>
    </span>
  );
}

function Kpi({ rotulo, valor, detalhe, cor, icone: Icone }: { rotulo: string; valor: number | string; detalhe?: string; cor: string; icone: typeof Boxes }) {
  return (
    <section className="card relative overflow-hidden p-5">
      <Icone className={clsx("pointer-events-none absolute -bottom-6 -right-4 h-28 w-28 opacity-[0.07]", cor)} />
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-t3">{rotulo}</p>
      <p className={clsx("num mt-2 text-[clamp(36px,3.4vw,60px)] font-semibold leading-none", cor)}>{typeof valor === "number" ? n(valor) : valor}</p>
      {detalhe && <p className="mt-2 text-[13px] text-t3">{detalhe}</p>}
    </section>
  );
}

/** Composição do estoque da unidade: Pallets PBR x Pallets Quebrados (barra empilhada). */
function Composicao({ bons, quebrados, maximo }: { bons: number; quebrados: number; maximo: number }) {
  const largura = (v: number) => `${maximo ? (v / maximo) * 100 : 0}%`;
  return (
    <div className="flex h-3 w-full min-w-[120px] overflow-hidden rounded-full bg-[var(--groove)]" role="img" aria-label={`${bons} Pallets PBR e ${quebrados} Pallets Quebrados`}>
      <div className="h-full bg-lima" style={{ width: largura(bons) }} />
      <div className="h-full bg-ouro" style={{ width: largura(quebrados) }} />
    </div>
  );
}

function TabelaUnidades({ titulo, icone: Icone, linhas, cross, testid }: { titulo: string; icone: typeof Boxes; linhas: LinhaTV[]; cross?: boolean; testid: string }) {
  const maximo = Math.max(1, ...linhas.map((l) => l.total));
  const t = linhas.reduce((s, l) => ({ bons: s.bons + l.vazios, quebrados: s.quebrados + l.quebrados, transito: s.transito + l.transito, oc: s.oc + l.ocorrenciasPendentes }), { bons: 0, quebrados: 0, transito: 0, oc: 0 });
  return (
    <section className="card flex min-h-0 flex-col p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold uppercase tracking-[0.12em] text-t1">
          <Icone className="h-5 w-5 text-lima" /> {titulo} <span className="text-t4">({linhas.length})</span>
        </h2>
        <span className="num text-[13px] text-t2">
          <span className="text-lima">●</span> {n(t.bons)} PBR · <span className="text-ouro">●</span> {n(t.quebrados)} quebrados
        </span>
      </div>
      {linhas.length === 0 ? (
        <p className="poco px-4 py-6 text-center text-[13px] text-t3">Nenhuma unidade cadastrada.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[980px] text-[14px]" data-testid={testid}>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-t4">
                <th className="pb-3 pr-2 font-semibold">Farol</th>
                <th className="pb-3 font-semibold">Unidade</th>
                <th className="pb-3 text-right font-semibold">Pallets PBR</th>
                <th className="pb-3 text-right font-semibold">Quebrados</th>
                <th className="pb-3 text-right font-semibold">Total</th>
                <th className="w-[16%] pb-3 pl-4 font-semibold">Composição</th>
                <th className="pb-3 text-right font-semibold">Em trânsito</th>
                <th className="pb-3 text-right font-semibold">A receber</th>
                <th className="pb-3 text-right font-semibold">Ocorrências</th>
                <th className="pb-3 text-right font-semibold">SLA</th>
                <th className="pb-3 text-right font-semibold">Acuracidade</th>
                <th className="pb-3 pl-4 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.unidade.id} className={clsx("border-t border-[var(--groove)] align-middle", l.farol === "VERMELHO" && "bg-[#ef4444]/[0.06]")}>
                  <td className="py-2.5 pr-2"><Luz farol={l.farol} /></td>
                  <td className="py-2.5">
                    <span className="num text-[15px] font-semibold text-t1">{l.unidade.codigo}</span>
                    {l.unidade.hub && <span className="ml-2 rounded-full bg-lima/15 px-2 py-0.5 text-[10px] font-bold text-lima">HUB</span>}
                    <span className="block max-w-[14rem] truncate text-[11px] text-t4" title={l.unidade.nome}>
                      {cross ? `Atende: ${l.cdsAtendidos.join(", ") || "—"}` : l.unidade.nome}
                    </span>
                  </td>
                  <td className="num py-2.5 text-right text-[20px] font-semibold text-lima">{n(l.vazios)}</td>
                  <td className="num py-2.5 text-right text-[20px] font-semibold text-ouro">{n(l.quebrados)}</td>
                  <td className="num py-2.5 text-right text-[16px] font-semibold text-t1">{n(l.total)}</td>
                  <td className="py-2.5 pl-4"><Composicao bons={l.vazios} quebrados={l.quebrados} maximo={maximo} /></td>
                  <td className="num py-2.5 text-right text-t2">{n(l.transito)}</td>
                  <td className="num py-2.5 text-right text-t2">{n(l.aReceber)}</td>
                  <td className={clsx("num py-2.5 text-right font-semibold", l.ocorrenciasPendentes ? "text-erro" : "text-t4")}>{n(l.ocorrenciasPendentes)}</td>
                  <td className="num py-2.5 text-right text-t2">{l.diasTransitoMaisAntigo === null ? "—" : `${l.diasTransitoMaisAntigo}d`}</td>
                  <td className={clsx("num py-2.5 text-right font-semibold", corAcur(l.acuracidade))}>{pct(l.acuracidade)}</td>
                  <td className="py-2.5 pl-4 text-[12px]">
                    {l.motivos.length === 0 ? (
                      <span className={clsx("rounded-full px-2.5 py-1 text-[11px] font-semibold", FAROL.VERDE.fundo)}>Normal</span>
                    ) : (
                      <span className={clsx("block max-w-[18rem] truncate font-medium", l.farol === "VERMELHO" ? "text-[#ef4444]" : "text-[#eab308]")} title={l.motivos.join(" · ")}>
                        {l.motivos.join(" · ")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Torre de Controle Nível Brasil (gestão à vista): CDs e Pontos de Cross em tabelas
 * separadas, com Pallets PBR, Quebrados, trânsito, ocorrências, SLA, acuracidade e farol por
 * unidade. Sem dados de fornecedores. Recarrega a cada nova transação em qualquer unidade.
 */
export default async function TelaTV() {
  const u = await requireUsuario();
  if (!u.visaoBrasil || (!tem(u, "tv") && !tem(u, "dashboard"))) redirect("/sem-acesso?modulo=tv");
  const [d, versao] = await Promise.all([dadosTV(), versaoTV()]);
  const t = d.totais;
  const r = REGRAS_FAROL_UNIDADE;

  return (
    <main className="min-h-screen p-[14px] lg:p-5" data-testid="tela-tv">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="btn-icone" title="Voltar ao sistema" aria-label="Voltar ao sistema"><ArrowLeft className="h-5 w-5" /></Link>
          <span className="fill-lima flex h-12 w-12 items-center justify-center rounded-2xl"><Boxes className="h-6 w-6" /></span>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-t3">Torre de Controle · Gestão à Vista · Pallets PBR</p>
            <h1 className="text-[clamp(22px,2.4vw,34px)] font-semibold leading-tight text-t1">
              Nível <span className="text-lima">Brasil</span>
              <span className="ml-3 text-[clamp(13px,1.1vw,16px)] font-medium text-t3">{d.cds.length} CD(s) · {d.crosses.length} Ponto(s) de Cross{d.hub ? ` · Hub ${d.hub.unidade.codigo}` : ""}</span>
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="card-sm flex items-center gap-4 px-4 py-2.5" data-testid="resumo-farois">
            {(["VERMELHO", "AMARELO", "VERDE"] as const).map((f) => (
              <span key={f} className="num flex items-center gap-2 text-[18px] font-semibold text-t1"><Luz farol={f} /> {t.farois[f]}</span>
            ))}
          </div>
          <AtualizacaoTV versaoInicial={versao} />
          <BotaoTelaCheia />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi rotulo="Pallets PBR · Brasil" valor={t.bons} detalhe={`CDs ${n(t.cds.bons)} · Cross ${n(t.crosses.bons)}`} cor="text-lima" icone={Boxes} />
        <Kpi rotulo="Pallets Quebrados · Brasil" valor={t.quebrados} detalhe={`CDs ${n(t.cds.quebrados)} · Cross ${n(t.crosses.quebrados)}`} cor="text-ouro" icone={Hammer} />
        <Kpi rotulo="Em trânsito" valor={t.transito} detalhe={`${n(t.quebradosAoHub)} quebrados a caminho do CDJC`} cor="text-t1" icone={Truck} />
        <Kpi rotulo="Ocorrências pendentes" valor={t.ocorrenciasPendentes} detalhe={`${n(t.ocorrenciasQuantidade)} pallet(s) em divergência`} cor={t.ocorrenciasPendentes ? "text-erro" : "text-t1"} icone={TriangleAlert} />
        <Kpi rotulo="Acuracidade" valor={pct(t.acuracidade)} detalhe={`recebidos ${n(t.recebidosConferidos)} x enviados ${n(t.enviadosConferidos)}`} cor={corAcur(t.acuracidade)} icone={Target} />
      </div>

      <div className="mt-4 grid gap-4">
        <TabelaUnidades titulo="Centros de Distribuição" icone={Building2} linhas={d.cds} testid="tv-cds" />
        <TabelaUnidades titulo="Pontos de Cross" icone={Network} linhas={d.crosses} cross testid="tv-cross" />
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-t3" data-testid="legenda-farol">
        <span className="font-semibold uppercase tracking-[0.12em] text-t4">Farol</span>
        <span className="flex items-center gap-2"><Luz farol="VERMELHO" /> vale em trânsito há {r.slaDias.vermelho}+ dias, saldo de Cross ≥ {r.saldoCross.vermelho}, {r.ocorrencias.vermelhoQuantidade}+ ocorrências ou ocorrência há {r.ocorrencias.vermelhoDias}+ dias</span>
        <span className="flex items-center gap-2"><Luz farol="AMARELO" /> trânsito há {r.slaDias.amarelo}+ dias, saldo de Cross ≥ {r.saldoCross.amarelo} ou ocorrência pendente</span>
        <span className="flex items-center gap-2"><Luz farol="VERDE" /> dentro do SLA, sem pendências</span>
      </p>
    </main>
  );
}
