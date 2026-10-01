"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigir } from "./guarda";
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

async function registrar(
  form: FormData,
  tipo: "QUEBRA" | "RECUPERADO" | "DESCARTE",
  mensagem: (qtd: string, origem?: string) => string,
): Promise<Estado> {
  try {
    const usuario = await exigir("avarias");
    const d = (tipo === "RECUPERADO" ? semObservacao : comObservacao).parse(Object.fromEntries(form));
    // Descarte: o usuário escolhe no modal de qual pulmão os pallets saem.
    const origem =
      tipo === "DESCARTE"
        ? z.enum(["VAZIOS", "QUEBRADOS"], { message: "Selecione de qual pulmão o pallet será descartado." }).parse(form.get("origem"))
        : undefined;
    await comContaBloqueada((tx) =>
      lancar(tx, { tipo, quantidade: d.quantidade, observacao: d.observacao, usuarioId: usuario.id, origem }),
    );
    revalidatePath("/", "layout");
    return sucesso(mensagem(formatarNumero(d.quantidade), origem));
  } catch (e) {
    return tratarErro(e);
  }
}

export async function registrarQuebra(_: Estado, form: FormData) {
  return registrar(form, "QUEBRA", (q) => `${q} pallet(s) quebrados: Estoque de Vazios → Estoque de Quebrados.`);
}

export async function registrarRecuperado(_: Estado, form: FormData) {
  return registrar(form, "RECUPERADO", (q) => `${q} pallet(s) consertados: Estoque de Quebrados → Estoque de Vazios.`);
}

export async function registrarDescarte(_: Estado, form: FormData) {
  return registrar(form, "DESCARTE", (q, origem) =>
    `${q} pallet(s) descartados/destruídos do ${origem === "VAZIOS" ? "Pulmão de Vazios" : "Pulmão de Quebrados"}.`,
  );
}
