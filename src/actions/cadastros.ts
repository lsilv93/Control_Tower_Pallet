"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CHAVES_PERMISSAO, ehMaster } from "@/lib/permissoes";
import { exigirAdmin, exigirGlobal as exigir, exigirMaster } from "./guarda";
import { auditar, ErroNegocio } from "@/lib/conta";
import { cnpjValido, emailValido, normalizarCnpj, telefoneValido } from "@/lib/formatos";
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

/** Campos padronizados (obrigatórios) dos cadastros de Fornecedor, CD e Ponto de Cross. */
const camposPadrao = {
  nome: z.string().trim().min(2, "Informe o nome.").max(200),
  cnpj,
  contato: z.string().trim().min(2, "Informe o contato responsável.").max(120),
  telefone: z.string().trim().refine(telefoneValido, "Telefone inválido (informe DDD + número)."),
  email: z.string().trim().max(160).refine(emailValido, "E-mail inválido."),
};

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
    const u = await exigir("cadastros");
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
const schemaFornecedor = z.object(camposPadrao);


export async function salvarFornecedor(_: Estado, form: FormData): Promise<Estado> {
  let msg: string;
  try {
    const u = await exigir("cadastros");
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

// ---------------- CDs e Pontos de Cross ----------------
const schemaCD = z.object({
  tipo: z.enum(["CD", "CROSS"]).default("CD"),
  codigo: z
    .string()
    .trim()
    .min(2, "Informe a sigla (ex.: CDJC, CDFT).")
    .max(20)
    .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
  ...camposPadrao,
  cdRegionalId: z
    .string()
    .optional()
    .transform((v) => v || null),
});

export async function salvarCD(_: Estado, form: FormData): Promise<Estado> {
  let msg: string;
  let caminhoCD = "/cadastros/cds";
  try {
    const admin = await exigir("cds");
    const id = lerId(form);
    const d = schemaCD.parse(Object.fromEntries(form));
    caminhoCD = d.tipo === "CROSS" ? "/cadastros/cross" : "/cadastros/cds";
    const duplicado = await prisma.centroDistribuicao.findUnique({ where: { codigo: d.codigo } });
    if (duplicado && duplicado.id !== id) throw new ErroNegocio(`Já existe uma unidade com a sigla ${d.codigo}.`);
    const cnpjDup = await prisma.centroDistribuicao.findUnique({ where: { cnpj: d.cnpj } });
    if (cnpjDup && cnpjDup.id !== id) throw new ErroNegocio(`CNPJ já cadastrado para ${cnpjDup.codigo}.`);
    if (d.tipo === "CROSS") {
      const regional = d.cdRegionalId ? await prisma.centroDistribuicao.findUnique({ where: { id: d.cdRegionalId } }) : null;
      if (!regional || regional.tipo !== "CD") throw new ErroNegocio("Selecione o CD regional ao qual o Ponto de Cross pertence.");
    }
    if (id) {
      // O tipo (CD / Cross) não muda depois do cadastro: o histórico depende dele.
      const atual = await prisma.centroDistribuicao.findUnique({ where: { id } });
      if (!atual) throw new ErroNegocio("Cadastro não encontrado.");
      if (atual.tipo !== d.tipo) throw new ErroNegocio("Não é possível transformar um CD em Ponto de Cross (ou o contrário).");
    }
    const dados = {
      tipo: d.tipo,
      codigo: d.codigo,
      nome: d.nome,
      cnpj: d.cnpj,
      contato: d.contato,
      telefone: d.telefone,
      email: d.email,
      cdRegionalId: d.tipo === "CROSS" ? d.cdRegionalId : null,
    };
    const cd = id ? await prisma.centroDistribuicao.update({ where: { id }, data: dados }) : await prisma.centroDistribuicao.create({ data: dados });
    const rotulo = d.tipo === "CROSS" ? "Ponto de Cross" : "CD";
    await auditar(prisma, {
      acao: `${id ? "EDITAR" : "CRIAR"}_${d.tipo === "CROSS" ? "PONTO_CROSS" : "CD"}`,
      entidade: "CentroDistribuicao",
      entidadeId: cd.id,
      usuarioId: admin.id,
      cdId: cd.id,
      detalhes: dados,
    });
    msg = `${rotulo} ${cd.codigo} ${id ? "atualizado" : "cadastrado"}.`;
  } catch (e) {
    return tratarErro(e);
  }
  concluir(caminhoCD, msg);
}

/**
 * Configurações exclusivas do MASTER na unidade: CD Hub principal (somente um) e
 * liberação do módulo "Recebimento Pallet Fornecedor" (desligado por padrão).
 */
export async function configurarUnidade(_: Estado, form: FormData): Promise<Estado> {
  let msg: string;
  try {
    const master = await exigirMaster();
    const id = String(form.get("id") ?? "");
    const unidade = await prisma.centroDistribuicao.findUnique({ where: { id } });
    if (!unidade || unidade.tipo !== "CD") throw new ErroNegocio("Configuração disponível somente para CDs.");
    const recebimentoFornecedor = form.get("recebimentoFornecedor") === "on";
    const hub = form.get("hub") === "on";
    await prisma.$transaction(async (tx) => {
      // Um único Hub: ao marcar este CD, os demais deixam de ser Hub.
      if (hub && !unidade.hub) await tx.centroDistribuicao.updateMany({ where: { hub: true }, data: { hub: false } });
      if (!hub && unidade.hub) throw new ErroNegocio("Deve existir um CD Hub. Para trocar, marque o novo Hub em outro CD.");
      await tx.centroDistribuicao.update({ where: { id }, data: { recebimentoFornecedor, hub } });
      await auditar(tx, {
        acao: "CONFIGURAR_UNIDADE",
        entidade: "CentroDistribuicao",
        entidadeId: id,
        usuarioId: master.id,
        cdId: id,
        detalhes: { recebimentoFornecedor, hub },
      });
    });
    msg = `${unidade.codigo}: módulo Recebimento Pallet Fornecedor ${recebimentoFornecedor ? "ATIVADO" : "desativado"}${hub ? " · CD Hub (Nível Brasil)" : ""}.`;
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
  perfil: z.enum(["MASTER", "ADMIN", "OPERADOR"]),
  senha: z.string().optional(),
});

export async function salvarUsuario(_: Estado, form: FormData): Promise<Estado> {
  let msg: string;
  try {
    const admin = await exigirAdmin();
    const id = lerId(form);
    const d = schemaUsuario.parse(Object.fromEntries(form));
    // Permissões granulares marcadas (somente chaves conhecidas; usadas pelo perfil OPERADOR).
    const permissoes = form
      .getAll("permissoes")
      .map(String)
      .filter((p): p is (typeof CHAVES_PERMISSAO)[number] => (CHAVES_PERMISSAO as string[]).includes(p));
    // Evita escalonamento: só um MASTER cria/edita outro MASTER.
    const alvo = id ? await prisma.usuario.findUnique({ where: { id }, select: { perfil: true } }) : null;
    if (!ehMaster(admin) && (d.perfil === "MASTER" || alvo?.perfil === "MASTER")) {
      return falha("Somente um usuário MASTER pode criar ou alterar usuários MASTER.");
    }
    const senha = d.senha ?? "";
    if ((!id || senha) && senha.length < 6) return falha("A senha deve ter ao menos 6 caracteres.");
    if (id === admin.id && d.perfil !== admin.perfil) return falha("Você não pode alterar o próprio perfil.");
    const existente = await prisma.usuario.findUnique({ where: { login: d.login } });
    if (existente && existente.id !== id) throw new ErroNegocio(`O login "${d.login}" já está em uso.`);

    // Unidade (CD ou Ponto de Cross) obrigatória para todos os usuários.
    const unidadeId = String(form.get("unidadeId") ?? "");
    const unidade = unidadeId ? await prisma.centroDistribuicao.findUnique({ where: { id: unidadeId }, select: { id: true, codigo: true } }) : null;
    if (!unidade) return falha("Vincule o usuário a um CD ou Ponto de Cross.");

    const dados = {
      nome: d.nome,
      login: d.login,
      perfil: d.perfil,
      permissoes: d.perfil === "OPERADOR" ? permissoes : [],
      unidadeId: unidade.id,
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
      detalhes: { login: d.login, perfil: d.perfil, permissoes, unidade: unidade.codigo, senhaAlterada: !!senha },
    });
    msg = `Usuário ${u.login} ${id ? "atualizado" : "criado"}.`;
  } catch (e) {
    return tratarErro(e);
  }
  concluir("/cadastros/usuarios", msg);
}

// ---------------- Ativar / inativar ----------------
const entidades = {
  transportadora: { caminho: "/cadastros/transportadoras", exigir: () => exigir("cadastros") },
  fornecedor: { caminho: "/cadastros/fornecedores", exigir: () => exigir("cadastros") },
  cd: { caminho: "/cadastros/cds", exigir: () => exigir("cds") },
  usuario: { caminho: "/cadastros/usuarios", exigir: () => exigirAdmin() },
} as const;

export async function alternarAtivo(_: Estado, form: FormData): Promise<Estado> {
  let msg: string;
  let caminho: string = "/cadastros";
  const tipo = String(form.get("tipo")) as keyof typeof entidades;
  const cfg = entidades[tipo];
  try {
    if (!cfg) throw new ErroNegocio("Cadastro inválido.");
    const u = await cfg.exigir();
    const id = String(form.get("id"));
    let nome: string;
    let ativo: boolean;
    caminho = cfg.caminho;
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
        if (r.tipo === "CROSS") caminho = "/cadastros/cross";
        break;
      }
      case "usuario": {
        if (id === u.id) throw new ErroNegocio("Você não pode inativar o próprio usuário.");
        const r = await prisma.usuario.findUniqueOrThrow({ where: { id } });
        if (r.perfil === "MASTER" && !ehMaster(u)) throw new ErroNegocio("Somente um MASTER pode inativar outro MASTER.");
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
  concluir(caminho, msg);
}
