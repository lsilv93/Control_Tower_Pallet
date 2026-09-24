"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUsuario } from "@/lib/auth";
import { auditar, comContaBloqueada, ErroNegocio, lancar } from "@/lib/conta";
import { prisma } from "@/lib/prisma";
import { inicioDoDia } from "@/lib/datas";
import { numeroAgenda } from "@/lib/formatos";
import { sucesso, tratarErro, type Estado } from "./estado";

const schemaAgenda = z.object({
  valeIds: z.array(z.string()).min(1, "Selecione ao menos um vale."),
  dataPrevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data prevista da devolução."),
  observacao: z.string().trim().max(500).optional(),
});

/** Gera agenda(s) de devolução a partir dos vales selecionados (uma por fornecedor). */
export async function gerarAgenda(_: Estado, form: FormData): Promise<Estado> {
  try {
    const usuario = await requireUsuario();
    const d = schemaAgenda.parse({
      valeIds: form.getAll("valeIds").map(String),
      dataPrevista: form.get("dataPrevista"),
      observacao: form.get("observacao") ?? undefined,
    });

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
            dataPrevista: inicioDoDia(d.dataPrevista),
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
          detalhes: { numero: agenda.numero, vales: ids, dataPrevista: d.dataPrevista },
        });
        criadas.push(agenda);
      }
      return criadas;
    });

    revalidatePath("/", "layout");
    return sucesso(`Agenda(s) gerada(s): ${agendas.map((a) => numeroAgenda(a.numero)).join(", ")}.`);
  } catch (e) {
    return tratarErro(e);
  }
}

/** Baixa de pagamento: valida a agenda, finaliza os vales e dá saída oficial da conta corrente. */
export async function validarAgenda(_: Estado, form: FormData): Promise<Estado> {
  let mensagem: string;
  try {
    const usuario = await requireUsuario();
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
    const usuario = await requireUsuario();
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
