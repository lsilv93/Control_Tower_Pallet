"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { exigir, exigirAdmin } from "./guarda";
import { auditar, comContaBloqueada, ErroNegocio, lancar } from "@/lib/conta";
import { formatarDataHora } from "@/lib/datas";
import { formatarCnpj, formatarNumero, MOTIVOS_INCLUSAO, rotuloUnidade } from "@/lib/formatos";
import { lerChaveNFe } from "@/lib/nfe";
import { prisma } from "@/lib/prisma";
import { sucesso, tratarErro, type Estado } from "./estado";

const exigirPermissao = () => exigir("compras");

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
          cdId: u.cd.id,
        },
      });
      await auditar(tx, {
        acao: "REGISTRAR_COMPRA",
        entidade: "Compra",
        entidadeId: compra.id,
        usuarioId: u.id,
        cdId: u.cd.id,
        detalhes: { chave: nfe.chave, notaFiscal: nfe.numero, fornecedor: fornecedor.nome, quantidade: d.quantidade },
      });
      await lancar(tx, {
        tipo: "COMPRA",
        quantidade: d.quantidade,
        usuarioId: u.id,
        cdId: u.cd.id,
        fornecedorId: fornecedor.id,
        compraId: compra.id,
        observacao: `NF ${nfe.numero} série ${nfe.serie}${d.observacao ? ` - ${d.observacao}` : ""}`,
      });
      return { ...compra, fornecedor };
    });
    revalidatePath("/", "layout");
    return sucesso(
      `Compra registrada: ${formatarNumero(compra.quantidade)} pallet(s) da NF ${compra.notaFiscal} (${compra.fornecedor.nome}) adicionados ao estoque de Pallets PBR.`,
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return tratarErro(new ErroNegocio("Esta NF já foi lançada."));
    }
    return tratarErro(e);
  }
}

// ---------------- Inclusão / remoção manual de saldo (MASTER / ADMIN) ----------------

const estoque = z.enum(["VAZIOS", "QUEBRADOS"], { message: "Selecione o estoque (Pallets PBR ou Pallets Quebrados)." });
const rotuloEstoque = (e: "VAZIOS" | "QUEBRADOS") => (e === "VAZIOS" ? "Pallets PBR" : "Pallets Quebrados");

const schemaInclusao = z.object({
  unidadeId: z.string().min(1, "Selecione o CD ou Ponto de Cross."),
  estoque,
  motivo: z.enum(["COMPRA", "DEVOLUCAO", "AJUSTE_ESTOQUE", "INVENTARIO"], { message: "Selecione o motivo (Compra, Devolução, Ajuste Estoque ou Inventário)." }),
  quantidade,
  observacao: z.string().trim().min(10, "A observação/justificativa é obrigatória (mínimo 10 caracteres).").max(500),
});

/** Inclui saldo de pallets bons ou quebrados em um CD ou Ponto de Cross (Ajuste → estoque), com motivo. */
export async function incluirSaldo(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigirAdmin();
    const d = schemaInclusao.parse(Object.fromEntries(form));
    const unidade = await comContaBloqueada(async (tx) => {
      const unidade = await tx.centroDistribuicao.findUnique({ where: { id: d.unidadeId } });
      if (!unidade || !unidade.ativo) throw new ErroNegocio("Unidade inválida ou inativa.");
      await lancar(tx, {
        tipo: "INCLUSAO_MANUAL",
        destino: d.estoque,
        quantidade: d.quantidade,
        usuarioId: u.id,
        cdId: unidade.id,
        motivo: d.motivo,
        observacao: `${MOTIVOS_INCLUSAO[d.motivo]} - ${d.observacao}`,
      });
      await auditar(tx, {
        acao: "INCLUIR_SALDO",
        entidade: "CentroDistribuicao",
        entidadeId: unidade.id,
        usuarioId: u.id,
        cdId: unidade.id,
        origem: "AJUSTE",
        destino: d.estoque,
        quantidade: d.quantidade,
        observacao: d.observacao,
        detalhes: { unidade: unidade.codigo, motivo: d.motivo },
      });
      return unidade;
    });
    revalidatePath("/", "layout");
    return sucesso(`+${formatarNumero(d.quantidade)} ${rotuloEstoque(d.estoque)} incluídos em ${rotuloUnidade(unidade)} (motivo: ${MOTIVOS_INCLUSAO[d.motivo]}).`);
  } catch (e) {
    return tratarErro(e);
  }
}

const schemaRemocao = z.object({
  unidadeId: z.string().min(1, "Selecione o CD ou Ponto de Cross."),
  estoque,
  quantidade,
  justificativa: z.string().trim().min(10, "A justificativa é obrigatória (mínimo 10 caracteres).").max(500),
  confirmado: z.literal("1", { message: "Confirme a remoção." }),
});

/** Remove saldo de um CD ou Ponto de Cross (estoque → Ajuste), com confirmação; nunca deixa saldo negativo. */
export async function removerSaldo(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigirAdmin();
    const d = schemaRemocao.parse(Object.fromEntries(form));
    const unidade = await comContaBloqueada(async (tx) => {
      const unidade = await tx.centroDistribuicao.findUnique({ where: { id: d.unidadeId } });
      if (!unidade) throw new ErroNegocio("Unidade inválida.");
      await lancar(
        tx,
        { tipo: "REMOCAO_MANUAL", origem: d.estoque, quantidade: d.quantidade, usuarioId: u.id, cdId: unidade.id, observacao: d.justificativa },
        unidade.codigo,
      );
      await auditar(tx, {
        acao: "REMOVER_SALDO",
        entidade: "CentroDistribuicao",
        entidadeId: unidade.id,
        usuarioId: u.id,
        cdId: unidade.id,
        origem: d.estoque,
        destino: "AJUSTE",
        quantidade: d.quantidade,
        observacao: d.justificativa,
        detalhes: { unidade: unidade.codigo, confirmado: true },
      });
      return unidade;
    });
    revalidatePath("/", "layout");
    return sucesso(`−${formatarNumero(d.quantidade)} ${rotuloEstoque(d.estoque)} removidos de ${rotuloUnidade(unidade)}.`);
  } catch (e) {
    return tratarErro(e);
  }
}
