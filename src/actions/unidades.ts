"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigir } from "./guarda";
import { auditar, comContaBloqueada, ErroNegocio, lancar, TIPOS_VALE_DEVEDOR } from "@/lib/conta";
import { formatarNumero, normalizarPlaca, numeroRetorno, numeroVale, placaValida, rotuloTipoUnidade } from "@/lib/formatos";
import { tratarErro, type Estado } from "./estado";

const quantidade = (msg = "Informe a quantidade.") =>
  z.coerce.number({ message: msg }).int("Quantidade deve ser inteira.").positive("Quantidade deve ser maior que zero.");
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

// ---------------- Envio para CD / Ponto de Cross ----------------

const schemaEnvio = z.object({
  tipoDestino: z.enum(["CD", "CROSS"]),
  unidadeId: z.string().min(1, "Selecione o destino."),
  quantidade: quantidade(),
  transportadoraId: z.string().min(1, "Selecione o transportador."),
  // Somente no envio para Ponto de Cross (opcionais).
  rota: opcional(60),
  dataFaturamento: z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data de faturamento inválida."),
  placa: z
    .string()
    .optional()
    .transform((v) => (v ? normalizarPlaca(v) : null))
    .refine((v) => !v || placaValida(v), "Placa inválida (use ABC-1234 ou ABC1D23)."),
  observacao: opcional(500),
});

/**
 * Envio para CD / Ponto de Cross: gera o Vale-Pallet de Envio. NÃO subtrai do
 * Estoque de Vazios; apenas soma no saldo devedor do destino (Carga → Custódia).
 */
export async function enviarParaUnidade(_: Estado, form: FormData): Promise<Estado> {
  let valeId: string;
  try {
    const u = await exigir("cd");
    const d = schemaEnvio.parse(Object.fromEntries(form));
    const cross = d.tipoDestino === "CROSS";
    // Rota, faturamento e placa só existem no envio para Ponto de Cross.
    const placa = cross ? d.placa : null;
    const rota = cross ? d.rota : null;
    const dataFaturamento = cross && d.dataFaturamento ? new Date(`${d.dataFaturamento}T00:00:00Z`) : null;
    valeId = await comContaBloqueada(async (tx) => {
      const destino = await tx.centroDistribuicao.findUnique({ where: { id: d.unidadeId } });
      if (!destino || !destino.ativo || destino.tipo !== d.tipoDestino) {
        throw new ErroNegocio(`${rotuloTipoUnidade[d.tipoDestino]} de destino inválido ou inativo.`);
      }
      if (destino.id === u.cd.id) throw new ErroNegocio("O destino não pode ser o próprio CD de operação.");
      const transportadora = await tx.transportadora.findUnique({ where: { id: d.transportadoraId } });
      if (!transportadora || !transportadora.ativo) throw new ErroNegocio("Transportador inválido ou inativo. Selecione um transportador cadastrado.");
      const vale = await tx.valePallet.create({
        data: {
          tipo: "ENVIO",
          cdId: u.cd.id,
          unidadeId: destino.id,
          transportadora: transportadora.nome,
          placa,
          rota,
          dataFaturamento,
          quantidade: d.quantidade,
          observacao: d.observacao,
          criadoPorId: u.id,
        },
      });
      await auditar(tx, {
        acao: "GERAR_VALE_ENVIO",
        entidade: "ValePallet",
        entidadeId: vale.id,
        usuarioId: u.id,
        cdId: u.cd.id,
        destino: "CUSTODIA",
        quantidade: d.quantidade,
        observacao: `${numeroVale(vale.numero, "ENVIO")} para ${destino.codigo} - ${destino.nome}`,
        detalhes: { numero: vale.numero, destino: `${destino.codigo} - ${destino.nome}`, tipoDestino: destino.tipo, transportadora: transportadora.nome, placa, rota, dataFaturamento: d.dataFaturamento },
      });
      await lancar(tx, {
        tipo: "ENVIO_UNIDADE",
        quantidade: d.quantidade,
        usuarioId: u.id,
        cdId: u.cd.id,
        unidadeId: destino.id,
        valeId: vale.id,
        observacao: [numeroVale(vale.numero, "ENVIO"), transportadora.nome, placa, rota && `Rota ${rota}`, d.observacao].filter(Boolean).join(" - "),
      });
      return vale.id;
    });
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/", "layout");
  redirect(`/imprimir/vale/${valeId}?auto=1`);
}

// ---------------- Retorno / conferência física ----------------

const schemaRetorno = z.object({
  unidadeId: z.string().min(1, "Selecione o CD ou Ponto de Cross remetente."),
  valeIds: z.array(z.string()).min(1, "Selecione ao menos um vale que está sendo devolvido."),
  quantidadeFisica: quantidade("Informe a quantidade física contada."),
  confirmarFalta: z.boolean(),
  placa: z.string().optional(),
  transportadora: opcional(200),
  observacao: opcional(500),
});

/**
 * Conferência de retorno de CD / Ponto de Cross. Os vales selecionados são baixados
 * e a quantidade física soma no Estoque de Vazios (Custódia → Vazios). Se a contagem
 * física for menor que o total dos vales, a falta exige confirmação, placa,
 * transportadora e justificativa, e gera automaticamente um Vale-Ocorrência com a
 * diferença — que permanece no saldo devedor do remetente.
 */
export async function registrarRetorno(_: Estado, form: FormData): Promise<Estado> {
  let destino: string;
  try {
    const u = await exigir("cd");
    const d = schemaRetorno.parse({
      unidadeId: form.get("unidadeId") ?? "",
      valeIds: [...new Set(form.getAll("valeIds").map(String))],
      quantidadeFisica: form.get("quantidadeFisica"),
      confirmarFalta: form.get("confirmarFalta") === "1",
      placa: form.get("placa") ? String(form.get("placa")) : undefined,
      transportadora: form.get("transportadora") ?? undefined,
      observacao: form.get("observacao") ?? undefined,
    });

    const r = await comContaBloqueada(async (tx) => {
      const unidade = await tx.centroDistribuicao.findUnique({ where: { id: d.unidadeId } });
      if (!unidade) throw new ErroNegocio("CD ou Ponto de Cross inválido.");
      const vales = await tx.valePallet.findMany({ where: { id: { in: d.valeIds } } });
      if (vales.length !== d.valeIds.length) throw new ErroNegocio("Um ou mais vales não foram encontrados.");
      for (const v of vales) {
        const codigo = numeroVale(v.numero, v.tipo);
        if (v.cdId !== u.cd.id) throw new ErroNegocio(`${codigo} pertence a outro CD.`);
        if (!(TIPOS_VALE_DEVEDOR as readonly string[]).includes(v.tipo) || v.unidadeId !== unidade.id) {
          throw new ErroNegocio(`${codigo} não é um vale pendente de ${unidade.codigo}.`);
        }
        if (v.status !== "PENDENTE") throw new ErroNegocio(`${codigo} não está pendente (já baixado ou cancelado).`);
      }
      const total = vales.reduce((s, v) => s + v.quantidade, 0);
      const fisico = d.quantidadeFisica;
      if (fisico > total) {
        throw new ErroNegocio(
          `Quantidade física (${formatarNumero(fisico)}) maior que o total dos vales selecionados (${formatarNumero(total)}). Selecione os demais vales devolvidos ou peça ao administrador a inclusão de saldo.`,
        );
      }
      const falta = total - fisico;
      let placa: string | null = d.placa ? normalizarPlaca(d.placa) : null;
      if (falta > 0) {
        if (!d.confirmarFalta) {
          throw new ErroNegocio(
            `Quantidade física (${formatarNumero(fisico)}) menor que o total dos vales (${formatarNumero(total)}). Confirme a falta de ${formatarNumero(falta)} pallet(s).`,
          );
        }
        if (!placa || !placaValida(placa)) throw new ErroNegocio("Divergência: informe a placa do veículo (ABC1234 ou ABC1D23).");
        if (!d.transportadora || d.transportadora.length < 2) throw new ErroNegocio("Divergência: informe a transportadora.");
        if (!d.observacao || d.observacao.length < 5) throw new ErroNegocio("Divergência: a observação/justificativa é obrigatória (mínimo 5 caracteres).");
      } else if (placa && !placaValida(placa)) {
        placa = null;
      }

      const agora = new Date();
      const retorno = await tx.retornoConferencia.create({
        data: {
          cdId: u.cd.id,
          unidadeId: unidade.id,
          totalVales: total,
          quantidadeFisica: fisico,
          falta,
          placa,
          transportadora: d.transportadora,
          observacao: d.observacao,
          usuarioId: u.id,
        },
      });
      // Baixa dos vales devolvidos (o filtro por status impede baixar o mesmo vale duas vezes).
      const { count } = await tx.valePallet.updateMany({
        where: { id: { in: d.valeIds }, status: "PENDENTE" },
        data: { status: "FINALIZADO", finalizadoEm: agora, retornoId: retorno.id },
      });
      if (count !== d.valeIds.length) throw new ErroNegocio("Alguns vales foram alterados por outro usuário. Atualize a página.");
      const codigos = vales.map((v) => numeroVale(v.numero, v.tipo)).join(", ");
      await lancar(tx, {
        tipo: "RETORNO_UNIDADE",
        quantidade: fisico,
        usuarioId: u.id,
        cdId: u.cd.id,
        unidadeId: unidade.id,
        retornoId: retorno.id,
        observacao: `${numeroRetorno(retorno.numero)} - vales ${codigos}${falta ? ` - falta de ${falta}` : ""}`,
      });

      let ocorrencia: { id: string; numero: number } | null = null;
      if (falta > 0) {
        ocorrencia = await tx.valePallet.create({
          data: {
            tipo: "OCORRENCIA",
            cdId: u.cd.id,
            unidadeId: unidade.id,
            quantidade: falta,
            transportadora: d.transportadora,
            placa,
            retornoOrigemId: retorno.id,
            observacao: `OCORRÊNCIA DE DIVERGÊNCIA FÍSICA na conferência ${numeroRetorno(retorno.numero)}: vales ${codigos} somam ${total}, contagem física ${fisico}, falta de ${falta} pallet(s). ${d.observacao}`,
            criadoPorId: u.id,
          },
          select: { id: true, numero: true },
        });
        await auditar(tx, {
          acao: "GERAR_VALE_OCORRENCIA",
          entidade: "ValePallet",
          entidadeId: ocorrencia.id,
          usuarioId: u.id,
          cdId: u.cd.id,
          origem: "CUSTODIA",
          quantidade: falta,
          observacao: d.observacao,
          detalhes: {
            numero: ocorrencia.numero,
            retorno: numeroRetorno(retorno.numero),
            unidade: `${unidade.codigo} - ${unidade.nome}`,
            totalVales: total,
            quantidadeFisica: fisico,
            falta,
            placa,
            transportadora: d.transportadora,
          },
        });
      }
      await auditar(tx, {
        acao: "CONFERENCIA_RETORNO",
        entidade: "RetornoConferencia",
        entidadeId: retorno.id,
        usuarioId: u.id,
        cdId: u.cd.id,
        origem: "CUSTODIA",
        destino: "VAZIOS",
        quantidade: fisico,
        observacao: d.observacao,
        detalhes: { numero: retorno.numero, unidade: `${unidade.codigo} - ${unidade.nome}`, vales: codigos, totalVales: total, quantidadeFisica: fisico, falta },
      });
      return { retorno, unidade, falta, fisico, ocorrencia };
    });

    destino = r.ocorrencia
      ? `/imprimir/vale/${r.ocorrencia.id}?auto=1`
      : `/retorno?ok=${encodeURIComponent(
          `${numeroRetorno(r.retorno.numero)} registrado: ${formatarNumero(r.fisico)} pallet(s) de ${r.unidade.codigo} somados ao Estoque de Vazios. Sem divergência.`,
        )}`;
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/", "layout");
  redirect(destino);
}
