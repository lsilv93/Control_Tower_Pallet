import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { ehAdmin, ehMaster, tem, temVisaoBrasil, temVisaoGlobal, type Perfil, type Permissao } from "./permissoes";
import { CD_COOKIE, SESSION_COOKIE, verifySession } from "./session";

export type CDResumo = {
  id: string;
  codigo: string;
  nome: string;
  tipo: "CD" | "CROSS";
  hub: boolean;
  recebimentoFornecedor: boolean;
};

export type UsuarioAtual = {
  id: string;
  nome: string;
  login: string;
  perfil: Perfil;
  permissoes: string[];
  /**
   * Unidade que define as regras de acesso da sessão: a unidade de operação escolhida (ou a
   * principal, antes da escolha). Ex.: operando um Ponto de Cross, valem as restrições de Cross.
   */
  unidade: CDResumo;
  /** Acesso cruzado a todas as unidades: somente Master e Administrador. */
  global: boolean;
  /** TV Nível Brasil (somente leitura): administradores e usuários do Hub CDJC. */
  visaoBrasil: boolean;
  /** Unidades em que pode operar: todas (administradores) ou as vinculadas ao usuário. */
  cds: CDResumo[];
  /** Unidade de operação da sessão (a própria; na visão global, a escolhida no modal). */
  cd: CDResumo | null;
};

export type UsuarioComCD = UsuarioAtual & { cd: CDResumo };

export const CAMPOS_UNIDADE = { id: true, codigo: true, nome: true, tipo: true, hub: true, recebimentoFornecedor: true } as const;

/** Usuário logado (validado contra o banco: usuários inativados perdem o acesso) e unidade ativa. */
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
    select: {
      id: true,
      nome: true,
      login: true,
      perfil: true,
      ativo: true,
      permissoes: true,
      unidade: { select: { ...CAMPOS_UNIDADE, ativo: true } },
      unidades: { select: { unidade: { select: { ...CAMPOS_UNIDADE, ativo: true } } } },
    },
  });
  if (!usuario || !usuario.ativo) return null;
  const { ativo: principalAtiva, ...principal } = usuario.unidade;
  const global = temVisaoGlobal({ perfil: usuario.perfil, unidade: principal });
  // Administrador: todas as unidades ativas. Demais: as unidades vinculadas (CDs e/ou Cross) ativas.
  const ordem = (a: CDResumo, b: CDResumo) => Number(b.hub) - Number(a.hub) || a.tipo.localeCompare(b.tipo) || a.codigo.localeCompare(b.codigo);
  const vinculadas = new Map<string, CDResumo>();
  if (principalAtiva) vinculadas.set(principal.id, principal);
  for (const { unidade: v } of usuario.unidades) {
    const { ativo, ...resumo } = v;
    if (ativo) vinculadas.set(resumo.id, resumo);
  }
  const cds = global
    ? await prisma.centroDistribuicao.findMany({ where: { ativo: true }, select: CAMPOS_UNIDADE, orderBy: [{ hub: "desc" }, { tipo: "asc" }, { codigo: "asc" }] })
    : [...vinculadas.values()].sort(ordem);
  const escolhido = jar.get(CD_COOKIE)?.value;
  const cd = cds.length === 1 ? cds[0] : (cds.find((c) => c.id === escolhido) ?? null);
  // As regras de acesso seguem a unidade em operação (ex.: operando um Cross valem as restrições de Cross).
  const unidade = cd ?? principal;
  const visaoBrasil = temVisaoBrasil({ perfil: usuario.perfil, unidade }) || cds.some((c) => c.hub);
  return {
    id: usuario.id,
    nome: usuario.nome,
    login: usuario.login,
    perfil: usuario.perfil,
    permissoes: usuario.permissoes,
    unidade,
    global,
    visaoBrasil,
    cds,
    cd,
  };
});

export async function requireUsuario(): Promise<UsuarioAtual> {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

/** Usuário logado com unidade de operação definida; sem unidade, abre a seleção. */
export async function requireCD(): Promise<UsuarioComCD> {
  const usuario = await requireUsuario();
  if (!usuario.cd) redirect("/selecionar-cd");
  return usuario as UsuarioComCD;
}

/** Usuário com acesso à tela/funcionalidade e unidade de operação definida. */
export async function requirePermissao(p: Permissao): Promise<UsuarioComCD> {
  const usuario = await requireCD();
  if (!tem(usuario, p)) redirect("/sem-acesso");
  return usuario;
}

/** Acesso a cadastros globais (não dependem da unidade de operação). */
export async function requirePermissaoGlobal(p: Permissao): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (!tem(usuario, p)) redirect("/sem-acesso");
  return usuario;
}

/** Acesso se o usuário tiver ao menos uma das permissões (com unidade de operação). */
export async function requireAlguma(...ps: Permissao[]): Promise<UsuarioComCD> {
  const usuario = await requireCD();
  if (!ps.some((p) => tem(usuario, p))) redirect("/sem-acesso");
  return usuario;
}

/** Módulo "Recebimento Pallet Fornecedor": permissão + módulo liberado pelo Master na unidade. */
export async function requireModuloFornecedor(p: Permissao = "fornecedor"): Promise<UsuarioComCD> {
  const usuario = await requirePermissao(p);
  if (!usuario.cd.recebimentoFornecedor) redirect("/sem-acesso?modulo=fornecedor");
  return usuario;
}

/** MASTER ou ADMIN (gestão de usuários, cadastros globais). */
export async function requireAdmin(): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (!ehAdmin(usuario)) redirect("/sem-acesso");
  return usuario;
}

/** MASTER ou ADMIN operando uma unidade (inclusão/remoção manual). */
export async function requireAdminCD(): Promise<UsuarioComCD> {
  const usuario = await requireCD();
  if (!ehAdmin(usuario)) redirect("/sem-acesso");
  return usuario;
}

/** Somente MASTER. */
export async function requireMaster(): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (!ehMaster(usuario)) redirect("/sem-acesso");
  return usuario;
}

/** Vale visível ao usuário: visão global ou a unidade dele é a emissora ou a destinatária. */
export function podeVerVale(u: UsuarioAtual, v: { cdId: string; unidadeId: string | null }) {
  return u.global || u.cds.some((c) => c.id === v.cdId || c.id === v.unidadeId);
}
