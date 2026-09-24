import type { Prisma, TipoMovimentacao } from "@prisma/client";
import { diaLocal, fimDoDia, inicioDoDia } from "./datas";
import { rotuloTipo } from "./formatos";

const reData = /^\d{4}-\d{2}-\d{2}$/;

/** Lê os filtros de período/tipo do relatório (padrão: últimos 30 dias). */
export function lerFiltros(p: { de?: string | null; ate?: string | null; tipo?: string | null }) {
  const hoje = diaLocal();
  const de = p.de && reData.test(p.de) ? p.de : diaLocal(new Date(Date.now() - 29 * 86400000));
  const ate = p.ate && reData.test(p.ate) ? p.ate : hoje;
  const tipo = p.tipo && p.tipo in rotuloTipo ? (p.tipo as TipoMovimentacao) : undefined;
  const periodo = { gte: inicioDoDia(de), lt: fimDoDia(ate) };
  const where: Prisma.MovimentacaoWhereInput = { criadoEm: periodo, ...(tipo ? { tipo } : {}) };
  return { de, ate, tipo, periodo, where };
}
