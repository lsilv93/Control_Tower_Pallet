"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ClipboardCheck, TriangleAlert } from "lucide-react";
import { Modal } from "./ModalFornecedor";
import { conferirRecebimento } from "@/actions/transferencias";
import { BotaoEnviar, Mensagem, useAcao } from "./FormAcao";
import { InputPlaca } from "./InputPlaca";

type Unidade = { id: string; codigo: string; nome: string; tipo: "CD" | "CROSS"; hub: boolean };
export type ValeConferencia = {
  id: string;
  codigo: string;
  remetenteId: string;
  bons: number;
  quebrados: number;
  quantidade: number;
  data: string;
  transportadora: string | null;
  /** Transportadora do envio no cadastro (para pré-preencher a conferência). */
  transportadoraId: string | null;
  placa: string | null;
};

const fmt = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const inteiro = (v: string) => (v === "" ? null : Math.max(0, Math.trunc(Number(v) || 0)));

/**
 * Conferência de recebimento: seleciona os vales de envio do remetente (soma automática;
 * placa e transportadora vêm preenchidas do envio), informa a contagem física de Pallets PBR
 * e Quebrados e, havendo divergência, confirma a diferença exata com justificativa — o
 * servidor gera a ocorrência pendente na unidade remetente.
 */
export function FormConferencia({
  remetentes,
  vales,
  transportadoras,
  remetenteInicial,
}: {
  remetentes: Unidade[];
  vales: ValeConferencia[];
  transportadoras: { id: string; nome: string }[];
  remetenteInicial?: string;
}) {
  const { estado, enviando, aoEnviar } = useAcao(conferirRecebimento);
  const [remetenteId, setRemetenteId] = useState(remetentes.some((r) => r.id === remetenteInicial) ? remetenteInicial! : remetentes.length === 1 ? remetentes[0].id : "");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [bons, setBons] = useState("");
  const [quebrados, setQuebrados] = useState("");
  const [confirmada, setConfirmada] = useState(false);
  const [pedirConfirmacao, setPedirConfirmacao] = useState(false);
  // Placa e transportadora vêm do envio (primeiro vale selecionado); o conferente pode corrigir.
  const [placa, setPlaca] = useState("");
  const [transportadoraId, setTransportadoraId] = useState("");

  const doRemetente = useMemo(() => vales.filter((v) => v.remetenteId === remetenteId), [vales, remetenteId]);
  const escolhidos = doRemetente.filter((v) => selecionados.has(v.id));
  const declaradoBons = escolhidos.reduce((s, v) => s + v.bons, 0);
  const declaradoQuebrados = escolhidos.reduce((s, v) => s + v.quebrados, 0);
  const declarado = declaradoBons + declaradoQuebrados;
  const qBons = inteiro(bons);
  const qQuebrados = inteiro(quebrados);
  const informado = qBons !== null || qQuebrados !== null;
  const recebido = (qBons ?? 0) + (qQuebrados ?? 0);
  const diferenca = informado && declarado > 0 ? recebido - declarado : 0;
  const divergente = diferenca !== 0;

  const reiniciar = () => {
    setConfirmada(false);
    setPedirConfirmacao(false);
  };
  const preencherDoEnvio = (ids: Set<string>) => {
    const primeiro = doRemetente.find((v) => ids.has(v.id));
    setPlaca(primeiro?.placa ?? "");
    setTransportadoraId(primeiro?.transportadoraId ?? "");
  };
  const selecionar = (ids: Set<string>) => {
    reiniciar();
    setSelecionados(ids);
    preencherDoEnvio(ids);
  };
  const alternar = (id: string) => {
    const n = new Set(selecionados);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    selecionar(n);
  };
  const difBons = (qBons ?? 0) - declaradoBons;
  const difQuebrados = (qQuebrados ?? 0) - declaradoQuebrados;
  const sinal = (v: number) => (v > 0 ? `+${fmt(v)}` : fmt(v));

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    if (divergente && !confirmada) {
      e.preventDefault();
      setPedirConfirmacao(true);
      return;
    }
    aoEnviar(e);
  }

  const rotuloDiv = diferenca < 0 ? `falta de ${fmt(-diferenca)}` : `sobra de ${fmt(diferenca)}`;

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <label className="label" htmlFor="remetenteId">CD / Ponto de Cross remetente *</label>
        <select
          id="remetenteId"
          name="remetenteId"
          className="input"
          required
          value={remetenteId}
          onChange={(e) => {
            setRemetenteId(e.target.value);
            selecionar(new Set());
          }}
        >
          <option value="" disabled>Selecione...</option>
          {remetentes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.tipo === "CROSS" ? "Cross" : r.hub ? "Hub" : "CD"} · {r.codigo} - {r.nome}
            </option>
          ))}
        </select>
      </div>

      {remetenteId && (
        <fieldset>
          <div className="mb-2 flex items-center justify-between">
            <legend className="label !mb-0">Vales recebidos *</legend>
            {doRemetente.length > 1 && (
              <button
                type="button"
                className="text-[11px] font-semibold text-lima hover:underline"
                onClick={() => selecionar(selecionados.size === doRemetente.length ? new Set() : new Set(doRemetente.map((v) => v.id)))}
              >
                {selecionados.size === doRemetente.length ? "Limpar" : "Selecionar todos"}
              </button>
            )}
          </div>
          {doRemetente.length === 0 ? (
            <p className="poco px-4 py-3 text-[12px] text-t3">Nenhum vale pendente deste remetente.</p>
          ) : (
            <div className="poco max-h-64 divide-y divide-[var(--groove)] overflow-auto" data-testid="vales-a-conferir">
              {doRemetente.map((v) => (
                <label key={v.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[12px]">
                  <input type="checkbox" name="valeIds" value={v.id} checked={selecionados.has(v.id)} onChange={() => alternar(v.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="num font-semibold text-t1">{v.codigo}</span>
                    <span className="block text-[11px] text-t4">
                      {v.data}
                      {v.transportadora ? ` · ${v.transportadora}` : ""}
                      {v.placa ? ` · ${v.placa}` : ""}
                    </span>
                  </span>
                  <span className="text-right text-[11px] text-t3">
                    <span className="num block text-[13px] font-semibold text-t1">{fmt(v.quantidade)}</span>
                    {fmt(v.bons)} PBR · {fmt(v.quebrados)} quebrados
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      <div className="poco grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-t4">Declarado</p>
          <p className="num text-[22px] font-semibold text-t1" data-testid="total-vales">{fmt(declarado)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-t4">Pallets PBR</p>
          <p className="num text-[16px] font-semibold text-lima">{fmt(declaradoBons)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-t4">Pallets Quebrados</p>
          <p className="num text-[16px] font-semibold text-ouro">{fmt(declaradoQuebrados)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-t4">Diferença</p>
          <p className={clsx("num text-[16px] font-semibold", divergente ? "text-erro" : "text-t3")} data-testid="diferenca">{informado && declarado > 0 ? sinal(diferenca) : "—"}</p>
        </div>
      </div>
      {divergente && !confirmada && (
        <p role="alert" className="poco-erro flex items-start gap-2 px-4 py-3 text-[12px] font-semibold text-erro-claro" data-testid="alerta-divergencia">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" /> Divergência de {sinal(diferenca)} pallet(s) em relação ao enviado ({rotuloDiv}).
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="recebidoBons">Pallets PBR recebidos *</label>
          <input id="recebidoBons" name="recebidoBons" type="number" min={0} step={1} className="input" required value={bons} onChange={(e) => { setBons(e.target.value); reiniciar(); }} />
        </div>
        <div>
          <label className="label" htmlFor="recebidoQuebrados">Pallets Quebrados recebidos *</label>
          <input id="recebidoQuebrados" name="recebidoQuebrados" type="number" min={0} step={1} className="input" required value={quebrados} onChange={(e) => { setQuebrados(e.target.value); reiniciar(); }} />
        </div>
      </div>

      {pedirConfirmacao && !confirmada && (
        <Modal titulo="Divergência na conferência" aoFechar={() => setPedirConfirmacao(false)}>
          <div role="alertdialog" aria-labelledby="aviso-divergencia" className="space-y-4 text-[12px]">
            <p id="aviso-divergencia" className="flex items-start gap-2 text-[14px] font-semibold text-erro-claro">
              <TriangleAlert className="mt-0.5 h-5 w-5 flex-none text-erro" />
              Recebido {fmt(recebido)} × enviado {fmt(declarado)}: {rotuloDiv} pallet(s). Confirmar a divergência?
            </p>
            <dl className="poco grid grid-cols-3 gap-3 p-4 text-center">
              <div><dt className="text-t4">Pallets PBR</dt><dd className="num text-[16px] font-semibold text-t1">{sinal(difBons)}</dd></div>
              <div><dt className="text-t4">Pallets Quebrados</dt><dd className="num text-[16px] font-semibold text-t1">{sinal(difQuebrados)}</dd></div>
              <div><dt className="text-t4">Total</dt><dd className="num text-[16px] font-semibold text-erro">{sinal(diferenca)}</dd></div>
            </dl>
            <p className="text-t2">
              Será gerada uma <strong>ocorrência de {diferenca < 0 ? "falta" : "sobra"}</strong> pendente na unidade remetente, que aceita ou recusa com justificativa.
              {diferenca > 0 && " A sobra entra no estoque desta unidade agora."}
            </p>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary flex-1" onClick={() => setPedirConfirmacao(false)}>Corrigir contagem</button>
              <button type="button" className="btn-danger flex-1" onClick={() => { setConfirmada(true); setPedirConfirmacao(false); }}>Confirmar divergência</button>
            </div>
          </div>
        </Modal>
      )}

      {confirmada && divergente && (
        <p className="poco-erro px-4 py-3 text-[12px] font-semibold text-erro-claro" data-testid="divergencia-confirmada">
          Divergência confirmada: {rotuloDiv} pallet(s). A justificativa é obrigatória.
        </p>
      )}
      <input type="hidden" name="confirmarDivergencia" value={confirmada && divergente ? "1" : "0"} />

      <div className={clsx("space-y-4", confirmada && divergente && "rounded-2xl p-3 ring-1 ring-erro/40")}>
        <div className="grid grid-cols-2 gap-4">
          <InputPlaca rotulo="Placa do veículo" valor={placa} aoMudar={setPlaca} />
          <div>
            <label className="label" htmlFor="transportadoraId">Transportadora</label>
            <select id="transportadoraId" name="transportadoraId" className="input" value={transportadoraId} onChange={(e) => setTransportadoraId(e.target.value)}>
              <option value="">Não informada</option>
              {transportadoras.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="observacao">{confirmada && divergente ? "Justificativa da divergência *" : "Observação"}</label>
          <textarea id="observacao" name="observacao" rows={2} className="input" maxLength={500} required={confirmada && divergente} minLength={confirmada && divergente ? 5 : undefined} />
        </div>
      </div>

      <Mensagem estado={estado} />
      <BotaoEnviar enviando={enviando} className={divergente ? "btn-danger w-full" : "btn-success w-full"} textoEnviando="Registrando...">
        <ClipboardCheck className="h-4 w-4" /> {divergente && confirmada ? `Registrar conferência com ${rotuloDiv}` : "Registrar conferência"}
      </BotaoEnviar>
    </form>
  );
}
