"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUsuario } from "@/lib/auth";
import { auditar, comContaBloqueada, ErroNegocio, lancar } from "@/lib/conta";
import { formatarDataHora } from "@/lib/datas";
import { cnpjValido, formatarCnpj, formatarNumero, normalizarCnpj } from "@/lib/formatos";
import { lerChaveNFe } from "@/lib/nfe";
import { podeAdicionarPallets } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { sucesso, tratarErro, type Estado } from "./estado";

async function exigirPermissao() {
  const u = await requireUsuario();
  if (!podeAdicionarPallets(u)) throw new ErroNegocio("Você não tem permissão para adicionar pallets.");
  return u;
}

export type Identificacao =
  | {
      ok: true;
      chave: string;
      notaFiscal: string;
      serie: string;
      cnpj: string;
      cnpjFormatado: string;
      fornecedor: { id: string; nome: string } | null;
    }
  | { ok: false; erro: string };

/** Interpreta a leitura do código de barras do DANFE e localiza o fornecedor pelo CNPJ do emitente. */
export async function identificarCompra(leitura: string): Promise<Identificacao> {
  try {
    await exigirPermissao();
    const nfe = lerChaveNFe(leitura);
    const existente = await prisma.compra.findUnique({ where: { chaveAcesso: nfe.chave }, include: { usuario: true } });
    if (existente) {
      return {
        ok: false,
        erro: `A NF ${existente.notaFiscal} já foi lançada em ${formatarDataHora(existente.criadoEm)} por ${existente.usuario.login}.`,
      };
    }
    const fornecedor = await prisma.fornecedor.findUnique({ where: { cnpj: nfe.cnpj }, select: { id: true, nome: true } });
    return {
      ok: true,
      chave: nfe.chave,
      notaFiscal: nfe.numero,
      serie: nfe.serie,
      cnpj: nfe.cnpj,
      cnpjFormatado: formatarCnpj(nfe.cnpj),
      fornecedor,
    };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível ler o código." };
  }
}

const schemaFornecedorRapido = z.object({
  cnpj: z.string().refine(cnpjValido, "CNPJ inválido."),
  nome: z.string().trim().min(2, "Informe o nome do fornecedor.").max(200),
  cidade: z.string().trim().max(120).optional(),
  uf: z.string().trim().max(2).optional(),
  contato: z.string().trim().max(120).optional(),
  telefone: z.string().trim().max(40).optional(),
});

/** Cadastro rápido de fornecedor aberto automaticamente quando o CNPJ da NF não está cadastrado. */
export async function cadastrarFornecedorRapido(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigirPermissao();
    const d = schemaFornecedorRapido.parse(Object.fromEntries(form));
    const cnpj = normalizarCnpj(d.cnpj);
    if (await prisma.fornecedor.findUnique({ where: { cnpj } })) throw new ErroNegocio("Fornecedor já cadastrado.");
    const f = await prisma.fornecedor.create({
      data: {
        cnpj,
        nome: d.nome,
        cidade: d.cidade || null,
        uf: d.uf ? d.uf.toUpperCase() : null,
        contato: d.contato || null,
        telefone: d.telefone || null,
      },
    });
    await auditar(prisma, {
      acao: "CRIAR_FORNECEDOR",
      entidade: "Fornecedor",
      entidadeId: f.id,
      usuarioId: u.id,
      detalhes: { cnpj, nome: d.nome, origem: "cadastro rápido (compra)" },
    });
    revalidatePath("/cadastros/fornecedores");
    return sucesso(`Fornecedor ${f.nome} cadastrado.`);
  } catch (e) {
    return tratarErro(e);
  }
}

const quantidade = z.coerce
  .number({ message: "Informe a quantidade." })
  .int("Quantidade deve ser inteira.")
  .positive("Quantidade deve ser maior que zero.");

export async function registrarCompra(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigirPermissao();
    const d = z
      .object({ chave: z.string().min(1, "Leia o código de barras da NF."), quantidade, observacao: z.string().trim().max(500).optional() })
      .parse(Object.fromEntries(form));
    const nfe = lerChaveNFe(d.chave);

    const compra = await comContaBloqueada(async (tx) => {
      const fornecedor = await tx.fornecedor.findUnique({ where: { cnpj: nfe.cnpj } });
      if (!fornecedor) throw new ErroNegocio("Fornecedor da NF não cadastrado.");
      const compra = await tx.compra.create({
        data: {
          chaveAcesso: nfe.chave,
          notaFiscal: nfe.numero,
          serie: nfe.serie,
          fornecedorId: fornecedor.id,
          quantidade: d.quantidade,
          observacao: d.observacao || null,
          usuarioId: u.id,
        },
      });
      await auditar(tx, {
        acao: "REGISTRAR_COMPRA",
        entidade: "Compra",
        entidadeId: compra.id,
        usuarioId: u.id,
        detalhes: { chave: nfe.chave, notaFiscal: nfe.numero, fornecedor: fornecedor.nome, quantidade: d.quantidade },
      });
      await lancar(tx, {
        tipo: "COMPRA",
        quantidade: d.quantidade,
        usuarioId: u.id,
        fornecedorId: fornecedor.id,
        compraId: compra.id,
        observacao: `NF ${nfe.numero} série ${nfe.serie}${d.observacao ? ` - ${d.observacao}` : ""}`,
      });
      return { ...compra, fornecedor };
    });
    revalidatePath("/", "layout");
    return sucesso(
      `Compra registrada: ${formatarNumero(compra.quantidade)} pallet(s) da NF ${compra.notaFiscal} (${compra.fornecedor.nome}) adicionados ao pulmão.`,
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return tratarErro(new ErroNegocio("Esta NF já foi lançada."));
    }
    return tratarErro(e);
  }
}

/** Ajuste de inventário (inclusão manual): apenas quantidade e motivo; auditado. */
export async function ajustarInventario(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigirPermissao();
    const d = z
      .object({ quantidade, motivo: z.string().trim().min(5, "Informe o motivo do ajuste (mínimo 5 caracteres).").max(500) })
      .parse(Object.fromEntries(form));
    await comContaBloqueada((tx) =>
      lancar(tx, { tipo: "AJUSTE_ENTRADA", quantidade: d.quantidade, observacao: d.motivo, usuarioId: u.id }),
    );
    revalidatePath("/", "layout");
    return sucesso(`Ajuste de inventário registrado: +${formatarNumero(d.quantidade)} pallet(s) no pulmão.`);
  } catch (e) {
    return tratarErro(e);
  }
}
