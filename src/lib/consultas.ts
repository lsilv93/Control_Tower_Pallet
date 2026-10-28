import "server-only";
import { Prisma, type TipoMovimentacao } from "@prisma/client";
import { estoquesPorUnidade, STATUS_ABERTOS } from "./conta";
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
 * Fluxo dos estoques físicos da unidade (bons + quebrados) no período. Entradas: de conta
 * externa (recebimento, sobra, compra, inclusão) para um estoque. Saídas: de um estoque
 * para conta externa (envio, descarte, remoção). Transferências internas (quebra,
 * conserto) não mudam o total e são somadas à parte.
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

export type LinhaUnidade = {
  unidade: { id: string; codigo: string; nome: string; tipo: "CD" | "CROSS"; hub: boolean };
  vazios: number;
  quebrados: number;
  /** Enviados pela unidade, aguardando conferência no destino. */
  transito: number;
  /** Faltas em aberto (ocorrências) da unidade remetente. */
  ocorrencias: number;
  /** Vales de envio destinados à unidade, ainda não conferidos. */
  aReceber: number;
  valesAReceber: number;
};

/**
 * Posição (bons, quebrados, trânsito, ocorrências e a receber) de cada unidade ativa —
 * ou só das informadas. Base do painel, da TV Nível Brasil e das exportações.
 */
export async function posicaoUnidades(ids?: string[]): Promise<LinhaUnidade[]> {
  const [unidades, estoques, aReceber] = await Promise.all([
    prisma.centroDistribuicao.findMany({
      where: { ativo: true, ...(ids ? { id: { in: ids } } : {}) },
      select: { id: true, codigo: true, nome: true, tipo: true, hub: true },
      orderBy: [{ hub: "desc" }, { tipo: "asc" }, { codigo: "asc" }],
    }),
    estoquesPorUnidade(prisma, ids),
    prisma.valePallet.groupBy({
      by: ["unidadeId"],
      where: { tipo: "ENVIO", status: "PENDENTE", ...(ids ? { unidadeId: { in: ids } } : {}) },
      _sum: { quantidade: true },
      _count: true,
    }),
  ]);
  const receber = new Map(aReceber.map((g) => [g.unidadeId, g]));
  return unidades.map((u) => {
    const e = estoques.get(u.id);
    const r = receber.get(u.id);
    return {
      unidade: u,
      vazios: e?.vazios ?? 0,
      quebrados: e?.quebrados ?? 0,
      transito: e?.transito ?? 0,
      ocorrencias: e?.ocorrencias ?? 0,
      aReceber: r?._sum.quantidade ?? 0,
      valesAReceber: r?._count ?? 0,
    };
  });
}

/** Vales de envio em trânsito (pendentes de conferência) com origem e destino. */
export async function enviosEmTransito(filtro: Prisma.ValePalletWhereInput = {}) {
  return prisma.valePallet.findMany({
    where: { tipo: "ENVIO", status: "PENDENTE", ...filtro },
    include: { cd: { select: { codigo: true, tipo: true, hub: true } }, unidade: { select: { codigo: true, tipo: true, hub: true } } },
    orderBy: { criadoEm: "asc" },
  });
}

export type LinhaTransporte = {
  transportadora: string;
  operacoes: number;
  recebidosFornecedor: number;
  enviados: number;
  conferidos: number;
  faltas: number;
};

const chaveTransp = (t: string | null) => (t ?? "").trim().replace(/\s+/g, " ");

/**
 * Consolidação das movimentações do CD por transportadora no período:
 * recebimentos de fornecedor, envios (vales emitidos) e recebimentos conferidos (com faltas).
 */
export async function consolidacaoTransporte(cdId: string, periodo: Intervalo = {}): Promise<LinhaTransporte[]> {
  const criadoEm = periodo.inicio || periodo.fim ? { ...(periodo.inicio ? { gte: periodo.inicio } : {}), ...(periodo.fim ? { lt: periodo.fim } : {}) } : undefined;
  const [vales, conferencias] = await Promise.all([
    prisma.valePallet.groupBy({
      by: ["transportadora", "tipo"],
      where: { cdId, tipo: { in: ["FORNECEDOR", "ENVIO"] }, status: { not: "CANCELADO" }, ...(criadoEm ? { criadoEm } : {}) },
      _sum: { quantidade: true },
      _count: true,
    }),
    prisma.conferencia.findMany({
      where: { cdId, ...(criadoEm ? { criadoEm } : {}) },
      select: { transportadora: true, recebidoBons: true, recebidoQuebrados: true, diferenca: true },
    }),
  ]);
  const mapa = new Map<string, LinhaTransporte>();
  const linha = (t: string | null) => {
    const transportadora = chaveTransp(t) || "Não informada";
    const k = transportadora.toUpperCase();
    let l = mapa.get(k);
    if (!l) {
      l = { transportadora, operacoes: 0, recebidosFornecedor: 0, enviados: 0, conferidos: 0, faltas: 0 };
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
  for (const c of conferencias) {
    const l = linha(c.transportadora);
    l.operacoes += 1;
    l.conferidos += c.recebidoBons + c.recebidoQuebrados;
    l.faltas += Math.max(0, -c.diferenca);
  }
  return [...mapa.values()].sort((a, b) => b.recebidosFornecedor + b.enviados + b.conferidos - (a.recebidosFornecedor + a.enviados + a.conferidos));
}
