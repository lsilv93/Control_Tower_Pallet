"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StatusVale } from "@prisma/client";
import { z } from "zod";
import { exigir } from "./guarda";
import { auditar, comContaBloqueada, ErroNegocio, lancar } from "@/lib/conta";
import { prisma } from "@/lib/prisma";
import { lerCodigoVale, numeroAgenda, numeroVale, rotuloMotivoCancelamento } from "@/lib/formatos";
import { formatarDataHora, inicioDoDia } from "@/lib/datas";
import { sucesso, tratarErro, type Estado } from "./estado";

const schemaAgenda = z.object({
  valeIds: z.array(z.string()).min(1, "Selecione ao menos um vale."),
  // datetime-local do navegador ("YYYY-MM-DDTHH:MM"), no fuso de operação (São Paulo).
  dataHora: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Informe a data e a hora da retirada."),
  observacao: z.string().trim().max(500).optional(),
});

/** Gera agenda(s) de devolução a partir dos vales selecionados (uma por fornecedor). */
export async function gerarAgenda(_: Estado, form: FormData): Promise<Estado> {
  try {
    const usuario = await exigir("agendas");
    const d = schemaAgenda.parse({
      valeIds: form.getAll("valeIds").map(String),
      dataHora: form.get("dataHora"),
      observacao: form.get("observacao") ?? undefined,
    });

    const dataHora = new Date(`${d.dataHora}:00-03:00`);
    if (Number.isNaN(dataHora.getTime())) throw new ErroNegocio("Data/hora da retirada inválida.");
    if (dataHora < inicioDoDia()) throw new ErroNegocio("A retirada não pode ser agendada para uma data passada.");

    const agendas = await prisma.$transaction(async (tx) => {
      const vales = await tx.valePallet.findMany({ where: { id: { in: d.valeIds } } });
      if (vales.length !== d.valeIds.length) throw new ErroNegocio("Um ou mais vales não foram encontrados.");
      const naoPendentes = vales.filter((v) => v.status !== "PENDENTE");
      if (naoPendentes.length) throw new ErroNegocio("Somente vales com status Pendente podem ser agendados.");

      const porFornecedor = new Map<string, string[]>();
      for (const v of vales) porFornecedor.set(v.fornecedorId, [...(porFornecedor.get(v.fornecedorId) ?? []), v.id]);

      const criadas = [];
      for (const [fornecedorId, ids] of porFornecedor) {
        const agenda = await tx.agendaDevolucao.create({
          data: {
            fornecedorId,
            dataPrevista: dataHora,
            observacao: d.observacao || null,
            criadoPorId: usuario.id,
          },
        });
        // updateMany com filtro de status evita agendar o mesmo vale duas vezes em requisições concorrentes
        const { count } = await tx.valePallet.updateMany({
          where: { id: { in: ids }, status: "PENDENTE" },
          data: { status: "AGENDADO", agendaId: agenda.id },
        });
        if (count !== ids.length) throw new ErroNegocio("Alguns vales foram alterados por outro usuário. Atualize a página.");
        await auditar(tx, {
          acao: "GERAR_AGENDA",
          entidade: "AgendaDevolucao",
          entidadeId: agenda.id,
          usuarioId: usuario.id,
          detalhes: { numero: agenda.numero, vales: ids, dataHoraRetirada: dataHora.toISOString() },
        });
        criadas.push(agenda);
      }
      return criadas;
    });

    revalidatePath("/", "layout");
    return sucesso(
      `Retirada agendada para ${formatarDataHora(dataHora)}: ${agendas.map((a) => numeroAgenda(a.numero)).join(", ")}.`,
    );
  } catch (e) {
    return tratarErro(e);
  }
}

/** Baixa de pagamento: valida a agenda, finaliza os vales e dá saída oficial da conta corrente. */
export async function validarAgenda(_: Estado, form: FormData): Promise<Estado> {
  let mensagem: string;
  try {
    const usuario = await exigir("agendas");
    const agendaId = String(form.get("agendaId") ?? "");
    const observacao = String(form.get("observacao") ?? "").trim() || null;

    const agenda = await comContaBloqueada(async (tx) => {
      const agora = new Date();
      // Reivindica a agenda atomicamente (bloqueia a linha contra cancelamento concorrente).
      const { count } = await tx.agendaDevolucao.updateMany({
        where: { id: agendaId, status: "ABERTA" },
        data: { status: "VALIDADA", validadoEm: agora, validadoPorId: usuario.id },
      });
      if (count !== 1) throw new ErroNegocio("Agenda não encontrada ou não está aberta.");
      const agenda = await tx.agendaDevolucao.findUniqueOrThrow({
        where: { id: agendaId },
        include: { vales: true, fornecedor: true },
      });

      for (const vale of agenda.vales) {
        await lancar(tx, {
          tipo: "DEVOLUCAO_FORNECEDOR",
          quantidade: vale.quantidade,
          usuarioId: usuario.id,
          fornecedorId: agenda.fornecedorId,
          valeId: vale.id,
          agendaId: agenda.id,
          observacao: `Baixa ${numeroAgenda(agenda.numero)}${observacao ? ` - ${observacao}` : ""}`,
        });
      }
      await tx.valePallet.updateMany({
        where: { agendaId: agenda.id },
        data: { status: "FINALIZADO", finalizadoEm: agora },
      });
      if (observacao) {
        await tx.agendaDevolucao.update({
          where: { id: agenda.id },
          data: { observacao: [agenda.observacao, observacao].filter(Boolean).join(" | ") },
        });
      }
      await auditar(tx, {
        acao: "VALIDAR_AGENDA",
        entidade: "AgendaDevolucao",
        entidadeId: agenda.id,
        usuarioId: usuario.id,
        detalhes: { numero: agenda.numero, total: agenda.vales.reduce((s, v) => s + v.quantidade, 0) },
      });
      return agenda;
    });

    revalidatePath("/", "layout");
    const total = agenda.vales.reduce((s, v) => s + v.quantidade, 0);
    mensagem = `${numeroAgenda(agenda.numero)} validada: ${total} pallet(s) devolvidos a ${agenda.fornecedor.nome}`;
  } catch (e) {
    return tratarErro(e);
  }
  // O card da agenda some após a baixa; a confirmação é exibida no topo da página.
  redirect(`/agendas?ok=${encodeURIComponent(mensagem)}`);
}

export async function cancelarAgenda(_: Estado, form: FormData): Promise<Estado> {
  let mensagem: string;
  try {
    const usuario = await exigir("agendas");
    const agendaId = String(form.get("agendaId") ?? "");
    const agenda = await prisma.$transaction(async (tx) => {
      const { count } = await tx.agendaDevolucao.updateMany({
        where: { id: agendaId, status: "ABERTA" },
        data: { status: "CANCELADA", canceladoEm: new Date() },
      });
      if (count !== 1) throw new ErroNegocio("Agenda não encontrada ou não está aberta.");
      await tx.valePallet.updateMany({ where: { agendaId }, data: { status: "PENDENTE", agendaId: null } });
      await auditar(tx, { acao: "CANCELAR_AGENDA", entidade: "AgendaDevolucao", entidadeId: agendaId, usuarioId: usuario.id });
      return tx.agendaDevolucao.findUniqueOrThrow({ where: { id: agendaId } });
    });
    revalidatePath("/", "layout");
    mensagem = `${numeroAgenda(agenda.numero)} cancelada. Os vales voltaram para Pendente.`;
  } catch (e) {
    return tratarErro(e);
  }
  redirect(`/agendas?ok=${encodeURIComponent(mensagem)}`);
}

export type ResultadoLeituraVale =
  | { ok: true; id: string; numero: number; codigo: string; status: StatusVale; texto: string }
  | { ok: false; erro: string };

/** Identifica o vale a partir da leitura óptica do código de barras (conteúdo: "VP-000123"). */
export async function consultarVale(leitura: string): Promise<ResultadoLeituraVale> {
  try {
    await exigir("vales", "agendas");
  } catch {
    return { ok: false, erro: "Você não tem permissão para consultar vales." };
  }
  const numero = lerCodigoVale(leitura);
  if (numero === null) return { ok: false, erro: `Código "${leitura}" não é de um vale-pallet.` };
  const vale = await prisma.valePallet.findUnique({ where: { numero }, include: { fornecedor: true, agenda: true } });
  if (!vale) return { ok: false, erro: `Vale ${numeroVale(numero)} não encontrado.` };
  const detalhe =
    vale.status === "CANCELADO"
      ? `CANCELADO (excluído) em ${formatarDataHora(vale.canceladoEm)}`
      : vale.status === "FINALIZADO"
      ? `finalizado em ${formatarDataHora(vale.finalizadoEm)}`
      : vale.status === "AGENDADO" && vale.agenda
        ? `agendado em ${numeroAgenda(vale.agenda.numero)}`
        : "pendente de devolução";
  return {
    ok: true,
    id: vale.id,
    numero,
    codigo: numeroVale(numero),
    status: vale.status,
    texto: `${numeroVale(numero)} · ${vale.fornecedor.nome} · ${vale.quantidade} pallet(s) · ${detalhe}`,
  };
}

const schemaExclusao = z.object({
  valeId: z.string().min(1, "Busque o vale a ser excluído."),
  motivo: z.enum(["FORNECEDOR_INCORRETO", "TRANSPORTADORA_INCORRETA", "QUANTIDADE_INCORRETA", "DOCUMENTO_ERRADO"], {
    message: "Selecione o motivo do cancelamento.",
  }),
  observacao: z.string().trim().max(500).optional(),
});

/**
 * Exclusão (cancelamento) de vale emitido incorretamente. Exclusão lógica: o vale
 * fica com status CANCELADO e a entrada no pulmão é estornada. Registra na auditoria
 * ID do vale, usuário, data/hora, motivo e observação.
 */
export async function excluirVale(_: Estado, form: FormData): Promise<Estado> {
  let mensagem: string;
  try {
    const usuario = await exigir("excluir_vale");
    const d = schemaExclusao.parse(Object.fromEntries(form));
    const observacao = d.observacao || null;

    const vale = await comContaBloqueada(async (tx) => {
      const vale = await tx.valePallet.findUnique({ where: { id: d.valeId }, include: { fornecedor: true, agenda: true } });
      if (!vale) throw new ErroNegocio("Vale não encontrado.");
      if (vale.status === "CANCELADO") throw new ErroNegocio(`${numeroVale(vale.numero)} já foi excluído.`);
      if (vale.status === "FINALIZADO") {
        throw new ErroNegocio(`${numeroVale(vale.numero)} já foi devolvido (finalizado) e não pode ser excluído.`);
      }
      if (vale.status === "AGENDADO") {
        throw new ErroNegocio(
          `${numeroVale(vale.numero)} está na agenda ${vale.agenda ? numeroAgenda(vale.agenda.numero) : ""}. Cancele a agenda em Baixa de Pagamento antes de excluir.`,
        );
      }
      const agora = new Date();
      // Filtro por status evita excluir um vale agendado por outro usuário no mesmo instante.
      const { count } = await tx.valePallet.updateMany({
        where: { id: vale.id, status: "PENDENTE" },
        data: {
          status: "CANCELADO",
          canceladoEm: agora,
          canceladoPorId: usuario.id,
          motivoCancelamento: d.motivo,
          observacaoCancelamento: observacao,
        },
      });
      if (count !== 1) throw new ErroNegocio("O vale foi alterado por outro usuário. Atualize a página.");
      await lancar(tx, {
        tipo: "ESTORNO_VALE",
        quantidade: vale.quantidade,
        usuarioId: usuario.id,
        fornecedorId: vale.fornecedorId,
        valeId: vale.id,
        observacao: `Exclusão ${numeroVale(vale.numero)} - ${rotuloMotivoCancelamento[d.motivo]}${observacao ? ` - ${observacao}` : ""}`,
      });
      await auditar(tx, {
        acao: "EXCLUIR_VALE",
        entidade: "ValePallet",
        entidadeId: vale.id,
        usuarioId: usuario.id,
        detalhes: {
          vale: numeroVale(vale.numero),
          motivo: rotuloMotivoCancelamento[d.motivo],
          observacao,
          quantidade: vale.quantidade,
          fornecedor: vale.fornecedor.nome,
          dataHora: agora.toISOString(),
        },
      });
      return vale;
    });
    mensagem = `${numeroVale(vale.numero)} excluído (${rotuloMotivoCancelamento[d.motivo]}). ${vale.quantidade} pallet(s) estornados do Estoque do CD.`;
  } catch (e) {
    return tratarErro(e);
  }
  revalidatePath("/", "layout");
  redirect(`/vales/excluir?ok=${encodeURIComponent(mensagem)}`);
}
