"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { MinusCircle, PlusCircle } from "lucide-react";
import { incluirSaldo, removerSaldo } from "@/actions/pallets";
import { MOTIVOS_INCLUSAO } from "@/lib/formatos";
import { BotaoEnviar, Mensagem } from "./FormAcao";
import { Modal } from "./ModalFornecedor";

type Unidade = { id: string; codigo: string; nome: string; tipo: "CD" | "CROSS"; vazios: number; quebrados: number };
const fmt = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

/**
 * Inclusão (motivo + observação) ou remoção manual (justificativa + "Tem certeza?") de
 * pallets bons ou quebrados em qualquer CD ou Ponto de Cross. Exclusivo de administradores.
 */
export function FormAjusteSaldo({ modo, unidades, unidadeInicial }: { modo: "inclusao" | "remocao"; unidades: Unidade[]; unidadeInicial?: string }) {
  const [estado, executar, enviando] = useActionState(modo === "inclusao" ? incluirSaldo : removerSaldo, null);
  const [dados, setDados] = useState<FormData | null>(null);
  const [unidadeId, setUnidadeId] = useState(unidades.some((x) => x.id === unidadeInicial) ? unidadeInicial! : "");
  const form = useRef<HTMLFormElement>(null);
  const unidade = unidades.find((x) => x.id === unidadeId);

  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);

  function aoEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (modo === "remocao") return setDados(fd);
    startTransition(() => executar(fd));
  }

  function confirmar() {
    if (!dados) return;
    const fd = dados;
    fd.set("confirmado", "1");
    setDados(null);
    startTransition(() => executar(fd));
  }

  const estoqueSel = String(dados?.get("estoque") ?? "");
  return (
    <>
      <form ref={form} onSubmit={aoEnviar} className="space-y-4">
        <div>
          <label className="label" htmlFor="unidadeId">CD / Ponto de Cross *</label>
          <select id="unidadeId" name="unidadeId" className="input" required value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
            <option value="" disabled>Selecione...</option>
            {unidades.map((x) => (
              <option key={x.id} value={x.id}>{x.tipo === "CROSS" ? "Cross" : "CD"} · {x.codigo} - {x.nome}</option>
            ))}
          </select>
          {unidade && (
            <p className="mt-1 text-[11px] text-t4">
              Saldo atual: <span className="num text-lima">{fmt(unidade.vazios)}</span> bons · <span className="num text-ouro">{fmt(unidade.quebrados)}</span> quebrados
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="estoque">Estoque *</label>
            <select id="estoque" name="estoque" className="input" required defaultValue="">
              <option value="" disabled>Selecione...</option>
              <option value="VAZIOS">Pallets bons (vazios)</option>
              <option value="QUEBRADOS">Pallets quebrados</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="quantidade">Quantidade *</label>
            <input id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
          </div>
        </div>
        {modo === "inclusao" ? (
          <>
            <div>
              <label className="label" htmlFor="motivo">Motivo *</label>
              <select id="motivo" name="motivo" className="input" required defaultValue="">
                <option value="" disabled>Selecione...</option>
                {Object.entries(MOTIVOS_INCLUSAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="observacao">Observação *</label>
              <textarea id="observacao" name="observacao" rows={3} className="input" required minLength={10} maxLength={500} placeholder="Descreva a origem dos pallets (mínimo 10 caracteres)" />
            </div>
          </>
        ) : (
          <div>
            <label className="label" htmlFor="justificativa">Justificativa *</label>
            <textarea id="justificativa" name="justificativa" rows={3} className="input" required minLength={10} maxLength={500} placeholder="Motivo da remoção (mínimo 10 caracteres)" />
          </div>
        )}
        <Mensagem estado={estado} />
        <BotaoEnviar enviando={enviando} className={modo === "inclusao" ? "btn-success w-full" : "btn-danger w-full"} textoEnviando="Registrando...">
          {modo === "inclusao" ? <><PlusCircle className="h-4 w-4" /> Incluir saldo</> : <><MinusCircle className="h-4 w-4" /> Remover saldo</>}
        </BotaoEnviar>
      </form>

      {dados && (
        <Modal titulo="Confirmar remoção" aoFechar={() => setDados(null)}>
          <p className="mb-3 text-[14px] font-semibold text-t1" data-testid="pergunta-remocao">Tem certeza?</p>
          <p className="mb-5 text-[12px] text-t2">
            Serão removidos <strong className="num text-t1">{fmt(Number(dados.get("quantidade") ?? 0))}</strong> pallet(s){" "}
            {estoqueSel === "QUEBRADOS" ? "quebrados" : "bons"} de <strong className="text-t1">{unidade?.codigo}</strong>. A operação fica registrada na auditoria e não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setDados(null)}>Cancelar</button>
            <button type="button" className="btn-danger flex-1" onClick={confirmar}>Sim, remover</button>
          </div>
        </Modal>
      )}
    </>
  );
}
