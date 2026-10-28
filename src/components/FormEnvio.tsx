"use client";

import { startTransition, useActionState, useState } from "react";
import { Send, TriangleAlert } from "lucide-react";
import { enviarPallets } from "@/actions/transferencias";
import { BotaoEnviar, Mensagem } from "./FormAcao";
import { InputPlaca } from "./InputPlaca";
import { Modal } from "./ModalFornecedor";

type Unidade = { id: string; codigo: string; nome: string; tipo: "CD" | "CROSS"; hub: boolean };
const fmt = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

/**
 * Envio de pallets da unidade ativa. Valida o saldo na tela (o servidor valida de novo,
 * com o saldo travado) e, antes de registrar, pede a confirmação do destino e da quantidade.
 */
export function FormEnvio({
  modo,
  destinos,
  transportadoras,
  saldo,
  origem,
}: {
  modo: "CROSS" | "CD" | "HUB";
  destinos: Unidade[];
  transportadoras: { id: string; nome: string }[];
  saldo: { vazios: number; quebrados: number };
  origem: string;
}) {
  const [estado, executar, enviando] = useActionState(enviarPallets, null);
  const [dados, setDados] = useState<FormData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [unidadeId, setUnidadeId] = useState(modo === "HUB" && destinos.length === 1 ? destinos[0].id : "");
  const [bons, setBons] = useState("");
  const [quebrados, setQuebrados] = useState("");

  const qBons = modo === "HUB" ? 0 : Math.max(0, Math.trunc(Number(bons) || 0));
  const qQuebrados = Math.max(0, Math.trunc(Number(quebrados) || 0));
  const total = qBons + qQuebrados;
  const destino = destinos.find((d) => d.id === unidadeId);
  const faltaBons = qBons > saldo.vazios;
  const faltaQuebrados = qQuebrados > saldo.quebrados;
  const tipoDestino = modo === "CROSS" ? "Ponto de Cross" : modo === "HUB" ? "CD Hub" : "CD";

  function aoEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    if (total <= 0) return setErro("Informe a quantidade de pallets a enviar.");
    if (faltaBons || faltaQuebrados) {
      return setErro(
        `Saldo insuficiente em ${origem}: ${faltaBons ? `Pallets PBR disponíveis ${fmt(saldo.vazios)}, solicitado ${fmt(qBons)}` : ""}${faltaBons && faltaQuebrados ? " · " : ""}${faltaQuebrados ? `Pallets Quebrados disponíveis ${fmt(saldo.quebrados)}, solicitado ${fmt(qQuebrados)}` : ""}. Envio bloqueado.`,
      );
    }
    setDados(new FormData(e.currentTarget));
  }

  function confirmar() {
    if (!dados) return;
    const fd = dados;
    setDados(null);
    startTransition(() => executar(fd));
  }

  return (
    <>
      <form onSubmit={aoEnviar} className="space-y-4">
        <input type="hidden" name="modo" value={modo} />
        <div>
          <label className="label" htmlFor="unidadeId">{tipoDestino} de destino *</label>
          <select id="unidadeId" name="unidadeId" className="input" required value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
            <option value="" disabled>Selecione...</option>
            {destinos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.codigo} - {d.nome}{d.hub ? " (Hub)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className={modo === "HUB" ? "" : "grid grid-cols-2 gap-4"}>
          {modo !== "HUB" && (
            <div>
              <label className="label" htmlFor="quantidadeBons">Pallets PBR</label>
              <input id="quantidadeBons" name="quantidadeBons" type="number" min={0} step={1} className="input" value={bons} onChange={(e) => setBons(e.target.value)} placeholder="0" />
              <p className={`mt-1 text-[11px] ${faltaBons ? "font-semibold text-erro" : "text-t4"}`}>Disponível: <span className="num">{fmt(saldo.vazios)}</span></p>
            </div>
          )}
          <div>
            <label className="label" htmlFor="quantidadeQuebrados">Pallets Quebrados{modo === "HUB" ? " *" : ""}</label>
            <input id="quantidadeQuebrados" name="quantidadeQuebrados" type="number" min={0} step={1} className="input" value={quebrados} onChange={(e) => setQuebrados(e.target.value)} placeholder="0" required={modo === "HUB"} />
            <p className={`mt-1 text-[11px] ${faltaQuebrados ? "font-semibold text-erro" : "text-t4"}`}>Disponível: <span className="num">{fmt(saldo.quebrados)}</span></p>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="transportadoraId">Transportador *</label>
          <select id="transportadoraId" name="transportadoraId" className="input" required defaultValue="">
            <option value="" disabled>Selecione...</option>
            {transportadoras.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <InputPlaca rotulo="Placa do veículo" />
        {modo === "CROSS" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="rota">Rota</label>
              <input id="rota" name="rota" className="input" maxLength={60} placeholder="Ex.: R-01/SP" autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="dataFaturamento">Data de faturamento</label>
              <input id="dataFaturamento" name="dataFaturamento" type="date" className="input" />
            </div>
          </div>
        )}
        <div>
          <label className="label" htmlFor="observacao">Observação</label>
          <textarea id="observacao" name="observacao" rows={2} className="input" maxLength={500} />
        </div>
        {erro && (
          <div role="alert" className="poco-erro flex items-start gap-2 px-4 py-3 text-[12px] font-medium text-erro-claro">
            <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" /> {erro}
          </div>
        )}
        <Mensagem estado={estado} />
        <BotaoEnviar enviando={enviando} className="btn-primary w-full" textoEnviando="Enviando...">
          <Send className="h-4 w-4" /> {modo === "HUB" ? "Enviar Pallets Quebrados ao CDJC" : "Gerar vale de envio"}
        </BotaoEnviar>
      </form>

      {dados && destino && (
        <Modal titulo="Confirmar envio" aoFechar={() => setDados(null)}>
          <p className="mb-4 text-[14px] font-semibold text-t1" data-testid="pergunta-envio">
            Tem certeza do {tipoDestino} selecionado e da quantidade informada ({fmt(total)} pallets)?
          </p>
          <dl className="poco mb-5 grid grid-cols-2 gap-3 p-4 text-[12px]">
            <div><dt className="text-t4">Origem</dt><dd className="num font-semibold text-t1">{origem}</dd></div>
            <div><dt className="text-t4">Destino</dt><dd className="font-semibold text-t1"><span className="num">{destino.codigo}</span> · {destino.nome}</dd></div>
            {modo !== "HUB" && <div><dt className="text-t4">Pallets PBR</dt><dd className="num text-[18px] font-semibold text-lima">{fmt(qBons)}</dd></div>}
            <div><dt className="text-t4">Pallets Quebrados</dt><dd className="num text-[18px] font-semibold text-ouro">{fmt(qQuebrados)}</dd></div>
          </dl>
          <p className="mb-4 text-[11px] text-t3">Os pallets saem do estoque de {origem} e ficam em trânsito até a conferência em {destino.codigo}.</p>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setDados(null)}>Corrigir</button>
            <button type="button" className="btn-primary flex-1" onClick={confirmar}>Confirmar envio</button>
          </div>
        </Modal>
      )}
    </>
  );
}
