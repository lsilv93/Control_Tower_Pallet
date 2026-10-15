import "server-only";
import type { TipoMovimentacao } from "@prisma/client";
import { obterSaldos } from "./conta";
import { devedoresPorUnidade, pendenciasPorFornecedor } from "./consultas";
import { diaLocal, fimDoDia, inicioDoDia, inicioDoMes } from "./datas";
import { prisma } from "./prisma";

/** Somatório por tipo em Dia / Mês / Geral para o CD. */
async function porPeriodo(cdId: string, tipos: TipoMovimentacao[]) {
  const hoje = diaLocal();
  const [dia, mes, geral] = await Promise.all(
    [{ gte: inicioDoDia(hoje), lt: fimDoDia(hoje) }, { gte: inicioDoMes() }, undefined].map((criadoEm) =>
      prisma.movimentacao.aggregate({ where: { cdId, tipo: { in: tipos }, ...(criadoEm ? { criadoEm } : {}) }, _sum: { quantidade: true } }),
    ),
  );
  return { dia: dia._sum.quantidade ?? 0, mes: mes._sum.quantidade ?? 0, geral: geral._sum.quantidade ?? 0 };
}

/** Indicadores da Tela TV (Control Center) do CD. */
export async function dadosTV(cdId: string) {
  const hoje = diaLocal();
  const diaAtual = { gte: inicioDoDia(hoje), lt: fimDoDia(hoje) };
  const [saldos, recuperados, descartados, entradas, enviados, devedores, pendencias, retornosHoje, faltasHoje, agendas] = await Promise.all([
    obterSaldos(cdId),
    porPeriodo(cdId, ["RECUPERADO"]),
    porPeriodo(cdId, ["DESCARTE", "CANIBALIZACAO"]),
    porPeriodo(cdId, ["RECEBIMENTO_FORNECEDOR"]),
    porPeriodo(cdId, ["ENVIO_UNIDADE"]),
    devedoresPorUnidade(cdId),
    pendenciasPorFornecedor(cdId),
    prisma.movimentacao.groupBy({ by: ["unidadeId"], where: { cdId, tipo: "RETORNO_UNIDADE", criadoEm: diaAtual }, _sum: { quantidade: true }, _count: true }),
    prisma.retornoConferencia.groupBy({ by: ["unidadeId"], where: { cdId, criadoEm: diaAtual }, _sum: { falta: true } }),
    prisma.agendaDevolucao.findMany({
      where: { cdId, dataPrevista: diaAtual, status: { not: "CANCELADA" } },
      include: { fornecedor: { select: { nome: true } }, vales: { select: { quantidade: true } } },
      orderBy: { dataPrevista: "asc" },
    }),
  ]);
  const ids = retornosHoje.map((r) => r.unidadeId!).filter(Boolean);
  const unidades = await prisma.centroDistribuicao.findMany({ where: { id: { in: ids } }, select: { id: true, codigo: true, nome: true, tipo: true } });
  const nomes = new Map(unidades.map((u) => [u.id, u]));
  const faltas = new Map(faltasHoje.map((f) => [f.unidadeId as string | null, f._sum.falta ?? 0]));
  return {
    saldos,
    recuperados,
    descartados,
    entradas,
    enviados,
    devedores,
    pendencias,
    recebidosHoje: retornosHoje
      .map((r) => ({ unidade: nomes.get(r.unidadeId!)!, quantidade: r._sum.quantidade ?? 0, conferencias: r._count, falta: faltas.get(r.unidadeId) ?? 0 }))
      .filter((r) => r.unidade)
      .sort((a, b) => b.quantidade - a.quantidade),
    agendas: agendas.map((a) => ({
      id: a.id,
      numero: a.numero,
      dataPrevista: a.dataPrevista,
      fornecedor: a.fornecedor.nome,
      quantidade: a.vales.reduce((s, v) => s + v.quantidade, 0),
      status: a.status,
    })),
  };
}

/** "Versão" dos dados do CD: muda a cada novo evento auditado (movimentação, vale, conferência...). */
export async function versaoTV(cdId: string): Promise<string> {
  const ultimo = await prisma.auditoria.findFirst({ where: { cdId }, orderBy: { criadoEm: "desc" }, select: { id: true, criadoEm: true } });
  return ultimo ? `${ultimo.criadoEm.getTime()}-${ultimo.id}` : "0";
}
