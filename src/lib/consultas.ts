import "server-only";
import type { Prisma, TipoMovimentacao } from "@prisma/client";
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

/** Entradas e saídas do pulmão no período (sem período = consolidado de todo o histórico). */
export async function entradasSaidas(periodo: Intervalo = {}) {
  const w = periodoWhere(periodo);
  const [entradas, saidas] = await Promise.all([
    prisma.movimentacao.aggregate({ where: { ...w, deltaPulmao: { gt: 0 } }, _sum: { deltaPulmao: true } }),
    prisma.movimentacao.aggregate({ where: { ...w, deltaPulmao: { lt: 0 } }, _sum: { deltaPulmao: true } }),
  ]);
  // Math.abs evita "-0" quando não há saídas no período
  return { entradas: entradas._sum.deltaPulmao ?? 0, saidas: Math.abs(saidas._sum.deltaPulmao ?? 0) };
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
