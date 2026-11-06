"use client";

import { startTransition, useActionState, useState } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { responderOcorrencia } from "@/actions/transferencias";
import { BotaoEnviar, Mensagem } from "./FormAcao";
import { Modal } from "./ModalFornecedor";

/**
 * Resposta à ocorrência pela unidade da vez: Aceitar (encerra e ajusta a conta corrente em
 * definitivo, com confirmação) ou Recusar (justificativa obrigatória; a pendência volta para
 * a outra unidade).
 */
export function FormRespostaOcorrencia({ valeId, codigo, efeitoAceite, outraUnidade, aba }: { valeId: string; codigo: string; efeitoAceite: string; outraUnidade: string; aba: string }) {
  const [estado, executar, enviando] = useActionState(responderOcorrencia, null);
  const [modo, setModo] = useState<"ACEITAR" | "RECUSAR" | null>(null);
  const [justificativa, setJustificativa] = useState("");

  function enviar(acao: "ACEITAR" | "RECUSAR") {
    const fd = new FormData();
    fd.set("valeId", valeId);
    fd.set("acao", acao);
    fd.set("aba", aba);
    if (justificativa.trim()) fd.set("justificativa", justificativa.trim());
    setModo(null);
    startTransition(() => executar(fd));
  }

  return (
    <div className="space-y-3" data-testid={`resposta-${codigo}`}>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-success btn-sm" disabled={enviando} onClick={() => setModo("ACEITAR")}>
          <CircleCheck className="h-4 w-4" /> Aceitar
        </button>
        <button type="button" className="btn-danger btn-sm" disabled={enviando} onClick={() => setModo("RECUSAR")}>
          <CircleX className="h-4 w-4" /> Recusar
        </button>
      </div>
      <Mensagem estado={estado} />

      {modo && (
        <Modal titulo={modo === "ACEITAR" ? `Aceitar ${codigo}` : `Recusar ${codigo}`} aoFechar={() => setModo(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              enviar(modo);
            }}
          >
            {modo === "ACEITAR" ? (
              <p className="poco px-4 py-3 text-[12px] text-t2" data-testid="efeito-aceite">
                Ao aceitar, a ocorrência é encerrada e a conta corrente é ajustada em definitivo: <strong className="text-t1">{efeitoAceite}</strong>.
              </p>
            ) : (
              <p className="poco-ouro px-4 py-3 text-[12px] text-ouro">
                A pendência volta para <strong>{outraUnidade}</strong> com a sua justificativa. O ciclo se repete até uma das unidades aceitar.
              </p>
            )}
            <div>
              <label className="label" htmlFor={`justificativa-${valeId}`}>{modo === "RECUSAR" ? "Justificativa da recusa *" : "Observação (opcional)"}</label>
              <textarea
                id={`justificativa-${valeId}`}
                className="input"
                rows={3}
                maxLength={500}
                required={modo === "RECUSAR"}
                minLength={modo === "RECUSAR" ? 10 : undefined}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder={modo === "RECUSAR" ? "Explique por que a divergência não procede (mínimo 10 caracteres)" : ""}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary flex-1" onClick={() => setModo(null)}>Voltar</button>
              <BotaoEnviar enviando={enviando} className={modo === "ACEITAR" ? "btn-success flex-1" : "btn-danger flex-1"} textoEnviando="Registrando...">
                {modo === "ACEITAR" ? "Confirmar aceite" : "Confirmar recusa"}
              </BotaoEnviar>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
