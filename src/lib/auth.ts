import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { podeAdicionarPallets } from "./permissoes";
import { SESSION_COOKIE, verifySession } from "./session";

export type UsuarioAtual = {
  id: string;
  nome: string;
  login: string;
  perfil: "ADMIN" | "OPERADOR";
  podeAdicionarPallets: boolean;
};

/** Usuário logado (validado contra o banco: usuários inativados perdem o acesso). */
export async function getUsuarioAtual(): Promise<UsuarioAtual | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const sessao = await verifySession(token);
  if (!sessao) return null;
  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.sub },
    select: { id: true, nome: true, login: true, perfil: true, ativo: true, podeAdicionarPallets: true },
  });
  if (!usuario || !usuario.ativo) return null;
  return {
    id: usuario.id,
    nome: usuario.nome,
    login: usuario.login,
    perfil: usuario.perfil,
    podeAdicionarPallets: usuario.podeAdicionarPallets,
  };
}

export async function requireUsuario(): Promise<UsuarioAtual> {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

export async function requireAdmin(): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (usuario.perfil !== "ADMIN") redirect("/");
  return usuario;
}

export async function requirePermissaoPallets(): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (!podeAdicionarPallets(usuario)) redirect("/");
  return usuario;
}
