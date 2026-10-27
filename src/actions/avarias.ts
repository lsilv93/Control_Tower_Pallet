"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigir, exigirUnidade } from "./guarda";
import { auditar, comContaBloqueada, ErroNegocio, lancar, saldosPorConta } from "@/lib/conta";
import { formatarNumero } from "@/lib/formatos";
import { travaReparo } from "@/lib/reparo";
import { sucesso, tratarErro, type Estado } from "./estado";

const quantidade = z.coerce
  .number({ message: "Informe a quantidade." })
  .int("Quantidade deve ser inteira.")
  .positive("Quantidade deve ser maior que zero.");

const observacaoObrigatoria = z.string().trim().min(5, "A observação é obrigatória (mínimo 5 caracteres).").max(500);

/** Lançar quebrado: pallets bons → quebrados na unidade ativa (sem deixar saldo negativo). */
export async function registrarQuebra(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigir("quebras");
    const d = z.object({ quantidade, observacao: observacaoObrigatoria }).parse(Object.fromEntries(form));
    await comContaBloqueada((tx) =>
      lancar(tx, { tipo: "QUEBRA", quantidade: d.quantidade, observacao: d.observacao, usuarioId: u.id, cdId: u.cd.id }, u.cd.codigo),
    );
    revalidatePath("/", "layout");
    return sucesso(`${formatarNumero(d.quantidade)} pallet(s) lançados como quebrados em ${u.cd.codigo}: bons → quebrados.`);
  } catch (e) {
    return tratarErro(e);
  }
}

const schemaReparo = z
  .object({
    recuperados: quantidade,
    usouOutros: z.enum(["SIM", "NAO"], { message: "Informe se foi necessário utilizar outros pallets quebrados no reparo." }),
    utilizados: z.coerce.number().int("Quantidade deve ser inteira.").min(0).optional(),
    observacao: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.usouOutros === "NAO" || (d.utilizados ?? 0) > 0, {
    message: "Informe a quantidade de pallets utilizados/destruídos no reparo.",
  });

/**
 * Conserto / reparo. Recuperados: Quebrados → Vazios. Se outros quebrados foram
 * desmontados para o reparo, eles saem de Quebrados para Descarte (destruídos).
 * Tudo na mesma transação, com a trava validada sobre o saldo travado do CD.
 */
export async function registrarReparo(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigir("reparo");
    if (!u.cd.hub) throw new ErroNegocio("O conserto/reparo de pallets é feito no CD Hub (CDJC).");
    const d = schemaReparo.parse(Object.fromEntries(form));
    const utilizados = d.usouOutros === "SIM" ? (d.utilizados ?? 0) : 0;
    const observacao = d.observacao || null;
    await comContaBloqueada(async (tx) => {
      const saldo = (await saldosPorConta(tx, u.cd.id)).QUEBRADOS;
      const erro = travaReparo(saldo, d.recuperados, utilizados);
      if (erro) throw new ErroNegocio(erro);
      await lancar(tx, {
        tipo: "RECUPERADO",
        quantidade: d.recuperados,
        usuarioId: u.id,
        cdId: u.cd.id,
        observacao: `Reparo${utilizados ? ` (${utilizados} pallet(s) utilizados)` : ""}${observacao ? ` - ${observacao}` : ""}`,
      });
      if (utilizados) {
        await lancar(tx, {
          tipo: "CANIBALIZACAO",
          quantidade: utilizados,
          usuarioId: u.id,
          cdId: u.cd.id,
          observacao: `Utilizados/desmontados no reparo de ${d.recuperados} pallet(s)${observacao ? ` - ${observacao}` : ""}`,
        });
      }
      await auditar(tx, {
        acao: "REPARO_QUEBRADOS",
        entidade: "Movimentacao",
        usuarioId: u.id,
        cdId: u.cd.id,
        origem: "QUEBRADOS",
        quantidade: d.recuperados + utilizados,
        observacao,
        detalhes: { saldoQuebradosAntes: saldo, recuperados: d.recuperados, utilizados, saldoQuebradosDepois: saldo - d.recuperados - utilizados },
      });
    });
    revalidatePath("/", "layout");
    return sucesso(
      utilizados
        ? `Reparo registrado: ${formatarNumero(d.recuperados)} recuperado(s) voltaram aos Vazios e ${formatarNumero(utilizados)} utilizado(s) foram para Descartados. Quebrados −${formatarNumero(d.recuperados + utilizados)}.`
        : `${formatarNumero(d.recuperados)} pallet(s) consertados: Estoque de Quebrados → Estoque de Vazios.`,
    );
  } catch (e) {
    return tratarErro(e);
  }
}

/**
 * Descarte / destruição (todos os usuários): o usuário escolhe no pop-up de qual estoque
 * os pallets saem. Registro definitivo: não pode ser removido nem estornado.
 */
export async function registrarDescarte(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigirUnidade();
    const d = z.object({ quantidade, observacao: observacaoObrigatoria }).parse(Object.fromEntries(form));
    const origem = z
      .enum(["VAZIOS", "QUEBRADOS"], { message: "Selecione de qual pulmão o pallet será descartado." })
      .parse(form.get("origem"));
    await comContaBloqueada((tx) =>
      lancar(tx, { tipo: "DESCARTE", quantidade: d.quantidade, observacao: d.observacao, usuarioId: u.id, cdId: u.cd.id, origem }, u.cd.codigo),
    );
    revalidatePath("/", "layout");
    return sucesso(
      `${formatarNumero(d.quantidade)} pallet(s) ${origem === "VAZIOS" ? "bons" : "quebrados"} descartados em ${u.cd.codigo}. Registro definitivo (consulte em Pallets Descartados).`,
    );
  } catch (e) {
    return tratarErro(e);
  }
}
