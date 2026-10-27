import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Printer } from "lucide-react";
import { FormResolverOcorrencia } from "@/components/FormResolverOcorrencia";
import { Abas, Cabecalho, Indicador, Painel, StatusBadge, Tabela, Vazio } from "@/components/ui";
import { requireCD } from "@/lib/auth";
import { formatarDataHora } from "@/lib/datas";
import { formatarNumero as n, numeroConferencia, numeroVale, rotuloResolucao, rotuloStatusVale } from "@/lib/formatos";
import { ehAdmin } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Ocorrências" };

const FILTROS = { abertas: "Faltas em aberto", todas: "Todas", falta: "Faltas", sobra: "Sobras" } as const;
type Filtro = keyof typeof FILTROS;

/**
 * Auditoria de ocorrências (falta/sobra apuradas nas conferências). Remetente e recebedor
 * veem as mesmas ocorrências (data/hora, número do vale, conferência). Visão global vê
 * todas; administradores resolvem as faltas (localizada ou perda).
 */
export default async function OcorrenciasPage({ searchParams }: { searchParams: Promise<{ f?: string; unidade?: string }> }) {
  const u = await requireCD();
  const sp = await searchParams;
  const filtro: Filtro = sp.f && sp.f in FILTROS ? (sp.f as Filtro) : "abertas";
  const escopoUnidade = u.global ? (sp.unidade && u.cds.some((c) => c.id === sp.unidade) ? sp.unidade : null) : u.cd.id;
  const where: Prisma.ValePalletWhereInput = {
    tipo: "OCORRENCIA",
    ...(escopoUnidade ? { OR: [{ cdId: escopoUnidade }, { unidadeId: escopoUnidade }] } : {}),
    ...(filtro === "abertas" ? { ocorrencia: "FALTA", status: "PENDENTE" } : filtro === "falta" ? { ocorrencia: "FALTA" } : filtro === "sobra" ? { ocorrencia: "SOBRA" } : {}),
  };
  const escopoBase: Prisma.ValePalletWhereInput = { tipo: "OCORRENCIA", ...(escopoUnidade ? { OR: [{ cdId: escopoUnidade }, { unidadeId: escopoUnidade }] } : {}) };
  const [vales, abertas, faltas, sobras] = await Promise.all([
    prisma.valePallet.findMany({
      where,
      include: {
        cd: { select: { codigo: true, tipo: true } },
        unidade: { select: { codigo: true, tipo: true } },
        conferenciaOrigem: { select: { numero: true, vales: { select: { numero: true } } } },
        criadoPor: { select: { nome: true } },
        resolvidoPor: { select: { nome: true } },
      },
      orderBy: { criadoEm: "desc" },
      take: 200,
    }),
    prisma.valePallet.aggregate({ where: { ...escopoBase, ocorrencia: "FALTA", status: "PENDENTE" }, _sum: { quantidade: true }, _count: true }),
    prisma.valePallet.aggregate({ where: { ...escopoBase, ocorrencia: "FALTA" }, _sum: { quantidade: true }, _count: true }),
    prisma.valePallet.aggregate({ where: { ...escopoBase, ocorrencia: "SOBRA" }, _sum: { quantidade: true }, _count: true }),
  ]);
  const admin = ehAdmin(u);
  const qs = (f: Filtro) => `/ocorrencias?f=${f}${escopoUnidade && u.global ? `&unidade=${escopoUnidade}` : ""}`;

  return (
    <>
      <Cabecalho
        titulo="Ocorrências (Falta / Sobra)"
        descricao={`Divergências apuradas nas conferências de recebimento, auditáveis pelo remetente e pelo recebedor. ${u.global ? "Visão Nível Brasil." : `Unidade ${u.cd.codigo}.`} Faltas ficam em aberto até um administrador resolver (localizada ou perda).`}
      >
        {u.global && (
          <form className="flex items-center gap-2" action="/ocorrencias">
            <input type="hidden" name="f" value={filtro} />
            <select name="unidade" className="input !w-auto" defaultValue={escopoUnidade ?? ""} aria-label="Unidade">
              <option value="">Todas as unidades</option>
              {u.cds.map((c) => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)}
            </select>
            <button type="submit" className="btn-secondary btn-sm">Filtrar</button>
          </form>
        )}
      </Cabecalho>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Indicador titulo="Faltas em aberto" valor={n(abertas._sum.quantidade ?? 0)} detalhe={`${abertas._count} vale(s) de ocorrência`} cor="erro" />
        <Indicador titulo="Faltas (total)" valor={n(faltas._sum.quantidade ?? 0)} detalhe={`${faltas._count} ocorrência(s)`} cor="ouro" />
        <Indicador titulo="Sobras registradas" valor={n(sobras._sum.quantidade ?? 0)} detalhe={`${sobras._count} ocorrência(s)`} cor="neutro" />
      </div>
      <Abas ativo={qs(filtro)} itens={(Object.keys(FILTROS) as Filtro[]).map((f) => ({ href: qs(f), rotulo: FILTROS[f] }))} />
      <Painel>
        {vales.length === 0 ? (
          <Vazio>Nenhuma ocorrência {filtro === "abertas" ? "em aberto" : "encontrada"}.</Vazio>
        ) : (
          <Tabela>
            <table className="tabela" data-testid="tabela-ocorrencias">
              <thead>
                <tr><th>Vale</th><th>Data/hora</th><th>Tipo</th><th>Remetente</th><th>Recebedor</th><th>Conferência / vales</th><th className="text-right">Qtd.</th><th>Status</th><th>Detalhe</th>{admin && <th className="min-w-[240px]">Resolver</th>}</tr>
              </thead>
              <tbody>
                {vales.map((v) => {
                  const codigo = numeroVale(v.numero, "OCORRENCIA");
                  return (
                    <tr key={v.id} className="align-top">
                      <td className="whitespace-nowrap">
                        <Link prefetch={false} href={`/vales/${v.id}`} className="num font-semibold text-lima hover:underline">{codigo}</Link>
                        <Link prefetch={false} href={`/imprimir/vale/${v.id}`} className="ml-2 inline-flex text-t3 hover:text-t1" title="Imprimir vale devolutivo"><Printer className="h-3.5 w-3.5" /></Link>
                      </td>
                      <td className="num whitespace-nowrap">{formatarDataHora(v.criadoEm)}</td>
                      <td><span className={v.ocorrencia === "FALTA" ? "pill text-erro bg-erro/10" : "pill text-t2 bg-t2/10"}>{v.ocorrencia === "FALTA" ? "Falta" : "Sobra"}</span></td>
                      <td className="num">{v.cd.codigo}</td>
                      <td className="num">{v.unidade?.codigo ?? "—"}</td>
                      <td className="num text-[11px]">
                        {v.conferenciaOrigem ? (
                          <>
                            <span className="font-semibold text-t1">{numeroConferencia(v.conferenciaOrigem.numero)}</span>
                            <span className="block text-t4">{v.conferenciaOrigem.vales.map((x) => numeroVale(x.numero, "ENVIO")).join(", ")}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td className="num text-right font-semibold">{n(v.quantidade)}</td>
                      <td>
                        <StatusBadge status={v.status} rotulo={v.ocorrencia === "FALTA" && v.status === "PENDENTE" ? "Em aberto" : rotuloStatusVale[v.status]} />
                      </td>
                      <td className="max-w-[280px] text-[11px] text-t3">
                        {v.resolucao ? (
                          <>
                            <span className="font-semibold text-t1">{rotuloResolucao[v.resolucao]}</span>
                            <span className="block">{formatarDataHora(v.resolvidoEm)} · {v.resolvidoPor?.nome}</span>
                            {v.observacaoResolucao && <span className="block">{v.observacaoResolucao}</span>}
                          </>
                        ) : (
                          <>
                            <span className="block">Conferido por {v.criadoPor.nome}</span>
                            {v.observacao && <span className="line-clamp-2" title={v.observacao}>{v.observacao}</span>}
                          </>
                        )}
                      </td>
                      {admin && (
                        <td>{v.ocorrencia === "FALTA" && v.status === "PENDENTE" ? <FormResolverOcorrencia valeId={v.id} codigo={codigo} /> : <span className="text-t4">—</span>}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Tabela>
        )}
      </Painel>
    </>
  );
}
