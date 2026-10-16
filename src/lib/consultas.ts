import "server-only";
import { Prisma, type TipoMovimentacao } from "@prisma/client";
import { saldosDevedores, STATUS_ABERTOS, TIPOS_VALE_DEVEDOR } from "./conta";
import { prisma } from "./prisma";
import { idadeEmDias } from "./datas";
import { compararFarol, farolPorFornecedor, farolPorIdade } from "./farol";

type Intervalo = { inicio?: Date; fim?: Date };
const periodoWhere = (p: Intervalo): Prisma.MovimentacaoWhereInput =>
  p.inicio || p.fim ? { criadoEm: { ...(p.inicio ? { gte: p.inicio } : {}), ...(p.fim ? { lt: p.fim } : {}) } } : {};

/** Soma das quantidades por tipo de movimentação no período (sem período = todo o histórico). */
export async function totaisPorTipo(cdId: string, periodo: Intervalo = {}) {
  const grupos = await prisma.movimentacao.groupBy({
    by: ["tipo"],
    where: { cdId, ...periodoWhere(periodo) },
    _sum: { quantidade: true },
  });
  const totais = {} as Record<TipoMovimentacao, number>;
  for (const g of grupos) totais[g.tipo] = g._sum.quantidade ?? 0;
  return (t: TipoMovimentacao) => totais[t] ?? 0;
}

const ESTOQUES_SQL = ["VAZIOS", "QUEBRADOS"] as const;

/**
 * Fluxo dos estoques físicos do CD (Vazios + Quebrados) no período. Entradas: de conta
 * externa (retorno de CD/Cross, compra, inclusão) para um estoque. Saídas: de um estoque
 * para conta externa (pagamento a fornecedor, descarte, correção). Transferências
 * internas (quebra, conserto) não mudam o total e são somadas à parte.
 */
export async function fluxo(cdId: string, periodo: Intervalo = {}, fornecedorId?: string) {
  const w: Prisma.MovimentacaoWhereInput = { cdId, ...periodoWhere(periodo), ...(fornecedorId ? { fornecedorId } : {}) };
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
export async function serieFluxo(cdId: string, periodo: Intervalo, granularidade: Granularidade, fornecedorId?: string): Promise<PontoFluxo[]> {
  const unidade = granularidade === "dia" ? "day" : granularidade === "semana" ? "week" : "month";
  const condicoes: Prisma.Sql[] = [Prisma.sql`"cdId" = ${cdId}`];
  if (periodo.inicio) condicoes.push(Prisma.sql`"criadoEm" >= ${periodo.inicio}`);
  if (periodo.fim) condicoes.push(Prisma.sql`"criadoEm" < ${periodo.fim}`);
  if (fornecedorId) condicoes.push(Prisma.sql`"fornecedorId" = ${fornecedorId}`);
  const linhas = await prisma.$queryRaw<{ inicio: Date; entradas: bigint; saidas: bigint }[]>`
    SELECT date_trunc(${unidade}, ("criadoEm" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo') AS inicio,
           COALESCE(SUM("quantidade") FILTER (WHERE "destino" IN ('VAZIOS','QUEBRADOS') AND "origem" NOT IN ('VAZIOS','QUEBRADOS')), 0) AS entradas,
           COALESCE(SUM("quantidade") FILTER (WHERE "origem" IN ('VAZIOS','QUEBRADOS') AND "destino" NOT IN ('VAZIOS','QUEBRADOS')), 0) AS saidas
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

/** Vales de fornecedor em aberto (pendentes ou agendados) do CD, com idade e farol. */
export async function valesEmAberto(cdId: string, filtro: Prisma.ValePalletWhereInput = {}) {
  const vales = await prisma.valePallet.findMany({
    where: { cdId, tipo: "FORNECEDOR", status: { in: [...STATUS_ABERTOS] }, ...filtro },
    include: { fornecedor: true, criadoPor: { select: { nome: true, login: true } }, agenda: true },
    orderBy: { criadoEm: "asc" },
  });
  return vales.map((v) => {
    const idade = idadeEmDias(v.criadoEm);
    return { ...v, idade, farol: farolPorIdade(idade) };
  });
}

/** Pendências do CD agrupadas por fornecedor, ordenadas pelo farol mais crítico. */
export async function pendenciasPorFornecedor(cdId: string) {
  const grupos = await prisma.valePallet.groupBy({
    by: ["fornecedorId"],
    where: { cdId, tipo: "FORNECEDOR", status: { in: [...STATUS_ABERTOS] } },
    _sum: { quantidade: true },
    _count: true,
    _min: { criadoEm: true },
  });
  const fornecedores = await prisma.fornecedor.findMany({ where: { id: { in: grupos.map((g) => g.fornecedorId!).filter(Boolean) } } });
  const porId = new Map(fornecedores.map((f) => [f.id, f]));
  return grupos
    .map((g) => {
      const total = g._sum.quantidade ?? 0;
      return {
        fornecedor: porId.get(g.fornecedorId!)!,
        total,
        vales: g._count,
        maisAntigo: g._min.criadoEm,
        farol: farolPorFornecedor(total),
      };
    })
    .sort((a, b) => compararFarol(a.farol, b.farol) || b.total - a.total);
}

export type LinhaDevedor = {
  unidade: { id: string; codigo: string; nome: string; tipo: "CD" | "CROSS"; cidade: string | null };
  saldo: number;
  vales: number;
  maisAntigo: Date | null;
  idade: number | null;
};

/**
 * Saldo devedor (custódia) de cada CD destino / Ponto de Cross no CD informado, com
 * a quantidade de vales pendentes e o mais antigo. Ordenado do maior saldo para o menor.
 */
export async function devedoresPorUnidade(cdId: string): Promise<LinhaDevedor[]> {
  const [saldos, grupos] = await Promise.all([
    saldosDevedores(prisma, cdId),
    prisma.valePallet.groupBy({
      by: ["unidadeId"],
      where: { cdId, tipo: { in: [...TIPOS_VALE_DEVEDOR] }, status: "PENDENTE" },
      _count: true,
      _min: { criadoEm: true },
    }),
  ]);
  const ids = new Set<string>([...saldos.keys(), ...grupos.map((g) => g.unidadeId!).filter(Boolean)]);
  const unidades = await prisma.centroDistribuicao.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, codigo: true, nome: true, tipo: true, cidade: true },
  });
  const porId = new Map(grupos.map((g) => [g.unidadeId, g]));
  return unidades
    .map((u) => {
      const g = porId.get(u.id);
      const maisAntigo = g?._min.criadoEm ?? null;
      return { unidade: u, saldo: saldos.get(u.id) ?? 0, vales: g?._count ?? 0, maisAntigo, idade: maisAntigo ? idadeEmDias(maisAntigo) : null };
    })
    .filter((l) => l.saldo !== 0 || l.vales > 0)
    .sort((a, b) => b.saldo - a.saldo);
}

/** Vales pendentes (envio, ocorrência e ajuste) de cada CD destino / Ponto de Cross do CD. */
export async function valesDevedoresPendentes(cdId: string) {
  return prisma.valePallet.findMany({
    where: { cdId, tipo: { in: [...TIPOS_VALE_DEVEDOR] }, status: "PENDENTE" },
    include: { unidade: { select: { id: true, codigo: true, nome: true, tipo: true } } },
    orderBy: { criadoEm: "asc" },
  });
}

export type LinhaTransporte = {
  transportadora: string;
  operacoes: number;
  recebidosFornecedor: number;
  enviados: number;
  retornados: number;
  faltas: number;
};

const chaveTransp = (t: string | null) => (t ?? "").trim().replace(/\s+/g, " ");

/**
 * Consolidação das movimentações do CD por transportadora no período:
 * recebimentos de fornecedor e envios (vales emitidos) e retornos conferidos (com faltas).
 */
export async function consolidacaoTransporte(cdId: string, periodo: Intervalo = {}): Promise<LinhaTransporte[]> {
  const criadoEm = periodo.inicio || periodo.fim ? { ...(periodo.inicio ? { gte: periodo.inicio } : {}), ...(periodo.fim ? { lt: periodo.fim } : {}) } : undefined;
  const [vales, retornos] = await Promise.all([
    prisma.valePallet.groupBy({
      by: ["transportadora", "tipo"],
      where: { cdId, tipo: { in: ["FORNECEDOR", "ENVIO"] }, status: { not: "CANCELADO" }, ...(criadoEm ? { criadoEm } : {}) },
      _sum: { quantidade: true },
      _count: true,
    }),
    prisma.retornoConferencia.groupBy({
      by: ["transportadora"],
      where: { cdId, ...(criadoEm ? { criadoEm } : {}) },
      _sum: { quantidadeFisica: true, falta: true },
      _count: true,
    }),
  ]);
  const mapa = new Map<string, LinhaTransporte>();
  const linha = (t: string | null) => {
    const transportadora = chaveTransp(t) || "Não informada";
    const k = transportadora.toUpperCase();
    let l = mapa.get(k);
    if (!l) {
      l = { transportadora, operacoes: 0, recebidosFornecedor: 0, enviados: 0, retornados: 0, faltas: 0 };
      mapa.set(k, l);
    }
    return l;
  };
  for (const g of vales) {
    const l = linha(g.transportadora);
    l.operacoes += g._count;
    if (g.tipo === "FORNECEDOR") l.recebidosFornecedor += g._sum.quantidade ?? 0;
    else l.enviados += g._sum.quantidade ?? 0;
  }
  for (const g of retornos) {
    const l = linha(g.transportadora);
    l.operacoes += g._count;
    l.retornados += g._sum.quantidadeFisica ?? 0;
    l.faltas += g._sum.falta ?? 0;
  }
  return [...mapa.values()].sort((a, b) => b.recebidosFornecedor + b.enviados + b.retornados - (a.recebidosFornecedor + a.enviados + a.retornados));
}
