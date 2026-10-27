import "server-only";
import { requireUsuario, type UsuarioAtual, type UsuarioComCD } from "@/lib/auth";
import { ErroNegocio } from "@/lib/conta";
import { ehAdmin, ehMaster, tem, type Permissao } from "@/lib/permissoes";

const semCD = () => new ErroNegocio("Selecione a unidade de operação antes de continuar (menu lateral → Trocar unidade).");

/**
 * Verifica a permissão dentro de uma server action (erro amigável em vez de redirecionar)
 * e exige a unidade de operação: toda movimentação é registrada na unidade ativa da sessão.
 */
export async function exigir(...permissoes: Permissao[]): Promise<UsuarioComCD> {
  const u = await exigirGlobal(...permissoes);
  if (!u.cd) throw semCD();
  return u as UsuarioComCD;
}

/** Permissão sem exigir unidade (cadastros globais). */
export async function exigirGlobal(...permissoes: Permissao[]): Promise<UsuarioAtual> {
  const u = await requireUsuario();
  if (!permissoes.some((p) => tem(u, p))) throw new ErroNegocio("Você não tem permissão para esta operação.");
  return u;
}

/** Qualquer usuário logado com unidade de operação (ex.: descarte). */
export async function exigirUnidade(): Promise<UsuarioComCD> {
  const u = await requireUsuario();
  if (!u.cd) throw semCD();
  return u as UsuarioComCD;
}

/** Módulo Recebimento Pallet Fornecedor liberado na unidade ativa. */
export async function exigirModuloFornecedor(...permissoes: Permissao[]): Promise<UsuarioComCD> {
  const u = await exigir(...(permissoes.length ? permissoes : (["fornecedor"] as Permissao[])));
  if (!u.cd.recebimentoFornecedor) throw new ErroNegocio("O módulo Recebimento Pallet Fornecedor não está liberado para esta unidade.");
  return u;
}

export async function exigirAdmin(): Promise<UsuarioAtual> {
  const u = await requireUsuario();
  if (!ehAdmin(u)) throw new ErroNegocio("Somente administradores podem realizar esta operação.");
  return u;
}

/** Administrador operando uma unidade (inclusão/remoção manual de saldo). */
export async function exigirAdminCD(): Promise<UsuarioComCD> {
  const u = await exigirAdmin();
  if (!u.cd) throw semCD();
  return u as UsuarioComCD;
}

export async function exigirMaster(): Promise<UsuarioAtual> {
  const u = await requireUsuario();
  if (!ehMaster(u)) throw new ErroNegocio("Somente o usuário MASTER pode alterar esta configuração.");
  return u;
}
