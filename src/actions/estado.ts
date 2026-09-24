import { ZodError } from "zod";
import { ErroNegocio } from "@/lib/conta";

export type Estado = { ok: boolean; mensagem: string; ts: number } | null;

export const sucesso = (mensagem: string): Estado => ({ ok: true, mensagem, ts: Date.now() });
export const falha = (mensagem: string): Estado => ({ ok: false, mensagem, ts: Date.now() });

/** Converte exceções conhecidas em mensagens amigáveis para o formulário. */
export function tratarErro(e: unknown): Estado {
  if (e instanceof ErroNegocio) return falha(e.message);
  if (e instanceof ZodError) return falha(e.issues[0]?.message ?? "Dados inválidos.");
  console.error(e);
  return falha("Erro inesperado ao processar a operação. Tente novamente.");
}
