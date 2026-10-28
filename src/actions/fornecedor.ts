"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirGlobal, exigirModuloFornecedor } from "./guarda";
import { auditar, comContaBloqueada, ErroNegocio, lancar } from "@/lib/conta";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { formatarDataHora } from "@/lib/datas";
import { cnpjValido, emailValido, formatarCnpj, normalizarCnpj, telefoneValido, normalizarPlaca, numeroVale, placaValida, rotuloStatusVale } from "@/lib/formatos";
import { lerChaveNFe } from "@/lib/nfe";
import { sucesso, tratarErro, type Estado } from "./estado";

const vazioNulo = (v: string | undefined) => (v ?? "").trim() || null;
// Cadastro rápido (aberto pela NF-e): o CNPJ vem da nota; Sigla e Nome obrigatórios, o resto opcional.
const schemaCadastro = z.object({
  cnpj: z.string().refine(cnpjValido, "CNPJ inválido."),
  sigla: z
    .string({ message: "Informe a sigla." })
    .trim()
    .min(2, "Informe a sigla (mínimo 2 caracteres).")
    .max(20)
    .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
  nome: z.string({ message: "Informe o nome do fornecedor." }).trim().min(2, "Informe o nome do fornecedor.").max(200),
  contato: z.string().max(120).optional().transform(vazioNulo),
  telefone: z.string().optional().transform(vazioNulo).refine((v) => !v || telefoneValido(v), "Telefone inválido (informe DDD + número)."),
  email: z.string().max(160).optional().transform(vazioNulo).refine((v) => !v || emailValido(v), "E-mail inválido."),
});


/**
 * Cadastro de fornecedor aberto automaticamente quando o CNPJ digitado (entrada)
 * ou lido na NF (compra) não existe. Disponível a todos os usuários, como a aba Fornecedores.
 */
export async function cadastrarFornecedorRapido(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigirGlobal("fornecedor", "compras", "cadastros");
    const d = schemaCadastro.parse(Object.fromEntries(form));
    const cnpj = normalizarCnpj(d.cnpj);
    if (await prisma.fornecedor.findUnique({ where: { cnpj } })) throw new ErroNegocio("Fornecedor já cadastrado.");
    const siglaDup = await prisma.fornecedor.findUnique({ where: { sigla: d.sigla } });
    if (siglaDup) throw new ErroNegocio(`Já existe um fornecedor com a sigla ${d.sigla} (${siglaDup.nome}).`);
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

// ---------------- Recebimento de fornecedor (gera o Vale-Pallet) ----------------

export type IdentificacaoNf =
  | {
      ok: true;
      chave: string;
      cnpj: string;
      cnpjFormatado: string;
      notaFiscal: string;
      serie: string;
      fornecedor: { nome: string; ativo: boolean } | null;
    }
  | { ok: false; erro: string };

/**
 * Lê a chave de acesso (código de barras do DANFE): valida, extrai CNPJ do emitente
 * e número/série da NF, impede NF já recebida e localiza o fornecedor no cadastro.
 */
export async function identificarNfRecebimento(leitura: string): Promise<IdentificacaoNf> {
  try {
    await exigirModuloFornecedor();
    const nfe = lerChaveNFe(leitura);
    const existente = await prisma.valePallet.findUnique({
      where: { chaveNfe: nfe.chave },
      select: { numero: true, criadoEm: true, status: true },
    });
    if (existente) {
      return {
        ok: false,
        erro: `Esta NF já foi recebida: ${numeroVale(existente.numero, "FORNECEDOR")} emitido em ${formatarDataHora(existente.criadoEm)} (${rotuloStatusVale[existente.status]}).`,
      };
    }
    const f = await prisma.fornecedor.findUnique({ where: { cnpj: nfe.cnpj }, select: { nome: true, ativo: true } });
    return {
      ok: true,
      chave: nfe.chave,
      cnpj: nfe.cnpj,
      cnpjFormatado: formatarCnpj(nfe.cnpj),
      notaFiscal: nfe.numero,
      serie: nfe.serie,
      fornecedor: f,
    };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível ler a chave da NF-e." };
  }
}

const operacionais = {
  transportadoraId: z.string({ message: "Selecione a transportadora." }).min(1, "Selecione a transportadora."),
  placa: z.string().refine(placaValida, "Placa inválida (use ABC-1234 ou ABC1D23)."),
  quantidade: z.coerce.number({ message: "Informe a quantidade." }).int("Quantidade deve ser inteira.").positive("Quantidade deve ser maior que zero."),
  conferente: z.string().trim().min(2, "Informe o conferente.").max(120),
  observacao: z.string().trim().max(500).optional(),
};

const schema = z.discriminatedUnion("modo", [
  // Com NF: CNPJ, número e série vêm SEMPRE da chave (parse no servidor, não confia no navegador).
  z.object({ modo: z.literal("NF"), chave: z.string().min(1, "Leia o código de barras da NF-e."), ...operacionais }),
  z.object({ modo: z.literal("SEM_NF"), fornecedorId: z.string({ message: "Selecione o fornecedor." }).min(1, "Selecione o fornecedor."), ...operacionais }),
], { message: "Selecione se o recebimento tem ou não nota fiscal." });

export async function registrarRecebimentoFornecedor(_: Estado, form: FormData): Promise<Estado> {
  let valeId: string;
  try {
    const usuario = await exigirModuloFornecedor();
    const d = schema.parse(Object.fromEntries(form));
    const nfe = d.modo === "NF" ? lerChaveNFe(d.chave) : null;
    const rotulo = nfe ? `NF ${nfe.numero}` : "SEM NOTA FISCAL";

    valeId = await comContaBloqueada(async (tx) => {
      // Fornecedor e transportadora vêm sempre do cadastro (nada é digitado livremente):
      // com NF, pelo CNPJ emitente da chave; sem NF, pela lista de fornecedores ativos.
      const fornecedor = nfe
        ? await tx.fornecedor.findUnique({ where: { cnpj: nfe.cnpj } })
        : await tx.fornecedor.findUnique({ where: { id: d.modo === "SEM_NF" ? d.fornecedorId : "" } });
      if (!fornecedor) throw new ErroNegocio(nfe ? "CNPJ não cadastrado. Cadastre o fornecedor antes de gerar o vale." : "Fornecedor não encontrado. Selecione um fornecedor cadastrado.");
      const transportadora = await tx.transportadora.findUnique({ where: { id: d.transportadoraId } });
      if (!transportadora || !transportadora.ativo) throw new ErroNegocio("Transportadora inválida ou inativa. Selecione uma transportadora cadastrada.");
      if (!fornecedor.ativo) throw new ErroNegocio(`O fornecedor ${fornecedor.nome} está inativo. Reative-o em Cadastros.`);
      if (nfe && (await tx.valePallet.findUnique({ where: { chaveNfe: nfe.chave }, select: { id: true } }))) {
        throw new ErroNegocio("Esta NF já foi recebida e possui vale-pallet.");
      }
      const vale = await tx.valePallet.create({
        data: {
          tipo: "FORNECEDOR",
          cdId: usuario.cd.id,
          fornecedorId: fornecedor.id,
          transportadora: transportadora.nome,
          placa: normalizarPlaca(d.placa),
          notaFiscal: nfe?.numero ?? null,
          serieNf: nfe?.serie ?? null,
          chaveNfe: nfe?.chave ?? null,
          semNotaFiscal: !nfe,
          conferente: d.conferente,
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
        cdId: usuario.cd.id,
        observacao: nfe ? `NF ${nfe.numero} série ${nfe.serie}` : "Recebimento SEM NOTA FISCAL",
        quantidade: d.quantidade,
        detalhes: {
          numero: vale.numero,
          fornecedor: fornecedor.nome,
          quantidade: d.quantidade,
          notaFiscal: nfe?.numero ?? null,
          chaveNfe: nfe?.chave ?? null,
          semNotaFiscal: !nfe,
          conferente: d.conferente,
        },
      });
      // O vale de fornecedor sobe o saldo do CD com o fornecedor (Fornecedor → Carga);
      // os vazios só mudam na baixa/pagamento.
      await lancar(tx, {
        tipo: "RECEBIMENTO_FORNECEDOR",
        quantidade: d.quantidade,
        usuarioId: usuario.id,
        cdId: usuario.cd.id,
        fornecedorId: fornecedor.id,
        valeId: vale.id,
        observacao: `${rotulo} - ${transportadora.nome} - ${normalizarPlaca(d.placa)}`,
      });
      return vale.id;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return tratarErro(new ErroNegocio("Esta NF já foi recebida e possui vale-pallet."));
    }
    return tratarErro(e);
  }
  revalidatePath("/", "layout");
  // Abre o layout de impressão A4 (2 vias) automaticamente.
  redirect(`/imprimir/vale/${valeId}?auto=1`);
}
