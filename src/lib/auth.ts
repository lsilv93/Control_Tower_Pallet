import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { ehAdmin, ehMaster, tem, type Perfil, type Permissao } from "./permissoes";
import { SESSION_COOKIE, verifySession } from "./session";

export type UsuarioAtual = {
  id: string;
  nome: string;
  login: string;
  perfil: Perfil;
  permissoes: string[];
};

/** Usuário logado (validado contra o banco: usuários inativados perdem o acesso). */
export async function getUsuarioAtual(): Promise<UsuarioAtual | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const sessao = await verifySession(token);
  if (!sessao) return null;
  // Sessão encerrada pelo botão Sair: o token não vale mais, mesmo se alguém tiver uma cópia.
  if (sessao.jti && (await prisma.sessaoRevogada.findUnique({ where: { jti: sessao.jti }, select: { jti: true } }))) {
    return null;
  }
  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.sub },
    select: { id: true, nome: true, login: true, perfil: true, ativo: true, permissoes: true },
  });
  if (!usuario || !usuario.ativo) return null;
  return {
    id: usuario.id,
    nome: usuario.nome,
    login: usuario.login,
    perfil: usuario.perfil,
    permissoes: usuario.permissoes,
  };
}

export async function requireUsuario(): Promise<UsuarioAtual> {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

/** Usuário logado com acesso à tela/funcionalidade; sem acesso volta ao início. */
export async function requirePermissao(p: Permissao): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (!tem(usuario, p)) redirect("/sem-acesso");
  return usuario;
}

/** Acesso se o usuário tiver ao menos uma das permissões. */
export async function requireAlguma(...ps: Permissao[]): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (!ps.some((p) => tem(usuario, p))) redirect("/sem-acesso");
  return usuario;
}

/** MASTER ou ADMIN (gestão de usuários). */
export async function requireAdmin(): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (!ehAdmin(usuario)) redirect("/sem-acesso");
  return usuario;
}

/** Somente MASTER (ajuste manual de saldos). */
export async function requireMaster(): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (!ehMaster(usuario)) redirect("/sem-acesso");
  return usuario;
}
