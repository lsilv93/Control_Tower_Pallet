"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/conta";
import { requireUsuario } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
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

export async function sair() {
  const token = await cookies();
  token.delete(SESSION_COOKIE);
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
