import "server-only";
import { Prisma, type Conta, type TipoMovimentacao } from "@prisma/client";
import { prisma } from "./prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Conta corrente em partida dobrada, isolada por CD (Movimentacao.cdId). Toda
 * movimentação debita uma conta (origem) e credita outra (destino) na mesma quantidade.
 *
 * - Estoques físicos do CD (nunca negativos): VAZIOS e QUEBRADOS.
 * - CUSTODIA: saldo devedor de cada CD destino / Ponto de Cross (Movimentacao.unidadeId),
 *   nunca negativo.
 * - FORNECEDOR: saldo negativo = pallets devidos aos fornecedores (vales em aberto).
 * - CARGA, COMPRA, DESCARTE e AJUSTE: contrapartidas externas, sem restrição de saldo.
 * - CD: conta legada (antes do multi-CD); não recebe novos lançamentos.
 */
export const ESTOQUES = ["VAZIOS", "QUEBRADOS"] as const;
export type Estoque = (typeof ESTOQUES)[number];
export const ehEstoque = (c: Conta): c is Estoque => (ESTOQUES as readonly string[]).includes(c);

/** Regras de movimentação: origem e destino permitidos para cada tipo (lançamentos novos). */
export const REGRAS: Partial<Record<TipoMovimentacao, { origem: readonly Conta[]; destino: readonly Conta[] }>> = {
  RECEBIMENTO_FORNECEDOR: { origem: ["FORNECEDOR"], destino: ["CARGA"] }, // sobe o saldo devido ao fornecedor
  DEVOLUCAO_FORNECEDOR: { origem: ["VAZIOS"], destino: ["FORNECEDOR"] }, // pagamento sai dos vazios
  ESTORNO_VALE: { origem: ["CARGA"], destino: ["FORNECEDOR"] }, // exclusão de vale de fornecedor
  ENVIO_UNIDADE: { origem: ["CARGA"], destino: ["CUSTODIA"] }, // envio não mexe nos vazios
  RETORNO_UNIDADE: { origem: ["CUSTODIA"], destino: ["VAZIOS"] }, // retorno soma nos vazios
  ESTORNO_ENVIO: { origem: ["CUSTODIA"], destino: ["CARGA", "AJUSTE"] }, // exclusão de vale de envio/ajuste/ocorrência
  INCLUSAO_DEVEDOR: { origem: ["AJUSTE"], destino: ["CUSTODIA"] }, // admin
  INCLUSAO_VAZIOS: { origem: ["AJUSTE"], destino: ["VAZIOS"] }, // admin, com motivo
  QUEBRA: { origem: ["VAZIOS"], destino: ["QUEBRADOS"] },
  RECUPERADO: { origem: ["QUEBRADOS"], destino: ["VAZIOS"] }, // conserto/reparo
  CANIBALIZACAO: { origem: ["QUEBRADOS"], destino: ["DESCARTE"] }, // pallets usados no reparo
  DESCARTE: { origem: ["VAZIOS", "QUEBRADOS"], destino: ["DESCARTE"] }, // usuário escolhe o pulmão
  COMPRA: { origem: ["COMPRA"], destino: ["VAZIOS"] },
  AJUSTE_ENTRADA: { origem: ["AJUSTE"], destino: ["VAZIOS", "QUEBRADOS"] }, // somente MASTER
  AJUSTE_SAIDA: { origem: ["VAZIOS", "QUEBRADOS"], destino: ["AJUSTE"] }, // somente MASTER
};

/** Tipos que envolvem um CD destino / Ponto de Cross (exigem unidadeId). */
const COM_UNIDADE: TipoMovimentacao[] = ["ENVIO_UNIDADE", "RETORNO_UNIDADE", "ESTORNO_ENVIO", "INCLUSAO_DEVEDOR"];

/** Vales de fornecedor em aberto (ainda devidos). Cancelados e baixados ficam de fora. */
export const STATUS_ABERTOS = ["PENDENTE", "AGENDADO"] as const;
/** Vales que formam o saldo devedor de um CD destino / Ponto de Cross. */
export const TIPOS_VALE_DEVEDOR = ["ENVIO", "OCORRENCIA", "AJUSTE"] as const;

export class ErroNegocio extends Error {}

export type Saldos = Record<Conta, number>;

const zerado = (): Saldos => ({ VAZIOS: 0, CD: 0, QUEBRADOS: 0, FORNECEDOR: 0, COMPRA: 0, DESCARTE: 0, AJUSTE: 0, CARGA: 0, CUSTODIA: 0 });

/** Saldo de cada conta de um CD = entradas (destino) − saídas (origem). Opcionalmente até uma data. */
export async function saldosPorConta(db: Db, cdId: string, ate?: Date): Promise<Saldos> {
  const where: Prisma.MovimentacaoWhereInput = { cdId, ...(ate ? { criadoEm: { lt: ate } } : {}) };
  const [entradas, saidas] = await Promise.all([
    db.movimentacao.groupBy({ by: ["destino"], where, _sum: { quantidade: true } }),
    db.movimentacao.groupBy({ by: ["origem"], where, _sum: { quantidade: true } }),
  ]);
  const s = zerado();
  for (const e of entradas) s[e.destino] += e._sum.quantidade ?? 0;
  for (const o of saidas) s[o.origem] -= o._sum.quantidade ?? 0;
  return s;
}

/** Saldo devedor (custódia) de cada CD destino / Ponto de Cross, no CD informado. */
export async function saldosDevedores(db: Db, cdId: string): Promise<Map<string, number>> {
  const [entradas, saidas] = await Promise.all([
    db.movimentacao.groupBy({ by: ["unidadeId"], where: { cdId, destino: "CUSTODIA" }, _sum: { quantidade: true } }),
    db.movimentacao.groupBy({ by: ["unidadeId"], where: { cdId, origem: "CUSTODIA" }, _sum: { quantidade: true } }),
  ]);
  const m = new Map<string, number>();
  for (const e of entradas) if (e.unidadeId) m.set(e.unidadeId, (m.get(e.unidadeId) ?? 0) + (e._sum.quantidade ?? 0));
  for (const s of saidas) if (s.unidadeId) m.set(s.unidadeId, (m.get(s.unidadeId) ?? 0) - (s._sum.quantidade ?? 0));
  return m;
}

export async function saldoDevedorDaUnidade(db: Db, cdId: string, unidadeId: string): Promise<number> {
  const [e, s] = await Promise.all([
    db.movimentacao.aggregate({ where: { cdId, unidadeId, destino: "CUSTODIA" }, _sum: { quantidade: true } }),
    db.movimentacao.aggregate({ where: { cdId, unidadeId, origem: "CUSTODIA" }, _sum: { quantidade: true } }),
  ]);
  return (e._sum.quantidade ?? 0) - (s._sum.quantidade ?? 0);
}

/** Posição do CD: estoques físicos, saldo com fornecedores e saldo devedor total. */
export async function obterSaldos(cdId: string, db: Db = prisma) {
  const [contas, pendentes] = await Promise.all([
    saldosPorConta(db, cdId),
    db.valePallet.aggregate({
      where: { cdId, tipo: "FORNECEDOR", status: { in: [...STATUS_ABERTOS] } },
      _sum: { quantidade: true },
      _count: true,
    }),
  ]);
  return {
    vazios: contas.VAZIOS,
    quebrados: contas.QUEBRADOS,
    /** Saldo do CD com fornecedores (entradas pendentes de devolução/pagamento). */
    fornecedores: pendentes._sum.quantidade ?? 0,
    valesFornecedorEmAberto: pendentes._count,
    /** Soma dos saldos devedores de CDs destino e Pontos de Cross. */
    devedor: contas.CUSTODIA,
    descartados: contas.DESCARTE,
    contas,
  };
}

/**
 * Serializa as movimentações dentro da transação corrente (lock consultivo do
 * PostgreSQL): duas saídas simultâneas não conseguem deixar um saldo negativo.
 */
export async function bloquearConta(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(815001)`;
}

export type NovoLancamento = {
  tipo: TipoMovimentacao;
  quantidade: number;
  usuarioId: string;
  /** CD da operação (CD ativo na sessão). */
  cdId: string;
  /** Obrigatórios só quando a regra admite mais de uma conta (descarte, ajuste, estorno). */
  origem?: Conta;
  destino?: Conta;
  observacao?: string | null;
  motivo?: string | null;
  unidadeId?: string | null;
  fornecedorId?: string | null;
  valeId?: string | null;
  agendaId?: string | null;
  compraId?: string | null;
  retornoId?: string | null;
};

export const ROTULO_CONTA: Record<Conta, string> = {
  VAZIOS: "Estoque de Vazios",
  CD: "Estoque do CD (legado)",
  QUEBRADOS: "Estoque de Quebrados",
  FORNECEDOR: "Fornecedor",
  COMPRA: "Compra",
  DESCARTE: "Descarte",
  AJUSTE: "Ajuste manual",
  CARGA: "Carga / operação",
  CUSTODIA: "Saldo devedor (CD/Cross)",
};

function resolverConta(permitidas: readonly Conta[], informada: Conta | undefined, papel: string): Conta {
  if (informada) {
    if (!permitidas.includes(informada)) throw new ErroNegocio(`Conta de ${papel} inválida para esta movimentação.`);
    return informada;
  }
  if (permitidas.length !== 1) throw new ErroNegocio(`Informe a conta de ${papel}.`);
  return permitidas[0];
}

/**
 * Lança uma movimentação (partida dobrada) no CD informado. Deve ser chamado dentro
 * de uma transação que já executou `bloquearConta`. Valida a regra do tipo, o saldo
 * da conta de origem (estoques e custódia) e grava a auditoria na mesma transação.
 */
export async function lancar(tx: Prisma.TransactionClient, l: NovoLancamento) {
  if (!Number.isInteger(l.quantidade) || l.quantidade <= 0) {
    throw new ErroNegocio("A quantidade deve ser um número inteiro maior que zero.");
  }
  const regra = REGRAS[l.tipo];
  if (!regra) throw new ErroNegocio("Tipo de movimentação não permitido.");
  if (!l.cdId) throw new ErroNegocio("Selecione o CD de operação.");
  const origem = resolverConta(regra.origem, l.origem, "origem");
  const destino = resolverConta(regra.destino, l.destino, "destino");
  if (origem === destino) throw new ErroNegocio("Origem e destino não podem ser iguais.");
  if (COM_UNIDADE.includes(l.tipo) && !l.unidadeId) throw new ErroNegocio("Informe o CD destino ou Ponto de Cross.");
  if (l.unidadeId && l.unidadeId === l.cdId) throw new ErroNegocio("O CD destino não pode ser o próprio CD de operação.");

  if (ehEstoque(origem)) {
    const saldos = await saldosPorConta(tx, l.cdId);
    if (saldos[origem] < l.quantidade) {
      throw new ErroNegocio(
        `Saldo insuficiente no ${ROTULO_CONTA[origem]}: disponível ${saldos[origem]}, solicitado ${l.quantidade}.`,
      );
    }
  }
  if (origem === "CUSTODIA") {
    const devedor = await saldoDevedorDaUnidade(tx, l.cdId, l.unidadeId!);
    if (devedor < l.quantidade) {
      throw new ErroNegocio(`Saldo devedor insuficiente: a unidade deve ${devedor} pallet(s), solicitado ${l.quantidade}.`);
    }
  }

  const mov = await tx.movimentacao.create({
    data: {
      tipo: l.tipo,
      quantidade: l.quantidade,
      origem,
      destino,
      observacao: l.observacao || null,
      motivo: l.motivo || null,
      usuarioId: l.usuarioId,
      cdId: l.cdId,
      unidadeId: l.unidadeId ?? null,
      fornecedorId: l.fornecedorId ?? null,
      valeId: l.valeId ?? null,
      agendaId: l.agendaId ?? null,
      compraId: l.compraId ?? null,
      retornoId: l.retornoId ?? null,
    },
  });
  await auditar(tx, {
    acao: `MOVIMENTACAO_${l.tipo}`,
    entidade: "Movimentacao",
    entidadeId: mov.id,
    usuarioId: l.usuarioId,
    cdId: l.cdId,
    origem,
    destino,
    quantidade: l.quantidade,
    observacao: l.observacao ?? null,
    detalhes: l.unidadeId || l.motivo ? { ...(l.unidadeId ? { unidadeId: l.unidadeId } : {}), ...(l.motivo ? { motivo: l.motivo } : {}) } : undefined,
  });
  return mov;
}

export async function auditar(
  db: Db,
  a: {
    acao: string;
    entidade: string;
    entidadeId?: string | null;
    usuarioId?: string | null;
    cdId?: string | null;
    origem?: Conta | null;
    destino?: Conta | null;
    quantidade?: number | null;
    observacao?: string | null;
    detalhes?: Prisma.InputJsonValue;
  },
) {
  await db.auditoria.create({
    data: {
      acao: a.acao,
      entidade: a.entidade,
      entidadeId: a.entidadeId ?? null,
      usuarioId: a.usuarioId ?? null,
      cdId: a.cdId ?? null,
      origem: a.origem ?? null,
      destino: a.destino ?? null,
      quantidade: a.quantidade ?? null,
      observacao: a.observacao ?? null,
      detalhes: a.detalhes,
    },
  });
}

/** Executa `fn` numa transação ACID com a conta corrente bloqueada. */
export function comContaBloqueada<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(
    async (tx) => {
      await bloquearConta(tx);
      return fn(tx);
    },
    { timeout: 15000 },
  );
}
