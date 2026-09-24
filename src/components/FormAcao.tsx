"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import clsx from "clsx";
import type { Estado } from "@/actions/estado";

type Acao = (estado: Estado, form: FormData) => Promise<Estado>;

export function BotaoEnviar({
  children,
  enviando,
  className = "btn-primary",
  textoEnviando = "Salvando...",
}: {
  children: React.ReactNode;
  enviando: boolean;
  className?: string;
  textoEnviando?: string;
}) {
  return (
    <button type="submit" className={className} disabled={enviando}>
      {enviando ? textoEnviando : children}
    </button>
  );
}

/**
 * Executa a server action a partir do onSubmit (em vez de `<form action>`),
 * para que o React não limpe os campos quando a validação falhar.
 */
export function useAcao(acao: Acao, confirmar?: string) {
  const [estado, executar, enviando] = useActionState(acao, null);
  const aoEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (confirmar && !window.confirm(confirmar)) return;
    const dados = new FormData(e.currentTarget);
    startTransition(() => executar(dados));
  };
  return { estado, enviando, aoEnviar };
}

export function Mensagem({ estado }: { estado: Estado }) {
  if (!estado) return null;
  return (
    <div
      role="status"
      className={clsx(
        "flex items-start gap-2.5 px-4 py-3 text-[12px] font-medium",
        estado.ok ? "poco text-lima" : "poco-erro text-erro-claro",
      )}
    >
      <span className={clsx("ponto mt-[5px]", estado.ok ? "text-lima" : "text-erro")} />
      <span>{estado.mensagem}</span>
    </div>
  );
}

/**
 * Formulário ligado a uma server action. Exibe a mensagem de retorno e limpa
 * os campos após sucesso (quando `limpar` for verdadeiro).
 */
export function FormAcao({
  acao,
  children,
  botao,
  classeBotao,
  confirmar,
  limpar = true,
  className = "space-y-4",
}: {
  acao: Acao;
  children: React.ReactNode;
  botao?: React.ReactNode;
  classeBotao?: string;
  confirmar?: string;
  limpar?: boolean;
  className?: string;
}) {
  const { estado, enviando, aoEnviar } = useAcao(acao, confirmar);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok && limpar) ref.current?.reset();
  }, [estado, limpar]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={aoEnviar}
    >
      {children}
      <Mensagem estado={estado} />
      {botao && (
        <BotaoEnviar enviando={enviando} className={classeBotao}>
          {botao}
        </BotaoEnviar>
      )}
    </form>
  );
}
