"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigir } from "./guarda";
import { comContaBloqueada, ErroNegocio, lancar } from "@/lib/conta";
import { formatarNumero } from "@/lib/formatos";
import { sucesso, tratarErro, type Estado } from "./estado";

const schema = z.object({
  cdId: z.string().min(1, "Selecione o CD."),
  quantidade: z.coerce.number({ message: "Informe a quantidade." }).int("Quantidade deve ser inteira.").positive("Quantidade deve ser maior que zero."),
  observacao: z.string().trim().max(500).optional(),
});

async function movimentarCD(form: FormData, tipo: "ENVIO_CD" | "RECEBIMENTO_CD"): Promise<Estado> {
  try {
    const usuario = await exigir("cd");
    const dados = schema.parse(Object.fromEntries(form));
    const cd = await comContaBloqueada(async (tx) => {
      const cd = await tx.centroDistribuicao.findUnique({ where: { id: dados.cdId } });
      if (!cd || !cd.ativo) throw new ErroNegocio("CD inválido ou inativo.");
      await lancar(tx, { tipo, quantidade: dados.quantidade, usuarioId: usuario.id, cdId: cd.id, observacao: dados.observacao });
      return cd;
    });
    revalidatePath("/", "layout");
    return sucesso(
      tipo === "ENVIO_CD"
        ? `${formatarNumero(dados.quantidade)} pallet(s) transferidos: Estoque de Vazios → Estoque do CD (${cd.codigo}).`
        : `${formatarNumero(dados.quantidade)} pallet(s) retornados: Estoque do CD (${cd.codigo}) → Estoque de Vazios.`,
    );
  } catch (e) {
    return tratarErro(e);
  }
}

export async function enviarParaCD(_: Estado, form: FormData) {
  return movimentarCD(form, "ENVIO_CD");
}

export async function receberDoCD(_: Estado, form: FormData) {
  return movimentarCD(form, "RECEBIMENTO_CD");
}
