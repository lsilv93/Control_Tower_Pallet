"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/conta";
import { requireUsuario } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "@/lib/session";
import { falha, sucesso, tratarErro, type Estado } from "./estado";

export async function entrar(_: Estado, form: FormData): Promise<Estado> {
  const login = String(form.get("login") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  if (!login || !senha) return falha("Informe login e senha.");

  const usuario = await prisma.usuario.findUnique({ where: { login } });
  if (!usuario || !usuario.ativo || !(await bcrypt.compare(senha, usuario.senhaHash))) {
    await auditar(prisma, { acao: "LOGIN_FALHOU", entidade: "Usuario", detalhes: { login } });
    return falha("Login ou senha inválidos.");
  }

  const token = await signSession({
    sub: usuario.id,
    login: usuario.login,
    nome: usuario.nome,
    perfil: usuario.perfil,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  await auditar(prisma, { acao: "LOGIN", entidade: "Usuario", entidadeId: usuario.id, usuarioId: usuario.id });
  redirect("/");
}

/**
 * Logout seguro: revoga o token no servidor (lista de sessões encerradas), apaga o
 * cookie de sessão, registra a auditoria e redireciona para o login.
 */
export async function sair() {
  const jar = await cookies();
  const sessao = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (sessao?.jti) {
    const expiraEm = new Date((sessao.exp ?? Math.floor(Date.now() / 1000) + SESSION_MAX_AGE) * 1000);
    await prisma.sessaoRevogada.upsert({
      where: { jti: sessao.jti },
      update: {},
      create: { jti: sessao.jti, usuarioId: sessao.sub, expiraEm },
    });
    // Tokens já expirados não precisam mais ficar na lista.
    await prisma.sessaoRevogada.deleteMany({ where: { expiraEm: { lt: new Date() } } });
    await auditar(prisma, { acao: "LOGOUT", entidade: "Usuario", entidadeId: sessao.sub, usuarioId: sessao.sub });
  }
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  redirect("/login");
}

const schemaSenha = z
  .object({
    atual: z.string().min(1, "Informe a senha atual."),
    nova: z.string().min(6, "A nova senha deve ter ao menos 6 caracteres."),
    confirmacao: z.string(),
  })
  .refine((d) => d.nova === d.confirmacao, { message: "A confirmação não confere com a nova senha." });

export async function alterarSenha(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await requireUsuario();
    const dados = schemaSenha.parse(Object.fromEntries(form));
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
    if (!(await bcrypt.compare(dados.atual, usuario.senhaHash))) return falha("Senha atual incorreta.");
    await prisma.usuario.update({ where: { id: u.id }, data: { senhaHash: await bcrypt.hash(dados.nova, 10) } });
    await auditar(prisma, { acao: "ALTERAR_SENHA", entidade: "Usuario", entidadeId: u.id, usuarioId: u.id });
    return sucesso("Senha alterada com sucesso.");
  } catch (e) {
    return tratarErro(e);
  }
}
