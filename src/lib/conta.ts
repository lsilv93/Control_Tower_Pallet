import "server-only";
import { Prisma, type Conta, type TipoMovimentacao } from "@prisma/client";
import { prisma } from "./prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Conta corrente em partida dobrada. Toda movimentação debita uma conta (origem)
 * e credita outra (destino) na mesma quantidade: nenhum pallet surge ou some.
 * Estoques físicos: VAZIOS, CD e QUEBRADOS. FORNECEDOR, COMPRA, DESCARTE e AJUSTE
 * são contrapartidas externas (não têm restrição de saldo).
 */
export const ESTOQUES = ["VAZIOS", "CD", "QUEBRADOS"] as const;
export type Estoque = (typeof ESTOQUES)[number];
export const ehEstoque = (c: Conta): c is Estoque => (ESTOQUES as readonly string[]).includes(c);

/** Regras de movimentação: origem e destino permitidos para cada tipo. */
export const REGRAS: Record<TipoMovimentacao, { origem: readonly Conta[]; destino: readonly Conta[] }> = {
  ENVIO_CD: { origem: ["VAZIOS"], destino: ["CD"] }, // transferência para o CD
  RECEBIMENTO_CD: { origem: ["CD"], destino: ["VAZIOS"] }, // retorno do CD para vazios
  RECEBIMENTO_FORNECEDOR: { origem: ["FORNECEDOR"], destino: ["CD"] }, // vale-pallet soma no CD
  DEVOLUCAO_FORNECEDOR: { origem: ["VAZIOS"], destino: ["FORNECEDOR"] }, // baixa de pagamento sai dos vazios
  ESTORNO_VALE: { origem: ["CD"], destino: ["FORNECEDOR"] }, // exclusão do vale cancela a entrada no CD
  QUEBRA: { origem: ["VAZIOS"], destino: ["QUEBRADOS"] },
  RECUPERADO: { origem: ["QUEBRADOS"], destino: ["VAZIOS"] }, // conserto/reparo
  DESCARTE: { origem: ["VAZIOS", "QUEBRADOS"], destino: ["DESCARTE"] }, // usuário escolhe o pulmão
  COMPRA: { origem: ["COMPRA"], destino: ["VAZIOS"] },
  AJUSTE_ENTRADA: { origem: ["AJUSTE"], destino: ["VAZIOS", "CD", "QUEBRADOS"] }, // somente MASTER
  AJUSTE_SAIDA: { origem: ["VAZIOS", "CD", "QUEBRADOS"], destino: ["AJUSTE"] }, // somente MASTER
};

/** Vales em aberto (ainda devidos ao fornecedor). Cancelados e baixados ficam de fora. */
export const STATUS_ABERTOS = ["PENDENTE", "AGENDADO"] as const;

export class ErroNegocio extends Error {}

export type Saldos = Record<Conta, number>;

/** Saldo de cada conta = entradas (destino) − saídas (origem). Opcionalmente até uma data. */
export async function saldosPorConta(db: Db = prisma, ate?: Date): Promise<Saldos> {
  const where = ate ? { criadoEm: { lt: ate } } : {};
  const [entradas, saidas] = await Promise.all([
    db.movimentacao.groupBy({ by: ["destino"], where, _sum: { quantidade: true } }),
    db.movimentacao.groupBy({ by: ["origem"], where, _sum: { quantidade: true } }),
  ]);
  const s = { VAZIOS: 0, CD: 0, QUEBRADOS: 0, FORNECEDOR: 0, COMPRA: 0, DESCARTE: 0, AJUSTE: 0 } as Saldos;
  for (const e of entradas) s[e.destino] += e._sum.quantidade ?? 0;
  for (const o of saidas) s[o.origem] -= o._sum.quantidade ?? 0;
  return s;
}

export async function obterSaldos(db: Db = prisma) {
  const [contas, pendentes] = await Promise.all([
    saldosPorConta(db),
    db.valePallet.aggregate({
      where: { status: { in: [...STATUS_ABERTOS] } },
      _sum: { quantidade: true },
      _count: true,
    }),
  ]);
  return {
    vazios: contas.VAZIOS,
    cd: contas.CD,
    quebrados: contas.QUEBRADOS,
    total: contas.VAZIOS + contas.CD + contas.QUEBRADOS,
    contas,
    pendenteFornecedores: pendentes._sum.quantidade ?? 0,
    valesEmAberto: pendentes._count,
  };
}

/**
 * Serializa as movimentações dentro da transação corrente (lock consultivo do
 * PostgreSQL): duas saídas simultâneas não conseguem deixar um estoque negativo.
 */
export async function bloquearConta(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(815001)`;
}

export type NovoLancamento = {
  tipo: TipoMovimentacao;
  quantidade: number;
  usuarioId: string;
  /** Obrigatórios só quando a regra admite mais de uma conta (descarte, ajuste). */
  origem?: Conta;
  destino?: Conta;
  observacao?: string | null;
  cdId?: string | null;
  fornecedorId?: string | null;
  valeId?: string | null;
  agendaId?: string | null;
  compraId?: string | null;
};

export const ROTULO_CONTA: Record<Conta, string> = {
  VAZIOS: "Estoque de Vazios",
  CD: "Estoque do CD",
  QUEBRADOS: "Estoque de Quebrados",
  FORNECEDOR: "Fornecedor",
  COMPRA: "Compra",
  DESCARTE: "Descarte",
  AJUSTE: "Ajuste manual",
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
 * Lança uma movimentação (partida dobrada). Deve ser chamado dentro de uma
 * transação que já executou `bloquearConta`. Valida a regra do tipo, o saldo
 * do estoque de origem e grava a auditoria (data/hora, usuário, origem, destino,
 * quantidade e justificativa) na mesma transação.
 */
export async function lancar(tx: Prisma.TransactionClient, l: NovoLancamento) {
  if (!Number.isInteger(l.quantidade) || l.quantidade <= 0) {
    throw new ErroNegocio("A quantidade deve ser um número inteiro maior que zero.");
  }
  const regra = REGRAS[l.tipo];
  const origem = resolverConta(regra.origem, l.origem, "origem");
  const destino = resolverConta(regra.destino, l.destino, "destino");
  if (origem === destino) throw new ErroNegocio("Origem e destino não podem ser iguais.");

  if (ehEstoque(origem)) {
    const saldos = await saldosPorConta(tx);
    if (saldos[origem] < l.quantidade) {
      throw new ErroNegocio(
        `Saldo insuficiente no ${ROTULO_CONTA[origem]}: disponível ${saldos[origem]}, solicitado ${l.quantidade}.`,
      );
    }
  }

  const mov = await tx.movimentacao.create({
    data: {
      tipo: l.tipo,
      quantidade: l.quantidade,
      origem,
      destino,
      observacao: l.observacao || null,
      usuarioId: l.usuarioId,
      cdId: l.cdId ?? null,
      fornecedorId: l.fornecedorId ?? null,
      valeId: l.valeId ?? null,
      agendaId: l.agendaId ?? null,
      compraId: l.compraId ?? null,
    },
  });
  await auditar(tx, {
    acao: `MOVIMENTACAO_${l.tipo}`,
    entidade: "Movimentacao",
    entidadeId: mov.id,
    usuarioId: l.usuarioId,
    origem,
    destino,
    quantidade: l.quantidade,
    observacao: l.observacao ?? null,
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
