"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { auditar, comContaBloqueada, ErroNegocio, lancar } from "@/lib/conta";
import { prisma } from "@/lib/prisma";
import { sucesso, tratarErro, type Estado } from "./estado";

const schemaCD = z.object({
  codigo: z.string().trim().min(1, "Informe o código do CD.").max(20).transform((v) => v.toUpperCase()),
  nome: z.string().trim().min(2, "Informe o nome do CD.").max(120),
  cidade: z.string().trim().max(120).optional(),
});

export async function criarCD(_: Estado, form: FormData): Promise<Estado> {
  try {
    const admin = await requireAdmin();
    const d = schemaCD.parse(Object.fromEntries(form));
    if (await prisma.centroDistribuicao.findUnique({ where: { codigo: d.codigo } })) {
      throw new ErroNegocio(`Já existe um CD com o código ${d.codigo}.`);
    }
    const cd = await prisma.centroDistribuicao.create({ data: { ...d, cidade: d.cidade || null } });
    await auditar(prisma, { acao: "CRIAR_CD", entidade: "CentroDistribuicao", entidadeId: cd.id, usuarioId: admin.id, detalhes: d });
    revalidatePath("/", "layout");
    return sucesso(`CD ${cd.codigo} cadastrado.`);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function alternarCD(_: Estado, form: FormData): Promise<Estado> {
  try {
    const admin = await requireAdmin();
    const id = String(form.get("id"));
    const cd = await prisma.centroDistribuicao.findUniqueOrThrow({ where: { id } });
    await prisma.centroDistribuicao.update({ where: { id }, data: { ativo: !cd.ativo } });
    await auditar(prisma, {
      acao: cd.ativo ? "INATIVAR_CD" : "ATIVAR_CD",
      entidade: "CentroDistribuicao",
      entidadeId: id,
      usuarioId: admin.id,
    });
    revalidatePath("/", "layout");
    return sucesso(`CD ${cd.codigo} ${cd.ativo ? "inativado" : "ativado"}.`);
  } catch (e) {
    return tratarErro(e);
  }
}

const schemaUsuario = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(120),
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/, "Login deve ter 3 a 40 caracteres (letras, números, ponto, hífen)."),
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
  perfil: z.enum(["ADMIN", "OPERADOR"]),
});

export async function criarUsuario(_: Estado, form: FormData): Promise<Estado> {
  try {
    const admin = await requireAdmin();
    const d = schemaUsuario.parse(Object.fromEntries(form));
    if (await prisma.usuario.findUnique({ where: { login: d.login } })) {
      throw new ErroNegocio(`O login "${d.login}" já está em uso.`);
    }
    const u = await prisma.usuario.create({
      data: { nome: d.nome, login: d.login, perfil: d.perfil, senhaHash: await bcrypt.hash(d.senha, 10) },
    });
    await auditar(prisma, {
      acao: "CRIAR_USUARIO",
      entidade: "Usuario",
      entidadeId: u.id,
      usuarioId: admin.id,
      detalhes: { login: d.login, perfil: d.perfil },
    });
    revalidatePath("/cadastros");
    return sucesso(`Usuário ${d.login} criado.`);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function alternarUsuario(_: Estado, form: FormData): Promise<Estado> {
  try {
    const admin = await requireAdmin();
    const id = String(form.get("id"));
    if (id === admin.id) throw new ErroNegocio("Você não pode inativar o próprio usuário.");
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id } });
    await prisma.usuario.update({ where: { id }, data: { ativo: !u.ativo } });
    await auditar(prisma, { acao: u.ativo ? "INATIVAR_USUARIO" : "ATIVAR_USUARIO", entidade: "Usuario", entidadeId: id, usuarioId: admin.id });
    revalidatePath("/cadastros");
    return sucesso(`Usuário ${u.login} ${u.ativo ? "inativado" : "ativado"}.`);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function redefinirSenha(_: Estado, form: FormData): Promise<Estado> {
  try {
    const admin = await requireAdmin();
    const id = String(form.get("id"));
    const senha = z.string().min(6, "A senha deve ter ao menos 6 caracteres.").parse(form.get("senha"));
    const u = await prisma.usuario.update({ where: { id }, data: { senhaHash: await bcrypt.hash(senha, 10) } });
    await auditar(prisma, { acao: "REDEFINIR_SENHA", entidade: "Usuario", entidadeId: id, usuarioId: admin.id });
    return sucesso(`Senha de ${u.login} redefinida.`);
  } catch (e) {
    return tratarErro(e);
  }
}

const schemaAjuste = z.object({
  sentido: z.enum(["ENTRADA", "SAIDA"]),
  quantidade: z.coerce.number({ message: "Informe a quantidade." }).int().positive("Quantidade deve ser maior que zero."),
  observacao: z.string().trim().min(5, "Justificativa obrigatória (mínimo 5 caracteres).").max(500),
});

/** Ajuste de inventário (saldo inicial, contagem física). Apenas administradores. */
export async function ajustarInventario(_: Estado, form: FormData): Promise<Estado> {
  try {
    const admin = await requireAdmin();
    const d = schemaAjuste.parse(Object.fromEntries(form));
    await comContaBloqueada((tx) =>
      lancar(tx, {
        tipo: d.sentido === "ENTRADA" ? "AJUSTE_ENTRADA" : "AJUSTE_SAIDA",
        quantidade: d.quantidade,
        observacao: d.observacao,
        usuarioId: admin.id,
      }),
    );
    revalidatePath("/", "layout");
    return sucesso(`Ajuste de ${d.sentido === "ENTRADA" ? "entrada" : "saída"} de ${d.quantidade} pallet(s) registrado.`);
  } catch (e) {
    return tratarErro(e);
  }
}
