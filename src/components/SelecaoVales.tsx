"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { gerarAgenda } from "@/actions/vales";
import type { Farol } from "@/lib/farol";
import { BotaoEnviar, Mensagem, useAcao } from "./FormAcao";
import { FarolBadge, StatusBadge } from "./ui";

export type LinhaVale = {
  id: string;
  numero: string;
  fornecedor: string;
  cnpj: string;
  notaFiscal: string;
  transportadora: string;
  placa: string;
  emissao: string;
  usuario: string;
  quantidade: number;
  idade: number;
  farol: Farol;
  status: "PENDENTE" | "AGENDADO";
  statusRotulo: string;
  agenda: string | null;
};

export function SelecaoVales({ vales, hoje }: { vales: LinhaVale[]; hoje: string }) {
  const { estado, enviando, aoEnviar } = useAcao(gerarAgenda);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const pendentes = vales.filter((v) => v.status === "PENDENTE");

  useEffect(() => {
    if (estado?.ok) setSelecionados(new Set());
  }, [estado]);

  const resumo = useMemo(() => {
    const sel = vales.filter((v) => selecionados.has(v.id));
    return {
      qtd: sel.reduce((s, v) => s + v.quantidade, 0),
      fornecedores: new Set(sel.map((v) => v.cnpj)).size,
    };
  }, [vales, selecionados]);

  const alternar = (id: string) =>
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const todos = pendentes.length > 0 && pendentes.every((v) => selecionados.has(v.id));

  return (
    <form onSubmit={aoEnviar}>
      <div className="card p-3 sm:p-4">
      <div className="poco overflow-x-auto">
        <table className="tabela">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os pendentes"
                  checked={todos}
                  onChange={() => setSelecionados(todos ? new Set() : new Set(pendentes.map((v) => v.id)))}
                />
              </th>
              <th>Farol</th>
              <th>Vale</th>
              <th>Fornecedor</th>
              <th>NF</th>
              <th>Transportadora / Placa</th>
              <th>Emissão</th>
              <th className="text-right">Idade</th>
              <th className="text-right">Qtd.</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {vales.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-t3">Nenhum vale em aberto.</td>
              </tr>
            )}
            {vales.map((v) => (
              <tr key={v.id} className={selecionados.has(v.id) ? "bg-lima/[.06]" : undefined}>
                <td>
                  {v.status === "PENDENTE" && (
                    <input
                      type="checkbox"
                      name="valeIds"
                      value={v.id}
                      checked={selecionados.has(v.id)}
                      onChange={() => alternar(v.id)}
                      aria-label={`Selecionar ${v.numero}`}
                    />
                  )}
                </td>
                <td><FarolBadge farol={v.farol} /></td>
                <td>
                  <Link prefetch={false} href={`/imprimir/vale/${v.id}`} className="num font-semibold text-lima hover:underline">
                    {v.numero}
                  </Link>
                </td>
                <td>
                  <p className="max-w-[14rem] truncate font-medium text-t1" title={v.fornecedor}>{v.fornecedor}</p>
                  <p className="text-[11px] text-t4">{v.cnpj}</p>
                </td>
                <td>{v.notaFiscal}</td>
                <td>
                  <p className="max-w-[10rem] truncate">{v.transportadora}</p>
                  <p className="text-[11px] text-t4">{v.placa}</p>
                </td>
                <td>
                  <p>{v.emissao}</p>
                  <p className="text-[11px] text-t4">{v.usuario}</p>
                </td>
                <td className="text-right tabular-nums">{v.idade} d</td>
                <td className="text-right font-semibold tabular-nums text-t1">{v.quantidade}</td>
                <td>
                  <StatusBadge status={v.status} rotulo={v.statusRotulo} />
                  {v.agenda && <p className="mt-0.5 text-[11px] text-t4">{v.agenda}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      <div className="card sticky bottom-4 z-10 mt-5 flex flex-wrap items-end gap-4 p-5">
        <div className="min-w-[10rem] text-[12px]">
          <p className="label !mb-1">Selecionados</p>
          <p className="num text-[13px] font-semibold text-t1">
            {selecionados.size} vale(s) · {resumo.qtd} pallet(s)
            {resumo.fornecedores > 1 && <span className="text-t3"> · {resumo.fornecedores} agendas</span>}
          </p>
        </div>
        <div>
          <label className="label" htmlFor="dataPrevista">Data prevista da devolução *</label>
          <input id="dataPrevista" name="dataPrevista" type="date" min={hoje} defaultValue={hoje} className="input" required />
        </div>
        <div className="min-w-[14rem] flex-1">
          <label className="label" htmlFor="observacao">Observação</label>
          <input id="observacao" name="observacao" className="input" maxLength={500} />
        </div>
        <BotaoEnviar enviando={enviando || selecionados.size === 0} textoEnviando={enviando ? "Gerando..." : "Selecione vales"}>
          <CalendarPlus className="h-4 w-4" /> Gerar Agenda de Devolução
        </BotaoEnviar>
        {estado && (
          <div className="w-full">
            <Mensagem estado={estado} />
          </div>
        )}
      </div>
    </form>
  );
}
