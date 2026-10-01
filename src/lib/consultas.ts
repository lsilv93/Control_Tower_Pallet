import "server-only";
import { Prisma, type TipoMovimentacao } from "@prisma/client";
import { STATUS_ABERTOS } from "./conta";
import { prisma } from "./prisma";
import { idadeEmDias } from "./datas";
import { compararFarol, farolPorFornecedor, farolPorIdade } from "./farol";

type Intervalo = { inicio?: Date; fim?: Date };
const periodoWhere = (p: Intervalo): Prisma.MovimentacaoWhereInput =>
  p.inicio || p.fim ? { criadoEm: { ...(p.inicio ? { gte: p.inicio } : {}), ...(p.fim ? { lt: p.fim } : {}) } } : {};

/** Soma das quantidades por tipo de movimentação no período (sem período = todo o histórico). */
export async function totaisPorTipo(periodo: Intervalo = {}) {
  const grupos = await prisma.movimentacao.groupBy({
    by: ["tipo"],
    where: periodoWhere(periodo),
    _sum: { quantidade: true },
  });
  const totais = {} as Record<TipoMovimentacao, number>;
  for (const g of grupos) totais[g.tipo] = g._sum.quantidade ?? 0;
  return (t: TipoMovimentacao) => totais[t] ?? 0;
}

const ESTOQUES_SQL = ["VAZIOS", "CD", "QUEBRADOS"] as const;

/**
 * Fluxo da conta corrente no período. Entradas: de conta externa (fornecedor,
 * compra, ajuste) para um estoque. Saídas: de um estoque para conta externa
 * (fornecedor, descarte, ajuste). Transferências internas (Vazios↔CD, quebra,
 * conserto) não mudam o total e são somadas à parte.
 */
export async function fluxo(periodo: Intervalo = {}, fornecedorId?: string) {
  const w: Prisma.MovimentacaoWhereInput = { ...periodoWhere(periodo), ...(fornecedorId ? { fornecedorId } : {}) };
  const estoque = { in: [...ESTOQUES_SQL] };
  const externo = { notIn: [...ESTOQUES_SQL] };
  const [entradas, saidas, internas] = await Promise.all([
    prisma.movimentacao.aggregate({ where: { ...w, destino: estoque, origem: externo }, _sum: { quantidade: true } }),
    prisma.movimentacao.aggregate({ where: { ...w, origem: estoque, destino: externo }, _sum: { quantidade: true } }),
    prisma.movimentacao.aggregate({ where: { ...w, origem: estoque, destino: estoque }, _sum: { quantidade: true } }),
  ]);
  return {
    entradas: entradas._sum.quantidade ?? 0,
    saidas: saidas._sum.quantidade ?? 0,
    transferencias: internas._sum.quantidade ?? 0,
  };
}

export type Granularidade = "dia" | "semana" | "mes";

/** Escolhe o agrupamento do gráfico de fluxo pelo tamanho do período. */
export function granularidadePara(inicio?: Date, fim?: Date): Granularidade {
  if (!inicio || !fim) return "mes";
  const dias = (fim.getTime() - inicio.getTime()) / 86400000;
  return dias <= 45 ? "dia" : dias <= 200 ? "semana" : "mes";
}

export type PontoFluxo = { inicio: string; entradas: number; saidas: number };

/** Série de entradas x saídas por dia/semana/mês (fuso de São Paulo) para o extrato. */
export async function serieFluxo(periodo: Intervalo, granularidade: Granularidade, fornecedorId?: string): Promise<PontoFluxo[]> {
  const unidade = granularidade === "dia" ? "day" : granularidade === "semana" ? "week" : "month";
  const condicoes: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (periodo.inicio) condicoes.push(Prisma.sql`"criadoEm" >= ${periodo.inicio}`);
  if (periodo.fim) condicoes.push(Prisma.sql`"criadoEm" < ${periodo.fim}`);
  if (fornecedorId) condicoes.push(Prisma.sql`"fornecedorId" = ${fornecedorId}`);
  const linhas = await prisma.$queryRaw<{ inicio: Date; entradas: bigint; saidas: bigint }[]>`
    SELECT date_trunc(${unidade}, ("criadoEm" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo') AS inicio,
           COALESCE(SUM("quantidade") FILTER (WHERE "destino" IN ('VAZIOS','CD','QUEBRADOS') AND "origem" NOT IN ('VAZIOS','CD','QUEBRADOS')), 0) AS entradas,
           COALESCE(SUM("quantidade") FILTER (WHERE "origem" IN ('VAZIOS','CD','QUEBRADOS') AND "destino" NOT IN ('VAZIOS','CD','QUEBRADOS')), 0) AS saidas
      FROM "Movimentacao"
     WHERE ${Prisma.join(condicoes, " AND ")}
     GROUP BY 1 ORDER BY 1`;
  return linhas.map((l) => ({
    // date_trunc devolve a data local sem fuso; o driver a entrega como UTC — basta formatar a parte da data.
    inicio: l.inicio.toISOString().slice(0, 10),
    entradas: Number(l.entradas),
    saidas: Number(l.saidas),
  }));
}

/** Vales em aberto (pendentes ou agendados) com idade e farol. */
export async function valesEmAberto(filtro: Prisma.ValePalletWhereInput = {}) {
  const vales = await prisma.valePallet.findMany({
    where: { status: { in: [...STATUS_ABERTOS] }, ...filtro },
    include: { fornecedor: true, criadoPor: { select: { nome: true, login: true } }, agenda: true },
    orderBy: { criadoEm: "asc" },
  });
  return vales.map((v) => {
    const idade = idadeEmDias(v.criadoEm);
    return { ...v, idade, farol: farolPorIdade(idade) };
  });
}

/** Pendências agrupadas por fornecedor, ordenadas pelo farol mais crítico. */
export async function pendenciasPorFornecedor() {
  const grupos = await prisma.valePallet.groupBy({
    by: ["fornecedorId"],
    where: { status: { in: [...STATUS_ABERTOS] } },
    _sum: { quantidade: true },
    _count: true,
    _min: { criadoEm: true },
  });
  const fornecedores = await prisma.fornecedor.findMany({ where: { id: { in: grupos.map((g) => g.fornecedorId) } } });
  const porId = new Map(fornecedores.map((f) => [f.id, f]));
  return grupos
    .map((g) => {
      const total = g._sum.quantidade ?? 0;
      return {
        fornecedor: porId.get(g.fornecedorId)!,
        total,
        vales: g._count,
        maisAntigo: g._min.criadoEm,
        farol: farolPorFornecedor(total),
      };
    })
    .sort((a, b) => compararFarol(a.farol, b.farol) || b.total - a.total);
}
