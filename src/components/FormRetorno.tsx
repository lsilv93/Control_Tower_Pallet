"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ClipboardCheck, TriangleAlert } from "lucide-react";
import { registrarRetorno } from "@/actions/unidades";
import { BotaoEnviar, Mensagem, useAcao } from "./FormAcao";
import { InputPlaca } from "./InputPlaca";

type Unidade = { id: string; codigo: string; nome: string; tipo: "CD" | "CROSS" };
type Vale = { id: string; codigo: string; unidadeId: string; quantidade: number; tipoRotulo: string; data: string; transportadora: string | null };

const fmt = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

/**
 * Conferência de retorno: seleciona os vales que o CD/Cross está devolvendo (soma
 * automática), informa a contagem física e, se faltar, confirma a falta com placa,
 * transportadora e justificativa — o servidor gera o Vale-Ocorrência com a diferença.
 */
export function FormRetorno({ unidades, vales, unidadeInicial }: { unidades: Unidade[]; vales: Vale[]; unidadeInicial?: string }) {
  const { estado, enviando, aoEnviar } = useAcao(registrarRetorno);
  const [unidadeId, setUnidadeId] = useState(unidades.some((u) => u.id === unidadeInicial) ? unidadeInicial! : "");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [fisico, setFisico] = useState("");
  const [faltaConfirmada, setFaltaConfirmada] = useState(false);
  const [pedirConfirmacao, setPedirConfirmacao] = useState(false);

  const daUnidade = useMemo(() => vales.filter((v) => v.unidadeId === unidadeId), [vales, unidadeId]);
  const total = daUnidade.filter((v) => selecionados.has(v.id)).reduce((s, v) => s + v.quantidade, 0);
  const qtdFisica = fisico === "" ? null : Math.trunc(Number(fisico));
  const falta = qtdFisica !== null && qtdFisica < total ? total - qtdFisica : 0;
  const excesso = qtdFisica !== null && qtdFisica > total && total > 0;

  const reiniciarConfirmacao = () => {
    setFaltaConfirmada(false);
    setPedirConfirmacao(false);
  };
  const alternar = (id: string) => {
    reiniciarConfirmacao();
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    if (excesso) {
      e.preventDefault();
      return;
    }
    if (falta > 0 && !faltaConfirmada) {
      e.preventDefault();
      setPedirConfirmacao(true);
      return;
    }
    aoEnviar(e);
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <label className="label" htmlFor="unidadeId">CD / Ponto de Cross remetente *</label>
        <select
          id="unidadeId"
          name="unidadeId"
          className="input"
          required
          value={unidadeId}
          onChange={(e) => {
            setUnidadeId(e.target.value);
            setSelecionados(new Set());
            reiniciarConfirmacao();
          }}
        >
          <option value="" disabled>Selecione...</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.tipo === "CROSS" ? "Cross" : "CD"} · {u.codigo} - {u.nome}
            </option>
          ))}
        </select>
      </div>

      {unidadeId && (
        <fieldset>
          <div className="mb-2 flex items-center justify-between">
            <legend className="label !mb-0">Vales devolvidos *</legend>
            {daUnidade.length > 1 && (
              <button
                type="button"
                className="text-[11px] font-semibold text-lima hover:underline"
                onClick={() => {
                  reiniciarConfirmacao();
                  setSelecionados(selecionados.size === daUnidade.length ? new Set() : new Set(daUnidade.map((v) => v.id)));
                }}
              >
                {selecionados.size === daUnidade.length ? "Limpar" : "Selecionar todos"}
              </button>
            )}
          </div>
          {daUnidade.length === 0 ? (
            <p className="poco px-4 py-3 text-[12px] text-t3">Nenhum vale pendente desta unidade.</p>
          ) : (
            <div className="poco max-h-64 divide-y divide-[var(--groove)] overflow-auto">
              {daUnidade.map((v) => (
                <label key={v.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[12px]">
                  <input type="checkbox" name="valeIds" value={v.id} checked={selecionados.has(v.id)} onChange={() => alternar(v.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="num font-semibold text-t1">{v.codigo}</span>
                    <span className="block text-[11px] text-t4">{v.tipoRotulo} · {v.data}{v.transportadora ? ` · ${v.transportadora}` : ""}</span>
                  </span>
                  <span className="num font-semibold text-t1">{fmt(v.quantidade)}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="poco px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-t4">Total dos vales</p>
          <p className="num text-[22px] font-semibold text-t1" data-testid="total-vales">{fmt(total)}</p>
        </div>
        <div>
          <label className="label" htmlFor="quantidadeFisica">Quantidade física contada *</label>
          <input
            id="quantidadeFisica"
            name="quantidadeFisica"
            type="number"
            min={1}
            step={1}
            className="input"
            required
            value={fisico}
            onChange={(e) => {
              setFisico(e.target.value);
              reiniciarConfirmacao();
            }}
          />
        </div>
      </div>

      {excesso && (
        <div role="alert" className="poco-erro flex items-start gap-2 px-4 py-3 text-[12px] font-medium text-erro-claro">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" />
          Quantidade física ({fmt(qtdFisica!)}) maior que o total dos vales selecionados ({fmt(total)}). Selecione os demais vales devolvidos.
        </div>
      )}

      {pedirConfirmacao && !faltaConfirmada && (
        <div role="alertdialog" aria-labelledby="aviso-falta" className="poco-erro space-y-3 px-4 py-4 text-[12px] text-erro-claro">
          <p id="aviso-falta" className="flex items-start gap-2 font-semibold">
            <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" />
            Quantidade física ({fmt(qtdFisica!)}) menor que o total dos vales ({fmt(total)}). Confirmar a falta de {fmt(falta)} pallet(s)?
          </p>
          <p className="text-t2">Será gerado um Vale-Ocorrência de {fmt(falta)} pallet(s), que volta ao saldo devedor do remetente.</p>
          <div className="flex gap-2">
            <button type="button" className="btn-danger btn-sm" onClick={() => setFaltaConfirmada(true)}>Confirmar falta</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setPedirConfirmacao(false)}>Corrigir contagem</button>
          </div>
        </div>
      )}

      {faltaConfirmada && falta > 0 && (
        <p className="poco-erro px-4 py-3 text-[12px] font-semibold text-erro-claro">
          Falta confirmada: {fmt(falta)} pallet(s). Placa, transportadora e justificativa são obrigatórias.
        </p>
      )}
      <input type="hidden" name="confirmarFalta" value={faltaConfirmada && falta > 0 ? "1" : "0"} />

      <div className={clsx("space-y-4", faltaConfirmada && falta > 0 && "rounded-2xl ring-1 ring-erro/40 p-3")}>
        <InputPlaca key={faltaConfirmada && falta > 0 ? "obrigatoria" : "opcional"} obrigatorio={faltaConfirmada && falta > 0} />
        <div>
          <label className="label" htmlFor="transportadora">Transportadora{faltaConfirmada && falta > 0 ? " *" : ""}</label>
          <input id="transportadora" name="transportadora" className="input" maxLength={200} required={faltaConfirmada && falta > 0} minLength={faltaConfirmada && falta > 0 ? 2 : undefined} />
        </div>
        <div>
          <label className="label" htmlFor="observacao">{faltaConfirmada && falta > 0 ? "Observação / justificativa da divergência *" : "Observação"}</label>
          <textarea id="observacao" name="observacao" rows={2} className="input" maxLength={500} required={faltaConfirmada && falta > 0} minLength={faltaConfirmada && falta > 0 ? 5 : undefined} />
        </div>
      </div>

      <Mensagem estado={estado} />
      <BotaoEnviar enviando={enviando} className={falta > 0 ? "btn-danger w-full" : "btn-success w-full"} textoEnviando="Registrando...">
        <ClipboardCheck className="h-4 w-4" /> {falta > 0 && faltaConfirmada ? `Registrar retorno com falta de ${fmt(falta)}` : "Registrar retorno"}
      </BotaoEnviar>
    </form>
  );
}
