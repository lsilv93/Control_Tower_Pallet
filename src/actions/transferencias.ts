"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigir } from "./guarda";
import { requireUsuario } from "@/lib/auth";
import { auditar, comContaBloqueada, ErroNegocio, lancar } from "@/lib/conta";
import { formatarNumero, normalizarPlaca, numeroConferencia, numeroVale, placaValida, rotuloUnidade } from "@/lib/formatos";
import { tratarErro, type Estado } from "./estado";

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
      // Ponto de Cross x CD: só circulam pallets entre o Cross e os CDs vinculados a ele.
      if (u.cd.tipo === "CROSS") {
        if (destino.tipo !== "CD" || d.modo !== "CD") throw new ErroNegocio("O Ponto de Cross devolve pallets somente para um CD vinculado.");
        const vinculo = await tx.crossCD.findUnique({ where: { crossId_cdId: { crossId: u.cd.id, cdId: destino.id } } });
        if (!vinculo) throw new ErroNegocio(`${destino.codigo} não é um CD vinculado a ${u.cd.codigo}. Selecione um dos CDs atendidos por este Ponto de Cross.`);
      }
      if (destino.tipo === "CROSS") {
        const vinculo = await tx.crossCD.findUnique({ where: { crossId_cdId: { crossId: destino.id, cdId: u.cd.id } } });
        if (!vinculo) throw new ErroNegocio(`O Ponto de Cross ${destino.codigo} não está vinculado a ${u.cd.codigo}. Vincule-o em Cadastros → Pontos de Cross.`);
      }
      const transportadora = await tx.transportadora.findUnique({ where: { id: d.transportadoraId } });
      if (!transportadora || !transportadora.ativo) throw new ErroNegocio("Transportador inválido ou inativo. Selecione um transportador cadastrado.");

      // Regra de saldo: CD → Cross não exige nem consome estoque (vai para o acumulador de remessas
      // a Cross); CD → CD e Cross → CD exigem saldo e saem do estoque da origem.
      const consomeEstoque = !(u.cd.tipo === "CD" && destino.tipo === "CROSS");
      const vale = await tx.valePallet.create({
        data: {
          tipo: "ENVIO",
          consomeEstoque,
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
      // Consome estoque: saem de Vazios/Quebrados (o lançamento bloqueia se não houver saldo).
      // CD → Cross: o total sai do acumulador REMESSA_CROSS, sem tocar no estoque do CD.
      if (!consomeEstoque) {
        await lancar(tx, { tipo: "ENVIO", origem: "REMESSA_CROSS", quantidade: total, usuarioId: u.id, cdId: u.cd.id, unidadeId: destino.id, valeId: vale.id, observacao: obs }, u.cd.codigo);
      } else {
        if (d.quantidadeBons > 0) {
          await lancar(tx, { tipo: "ENVIO", origem: "VAZIOS", quantidade: d.quantidadeBons, usuarioId: u.id, cdId: u.cd.id, unidadeId: destino.id, valeId: vale.id, observacao: obs }, u.cd.codigo);
        }
        if (d.quantidadeQuebrados > 0) {
          await lancar(tx, { tipo: "ENVIO", origem: "QUEBRADOS", quantidade: d.quantidadeQuebrados, usuarioId: u.id, cdId: u.cd.id, unidadeId: destino.id, valeId: vale.id, observacao: obs }, u.cd.codigo);
        }
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
  transportadoraId: opcional(60),
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
      transportadoraId: form.get("transportadoraId") ?? undefined,
      observacao: form.get("observacao") ?? undefined,
    });

    const r = await comContaBloqueada(async (tx) => {
      const remetente = await tx.centroDistribuicao.findUnique({ where: { id: d.remetenteId } });
      if (!remetente) throw new ErroNegocio("Unidade remetente inválida.");
      // Transportadora (opcional) sempre escolhida no cadastro de transportadoras ativas.
      const transp = d.transportadoraId ? await tx.transportadora.findUnique({ where: { id: d.transportadoraId } }) : null;
      if (d.transportadoraId && (!transp || !transp.ativo)) throw new ErroNegocio("Transportadora inválida ou inativa. Selecione uma transportadora cadastrada.");
      const nomeTransportadora = transp?.nome ?? null;
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
          transportadora: nomeTransportadora,
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
        transportadora: nomeTransportadora,
        placa: d.placa,
        conferenciaOrigemId: conferencia.id,
        criadoPorId: u.id,
        // Remessa CD → Cross não consumiu estoque: o aceite de uma sobra pelo remetente também não consome.
        consomeEstoque: vales.every((v) => v.consomeEstoque),
      };
      // A divergência vira ocorrência pendente na unidade remetente, que aceita ou recusa.
      if (falta > 0) {
        // Quanto da falta é de Pallets PBR e quanto de Quebrados (pelo declarado nos vales).
        const declaradoBons = vales.reduce((s, v) => s + v.quantidadeBons, 0);
        const faltaBons = Math.min(falta, Math.max(0, declaradoBons - d.recebidoBons));
        ocorrencia = await tx.valePallet.create({
          data: {
            ...dadosOcorrencia,
            ocorrencia: "FALTA",
            quantidade: falta,
            quantidadeBons: faltaBons,
            quantidadeQuebrados: falta - faltaBons,
            aguardandoId: remetente.id,
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
            aguardandoId: remetente.id,
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
        await tx.ocorrenciaInteracao.create({
          data: { valeId: ocorrencia.id, acao: "ABERTURA", unidadeId: u.cd.id, usuarioId: u.id, justificativa: d.observacao },
        });
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

// ---------------- Ocorrência: aceite ou recusa (ciclo entre remetente e recebedor) ----------------

const schemaResposta = z
  .object({
    valeId: z.string().min(1),
    acao: z.enum(["ACEITAR", "RECUSAR"], { message: "Escolha aceitar ou recusar a ocorrência." }),
    justificativa: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || null),
  })
  .refine((d) => d.acao === "ACEITAR" || (d.justificativa?.length ?? 0) >= 10, {
    message: "Para recusar, a justificativa é obrigatória (mínimo 10 caracteres).",
  });

/**
 * Resposta da unidade da vez a uma ocorrência de divergência. Recusar (com justificativa)
 * devolve a pendência à outra unidade; o ciclo se repete até um aceite. O aceite encerra a
 * ocorrência e ajusta a conta corrente em definitivo:
 * - FALTA aceita pelo remetente: Ocorrência → Perda no remetente.
 * - FALTA aceita pelo recebedor: remetente Ocorrência → Enviado; recebedor Recebido → estoque.
 * - SOBRA aceita pelo remetente: remetente estoque → Enviado (bloqueia sem saldo);
 *   recebedor Recebido → Sobra (o físico já entrou no estoque na conferência).
 * - SOBRA aceita pelo recebedor: a sobra fica incorporada ao estoque do recebedor.
 * Somente usuários operando a unidade da vez (ou administradores) respondem.
 */
export async function responderOcorrencia(_: Estado, form: FormData): Promise<Estado> {
  let mensagem: string;
  const aba = String(form.get("aba") ?? "acao").replace(/[^a-z]/g, "") || "acao";
  try {
    const u = await requireUsuario();
    const d = schemaResposta.parse(Object.fromEntries(form));
    const r = await comContaBloqueada(async (tx) => {
      const vale = await tx.valePallet.findUnique({ where: { id: d.valeId }, include: { cd: true, unidade: true } });
      if (!vale || vale.tipo !== "OCORRENCIA" || !vale.ocorrencia || !vale.unidade) throw new ErroNegocio("Ocorrência não encontrada.");
      if (vale.status !== "PENDENTE" || !vale.aguardandoId) throw new ErroNegocio("Esta ocorrência já foi encerrada.");
      const daVez = vale.aguardandoId === vale.cdId ? vale.cd : vale.unidade;
      const outra = daVez.id === vale.cdId ? vale.unidade : vale.cd;
      // Responde quem tem acesso à unidade da vez (ou administrador, que age em nome dela).
      if (!u.global && !u.cds.some((c) => c.id === daVez.id)) {
        throw new ErroNegocio(`Esta ocorrência aguarda resposta de ${daVez.codigo}. Somente usuários dessa unidade podem responder.`);
      }
      const codigo = numeroVale(vale.numero, "OCORRENCIA");
      const agora = new Date();

      if (d.acao === "RECUSAR") {
        const { count } = await tx.valePallet.updateMany({
          where: { id: vale.id, status: "PENDENTE", aguardandoId: daVez.id },
          data: { aguardandoId: outra.id, recusas: { increment: 1 } },
        });
        if (count !== 1) throw new ErroNegocio("A ocorrência foi respondida por outro usuário. Atualize a página.");
        await tx.ocorrenciaInteracao.create({ data: { valeId: vale.id, acao: "RECUSA", unidadeId: daVez.id, usuarioId: u.id, justificativa: d.justificativa } });
        await auditar(tx, {
          acao: "RECUSAR_OCORRENCIA",
          entidade: "ValePallet",
          entidadeId: vale.id,
          usuarioId: u.id,
          cdId: daVez.id,
          quantidade: vale.quantidade,
          observacao: d.justificativa,
          detalhes: { numero: vale.numero, recusadaPor: daVez.codigo, devolvidaPara: outra.codigo },
        });
        return `${codigo} recusada por ${daVez.codigo}: a pendência voltou para ${outra.codigo} com a justificativa.`;
      }

      const peloRemetente = daVez.id === vale.cdId;
      const { count } = await tx.valePallet.updateMany({
        where: { id: vale.id, status: "PENDENTE", aguardandoId: daVez.id },
        data: {
          status: "FINALIZADO",
          finalizadoEm: agora,
          aguardandoId: null,
          resolucao: peloRemetente ? "ACEITA_REMETENTE" : "ACEITA_RECEBEDOR",
          resolvidoEm: agora,
          resolvidoPorId: u.id,
          observacaoResolucao: d.justificativa,
        },
      });
      if (count !== 1) throw new ErroNegocio("A ocorrência foi respondida por outro usuário. Atualize a página.");
      const base = { usuarioId: u.id, valeId: vale.id, conferenciaId: vale.conferenciaOrigemId };
      const obs = `${codigo} aceita por ${daVez.codigo}${d.justificativa ? ` - ${d.justificativa}` : ""}`;
      const remetente = { ...base, cdId: vale.cdId, unidadeId: vale.unidadeId };
      const recebedor = { ...base, cdId: vale.unidade.id, unidadeId: vale.cdId };
      const partes = [
        ["VAZIOS", vale.quantidadeBons],
        ["QUEBRADOS", vale.quantidadeQuebrados],
      ] as const;
      if (vale.ocorrencia === "FALTA") {
        if (peloRemetente) {
          await lancar(tx, { ...remetente, tipo: "OCORRENCIA_PERDA", quantidade: vale.quantidade, observacao: `${obs} (baixada como perda)` }, vale.cd.codigo);
        } else {
          await lancar(tx, { ...remetente, tipo: "DIVERGENCIA_ENVIADO", origem: "OCORRENCIA", quantidade: vale.quantidade, observacao: obs }, vale.cd.codigo);
          for (const [estoque, qtd] of partes) {
            if (qtd > 0) await lancar(tx, { ...recebedor, tipo: "DIVERGENCIA_RECEBIDO", destino: estoque, quantidade: qtd, observacao: obs }, vale.unidade.codigo);
          }
        }
      } else if (peloRemetente) {
        if (!vale.consomeEstoque) {
          await lancar(tx, { ...remetente, tipo: "DIVERGENCIA_ENVIADO", origem: "REMESSA_CROSS", quantidade: vale.quantidade, observacao: obs }, vale.cd.codigo);
        } else {
          for (const [estoque, qtd] of partes) {
            if (qtd > 0) await lancar(tx, { ...remetente, tipo: "DIVERGENCIA_ENVIADO", origem: estoque, quantidade: qtd, observacao: obs }, vale.cd.codigo);
          }
        }
        await lancar(tx, { ...recebedor, tipo: "DIVERGENCIA_RECEBIDO", destino: "SOBRA", quantidade: vale.quantidade, observacao: obs }, vale.unidade.codigo);
      }
      await tx.ocorrenciaInteracao.create({ data: { valeId: vale.id, acao: "ACEITE", unidadeId: daVez.id, usuarioId: u.id, justificativa: d.justificativa } });
      await auditar(tx, {
        acao: "ACEITAR_OCORRENCIA",
        entidade: "ValePallet",
        entidadeId: vale.id,
        usuarioId: u.id,
        cdId: daVez.id,
        quantidade: vale.quantidade,
        observacao: d.justificativa,
        detalhes: { numero: vale.numero, ocorrencia: vale.ocorrencia, aceitaPor: daVez.codigo, recusas: vale.recusas },
      });
      const efeito =
        vale.ocorrencia === "FALTA"
          ? peloRemetente
            ? `${vale.quantidade} pallet(s) baixados como perda de ${vale.cd.codigo}`
            : `${vale.quantidade} pallet(s) assumidos no estoque de ${vale.unidade.codigo}`
          : peloRemetente
            ? `${vale.quantidade} pallet(s) baixados do estoque de ${vale.cd.codigo} como enviados`
            : `${vale.quantidade} pallet(s) incorporados ao estoque de ${vale.unidade.codigo}`;
      return `${codigo} aceita por ${daVez.codigo} e encerrada: ${efeito}.`;
    });
    mensagem = r;
  } catch (e) {
    return tratarErro(e);
  }
  // A ocorrência sai da lista "aguardando" ao ser respondida: a confirmação aparece no topo da página.
  revalidatePath("/", "layout");
  redirect(`/ocorrencias?f=${aba}&ok=${encodeURIComponent(mensagem)}`);
}
