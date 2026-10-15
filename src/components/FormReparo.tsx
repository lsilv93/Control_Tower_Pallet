"use client";

import { useEffect, useRef, useState } from "react";
import { Recycle, TriangleAlert } from "lucide-react";
import { registrarReparo } from "@/actions/avarias";
import { travaReparo } from "@/lib/reparo";
import { BotaoEnviar, Mensagem, useAcao } from "./FormAcao";

const n = (v: string) => (v === "" ? 0 : Math.max(0, Math.trunc(Number(v)) || 0));

/**
 * Conserto / reparo de quebrados. Pergunta se outros quebrados foram desmontados
 * para o reparo e aplica a trava: recuperados + utilizados ≤ saldo de quebrados
 * (validada de novo no servidor, com o saldo travado).
 */
export function FormReparo({ saldoQuebrados }: { saldoQuebrados: number }) {
  const { estado, enviando, aoEnviar } = useAcao(registrarReparo);
  const ref = useRef<HTMLFormElement>(null);
  const [recuperados, setRecuperados] = useState("");
  const [usouOutros, setUsouOutros] = useState<"" | "SIM" | "NAO">("");
  const [utilizados, setUtilizados] = useState("");

  useEffect(() => {
    if (estado?.ok) {
      ref.current?.reset();
      setRecuperados("");
      setUsouOutros("");
      setUtilizados("");
    }
  }, [estado]);

  const r = n(recuperados);
  const u = usouOutros === "SIM" ? n(utilizados) : 0;
  const erro = r > 0 ? travaReparo(saldoQuebrados, r, u) : null;
  const maxUtilizados = Math.max(0, saldoQuebrados - r);

  return (
    <form ref={ref} onSubmit={aoEnviar} className="space-y-4">
      <div className="poco flex items-center justify-between px-4 py-3 text-[12px]">
        <span className="text-t3">Saldo de quebrados no CD</span>
        <span className="num text-[18px] font-semibold text-ouro" data-testid="saldo-quebrados">{saldoQuebrados}</span>
      </div>
      <div>
        <label className="label" htmlFor="recuperados">Pallets recuperados *</label>
        <input id="recuperados" name="recuperados" type="number" min={1} max={saldoQuebrados} step={1} className="input" required value={recuperados} onChange={(e) => setRecuperados(e.target.value)} />
      </div>
      <fieldset>
        <legend className="label">Foi necessário utilizar/desmontar outros pallets quebrados para realizar este reparo? *</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["NAO", "SIM"] as const).map((v) => (
            <label key={v} className="poco flex cursor-pointer items-center gap-2 px-4 py-3 text-[12px] font-semibold text-t2 has-[:checked]:text-lima has-[:checked]:ring-1 has-[:checked]:ring-lima">
              <input type="radio" name="usouOutros" value={v} required checked={usouOutros === v} onChange={() => setUsouOutros(v)} />
              {v === "SIM" ? "Sim" : "Não"}
            </label>
          ))}
        </div>
      </fieldset>
      {usouOutros === "SIM" && (
        <div>
          <label className="label" htmlFor="utilizados">Pallets utilizados / destruídos no reparo *</label>
          <input id="utilizados" name="utilizados" type="number" min={1} step={1} className="input" required value={utilizados} onChange={(e) => setUtilizados(e.target.value)} />
          <p className="mt-1.5 text-[11px] text-t4">Máximo permitido agora: {maxUtilizados}. Os utilizados saem de Quebrados e vão para Descartados.</p>
        </div>
      )}
      <div>
        <label className="label" htmlFor="observacao">Observação</label>
        <textarea id="observacao" name="observacao" rows={2} className="input" maxLength={500} />
      </div>
      {r > 0 && !erro && (
        <div className="poco space-y-1 px-4 py-3 text-[12px] text-t2">
          <p>Quebrados: <strong className="num text-t1">−{r + u}</strong> (saldo final {saldoQuebrados - r - u})</p>
          <p>Vazios: <strong className="num text-lima">+{r}</strong></p>
          {u > 0 && <p>Descartados/destruídos: <strong className="num text-erro">+{u}</strong></p>}
        </div>
      )}
      {erro && (
        <div role="alert" className="poco-erro flex items-start gap-2 px-4 py-3 text-[12px] font-medium text-erro-claro">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" /> {erro}
        </div>
      )}
      <Mensagem estado={estado} />
      <BotaoEnviar enviando={enviando} className="btn-primary w-full">
        <Recycle className="h-4 w-4" /> Registrar reparo
      </BotaoEnviar>
    </form>
  );
}
