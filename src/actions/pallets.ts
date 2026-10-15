"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { exigir, exigirAdminCD, exigirMaster } from "./guarda";
import { auditar, comContaBloqueada, ErroNegocio, lancar, ROTULO_CONTA } from "@/lib/conta";
import { formatarDataHora } from "@/lib/datas";
import { formatarCnpj, formatarNumero, MOTIVOS_INCLUSAO, numeroVale, rotuloTipoUnidade } from "@/lib/formatos";
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
      `Compra registrada: ${formatarNumero(compra.quantidade)} pallet(s) da NF ${compra.notaFiscal} (${compra.fornecedor.nome}) adicionados ao Estoque de Vazios.`,
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return tratarErro(new ErroNegocio("Esta NF já foi lançada."));
    }
    return tratarErro(e);
  }
}

// ---------------- Inclusão manual de vazios (MASTER / ADMIN) ----------------

const schemaInclusaoVazios = z.object({
  motivo: z.enum(["COMPRA", "ESTORNO", "DEVOLUCAO"], { message: "Selecione o motivo (Compra, Estorno ou Devolução)." }),
  quantidade,
  observacao: z.string().trim().min(10, "Detalhe a inclusão na observação (mínimo 10 caracteres).").max(500),
});

/**
 * Sobe o pulmão de vazios do CD ativo (Ajuste → Vazios) com motivo e observação.
 * Devolução de CD ou Ponto de Cross deve ser feita pela conferência de retorno,
 * que também baixa o saldo devedor.
 */
export async function incluirVazios(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigirAdminCD();
    const d = schemaInclusaoVazios.parse(Object.fromEntries(form));
    await comContaBloqueada((tx) =>
      lancar(tx, {
        tipo: "INCLUSAO_VAZIOS",
        quantidade: d.quantidade,
        usuarioId: u.id,
        cdId: u.cd.id,
        motivo: d.motivo,
        observacao: `${MOTIVOS_INCLUSAO[d.motivo]} - ${d.observacao}`,
      }),
    );
    revalidatePath("/", "layout");
    return sucesso(`+${formatarNumero(d.quantidade)} pallet(s) incluídos no Estoque de Vazios de ${u.cd.codigo} (motivo: ${MOTIVOS_INCLUSAO[d.motivo]}).`);
  } catch (e) {
    return tratarErro(e);
  }
}

// ---------------- Inclusão manual de saldo devedor (MASTER / ADMIN) ----------------

const schemaInclusaoDevedor = z.object({
  unidadeId: z.string().min(1, "Selecione o CD ou Ponto de Cross."),
  quantidade,
  observacao: z.string().trim().min(5, "A observação é obrigatória (mínimo 5 caracteres).").max(500),
  justificativa: z.string().trim().min(10, "A justificativa é obrigatória (mínimo 10 caracteres).").max(500),
});

/**
 * Inclui saldo devedor para um CD destino ou Ponto de Cross (Ajuste → Custódia) e
 * emite um Vale de Ajuste pendente, que poderá ser baixado na conferência de retorno.
 * Para reduzir o saldo, exclua o vale correspondente em Excluir Vale.
 */
export async function incluirSaldoDevedor(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigirAdminCD();
    const d = schemaInclusaoDevedor.parse(Object.fromEntries(form));
    const r = await comContaBloqueada(async (tx) => {
      const unidade = await tx.centroDistribuicao.findUnique({ where: { id: d.unidadeId } });
      if (!unidade || !unidade.ativo) throw new ErroNegocio("CD ou Ponto de Cross inválido ou inativo.");
      if (unidade.id === u.cd.id) throw new ErroNegocio("O saldo devedor não pode ser do próprio CD de operação.");
      const vale = await tx.valePallet.create({
        data: {
          tipo: "AJUSTE",
          cdId: u.cd.id,
          unidadeId: unidade.id,
          quantidade: d.quantidade,
          observacao: `${d.observacao} | Justificativa: ${d.justificativa}`,
          criadoPorId: u.id,
        },
      });
      await auditar(tx, {
        acao: "INCLUIR_SALDO_DEVEDOR",
        entidade: "ValePallet",
        entidadeId: vale.id,
        usuarioId: u.id,
        cdId: u.cd.id,
        destino: "CUSTODIA",
        quantidade: d.quantidade,
        observacao: d.justificativa,
        detalhes: { numero: vale.numero, unidade: `${unidade.codigo} - ${unidade.nome}`, observacao: d.observacao, justificativa: d.justificativa },
      });
      await lancar(tx, {
        tipo: "INCLUSAO_DEVEDOR",
        quantidade: d.quantidade,
        usuarioId: u.id,
        cdId: u.cd.id,
        unidadeId: unidade.id,
        valeId: vale.id,
        observacao: `${numeroVale(vale.numero, "AJUSTE")} - ${d.observacao} - Justificativa: ${d.justificativa}`,
      });
      return { vale, unidade };
    });
    revalidatePath("/", "layout");
    return sucesso(
      `Saldo devedor de ${rotuloTipoUnidade[r.unidade.tipo]} ${r.unidade.codigo} +${formatarNumero(d.quantidade)} (${numeroVale(r.vale.numero, "AJUSTE")}).`,
    );
  } catch (e) {
    return tratarErro(e);
  }
}

// ---------------- Correção de inventário (MASTER) ----------------

const schemaAjuste = z.object({
  estoque: z.enum(["VAZIOS", "QUEBRADOS"], { message: "Selecione o estoque." }),
  sentido: z.enum(["INCLUIR", "REMOVER"], { message: "Selecione incluir ou remover." }),
  quantidade,
  justificativa: z.string().trim().min(10, "Justificativa obrigatória (mínimo 10 caracteres).").max(500),
});

/**
 * Correção de inventário (inclusão ou remoção) nos estoques físicos do CD ativo.
 * Exclusiva do MASTER; a contrapartida é a conta AJUSTE e a justificativa vai para a auditoria.
 */
export async function ajustarInventario(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigirMaster();
    const d = schemaAjuste.parse(Object.fromEntries(form));
    const incluir = d.sentido === "INCLUIR";
    await comContaBloqueada((tx) =>
      lancar(tx, {
        tipo: incluir ? "AJUSTE_ENTRADA" : "AJUSTE_SAIDA",
        quantidade: d.quantidade,
        origem: incluir ? "AJUSTE" : d.estoque,
        destino: incluir ? d.estoque : "AJUSTE",
        observacao: d.justificativa,
        usuarioId: u.id,
        cdId: u.cd.id,
      }),
    );
    revalidatePath("/", "layout");
    return sucesso(
      `Correção registrada em ${u.cd.codigo}: ${incluir ? "+" : "−"}${formatarNumero(d.quantidade)} pallet(s) no ${ROTULO_CONTA[d.estoque]}.`,
    );
  } catch (e) {
    return tratarErro(e);
  }
}
