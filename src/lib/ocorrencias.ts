import "server-only";
import type { Prisma } from "@prisma/client";
import type { UsuarioAtual } from "./auth";
import { prisma } from "./prisma";

/** Unidades cujos dados o usuário enxerga (null = todas: Master/Admin). */
export const unidadesDoEscopo = (u: Pick<UsuarioAtual, "global" | "cds">) => (u.global ? null : u.cds.map((c) => c.id));

/** Ocorrências pendentes que aguardam resposta de uma das unidades do usuário (todas, para administradores). */
export function filtroAguardandoUsuario(u: Pick<UsuarioAtual, "global" | "cds">): Prisma.ValePalletWhereInput {
  const ids = unidadesDoEscopo(u);
  return { tipo: "OCORRENCIA", status: "PENDENTE", ...(ids ? { aguardandoId: { in: ids } } : { aguardandoId: { not: null } }) };
}

export function contarPendenciasDoUsuario(u: Pick<UsuarioAtual, "global" | "cds">) {
  return prisma.valePallet.count({ where: filtroAguardandoUsuario(u) });
}

/** O que acontece na conta corrente se a unidade da vez aceitar (texto para a confirmação). */
export function efeitoDoAceite(v: { ocorrencia: "FALTA" | "SOBRA" | null; quantidade: number; cdCodigo: string; recebedorCodigo: string }, peloRemetente: boolean) {
  const q = `${v.quantidade} pallet(s)`;
  if (v.ocorrencia === "FALTA") {
    return peloRemetente ? `${q} baixados como perda de ${v.cdCodigo}` : `${q} assumidos no estoque de ${v.recebedorCodigo} (o remetente ${v.cdCodigo} fica quite)`;
  }
  return peloRemetente
    ? `${q} saem do estoque de ${v.cdCodigo} como enviados (a sobra fica com ${v.recebedorCodigo})`
    : `${q} de sobra incorporados ao estoque de ${v.recebedorCodigo}`;
}
