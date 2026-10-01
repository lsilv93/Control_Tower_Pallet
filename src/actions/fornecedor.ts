"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUsuario } from "@/lib/auth";
import { exigir } from "./guarda";
import { auditar, comContaBloqueada, ErroNegocio, lancar } from "@/lib/conta";
import { prisma } from "@/lib/prisma";
import { cnpjValido, normalizarCnpj, normalizarPlaca, placaValida } from "@/lib/formatos";
import { sucesso, tratarErro, type Estado } from "./estado";

export type BuscaFornecedor =
  | { status: "ok"; cnpj: string; nome: string }
  | { status: "inativo"; cnpj: string; nome: string }
  | { status: "nao_encontrado"; cnpj: string }
  | { status: "invalido" };

/** Localiza o fornecedor pelo CNPJ (usado para liberar/preencher o nome na entrada). */
export async function buscarFornecedorPorCnpj(valor: string): Promise<BuscaFornecedor> {
  await requireUsuario();
  if (!cnpjValido(valor)) return { status: "invalido" };
  const cnpj = normalizarCnpj(valor);
  const f = await prisma.fornecedor.findUnique({ where: { cnpj }, select: { nome: true, ativo: true } });
  if (!f) return { status: "nao_encontrado", cnpj };
  return { status: f.ativo ? "ok" : "inativo", cnpj, nome: f.nome };
}

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const schemaCadastro = z.object({
  cnpj: z.string().refine(cnpjValido, "CNPJ inválido."),
  nome: z.string().trim().min(2, "Informe o nome do fornecedor.").max(200),
  endereco: opcional(200),
  cidade: opcional(120),
  uf: opcional(2).transform((v) => (v ? v.toUpperCase() : null)),
  contato: opcional(120),
  telefone: opcional(40),
  email: opcional(160).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido."),
});

/**
 * Cadastro de fornecedor aberto automaticamente quando o CNPJ digitado (entrada)
 * ou lido na NF (compra) não existe. Disponível a todos os usuários, como a aba Fornecedores.
 */
export async function cadastrarFornecedorRapido(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigir("entrada", "compras", "cadastros");
    const d = schemaCadastro.parse(Object.fromEntries(form));
    const cnpj = normalizarCnpj(d.cnpj);
    if (await prisma.fornecedor.findUnique({ where: { cnpj } })) throw new ErroNegocio("Fornecedor já cadastrado.");
    const f = await prisma.fornecedor.create({ data: { ...d, cnpj } });
    await auditar(prisma, {
      acao: "CRIAR_FORNECEDOR",
      entidade: "Fornecedor",
      entidadeId: f.id,
      usuarioId: u.id,
      detalhes: { cnpj, nome: d.nome, origem: String(form.get("origem") ?? "cadastro rápido") },
    });
    revalidatePath("/cadastros/fornecedores");
    return sucesso(`Fornecedor ${f.nome} cadastrado.`);
  } catch (e) {
    return tratarErro(e);
  }
}

const schema = z.object({
  cnpj: z.string().refine(cnpjValido, "CNPJ inválido."),
  transportadora: z.string().trim().min(2, "Informe a transportadora.").max(200),
  placa: z.string().refine(placaValida, "Placa inválida (use ABC1234 ou ABC1D23)."),
  notaFiscal: z.string().trim().min(1, "Informe o número da nota fiscal.").max(50),
  quantidade: z.coerce.number({ message: "Informe a quantidade." }).int("Quantidade deve ser inteira.").positive("Quantidade deve ser maior que zero."),
  observacao: z.string().trim().max(500).optional(),
});

export async function registrarRecebimentoFornecedor(_: Estado, form: FormData): Promise<Estado> {
  let valeId: string;
  try {
    const usuario = await exigir("entrada");
    const d = schema.parse(Object.fromEntries(form));
    const cnpj = normalizarCnpj(d.cnpj);

    valeId = await comContaBloqueada(async (tx) => {
      // O fornecedor vem sempre do cadastro (o nome não é digitado na entrada).
      const fornecedor = await tx.fornecedor.findUnique({ where: { cnpj } });
      if (!fornecedor) throw new ErroNegocio("CNPJ não cadastrado. Cadastre o fornecedor antes de gerar o vale.");
      if (!fornecedor.ativo) throw new ErroNegocio(`O fornecedor ${fornecedor.nome} está inativo. Reative-o em Cadastros.`);
      const vale = await tx.valePallet.create({
        data: {
          fornecedorId: fornecedor.id,
          transportadora: d.transportadora,
          placa: normalizarPlaca(d.placa),
          notaFiscal: d.notaFiscal,
          quantidade: d.quantidade,
          observacao: d.observacao || null,
          criadoPorId: usuario.id,
        },
      });
      await auditar(tx, {
        acao: "GERAR_VALE",
        entidade: "ValePallet",
        entidadeId: vale.id,
        usuarioId: usuario.id,
        detalhes: { numero: vale.numero, fornecedor: fornecedor.nome, quantidade: d.quantidade, notaFiscal: d.notaFiscal },
      });
      await lancar(tx, {
        tipo: "RECEBIMENTO_FORNECEDOR",
        quantidade: d.quantidade,
        usuarioId: usuario.id,
        fornecedorId: fornecedor.id,
        valeId: vale.id,
        observacao: `NF ${d.notaFiscal} - ${d.transportadora} - ${normalizarPlaca(d.placa)}`,
      });
      return vale.id;
    });
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/", "layout");
  // Abre o layout de impressão A4 (2 vias) automaticamente.
  redirect(`/imprimir/vale/${valeId}?auto=1`);
}
