import "server-only";
import { requireUsuario, type UsuarioAtual } from "@/lib/auth";
import { ErroNegocio } from "@/lib/conta";
import { ehAdmin, ehMaster, tem, type Permissao } from "@/lib/permissoes";

/** Verifica a permissão dentro de uma server action (erro amigável em vez de redirecionar). */
export async function exigir(...permissoes: Permissao[]): Promise<UsuarioAtual> {
  const u = await requireUsuario();
  if (!permissoes.some((p) => tem(u, p))) throw new ErroNegocio("Você não tem permissão para esta operação.");
  return u;
}

export async function exigirAdmin(): Promise<UsuarioAtual> {
  const u = await requireUsuario();
  if (!ehAdmin(u)) throw new ErroNegocio("Somente administradores podem realizar esta operação.");
  return u;
}

export async function exigirMaster(): Promise<UsuarioAtual> {
  const u = await requireUsuario();
  if (!ehMaster(u)) throw new ErroNegocio("Somente o usuário MASTER pode ajustar saldos manualmente.");
  return u;
}
