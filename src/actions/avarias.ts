"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUsuario } from "@/lib/auth";
import { comContaBloqueada, lancar } from "@/lib/conta";
import { formatarNumero } from "@/lib/formatos";
import { sucesso, tratarErro, type Estado } from "./estado";

const quantidade = z.coerce
  .number({ message: "Informe a quantidade." })
  .int("Quantidade deve ser inteira.")
  .positive("Quantidade deve ser maior que zero.");

const comObservacao = z.object({
  quantidade,
  observacao: z.string().trim().min(5, "A observação é obrigatória (mínimo 5 caracteres).").max(500),
});
const semObservacao = z.object({ quantidade, observacao: z.string().trim().max(500).optional() });

async function registrar(form: FormData, tipo: "QUEBRA" | "RECUPERADO" | "DESCARTE", mensagem: string): Promise<Estado> {
  try {
    const usuario = await requireUsuario();
    const d = (tipo === "RECUPERADO" ? semObservacao : comObservacao).parse(Object.fromEntries(form));
    await comContaBloqueada((tx) =>
      lancar(tx, { tipo, quantidade: d.quantidade, observacao: d.observacao, usuarioId: usuario.id }),
    );
    revalidatePath("/", "layout");
    return sucesso(`${formatarNumero(d.quantidade)} pallet(s) ${mensagem}.`);
  } catch (e) {
    return tratarErro(e);
  }
}

export async function registrarQuebra(_: Estado, form: FormData) {
  return registrar(form, "QUEBRA", "apontados como quebrados e retirados do pulmão");
}

export async function registrarRecuperado(_: Estado, form: FormData) {
  return registrar(form, "RECUPERADO", "recuperados e devolvidos ao pulmão");
}

export async function registrarDescarte(_: Estado, form: FormData) {
  return registrar(form, "DESCARTE", "descartados definitivamente");
}
