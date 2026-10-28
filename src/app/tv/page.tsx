import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Boxes, Building2, ClipboardCheck, Gauge, Hammer, Network, Target, TriangleAlert, Truck } from "lucide-react";
import { AtualizacaoTV } from "@/components/AtualizacaoTV";
import { BotaoTelaCheia } from "@/components/BotaoTelaCheia";
import { requireUsuario } from "@/lib/auth";
import { formatarNumero as n } from "@/lib/formatos";
import { tem } from "@/lib/permissoes";
import { dadosTV, versaoTV } from "@/lib/tv";

export const metadata: Metadata = { title: "Torre de Controle · Nível Brasil" };
export const dynamic = "force-dynamic";

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const corAcur = (v: number | null) => (v === null ? "text-t4" : v >= 0.98 ? "text-lima" : v >= 0.95 ? "text-ouro" : "text-erro");

function Kpi({ rotulo, valor, detalhe, cor, icone: Icone, grande }: {
  rotulo: string;
  valor: number | string;
  detalhe?: string;
  cor: string;
  icone: typeof Boxes;
  grande?: boolean;
}) {
  return (
    <section className="card relative overflow-hidden p-5">
      <Icone className={clsx("pointer-events-none absolute -bottom-6 -right-4 h-32 w-32 opacity-[0.07]", cor)} />
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-t3">{rotulo}</p>
      <p className={clsx("num mt-2 font-semibold leading-none", cor, grande ? "text-[clamp(52px,5.2vw,96px)]" : "text-[clamp(40px,3.8vw,68px)]")}>{typeof valor === "number" ? n(valor) : valor}</p>
      {detalhe && <p className="mt-2 text-[13px] text-t3">{detalhe}</p>}
    </section>
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
 * Torre de Controle Nível Brasil (TV da gerência): posição de bons e quebrados em cada CD e
 * Ponto de Cross, ativos fora do Hub, quebrados em trânsito para o CDJC e acuracidade das
 * remessas. Sem dados de fornecedores. Recarrega a cada nova transação em qualquer unidade.
 */
export default async function TelaTV() {
  const u = await requireUsuario();
  if (!u.global || (!tem(u, "tv") && !tem(u, "dashboard"))) redirect("/sem-acesso?modulo=tv");
  const [d, versao] = await Promise.all([dadosTV(), versaoTV()]);
  const t = d.totais;
  const altura = "xl:h-[max(20rem,calc(100vh-24rem))]";

  return (
    <main className="min-h-screen p-[14px] lg:p-5" data-testid="tela-tv">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="btn-icone" title="Voltar ao sistema" aria-label="Voltar ao sistema"><ArrowLeft className="h-5 w-5" /></Link>
          <span className="fill-lima flex h-12 w-12 items-center justify-center rounded-2xl"><Boxes className="h-6 w-6" /></span>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-t3">Torre de Controle · Pallets PBR</p>
            <h1 className="text-[clamp(22px,2.4vw,34px)] font-semibold leading-tight text-t1">
              Nível <span className="text-lima">Brasil</span>
              <span className="ml-3 text-[clamp(13px,1.1vw,16px)] font-medium text-t3">{t.unidades} unidade(s) · {t.crosses} Ponto(s) de Cross{d.hub ? ` · Hub ${d.hub.unidade.codigo}` : ""}</span>
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <AtualizacaoTV versaoInicial={versao} />
          <BotaoTelaCheia />
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Kpi rotulo="Pallets PBR · Brasil" valor={t.bons} detalhe="todos os CDs e Cross" cor="text-lima" icone={Boxes} grande />
        <Kpi rotulo="Pallets Quebrados · Brasil" valor={t.quebrados} detalhe={d.hub ? `${n(d.hub.quebrados)} no Hub ${d.hub.unidade.codigo}` : "sem Hub cadastrado"} cor="text-ouro" icone={Hammer} grande />
        <Kpi rotulo="Pallets Quebrados em trânsito ao Hub" valor={t.transitoHubQuebrados} detalhe={`${t.valesHub} vale(s) a conferir no CDJC`} cor="text-t1" icone={Truck} />
        <Kpi rotulo="Faltas em aberto" valor={t.ocorrenciasAbertas} detalhe={`${t.valesOcorrencia} ocorrência(s) · conferidos hoje ${n(t.recebidosHoje)}`} cor={t.ocorrenciasAbertas ? "text-erro" : "text-t1"} icone={TriangleAlert} />
        <Kpi rotulo="Acuracidade" valor={pct(t.acuracidade)} detalhe={`recebidos ${n(t.recebidosConferidos)} x enviados ${n(t.enviadosConferidos)}`} cor={corAcur(t.acuracidade)} icone={Target} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Quadro titulo="Posição por unidade" icone={Building2} total={`${n(t.bons)} PBR · ${n(t.quebrados)} quebrados`} className={clsx("xl:col-span-2", altura)}>
          <table className="w-full text-[14px]" data-testid="tv-unidades">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-t4">
                <th className="pb-2 font-semibold">Unidade</th>
                <th className="pb-2 text-right font-semibold">Pallets PBR</th>
                <th className="pb-2 text-right font-semibold">Pallets Quebrados</th>
                <th className="pb-2 text-right font-semibold">Trânsito</th>
              </tr>
            </thead>
            <tbody>
              {d.posicao.map((p) => (
                <tr key={p.unidade.id} className="border-t border-[var(--groove)]">
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-2">
                      {p.unidade.tipo === "CROSS" ? <Network className="h-3.5 w-3.5 flex-none text-t3" /> : <Building2 className={clsx("h-3.5 w-3.5 flex-none", p.unidade.hub ? "text-lima" : "text-t3")} />}
                      <span className="num font-semibold text-t1">{p.unidade.codigo}</span>
                      <span className="truncate text-[11px] text-t4">{p.unidade.hub ? "Hub" : p.unidade.tipo === "CROSS" ? "Cross" : "CD"}</span>
                    </span>
                  </td>
                  <td className="num py-2 text-right text-[18px] font-semibold text-lima">{n(p.vazios)}</td>
                  <td className="num py-2 text-right text-[18px] font-semibold text-ouro">{n(p.quebrados)}</td>
                  <td className="num py-2 text-right text-t2">{n(p.transito)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Quadro>

        <Quadro titulo="Ativos fora do Hub" icone={Gauge} total={`${n(t.foraHubBons)} PBR · ${n(t.foraHubQuebrados)} quebrados`} className={clsx("xl:col-span-3", altura)}>
          {d.filiais.length === 0 ? (
            <p className="poco px-4 py-6 text-center text-[13px] text-t3">Nenhuma filial ou Ponto de Cross cadastrado.</p>
          ) : (
            <table className="w-full text-[14px]" data-testid="tv-fora-hub">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-t4">
                  <th className="pb-2 font-semibold">Filial</th>
                  <th className="pb-2 text-right font-semibold">Pallets PBR</th>
                  <th className="pb-2 text-right font-semibold">Pallets Quebrados</th>
                  <th className="pb-2 text-right font-semibold">Em trânsito ao CDJC</th>
                  <th className="pb-2 text-right font-semibold">Recebidos x enviados</th>
                  <th className="pb-2 text-right font-semibold">Acuracidade</th>
                </tr>
              </thead>
              <tbody>
                {d.filiais.map((f) => (
                  <tr key={f.unidade.id} className="border-t border-[var(--groove)]">
                    <td className="py-2 pr-2">
                      <span className="num font-semibold text-t1">{f.unidade.codigo}</span>{" "}
                      <span className="text-[11px] text-t4">{f.unidade.tipo === "CROSS" ? "Cross" : "CD"}</span>
                    </td>
                    <td className="num py-2 text-right text-[18px] font-semibold text-lima">{n(f.vazios)}</td>
                    <td className="num py-2 text-right text-[18px] font-semibold text-ouro">{n(f.quebrados)}</td>
                    <td className="num py-2 text-right text-t1">
                      {n(f.transitoHubQuebrados + f.transitoHubBons)}
                      {f.valesHub > 0 && <span className="block text-[10px] text-t4">{f.valesHub} vale(s)</span>}
                    </td>
                    <td className="num py-2 text-right text-t2">{n(f.recebidosConferidos)} / {n(f.enviadosConferidos)}</td>
                    <td className={clsx("num py-2 text-right text-[18px] font-semibold", corAcur(f.acuracidade))}>{pct(f.acuracidade)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 flex items-center gap-2 text-[11px] text-t4">
            <ClipboardCheck className="h-3.5 w-3.5" /> Acuracidade = 1 − divergências (faltas + sobras) ÷ enviados, nas conferências em que a unidade foi remetente.
          </p>
        </Quadro>
      </div>
    </main>
  );
}
