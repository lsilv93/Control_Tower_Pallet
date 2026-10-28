"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigir, exigirAdmin } from "./guarda";
import { auditar, comContaBloqueada, ErroNegocio, lancar } from "@/lib/conta";
import { formatarNumero, normalizarPlaca, numeroConferencia, numeroVale, placaValida, rotuloUnidade } from "@/lib/formatos";
import { sucesso, tratarErro, type Estado } from "./estado";

const inteiro = (rotulo: string) =>
  z.coerce
    .number({ message: `Informe ${rotulo}.` })
    .int(`${rotulo[0].toUpperCase()}${rotulo.slice(1)} deve ser um número inteiro.`)
    .min(0, `${rotulo[0].toUpperCase()}${rotulo.slice(1)} não pode ser negativa.`);
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const placaOpcional = z
  .string()
  .optional()
  .transform((v) => (v ? normalizarPlaca(v) : null))
  .refine((v) => !v || placaValida(v), "Placa inválida (use ABC-1234 ou ABC1D23).");

// ---------------- Envio entre unidades ----------------

const schemaEnvio = z.object({
  modo: z.enum(["CROSS", "CD", "HUB"]),
  unidadeId: z.string().min(1, "Selecione a unidade de destino."),
  quantidadeBons: inteiro("a quantidade de Pallets PBR").default(0),
  quantidadeQuebrados: inteiro("a quantidade de Pallets Quebrados").default(0),
  transportadoraId: z.string().min(1, "Selecione o transportador."),
  placa: placaOpcional,
  rota: opcional(60),
  dataFaturamento: z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data de faturamento inválida."),
  observacao: opcional(500),
});

/**
 * Envio de pallets (bons e/ou quebrados) da unidade ativa para outra unidade. Sai do
 * estoque da origem (bloqueado se não houver saldo) e fica em trânsito até a conferência
 * no destino. Gera o Vale-Pallet de Envio (ou de Pallets Quebrados, quando vai ao Hub).
 */
export async function enviarPallets(_: Estado, form: FormData): Promise<Estado> {
  let valeId: string;
  try {
    const u = await exigir("envio");
    const d = schemaEnvio.parse(Object.fromEntries(form));
    const total = d.quantidadeBons + d.quantidadeQuebrados;
    if (total <= 0) throw new ErroNegocio("Informe a quantidade de pallets a enviar.");
    if (d.modo === "HUB" && d.quantidadeBons > 0) throw new ErroNegocio("Para o CDJC (Hub) são enviados somente Pallets Quebrados.");
    const dataFaturamento = d.dataFaturamento ? new Date(`${d.dataFaturamento}T00:00:00Z`) : null;

    valeId = await comContaBloqueada(async (tx) => {
      const destino = await tx.centroDistribuicao.findUnique({ where: { id: d.unidadeId } });
      if (!destino || !destino.ativo) throw new ErroNegocio("Unidade de destino inválida ou inativa.");
      if (destino.id === u.cd.id) throw new ErroNegocio("O destino não pode ser a própria unidade.");
      if (d.modo === "CROSS" && destino.tipo !== "CROSS") throw new ErroNegocio("Selecione um Ponto de Cross.");
      if (d.modo === "CD" && destino.tipo !== "CD") throw new ErroNegocio("Selecione um CD.");
      if (d.modo === "HUB" && !destino.hub) throw new ErroNegocio("O destino dos quebrados deve ser o CD Hub (CDJC).");
      if (u.cd.tipo === "CROSS" && destino.tipo !== "CD") throw new ErroNegocio("Pontos de Cross enviam pallets somente para CDs.");
      const transportadora = await tx.transportadora.findUnique({ where: { id: d.transportadoraId } });
      if (!transportadora || !transportadora.ativo) throw new ErroNegocio("Transportador inválido ou inativo. Selecione um transportador cadastrado.");

      const vale = await tx.valePallet.create({
        data: {
          tipo: "ENVIO",
          cdId: u.cd.id,
          unidadeId: destino.id,
          quantidadeBons: d.quantidadeBons,
          quantidadeQuebrados: d.quantidadeQuebrados,
          quantidade: total,
          transportadora: transportadora.nome,
          placa: d.placa,
          rota: d.rota,
          dataFaturamento,
          observacao: d.observacao,
          criadoPorId: u.id,
        },
      });
      const codigo = numeroVale(vale.numero, "ENVIO");
      const obs = [codigo, `para ${rotuloUnidade(destino)}`, transportadora.nome, d.placa, d.rota && `Rota ${d.rota}`, d.observacao].filter(Boolean).join(" - ");
      // Saem do estoque da origem (o lançamento bloqueia se não houver saldo).
      if (d.quantidadeBons > 0) {
        await lancar(tx, { tipo: "ENVIO", origem: "VAZIOS", quantidade: d.quantidadeBons, usuarioId: u.id, cdId: u.cd.id, unidadeId: destino.id, valeId: vale.id, observacao: obs }, u.cd.codigo);
      }
      if (d.quantidadeQuebrados > 0) {
        await lancar(tx, { tipo: "ENVIO", origem: "QUEBRADOS", quantidade: d.quantidadeQuebrados, usuarioId: u.id, cdId: u.cd.id, unidadeId: destino.id, valeId: vale.id, observacao: obs }, u.cd.codigo);
      }
      await auditar(tx, {
        acao: d.modo === "HUB" ? "GERAR_VALE_QUEBRADOS" : "GERAR_VALE_ENVIO",
        entidade: "ValePallet",
        entidadeId: vale.id,
        usuarioId: u.id,
        cdId: u.cd.id,
        destino: "TRANSITO",
        quantidade: total,
        observacao: `${codigo} para ${rotuloUnidade(destino)}`,
        detalhes: {
          numero: vale.numero,
          origem: u.cd.codigo,
          destino: destino.codigo,
          bons: d.quantidadeBons,
          quebrados: d.quantidadeQuebrados,
          transportadora: transportadora.nome,
          placa: d.placa,
          rota: d.rota,
          dataFaturamento: d.dataFaturamento,
        },
      });
      return vale.id;
    });
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/", "layout");
  redirect(`/imprimir/vale/${valeId}?auto=1`);
}

// ---------------- Recebimento / conferência ----------------

const schemaConferencia = z.object({
  remetenteId: z.string().min(1, "Selecione a unidade remetente."),
  valeIds: z.array(z.string()).min(1, "Selecione ao menos um vale recebido."),
  recebidoBons: inteiro("a quantidade de Pallets PBR recebidos"),
  recebidoQuebrados: inteiro("a quantidade de Pallets Quebrados recebidos"),
  confirmarDivergencia: z.boolean(),
  placa: placaOpcional,
  transportadora: opcional(200),
  observacao: opcional(500),
});

/**
 * Conferência de recebimento na unidade ativa: os vales selecionados (todos do mesmo
 * remetente) são baixados e a contagem física entra no estoque da unidade (bons e
 * quebrados). Falta: gera Vale de Ocorrência pendente, a devolver ao remetente. Sobra:
 * entra no estoque e fica registrada num Vale de Ocorrência de sobra.
 */
export async function conferirRecebimento(_: Estado, form: FormData): Promise<Estado> {
  let destinoUrl: string;
  try {
    const u = await exigir("recebimento");
    const d = schemaConferencia.parse({
      remetenteId: form.get("remetenteId") ?? "",
      valeIds: [...new Set(form.getAll("valeIds").map(String))],
      recebidoBons: form.get("recebidoBons"),
      recebidoQuebrados: form.get("recebidoQuebrados") || 0,
      confirmarDivergencia: form.get("confirmarDivergencia") === "1",
      placa: form.get("placa") ? String(form.get("placa")) : undefined,
      transportadora: form.get("transportadora") ?? undefined,
      observacao: form.get("observacao") ?? undefined,
    });

    const r = await comContaBloqueada(async (tx) => {
      const remetente = await tx.centroDistribuicao.findUnique({ where: { id: d.remetenteId } });
      if (!remetente) throw new ErroNegocio("Unidade remetente inválida.");
      const vales = await tx.valePallet.findMany({ where: { id: { in: d.valeIds } } });
      if (vales.length !== d.valeIds.length) throw new ErroNegocio("Um ou mais vales não foram encontrados.");
      for (const v of vales) {
        const codigo = numeroVale(v.numero, v.tipo);
        if (v.tipo !== "ENVIO" || v.unidadeId !== u.cd.id) throw new ErroNegocio(`${codigo} não é um envio destinado a ${u.cd.codigo}.`);
        if (v.cdId !== remetente.id) throw new ErroNegocio(`${codigo} não foi enviado por ${remetente.codigo}.`);
        if (v.status !== "PENDENTE") throw new ErroNegocio(`${codigo} já foi conferido ou cancelado.`);
      }
      const declarado = vales.reduce((s, v) => s + v.quantidade, 0);
      const recebido = d.recebidoBons + d.recebidoQuebrados;
      const diferenca = recebido - declarado;
      if (diferenca !== 0) {
        if (!d.confirmarDivergencia) {
          throw new ErroNegocio(
            `${diferenca < 0 ? "Falta" : "Sobra"} de ${formatarNumero(Math.abs(diferenca))} pallet(s): recebido ${formatarNumero(recebido)} x enviado ${formatarNumero(declarado)}. Confirme a divergência.`,
          );
        }
        if (!d.observacao || d.observacao.length < 5) throw new ErroNegocio("Divergência: a observação/justificativa é obrigatória (mínimo 5 caracteres).");
      }

      const agora = new Date();
      const conferencia = await tx.conferencia.create({
        data: {
          cdId: u.cd.id,
          remetenteId: remetente.id,
          totalDeclarado: declarado,
          recebidoBons: d.recebidoBons,
          recebidoQuebrados: d.recebidoQuebrados,
          diferenca,
          placa: d.placa,
          transportadora: d.transportadora,
          observacao: d.observacao,
          usuarioId: u.id,
        },
      });
      const { count } = await tx.valePallet.updateMany({
        where: { id: { in: d.valeIds }, status: "PENDENTE" },
        data: { status: "FINALIZADO", finalizadoEm: agora, conferenciaId: conferencia.id },
      });
      if (count !== d.valeIds.length) throw new ErroNegocio("Alguns vales foram conferidos por outro usuário. Atualize a página.");

      const codigos = vales.map((v) => numeroVale(v.numero, v.tipo)).join(", ");
      const rc = numeroConferencia(conferencia.numero);
      const base = Math.min(recebido, declarado);
      const falta = Math.max(0, -diferenca);
      const sobra = Math.max(0, diferenca);

      // Livro do remetente: baixa o trânsito; a falta vira ocorrência a devolver.
      if (base > 0) {
        await lancar(tx, { tipo: "BAIXA_TRANSITO", quantidade: base, usuarioId: u.id, cdId: remetente.id, unidadeId: u.cd.id, conferenciaId: conferencia.id, observacao: `${rc} - ${codigos} conferidos em ${u.cd.codigo}` }, remetente.codigo);
      }
      // Livro do recebedor: entra o físico (o declarado como recebido; o excedente como sobra).
      const bonsBase = Math.min(d.recebidoBons, base);
      const quebradosBase = base - bonsBase;
      const sobraBons = d.recebidoBons - bonsBase;
      const sobraQuebrados = d.recebidoQuebrados - quebradosBase;
      const obsRec = `${rc} - ${codigos} de ${remetente.codigo}`;
      if (bonsBase > 0) await lancar(tx, { tipo: "RECEBIMENTO", destino: "VAZIOS", quantidade: bonsBase, usuarioId: u.id, cdId: u.cd.id, unidadeId: remetente.id, conferenciaId: conferencia.id, observacao: obsRec });
      if (quebradosBase > 0) await lancar(tx, { tipo: "RECEBIMENTO", destino: "QUEBRADOS", quantidade: quebradosBase, usuarioId: u.id, cdId: u.cd.id, unidadeId: remetente.id, conferenciaId: conferencia.id, observacao: obsRec });

      let ocorrencia: { id: string; numero: number } | null = null;
      const dadosOcorrencia = {
        tipo: "OCORRENCIA" as const,
        cdId: remetente.id,
        unidadeId: u.cd.id,
        transportadora: d.transportadora,
        placa: d.placa,
        conferenciaOrigemId: conferencia.id,
        criadoPorId: u.id,
      };
      if (falta > 0) {
        ocorrencia = await tx.valePallet.create({
          data: {
            ...dadosOcorrencia,
            ocorrencia: "FALTA",
            quantidade: falta,
            observacao: `FALTA na conferência ${rc} em ${u.cd.codigo}: ${codigos} somam ${declarado}, recebidos ${recebido} (PBR ${d.recebidoBons}, quebrados ${d.recebidoQuebrados}). ${d.observacao}`,
          },
          select: { id: true, numero: true },
        });
        await lancar(tx, { tipo: "FALTA", quantidade: falta, usuarioId: u.id, cdId: remetente.id, unidadeId: u.cd.id, valeId: ocorrencia.id, conferenciaId: conferencia.id, observacao: `${numeroVale(ocorrencia.numero, "OCORRENCIA")} - falta de ${falta} na ${rc}` }, remetente.codigo);
      }
      if (sobra > 0) {
        ocorrencia = await tx.valePallet.create({
          data: {
            ...dadosOcorrencia,
            ocorrencia: "SOBRA",
            quantidade: sobra,
            quantidadeBons: sobraBons,
            quantidadeQuebrados: sobraQuebrados,
            status: "FINALIZADO",
            finalizadoEm: agora,
            observacao: `SOBRA na conferência ${rc} em ${u.cd.codigo}: ${codigos} somam ${declarado}, recebidos ${recebido}. ${d.observacao}`,
          },
          select: { id: true, numero: true },
        });
        const obsSobra = `${numeroVale(ocorrencia.numero, "OCORRENCIA")} - sobra de ${sobra} na ${rc}`;
        if (sobraBons > 0) await lancar(tx, { tipo: "SOBRA", destino: "VAZIOS", quantidade: sobraBons, usuarioId: u.id, cdId: u.cd.id, unidadeId: remetente.id, valeId: ocorrencia.id, conferenciaId: conferencia.id, observacao: obsSobra });
        if (sobraQuebrados > 0) await lancar(tx, { tipo: "SOBRA", destino: "QUEBRADOS", quantidade: sobraQuebrados, usuarioId: u.id, cdId: u.cd.id, unidadeId: remetente.id, valeId: ocorrencia.id, conferenciaId: conferencia.id, observacao: obsSobra });
      }
      await auditar(tx, {
        acao: "CONFERENCIA_RECEBIMENTO",
        entidade: "Conferencia",
        entidadeId: conferencia.id,
        usuarioId: u.id,
        cdId: u.cd.id,
        quantidade: recebido,
        observacao: d.observacao,
        detalhes: { numero: conferencia.numero, remetente: remetente.codigo, vales: codigos, declarado, recebidoBons: d.recebidoBons, recebidoQuebrados: d.recebidoQuebrados, diferenca },
      });
      if (ocorrencia) {
        await auditar(tx, {
          acao: falta > 0 ? "GERAR_OCORRENCIA_FALTA" : "GERAR_OCORRENCIA_SOBRA",
          entidade: "ValePallet",
          entidadeId: ocorrencia.id,
          usuarioId: u.id,
          cdId: u.cd.id,
          quantidade: falta || sobra,
          observacao: d.observacao,
          detalhes: { numero: ocorrencia.numero, conferencia: rc, remetente: remetente.codigo, recebedor: u.cd.codigo, declarado, recebido },
        });
      }
      return { conferencia, remetente, recebido, ocorrencia, rc, unidade: u.cd.codigo };
    });

    destinoUrl = r.ocorrencia
      ? `/imprimir/vale/${r.ocorrencia.id}?auto=1`
      : `/recebimento?ok=${encodeURIComponent(`${r.rc} registrada: ${formatarNumero(r.recebido)} pallet(s) de ${r.remetente.codigo} conferidos e somados ao estoque de ${r.unidade}. Sem divergência.`)}`;
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/", "layout");
  redirect(destinoUrl);
}

// ---------------- Resolução de ocorrência de falta (administrador) ----------------

const schemaResolucao = z
  .object({
    valeId: z.string().min(1),
    resolucao: z.enum(["LOCALIZADA", "PERDA"], { message: "Selecione como a ocorrência foi resolvida." }),
    estoque: z.enum(["VAZIOS", "QUEBRADOS"]).optional(),
    observacao: z.string().trim().min(5, "A justificativa é obrigatória (mínimo 5 caracteres).").max(500),
  })
  .refine((d) => d.resolucao === "PERDA" || !!d.estoque, { message: "Informe se os pallets localizados são Pallets PBR ou Pallets Quebrados." });

/**
 * Resolve uma falta: pallets localizados voltam ao estoque da unidade remetente, ou a
 * falta é baixada como perda. Exclusivo de administradores.
 */
export async function resolverOcorrencia(_: Estado, form: FormData): Promise<Estado> {
  try {
    const u = await exigirAdmin();
    const d = schemaResolucao.parse(Object.fromEntries(form));
    const vale = await comContaBloqueada(async (tx) => {
      const vale = await tx.valePallet.findUnique({ where: { id: d.valeId }, include: { cd: true } });
      if (!vale || vale.tipo !== "OCORRENCIA" || vale.ocorrencia !== "FALTA") throw new ErroNegocio("Ocorrência de falta não encontrada.");
      const { count } = await tx.valePallet.updateMany({
        where: { id: vale.id, status: "PENDENTE" },
        data: { status: "FINALIZADO", finalizadoEm: new Date(), resolucao: d.resolucao, resolvidoEm: new Date(), resolvidoPorId: u.id, observacaoResolucao: d.observacao },
      });
      if (count !== 1) throw new ErroNegocio("Esta ocorrência já foi resolvida.");
      const codigo = numeroVale(vale.numero, "OCORRENCIA");
      await lancar(
        tx,
        d.resolucao === "LOCALIZADA"
          ? { tipo: "OCORRENCIA_LOCALIZADA", destino: d.estoque, quantidade: vale.quantidade, usuarioId: u.id, cdId: vale.cdId, unidadeId: vale.unidadeId, valeId: vale.id, observacao: `${codigo} localizada - ${d.observacao}` }
          : { tipo: "OCORRENCIA_PERDA", quantidade: vale.quantidade, usuarioId: u.id, cdId: vale.cdId, unidadeId: vale.unidadeId, valeId: vale.id, observacao: `${codigo} baixada como perda - ${d.observacao}` },
        vale.cd.codigo,
      );
      await auditar(tx, {
        acao: "RESOLVER_OCORRENCIA",
        entidade: "ValePallet",
        entidadeId: vale.id,
        usuarioId: u.id,
        cdId: vale.cdId,
        quantidade: vale.quantidade,
        observacao: d.observacao,
        detalhes: { numero: vale.numero, resolucao: d.resolucao, estoque: d.estoque ?? null },
      });
      return vale;
    });
    revalidatePath("/", "layout");
    return sucesso(
      `${numeroVale(vale.numero, "OCORRENCIA")} resolvida: ${d.resolucao === "LOCALIZADA" ? `${vale.quantidade} pallet(s) devolvidos ao estoque de ${vale.cd.codigo}` : `${vale.quantidade} pallet(s) baixados como perda`}.`,
    );
  } catch (e) {
    return tratarErro(e);
  }
}
