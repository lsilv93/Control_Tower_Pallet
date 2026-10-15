import "server-only";
import { requireUsuario, type UsuarioAtual, type UsuarioComCD } from "@/lib/auth";
import { ErroNegocio } from "@/lib/conta";
import { ehAdmin, ehMaster, tem, type Permissao } from "@/lib/permissoes";

const semCD = () =>
  new ErroNegocio("Selecione o CD de operação antes de continuar (menu lateral → Trocar CD).");

/**
 * Verifica a permissão dentro de uma server action (erro amigável em vez de redirecionar)
 * e exige o CD de operação: toda movimentação é registrada no CD ativo da sessão.
 */
export async function exigir(...permissoes: Permissao[]): Promise<UsuarioComCD> {
  const u = await exigirGlobal(...permissoes);
  if (!u.cd) throw semCD();
  return u as UsuarioComCD;
}

/** Permissão sem exigir CD (cadastros globais). */
export async function exigirGlobal(...permissoes: Permissao[]): Promise<UsuarioAtual> {
  const u = await requireUsuario();
  if (!permissoes.some((p) => tem(u, p))) throw new ErroNegocio("Você não tem permissão para esta operação.");
  return u;
}

export async function exigirAdmin(): Promise<UsuarioAtual> {
  const u = await requireUsuario();
  if (!ehAdmin(u)) throw new ErroNegocio("Somente administradores podem realizar esta operação.");
  return u;
}

/** Administrador operando um CD (inclusão manual de vazios / saldo devedor). */
export async function exigirAdminCD(): Promise<UsuarioComCD> {
  const u = await exigirAdmin();
  if (!u.cd) throw semCD();
  return u as UsuarioComCD;
}

export async function exigirMaster(): Promise<UsuarioComCD> {
  const u = await requireUsuario();
  if (!ehMaster(u)) throw new ErroNegocio("Somente o usuário MASTER pode corrigir o inventário.");
  if (!u.cd) throw semCD();
  return u as UsuarioComCD;
}
