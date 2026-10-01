"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Boxes, Hammer, Trash2 } from "lucide-react";
import { registrarDescarte } from "@/actions/avarias";
import { BotaoEnviar, Mensagem } from "./FormAcao";
import { Modal } from "./ModalFornecedor";

/**
 * Descarte/destruição: ao enviar, abre o pop-up "De qual pulmão este pallet será
 * descartado/destruído?" (Vazios ou Quebrados) antes de efetivar.
 */
export function FormDescarte({ saldoVazios, saldoQuebrados }: { saldoVazios: number; saldoQuebrados: number }) {
  const [estado, executar, enviando] = useActionState(registrarDescarte, null);
  const [dados, setDados] = useState<FormData | null>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);

  function confirmar(origem: "VAZIOS" | "QUEBRADOS") {
    if (!dados) return;
    const fd = new FormData();
    dados.forEach((v, k) => fd.append(k, v));
    fd.set("origem", origem);
    setDados(null);
    startTransition(() => executar(fd));
  }

  const qtd = Number(dados?.get("quantidade") ?? 0);
  const opcoes = [
    { origem: "VAZIOS" as const, titulo: "Opção A · Pulmão de Vazios", saldo: saldoVazios, icone: Boxes },
    { origem: "QUEBRADOS" as const, titulo: "Opção B · Pulmão de Quebrados", saldo: saldoQuebrados, icone: Hammer },
  ];

  return (
    <>
      <form
        ref={form}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setDados(new FormData(e.currentTarget));
        }}
      >
        <div>
          <label className="label" htmlFor="quantidade">Quantidade de pallets *</label>
          <input id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="observacao">Justificativa do descarte *</label>
          <textarea id="observacao" name="observacao" rows={3} className="input" required minLength={5} maxLength={500} />
        </div>
        <Mensagem estado={estado} />
        <BotaoEnviar enviando={enviando} className="btn-danger w-full" textoEnviando="Descartando...">
          <Trash2 className="h-4 w-4" /> Descartar / destruir
        </BotaoEnviar>
      </form>

      {dados && (
        <Modal titulo="Confirmar descarte" aoFechar={() => setDados(null)}>
          <p className="mb-5 text-[13px] font-semibold text-t1">De qual pulmão este pallet será descartado/destruído?</p>
          <p className="mb-4 text-[12px] text-t3">
            Quantidade: <strong className="num text-t1">{qtd}</strong> pallet(s). A baixa é definitiva.
          </p>
          <div className="grid gap-3">
            {opcoes.map((o) => (
              <button
                key={o.origem}
                type="button"
                onClick={() => confirmar(o.origem)}
                disabled={o.saldo < qtd}
                className="poco flex items-center gap-4 p-4 text-left transition hover:ring-2 hover:ring-lima/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <o.icone className="h-6 w-6 flex-none text-lima" />
                <span className="flex-1">
                  <span className="block text-[13px] font-semibold text-t1">{o.titulo}</span>
                  <span className="block text-[11px] text-t3">
                    Saldo disponível: <span className="num">{o.saldo}</span>
                    {o.saldo < qtd && " · insuficiente"}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary mt-5 w-full" onClick={() => setDados(null)}>
            Cancelar
          </button>
        </Modal>
      )}
    </>
  );
}
