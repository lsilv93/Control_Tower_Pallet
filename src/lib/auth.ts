import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { ehAdmin, ehMaster, tem, type Perfil, type Permissao } from "./permissoes";
import { CD_COOKIE, SESSION_COOKIE, verifySession } from "./session";

export type CDResumo = { id: string; codigo: string; nome: string; cidade: string | null };

export type UsuarioAtual = {
  id: string;
  nome: string;
  login: string;
  perfil: Perfil;
  permissoes: string[];
  /** CDs ativos em que o usuário pode operar. */
  cds: CDResumo[];
  /** CD ativo da sessão (escolhido no login; automático quando há um só). */
  cd: CDResumo | null;
};

export type UsuarioComCD = UsuarioAtual & { cd: CDResumo };

const CAMPOS_CD = { id: true, codigo: true, nome: true, cidade: true } as const;

/**
 * CDs em que o usuário pode operar: os vinculados no cadastro (ativos, do tipo CD).
 * Sem vínculo, MASTER e ADMIN operam qualquer CD ativo; operador não opera nenhum.
 */
async function cdsPermitidos(usuarioId: string, perfil: Perfil): Promise<CDResumo[]> {
  const vinculados = await prisma.centroDistribuicao.findMany({
    where: { tipo: "CD", ativo: true, usuarios: { some: { id: usuarioId } } },
    select: CAMPOS_CD,
    orderBy: { codigo: "asc" },
  });
  if (vinculados.length || perfil === "OPERADOR") return vinculados;
  const temVinculo = await prisma.centroDistribuicao.count({ where: { usuarios: { some: { id: usuarioId } } } });
  if (temVinculo) return []; // vinculado só a CDs inativos
  return prisma.centroDistribuicao.findMany({ where: { tipo: "CD", ativo: true }, select: CAMPOS_CD, orderBy: { codigo: "asc" } });
}

/** Usuário logado (validado contra o banco: usuários inativados perdem o acesso) e CD ativo. */
export const getUsuarioAtual = cache(async (): Promise<UsuarioAtual | null> => {
  const jar = await cookies();
  const sessao = await verifySession(jar.get(SESSION_COOKIE)?.value);
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
  const cds = await cdsPermitidos(usuario.id, usuario.perfil);
  // Um único CD: selecionado automaticamente (sem troca). Vários: o escolhido no modal,
  // sempre revalidado contra a lista de CDs permitidos.
  const escolhido = jar.get(CD_COOKIE)?.value;
  const cd = cds.length === 1 ? cds[0] : (cds.find((c) => c.id === escolhido) ?? null);
  return {
    id: usuario.id,
    nome: usuario.nome,
    login: usuario.login,
    perfil: usuario.perfil,
    permissoes: usuario.permissoes,
    cds,
    cd,
  };
});

export async function requireUsuario(): Promise<UsuarioAtual> {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

/** Usuário logado com CD de operação definido; sem CD, abre a seleção de CD. */
export async function requireCD(): Promise<UsuarioComCD> {
  const usuario = await requireUsuario();
  if (!usuario.cd) redirect("/selecionar-cd");
  return usuario as UsuarioComCD;
}

/** Usuário com acesso à tela/funcionalidade e CD de operação definido. */
export async function requirePermissao(p: Permissao): Promise<UsuarioComCD> {
  const usuario = await requireCD();
  if (!tem(usuario, p)) redirect("/sem-acesso");
  return usuario;
}

/** Acesso a cadastros globais (não dependem do CD de operação). */
export async function requirePermissaoGlobal(p: Permissao): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (!tem(usuario, p)) redirect("/sem-acesso");
  return usuario;
}

/** Acesso se o usuário tiver ao menos uma das permissões (com CD de operação). */
export async function requireAlguma(...ps: Permissao[]): Promise<UsuarioComCD> {
  const usuario = await requireCD();
  if (!ps.some((p) => tem(usuario, p))) redirect("/sem-acesso");
  return usuario;
}

/** MASTER ou ADMIN (gestão de usuários, cadastros globais). */
export async function requireAdmin(): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (!ehAdmin(usuario)) redirect("/sem-acesso");
  return usuario;
}

/** MASTER ou ADMIN operando um CD (inclusões manuais de saldo). */
export async function requireAdminCD(): Promise<UsuarioComCD> {
  const usuario = await requireCD();
  if (!ehAdmin(usuario)) redirect("/sem-acesso");
  return usuario;
}

/** Somente MASTER (correção de inventário). */
export async function requireMaster(): Promise<UsuarioComCD> {
  const usuario = await requireCD();
  if (!ehMaster(usuario)) redirect("/sem-acesso");
  return usuario;
}
