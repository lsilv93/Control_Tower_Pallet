import "server-only";
import type { Prisma } from "@prisma/client";
import { diaLocal, fimDoDia, formatarData, inicioDoDia } from "./datas";
import { rotuloTipo } from "./formatos";
import type { TipoMovimentacao } from "@prisma/client";

const ACOES: Record<string, string> = {
  LOGIN: "Login",
  LOGOUT: "Logout (Sair)",
  LOGIN_FALHOU: "Tentativa de login falhou",
  ALTERAR_SENHA: "Alteração de senha",
  REDEFINIR_SENHA: "Senha redefinida",
  SEED_ADMIN: "Criação do usuário inicial",
  GERAR_VALE: "Vale-pallet emitido",
  EXCLUIR_VALE: "Vale-pallet excluído (cancelado)",
  GERAR_AGENDA: "Retirada agendada",
  VALIDAR_AGENDA: "Baixa de pagamento",
  CANCELAR_AGENDA: "Agenda cancelada",
  REGISTRAR_COMPRA: "Compra registrada",
  EXPORTAR_RELATORIO: "Exportação de relatório",
  EXPORTAR_AUDITORIA: "Exportação da auditoria",
};

/** Nome amigável do tipo de ação gravado na auditoria. */
export function rotuloAcao(acao: string): string {
  if (acao.startsWith("MOVIMENTACAO_")) {
    const tipo = acao.slice("MOVIMENTACAO_".length) as TipoMovimentacao;
    return `Movimentação · ${rotuloTipo[tipo] ?? tipo}`;
  }
  if (ACOES[acao]) return ACOES[acao];
  const m = acao.match(/^(CRIAR|EDITAR|INATIVAR|ATIVAR)_(.+)$/);
  if (m) {
    const verbo = { CRIAR: "Cadastro", EDITAR: "Edição", INATIVAR: "Inativação", ATIVAR: "Ativação" }[m[1]];
    return `${verbo} · ${m[2].toLowerCase().replace(/_/g, " ")}`;
  }
  return acao.toLowerCase().replace(/_/g, " ");
}

const reData = /^\d{4}-\d{2}-\d{2}$/;

export type FiltrosAuditoria = { de: string; ate: string; usuario: string; acao: string };

/** Filtros da tela de auditoria (padrão: últimos 30 dias). Usados pela tela e pela exportação. */
export function lerFiltrosAuditoria(p: Partial<Record<keyof FiltrosAuditoria, string | null>>) {
  const hoje = diaLocal();
  const de = p.de && reData.test(p.de) ? p.de : diaLocal(new Date(Date.now() - 29 * 86400000));
  const ate = p.ate && reData.test(p.ate) ? p.ate : hoje;
  const usuario = p.usuario ?? "";
  const acao = p.acao ?? "";
  const where: Prisma.AuditoriaWhereInput = {
    criadoEm: { gte: inicioDoDia(de < ate ? de : ate), lt: fimDoDia(de < ate ? ate : de) },
    ...(usuario ? { usuarioId: usuario } : {}),
    // "MOVIMENTACAO" sozinho = todas as movimentações de estoque
    ...(acao === "MOVIMENTACAO" ? { acao: { startsWith: "MOVIMENTACAO_" } } : acao ? { acao } : {}),
  };
  const descricao = `Período ${formatarData(inicioDoDia(de))} a ${formatarData(inicioDoDia(ate))}${acao ? ` · ${acao === "MOVIMENTACAO" ? "Todas as movimentações" : rotuloAcao(acao)}` : ""}`;
  return { filtros: { de, ate, usuario, acao } as FiltrosAuditoria, where, descricao };
}
