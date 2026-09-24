import "server-only";
import { Prisma, type TipoMovimentacao } from "@prisma/client";
import { prisma } from "./prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** Variação aplicada ao pulmão e ao estoque de avariados por tipo de movimentação. */
export const DELTAS: Record<TipoMovimentacao, { pulmao: -1 | 0 | 1; avaria: -1 | 0 | 1 }> = {
  ENVIO_CD: { pulmao: -1, avaria: 0 },
  RECEBIMENTO_CD: { pulmao: 1, avaria: 0 },
  RECEBIMENTO_FORNECEDOR: { pulmao: 1, avaria: 0 },
  DEVOLUCAO_FORNECEDOR: { pulmao: -1, avaria: 0 },
  QUEBRA: { pulmao: -1, avaria: 1 },
  RECUPERADO: { pulmao: 1, avaria: -1 },
  DESCARTE: { pulmao: 0, avaria: -1 },
  AJUSTE_ENTRADA: { pulmao: 1, avaria: 0 },
  AJUSTE_SAIDA: { pulmao: -1, avaria: 0 },
  COMPRA: { pulmao: 1, avaria: 0 },
};

export class ErroNegocio extends Error {}

export async function obterSaldos(db: Db = prisma) {
  const [conta, pendentes] = await Promise.all([
    db.movimentacao.aggregate({ _sum: { deltaPulmao: true, deltaAvaria: true } }),
    db.valePallet.aggregate({
      where: { status: { not: "FINALIZADO" } },
      _sum: { quantidade: true },
      _count: true,
    }),
  ]);
  return {
    pulmao: conta._sum.deltaPulmao ?? 0,
    avaria: conta._sum.deltaAvaria ?? 0,
    pendenteFornecedores: pendentes._sum.quantidade ?? 0,
    valesEmAberto: pendentes._count,
  };
}

/**
 * Serializa as movimentações da conta corrente dentro da transação corrente,
 * garantindo que duas saídas simultâneas não deixem o saldo negativo.
 */
export async function bloquearConta(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(815001)`;
}

export type NovoLancamento = {
  tipo: TipoMovimentacao;
  quantidade: number;
  usuarioId: string;
  observacao?: string | null;
  cdId?: string | null;
  fornecedorId?: string | null;
  valeId?: string | null;
  agendaId?: string | null;
  compraId?: string | null;
};

/**
 * Lança uma movimentação na conta corrente. Deve ser chamado dentro de uma
 * transação que já executou `bloquearConta`. Valida saldo suficiente e
 * registra a trilha de auditoria (data/hora + usuário).
 */
export async function lancar(tx: Prisma.TransactionClient, l: NovoLancamento) {
  if (!Number.isInteger(l.quantidade) || l.quantidade <= 0) {
    throw new ErroNegocio("A quantidade deve ser um número inteiro maior que zero.");
  }
  const d = DELTAS[l.tipo];
  const deltaPulmao = d.pulmao * l.quantidade;
  const deltaAvaria = d.avaria * l.quantidade;

  if (deltaPulmao < 0 || deltaAvaria < 0) {
    const saldos = await obterSaldos(tx);
    if (saldos.pulmao + deltaPulmao < 0) {
      throw new ErroNegocio(
        `Saldo insuficiente no pulmão: disponível ${saldos.pulmao}, solicitado ${l.quantidade}.`,
      );
    }
    if (saldos.avaria + deltaAvaria < 0) {
      throw new ErroNegocio(
        `Saldo insuficiente de pallets avariados: disponível ${saldos.avaria}, solicitado ${l.quantidade}.`,
      );
    }
  }

  const mov = await tx.movimentacao.create({
    data: {
      tipo: l.tipo,
      quantidade: l.quantidade,
      deltaPulmao,
      deltaAvaria,
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
    detalhes: { quantidade: l.quantidade, deltaPulmao, deltaAvaria, observacao: l.observacao ?? null },
  });
  return mov;
}

export async function auditar(
  db: Db,
  a: { acao: string; entidade: string; entidadeId?: string | null; usuarioId?: string | null; detalhes?: Prisma.InputJsonValue },
) {
  await db.auditoria.create({
    data: {
      acao: a.acao,
      entidade: a.entidade,
      entidadeId: a.entidadeId ?? null,
      usuarioId: a.usuarioId ?? null,
      detalhes: a.detalhes,
    },
  });
}

/** Executa `fn` numa transação com a conta corrente bloqueada. */
export function comContaBloqueada<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(
    async (tx) => {
      await bloquearConta(tx);
      return fn(tx);
    },
    { timeout: 15000 },
  );
}
