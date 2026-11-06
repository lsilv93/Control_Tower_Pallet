import Link from "next/link";
import type { Prisma } from "@prisma/client";
import clsx from "clsx";
import { ArrowRight, CircleCheck, CircleX, FilePlus2, Printer } from "lucide-react";
import { BannerOk } from "@/components/Cadastro";
import { FormRespostaOcorrencia } from "@/components/FormRespostaOcorrencia";
import { Abas, Cabecalho, Indicador, Painel, Vazio } from "@/components/ui";
import { requireCD } from "@/lib/auth";
import { formatarDataHora } from "@/lib/datas";
import { formatarNumero as n, numeroConferencia, numeroVale, rotuloResolucao } from "@/lib/formatos";
import { efeitoDoAceite, filtroAguardandoUsuario, unidadesDoEscopo } from "@/lib/ocorrencias";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Ocorrências" };

const FILTROS = { acao: "Aguardando minha ação", pendentes: "Pendentes", encerradas: "Encerradas", todas: "Todas" } as const;
type Filtro = keyof typeof FILTROS;

const ICONE_ACAO = { ABERTURA: FilePlus2, RECUSA: CircleX, ACEITE: CircleCheck } as const;
const ROTULO_ACAO = { ABERTURA: "Abriu a ocorrência", RECUSA: "Recusou", ACEITE: "Aceitou" } as const;

/**
 * Gestão de ocorrências (divergências entre o enviado e o recebido). Cada ocorrência começa
 * pendente na unidade remetente, que aceita ou recusa com justificativa; a recusa devolve a
 * pendência à unidade recebedora, e o ciclo segue até um aceite, que ajusta a conta corrente.
 */
export default async function OcorrenciasPage({ searchParams }: { searchParams: Promise<{ f?: string; ok?: string }> }) {
  const u = await requireCD();
  const sp = await searchParams;
  const ids = unidadesDoEscopo(u);
  const escopo: Prisma.ValePalletWhereInput = { tipo: "OCORRENCIA", ...(ids ? { OR: [{ cdId: { in: ids } }, { unidadeId: { in: ids } }] } : {}) };
  const aguardando = filtroAguardandoUsuario(u);
  const nAcao = await prisma.valePallet.count({ where: aguardando });
  const filtro: Filtro = sp.f && sp.f in FILTROS ? (sp.f as Filtro) : nAcao > 0 ? "acao" : "pendentes";
  const where: Prisma.ValePalletWhereInput =
    filtro === "acao" ? aguardando : filtro === "pendentes" ? { ...escopo, status: "PENDENTE" } : filtro === "encerradas" ? { ...escopo, status: "FINALIZADO" } : escopo;

  const [vales, pendentes, faltas, sobras] = await Promise.all([
    prisma.valePallet.findMany({
      where,
      include: {
        cd: { select: { id: true, codigo: true, tipo: true } },
        unidade: { select: { id: true, codigo: true, tipo: true } },
        aguardando: { select: { id: true, codigo: true } },
        conferenciaOrigem: { select: { numero: true, totalDeclarado: true, recebidoBons: true, recebidoQuebrados: true, vales: { select: { numero: true } } } },
        resolvidoPor: { select: { nome: true } },
        interacoes: { include: { unidade: { select: { codigo: true } }, usuario: { select: { nome: true } } }, orderBy: { criadoEm: "asc" } },
      },
      orderBy: [{ status: "asc" }, { criadoEm: "desc" }],
      take: 150,
    }),
    prisma.valePallet.aggregate({ where: { ...escopo, status: "PENDENTE" }, _sum: { quantidade: true }, _count: true }),
    prisma.valePallet.aggregate({ where: { ...escopo, ocorrencia: "FALTA" }, _sum: { quantidade: true }, _count: true }),
    prisma.valePallet.aggregate({ where: { ...escopo, ocorrencia: "SOBRA" }, _sum: { quantidade: true }, _count: true }),
  ]);
  const minhas = new Set(u.cds.map((c) => c.id));
  const podeResponder = (aguardandoId: string | null) => !!aguardandoId && (u.global || minhas.has(aguardandoId));

  return (
    <>
      <Cabecalho
        titulo="Ocorrências (Divergências)"
        descricao="Toda diferença entre o enviado e o recebido gera uma ocorrência pendente na unidade remetente. Ela aceita (a conta corrente é ajustada em definitivo) ou recusa com justificativa (a pendência volta para a unidade recebedora). O ciclo se repete até uma das unidades aceitar."
      />
      <BannerOk mensagem={sp.ok} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Indicador titulo="Aguardando sua ação" valor={n(nAcao)} detalhe="ocorrência(s) para aceitar ou recusar" cor={nAcao ? "erro" : "lima"} />
        <Indicador titulo="Pendentes" valor={n(pendentes._sum.quantidade ?? 0)} detalhe={`${pendentes._count} ocorrência(s) em aberto`} cor="ouro" />
        <Indicador titulo="Faltas (total)" valor={n(faltas._sum.quantidade ?? 0)} detalhe={`${faltas._count} ocorrência(s)`} cor="neutro" />
        <Indicador titulo="Sobras (total)" valor={n(sobras._sum.quantidade ?? 0)} detalhe={`${sobras._count} ocorrência(s)`} cor="neutro" />
      </div>
      <Abas ativo={`/ocorrencias?f=${filtro}`} itens={(Object.keys(FILTROS) as Filtro[]).map((f) => ({ href: `/ocorrencias?f=${f}`, rotulo: f === "acao" && nAcao ? `${FILTROS[f]} (${nAcao})` : FILTROS[f] }))} />

      {vales.length === 0 ? (
        <Painel>
          <Vazio>{filtro === "acao" ? "Nenhuma ocorrência aguardando a sua ação." : "Nenhuma ocorrência encontrada."}</Vazio>
        </Painel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2" data-testid="lista-ocorrencias">
          {vales.map((v) => {
            const codigo = numeroVale(v.numero, "OCORRENCIA");
            const pendente = v.status === "PENDENTE";
            const daVezRemetente = v.aguardandoId === v.cdId;
            const c = v.conferenciaOrigem;
            return (
              <section key={v.id} className={clsx("card flex min-w-0 flex-col gap-4 p-5", pendente && podeResponder(v.aguardandoId) && "ring-1 ring-erro/50")} data-testid={`ocorrencia-${codigo}`}>
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link prefetch={false} href={`/vales/${v.id}`} className="num text-[15px] font-semibold text-lima hover:underline">{codigo}</Link>
                      <span className={v.ocorrencia === "FALTA" ? "pill text-erro bg-erro/10" : "pill text-t2 bg-t2/10"}>{v.ocorrencia === "FALTA" ? "Falta" : "Sobra"}</span>
                      {v.recusas > 0 && <span className="pill text-ouro bg-ouro/10">{v.recusas} recusa(s)</span>}
                    </div>
                    <p className="num mt-1 flex items-center gap-1.5 text-[12px] text-t2">
                      {v.cd.codigo} <ArrowRight className="h-3 w-3 text-t4" aria-label="para" /> {v.unidade?.codigo}
                      <span className="text-t4">· {formatarDataHora(v.criadoEm)}</span>
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="num text-[24px] font-semibold leading-none text-t1">{n(v.quantidade)}</p>
                    <p className="text-[11px] text-t4">{n(v.quantidadeBons)} PBR · {n(v.quantidadeQuebrados)} quebrados</p>
                  </div>
                </header>

                {c && (
                  <p className="poco px-4 py-2.5 text-[11px] text-t3">
                    Conferência <span className="num font-semibold text-t1">{numeroConferencia(c.numero)}</span> ({c.vales.map((x) => numeroVale(x.numero, "ENVIO")).join(", ")}): enviado{" "}
                    <span className="num text-t1">{n(c.totalDeclarado)}</span> × recebido <span className="num text-t1">{n(c.recebidoBons + c.recebidoQuebrados)}</span> ({n(c.recebidoBons)} PBR, {n(c.recebidoQuebrados)} quebrados)
                  </p>
                )}

                <ol className="space-y-2 border-l border-[var(--groove)] pl-4" aria-label="Histórico">
                  {v.interacoes.map((i) => {
                    const Icone = ICONE_ACAO[i.acao];
                    return (
                      <li key={i.id} className="relative text-[12px]">
                        <Icone className={clsx("absolute -left-[23px] top-0.5 h-3.5 w-3.5", i.acao === "RECUSA" ? "text-erro" : i.acao === "ACEITE" ? "text-lima" : "text-t3")} />
                        <p className="text-t2">
                          <span className="num font-semibold text-t1">{i.unidade.codigo}</span> · {ROTULO_ACAO[i.acao]} <span className="text-t4">· {i.usuario.nome} · {formatarDataHora(i.criadoEm)}</span>
                        </p>
                        {i.justificativa && <p className="mt-0.5 whitespace-pre-line text-t3">&ldquo;{i.justificativa}&rdquo;</p>}
                      </li>
                    );
                  })}
                </ol>

                <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--groove)] pt-3">
                  {pendente ? (
                    <p className="text-[12px] text-ouro" data-testid="aguardando">
                      Aguardando <strong className="num">{v.aguardando?.codigo}</strong> ({daVezRemetente ? "remetente" : "recebedor"})
                    </p>
                  ) : (
                    <p className="text-[12px] text-lima">
                      {v.resolucao ? rotuloResolucao[v.resolucao] : "Encerrada"} · {formatarDataHora(v.resolvidoEm)}
                      {v.resolvidoPor ? ` · ${v.resolvidoPor.nome}` : ""}
                    </p>
                  )}
                  <Link prefetch={false} href={`/imprimir/vale/${v.id}`} className="inline-flex items-center gap-1 text-[11px] text-t3 hover:text-t1"><Printer className="h-3.5 w-3.5" /> Vale</Link>
                  {pendente && podeResponder(v.aguardandoId) && v.unidade && (
                    <div className="w-full">
                      <FormRespostaOcorrencia
                        valeId={v.id}
                        codigo={codigo}
                        outraUnidade={daVezRemetente ? v.unidade.codigo : v.cd.codigo}
                        aba={filtro}
                        efeitoAceite={efeitoDoAceite({ ocorrencia: v.ocorrencia, quantidade: v.quantidade, cdCodigo: v.cd.codigo, recebedorCodigo: v.unidade.codigo }, daVezRemetente)}
                      />
                    </div>
                  )}
                </footer>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
