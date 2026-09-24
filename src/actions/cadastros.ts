"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireUsuario } from "@/lib/auth";
import { auditar, ErroNegocio } from "@/lib/conta";
import { cnpjValido, normalizarCnpj } from "@/lib/formatos";
import { prisma } from "@/lib/prisma";
import { falha, tratarErro, type Estado } from "./estado";

// Campos opcionais: string vazia vira null.
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const email = z
  .string()
  .trim()
  .max(160)
  .optional()
  .transform((v) => v || null)
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido.");
const cnpj = z
  .string()
  .refine(cnpjValido, "CNPJ inválido.")
  .transform((v) => normalizarCnpj(v));

/** Após salvar, volta para a listagem com a mensagem de confirmação no topo. */
function concluir(caminho: string, mensagem: string): never {
  revalidatePath("/", "layout");
  redirect(`${caminho}?ok=${encodeURIComponent(mensagem)}`);
}

function lerId(form: FormData) {
  const id = String(form.get("id") ?? "");
  return id || null;
}

// ---------------- Transportadoras (todos os usuários) ----------------
const schemaTransportadora = z.object({
  nome: z.string().trim().min(2, "Informe o nome da transportadora.").max(200),
  cnpj,
  contato: opcional(120),
  telefone: opcional(40),
  email,
});

export async function salvarTransportadora(_: Estado, form: FormData): Promise<Estado> {
  let msg: string;
  try {
    const u = await requireUsuario();
    const id = lerId(form);
    const d = schemaTransportadora.parse(Object.fromEntries(form));
    const duplicada = await prisma.transportadora.findUnique({ where: { cnpj: d.cnpj } });
    if (duplicada && duplicada.id !== id) throw new ErroNegocio(`CNPJ já cadastrado para ${duplicada.nome}.`);
    const t = id
      ? await prisma.transportadora.update({ where: { id }, data: d })
      : await prisma.transportadora.create({ data: d });
    await auditar(prisma, { acao: id ? "EDITAR_TRANSPORTADORA" : "CRIAR_TRANSPORTADORA", entidade: "Transportadora", entidadeId: t.id, usuarioId: u.id, detalhes: d });
    msg = `Transportadora ${t.nome} ${id ? "atualizada" : "cadastrada"}.`;
  } catch (e) {
    return tratarErro(e);
  }
  concluir("/cadastros/transportadoras", msg);
}

// ---------------- Fornecedores (todos os usuários) ----------------
const schemaFornecedor = z.object({
  nome: z.string().trim().min(2, "Informe o nome do fornecedor.").max(200),
  cnpj,
  endereco: opcional(200),
  cidade: opcional(120),
  uf: opcional(2).transform((v) => (v ? v.toUpperCase() : null)),
  contato: opcional(120),
  telefone: opcional(40),
  email,
});

export async function salvarFornecedor(_: Estado, form: FormData): Promise<Estado> {
  let msg: string;
  try {
    const u = await requireUsuario();
    const id = lerId(form);
    const d = schemaFornecedor.parse(Object.fromEntries(form));
    const duplicado = await prisma.fornecedor.findUnique({ where: { cnpj: d.cnpj } });
    if (duplicado && duplicado.id !== id) throw new ErroNegocio(`CNPJ já cadastrado para ${duplicado.nome}.`);
    const f = id ? await prisma.fornecedor.update({ where: { id }, data: d }) : await prisma.fornecedor.create({ data: d });
    await auditar(prisma, { acao: id ? "EDITAR_FORNECEDOR" : "CRIAR_FORNECEDOR", entidade: "Fornecedor", entidadeId: f.id, usuarioId: u.id, detalhes: d });
    msg = `Fornecedor ${f.nome} ${id ? "atualizado" : "cadastrado"}.`;
  } catch (e) {
    return tratarErro(e);
  }
  concluir("/cadastros/fornecedores", msg);
}

// ---------------- CDs (administrador) ----------------
const schemaCD = z.object({
  codigo: z.string().trim().min(1, "Informe o código do CD.").max(20).transform((v) => v.toUpperCase()),
  nome: z.string().trim().min(2, "Informe o nome do CD.").max(120),
  cidade: opcional(120),
  responsavel: opcional(120),
});

export async function salvarCD(_: Estado, form: FormData): Promise<Estado> {
  let msg: string;
  try {
    const admin = await requireAdmin();
    const id = lerId(form);
    const d = schemaCD.parse(Object.fromEntries(form));
    const duplicado = await prisma.centroDistribuicao.findUnique({ where: { codigo: d.codigo } });
    if (duplicado && duplicado.id !== id) throw new ErroNegocio(`Já existe um CD com o código ${d.codigo}.`);
    const cd = id
      ? await prisma.centroDistribuicao.update({ where: { id }, data: d })
      : await prisma.centroDistribuicao.create({ data: d });
    await auditar(prisma, { acao: id ? "EDITAR_CD" : "CRIAR_CD", entidade: "CentroDistribuicao", entidadeId: cd.id, usuarioId: admin.id, detalhes: d });
    msg = `CD ${cd.codigo} ${id ? "atualizado" : "cadastrado"}.`;
  } catch (e) {
    return tratarErro(e);
  }
  concluir("/cadastros/cds", msg);
}

// ---------------- Usuários (administrador) ----------------
const schemaUsuario = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(120),
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/, "Login deve ter 3 a 40 caracteres (letras, números, ponto, hífen)."),
  perfil: z.enum(["ADMIN", "OPERADOR"]),
  senha: z.string().optional(),
});

export async function salvarUsuario(_: Estado, form: FormData): Promise<Estado> {
  let msg: string;
  try {
    const admin = await requireAdmin();
    const id = lerId(form);
    const d = schemaUsuario.parse(Object.fromEntries(form));
    const podeAdicionarPallets = form.get("podeAdicionarPallets") === "on";
    const senha = d.senha ?? "";
    if ((!id || senha) && senha.length < 6) return falha("A senha deve ter ao menos 6 caracteres.");
    if (id === admin.id && d.perfil !== "ADMIN") return falha("Você não pode remover o próprio perfil de administrador.");
    const existente = await prisma.usuario.findUnique({ where: { login: d.login } });
    if (existente && existente.id !== id) throw new ErroNegocio(`O login "${d.login}" já está em uso.`);

    const dados = {
      nome: d.nome,
      login: d.login,
      perfil: d.perfil,
      podeAdicionarPallets,
      ...(senha ? { senhaHash: await bcrypt.hash(senha, 10) } : {}),
    };
    const u = id
      ? await prisma.usuario.update({ where: { id }, data: dados })
      : await prisma.usuario.create({ data: { ...dados, senhaHash: dados.senhaHash! } });
    await auditar(prisma, {
      acao: id ? "EDITAR_USUARIO" : "CRIAR_USUARIO",
      entidade: "Usuario",
      entidadeId: u.id,
      usuarioId: admin.id,
      detalhes: { login: d.login, perfil: d.perfil, podeAdicionarPallets, senhaAlterada: !!senha },
    });
    msg = `Usuário ${u.login} ${id ? "atualizado" : "criado"}.`;
  } catch (e) {
    return tratarErro(e);
  }
  concluir("/cadastros/usuarios", msg);
}

// ---------------- Ativar / inativar ----------------
const entidades = {
  transportadora: { caminho: "/cadastros/transportadoras", admin: false },
  fornecedor: { caminho: "/cadastros/fornecedores", admin: false },
  cd: { caminho: "/cadastros/cds", admin: true },
  usuario: { caminho: "/cadastros/usuarios", admin: true },
} as const;

export async function alternarAtivo(_: Estado, form: FormData): Promise<Estado> {
  let msg: string;
  const tipo = String(form.get("tipo")) as keyof typeof entidades;
  const cfg = entidades[tipo];
  try {
    if (!cfg) throw new ErroNegocio("Cadastro inválido.");
    const u = cfg.admin ? await requireAdmin() : await requireUsuario();
    const id = String(form.get("id"));
    let nome: string;
    let ativo: boolean;
    switch (tipo) {
      case "transportadora": {
        const r = await prisma.transportadora.findUniqueOrThrow({ where: { id } });
        await prisma.transportadora.update({ where: { id }, data: { ativo: !r.ativo } });
        [nome, ativo] = [r.nome, r.ativo];
        break;
      }
      case "fornecedor": {
        const r = await prisma.fornecedor.findUniqueOrThrow({ where: { id } });
        await prisma.fornecedor.update({ where: { id }, data: { ativo: !r.ativo } });
        [nome, ativo] = [r.nome, r.ativo];
        break;
      }
      case "cd": {
        const r = await prisma.centroDistribuicao.findUniqueOrThrow({ where: { id } });
        await prisma.centroDistribuicao.update({ where: { id }, data: { ativo: !r.ativo } });
        [nome, ativo] = [r.codigo, r.ativo];
        break;
      }
      case "usuario": {
        if (id === u.id) throw new ErroNegocio("Você não pode inativar o próprio usuário.");
        const r = await prisma.usuario.findUniqueOrThrow({ where: { id } });
        await prisma.usuario.update({ where: { id }, data: { ativo: !r.ativo } });
        [nome, ativo] = [r.login, r.ativo];
        break;
      }
    }
    await auditar(prisma, { acao: `${ativo ? "INATIVAR" : "ATIVAR"}_${tipo.toUpperCase()}`, entidade: tipo, entidadeId: id, usuarioId: u.id });
    msg = `${nome} ${ativo ? "inativado" : "ativado"}.`;
  } catch (e) {
    return tratarErro(e);
  }
  concluir(cfg.caminho, msg);
}
