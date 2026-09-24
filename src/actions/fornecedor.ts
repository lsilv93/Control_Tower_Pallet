"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUsuario } from "@/lib/auth";
import { auditar, comContaBloqueada, lancar } from "@/lib/conta";
import { cnpjValido, normalizarPlaca, placaValida, somenteDigitos } from "@/lib/formatos";
import { tratarErro, type Estado } from "./estado";

const schema = z.object({
  fornecedorNome: z.string().trim().min(2, "Informe o nome do fornecedor.").max(200),
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
    const usuario = await requireUsuario();
    const d = schema.parse(Object.fromEntries(form));
    const cnpj = somenteDigitos(d.cnpj);

    valeId = await comContaBloqueada(async (tx) => {
      const fornecedor = await tx.fornecedor.upsert({
        where: { cnpj },
        update: { nome: d.fornecedorNome },
        create: { cnpj, nome: d.fornecedorNome },
      });
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
