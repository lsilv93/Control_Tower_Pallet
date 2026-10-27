import "server-only";
import { Prisma, type Conta, type TipoMovimentacao } from "@prisma/client";
import { prisma } from "./prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Conta corrente em partida dobrada, um livro por unidade (Movimentacao.cdId = CD,
 * Hub ou Ponto de Cross). Toda movimentação debita uma conta (origem) e credita outra
 * (destino) na mesma quantidade.
 *
 * - Estoques físicos (NUNCA negativos): VAZIOS (pallets bons) e QUEBRADOS.
 * - TRANSITO: enviados pela unidade e ainda não conferidos no destino (nunca negativo).
 * - OCORRENCIA: faltas apuradas na conferência, a devolver à unidade (nunca negativo).
 * - As demais são contrapartidas externas.
 */
export const ESTOQUES = ["VAZIOS", "QUEBRADOS"] as const;
export type Estoque = (typeof ESTOQUES)[number];
export const ehEstoque = (c: Conta): c is Estoque => (ESTOQUES as readonly string[]).includes(c);

/** Contas que nunca podem ficar negativas. */
const CONTROLADAS: readonly Conta[] = ["VAZIOS", "QUEBRADOS", "TRANSITO", "OCORRENCIA"];

const EST = ["VAZIOS", "QUEBRADOS"] as const;

/** Regras de movimentação: origem e destino permitidos para cada tipo. */
export const REGRAS: Record<TipoMovimentacao, { origem: readonly Conta[]; destino: readonly Conta[] }> = {
  ENVIO: { origem: EST, destino: ["TRANSITO"] },
  BAIXA_TRANSITO: { origem: ["TRANSITO"], destino: ["ENVIADO"] },
  RECEBIMENTO: { origem: ["RECEBIDO"], destino: EST },
  FALTA: { origem: ["TRANSITO"], destino: ["OCORRENCIA"] },
  SOBRA: { origem: ["SOBRA"], destino: EST },
  OCORRENCIA_LOCALIZADA: { origem: ["OCORRENCIA"], destino: EST },
  OCORRENCIA_PERDA: { origem: ["OCORRENCIA"], destino: ["PERDA"] },
  ESTORNO_ENVIO: { origem: ["TRANSITO"], destino: EST },
  QUEBRA: { origem: ["VAZIOS"], destino: ["QUEBRADOS"] },
  RECUPERADO: { origem: ["QUEBRADOS"], destino: ["VAZIOS"] },
  CANIBALIZACAO: { origem: ["QUEBRADOS"], destino: ["DESCARTE"] },
  DESCARTE: { origem: EST, destino: ["DESCARTE"] },
  INCLUSAO_MANUAL: { origem: ["AJUSTE"], destino: EST },
  REMOCAO_MANUAL: { origem: EST, destino: ["AJUSTE"] },
  COMPRA: { origem: ["COMPRA"], destino: ["VAZIOS"] },
  RECEBIMENTO_FORNECEDOR: { origem: ["FORNECEDOR"], destino: ["CARGA"] },
  DEVOLUCAO_FORNECEDOR: { origem: ["VAZIOS"], destino: ["FORNECEDOR"] },
  ESTORNO_VALE: { origem: ["CARGA"], destino: ["FORNECEDOR"] },
};

/** Vales de fornecedor em aberto (ainda devidos). */
export const STATUS_ABERTOS = ["PENDENTE", "AGENDADO"] as const;

export class ErroNegocio extends Error {}

export type Saldos = Record<Conta, number>;

const zerado = (): Saldos => ({
  VAZIOS: 0,
  QUEBRADOS: 0,
  TRANSITO: 0,
  OCORRENCIA: 0,
  ENVIADO: 0,
  RECEBIDO: 0,
  SOBRA: 0,
  PERDA: 0,
  DESCARTE: 0,
  AJUSTE: 0,
  COMPRA: 0,
  FORNECEDOR: 0,
  CARGA: 0,
});

/** Saldo de cada conta de uma unidade = entradas (destino) − saídas (origem). Opcionalmente até uma data. */
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

/** Estoques (bons e quebrados) e trânsito de várias unidades de uma vez (TV, dashboard). */
export async function estoquesPorUnidade(db: Db = prisma, cdIds?: string[]) {
  const filtro = cdIds ? { cdId: { in: cdIds } } : {};
  const contas: Conta[] = ["VAZIOS", "QUEBRADOS", "TRANSITO", "OCORRENCIA"];
  const [entradas, saidas] = await Promise.all([
    db.movimentacao.groupBy({ by: ["cdId", "destino"], where: { ...filtro, destino: { in: contas } }, _sum: { quantidade: true } }),
    db.movimentacao.groupBy({ by: ["cdId", "origem"], where: { ...filtro, origem: { in: contas } }, _sum: { quantidade: true } }),
  ]);
  const mapa = new Map<string, { vazios: number; quebrados: number; transito: number; ocorrencias: number }>();
  const linha = (id: string) => {
    let l = mapa.get(id);
    if (!l) mapa.set(id, (l = { vazios: 0, quebrados: 0, transito: 0, ocorrencias: 0 }));
    return l;
  };
  const chave: Partial<Record<Conta, "vazios" | "quebrados" | "transito" | "ocorrencias">> = {
    VAZIOS: "vazios",
    QUEBRADOS: "quebrados",
    TRANSITO: "transito",
    OCORRENCIA: "ocorrencias",
  };
  for (const e of entradas) linha(e.cdId)[chave[e.destino]!] += e._sum.quantidade ?? 0;
  for (const s of saidas) linha(s.cdId)[chave[s.origem]!] -= s._sum.quantidade ?? 0;
  return mapa;
}

/** Posição da unidade: estoques, trânsito, a receber, ocorrências e fornecedores. */
export async function obterSaldos(cdId: string, db: Db = prisma) {
  const [contas, aReceber, fornecedor, ocorrenciasAbertas] = await Promise.all([
    saldosPorConta(db, cdId),
    db.valePallet.aggregate({ where: { unidadeId: cdId, tipo: "ENVIO", status: "PENDENTE" }, _sum: { quantidade: true }, _count: true }),
    db.valePallet.aggregate({
      where: { cdId, tipo: "FORNECEDOR", status: { in: [...STATUS_ABERTOS] } },
      _sum: { quantidade: true },
      _count: true,
    }),
    db.valePallet.count({ where: { tipo: "OCORRENCIA", ocorrencia: "FALTA", status: "PENDENTE", OR: [{ cdId }, { unidadeId: cdId }] } }),
  ]);
  return {
    vazios: contas.VAZIOS,
    quebrados: contas.QUEBRADOS,
    /** Enviados pela unidade aguardando conferência no destino. */
    transito: contas.TRANSITO,
    /** Faltas a devolver à unidade (ocorrências abertas em que ela é a remetente). */
    ocorrencias: contas.OCORRENCIA,
    ocorrenciasAbertas,
    /** Vales de envio destinados à unidade, ainda não conferidos. */
    aReceber: aReceber._sum.quantidade ?? 0,
    valesAReceber: aReceber._count,
    descartados: contas.DESCARTE,
    fornecedores: fornecedor._sum.quantidade ?? 0,
    valesFornecedorEmAberto: fornecedor._count,
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
  /** Unidade dona do lançamento. */
  cdId: string;
  origem?: Conta;
  destino?: Conta;
  observacao?: string | null;
  motivo?: string | null;
  unidadeId?: string | null;
  fornecedorId?: string | null;
  valeId?: string | null;
  agendaId?: string | null;
  compraId?: string | null;
  conferenciaId?: string | null;
};

export const ROTULO_CONTA: Record<Conta, string> = {
  VAZIOS: "Pallets bons (vazios)",
  QUEBRADOS: "Pallets quebrados",
  TRANSITO: "Em trânsito",
  OCORRENCIA: "Ocorrência (falta a devolver)",
  ENVIADO: "Enviado a outra unidade",
  RECEBIDO: "Recebido de outra unidade",
  SOBRA: "Sobra na conferência",
  PERDA: "Perda",
  DESCARTE: "Descarte",
  AJUSTE: "Ajuste manual",
  COMPRA: "Compra",
  FORNECEDOR: "Fornecedor",
  CARGA: "Carga de fornecedor",
};

const ROTULO_CURTO: Partial<Record<Conta, string>> = { VAZIOS: "pallets bons", QUEBRADOS: "pallets quebrados", TRANSITO: "trânsito", OCORRENCIA: "ocorrência" };

function resolverConta(permitidas: readonly Conta[], informada: Conta | undefined, papel: string): Conta {
  if (informada) {
    if (!permitidas.includes(informada)) throw new ErroNegocio(`Conta de ${papel} inválida para esta movimentação.`);
    return informada;
  }
  if (permitidas.length !== 1) throw new ErroNegocio(`Informe a conta de ${papel}.`);
  return permitidas[0];
}

/**
 * Lança uma movimentação no livro da unidade. Deve ser chamado dentro de uma transação
 * que já executou `bloquearConta`. Valida a regra do tipo e BLOQUEIA qualquer lançamento
 * que deixaria negativo um estoque, o trânsito ou as ocorrências; grava a auditoria
 * (data/hora, usuário, unidade, origem, destino, quantidade e observação) na mesma transação.
 */
export async function lancar(tx: Prisma.TransactionClient, l: NovoLancamento, codigoUnidade?: string) {
  if (!Number.isInteger(l.quantidade) || l.quantidade <= 0) {
    throw new ErroNegocio("A quantidade deve ser um número inteiro maior que zero.");
  }
  if (!l.cdId) throw new ErroNegocio("Selecione a unidade de operação.");
  const regra = REGRAS[l.tipo];
  const origem = resolverConta(regra.origem, l.origem, "origem");
  const destino = resolverConta(regra.destino, l.destino, "destino");
  if (origem === destino) throw new ErroNegocio("Origem e destino não podem ser iguais.");

  if (CONTROLADAS.includes(origem)) {
    const saldos = await saldosPorConta(tx, l.cdId);
    if (saldos[origem] < l.quantidade) {
      const onde = codigoUnidade ? ` em ${codigoUnidade}` : "";
      throw new ErroNegocio(
        `Saldo insuficiente de ${ROTULO_CURTO[origem] ?? ROTULO_CONTA[origem]}${onde}: disponível ${saldos[origem]}, solicitado ${l.quantidade}. A operação foi bloqueada (o saldo não pode ficar negativo).`,
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
      motivo: l.motivo || null,
      usuarioId: l.usuarioId,
      cdId: l.cdId,
      unidadeId: l.unidadeId ?? null,
      fornecedorId: l.fornecedorId ?? null,
      valeId: l.valeId ?? null,
      agendaId: l.agendaId ?? null,
      compraId: l.compraId ?? null,
      conferenciaId: l.conferenciaId ?? null,
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
    { timeout: 20000 },
  );
}
