"use client";

import { useState } from "react";
import { resolverOcorrencia } from "@/actions/transferencias";
import { FormAcao } from "./FormAcao";

/** Resolução de falta (administrador): localizada (volta ao estoque do remetente) ou perda. */
export function FormResolverOcorrencia({ valeId, codigo }: { valeId: string; codigo: string }) {
  const [resolucao, setResolucao] = useState("");
  return (
    <FormAcao acao={resolverOcorrencia} botao={`Resolver ${codigo}`} classeBotao="btn-primary btn-sm w-full" className="space-y-2">
      <input type="hidden" name="valeId" value={valeId} />
      <select name="resolucao" className="input" required value={resolucao} onChange={(e) => setResolucao(e.target.value)} aria-label="Resolução">
        <option value="" disabled>Resolução...</option>
        <option value="LOCALIZADA">Localizada (volta ao estoque do remetente)</option>
        <option value="PERDA">Baixar como perda</option>
      </select>
      {resolucao === "LOCALIZADA" && (
        <select name="estoque" className="input" required defaultValue="" aria-label="Estoque">
          <option value="" disabled>Estoque de destino...</option>
          <option value="VAZIOS">Pallets bons (vazios)</option>
          <option value="QUEBRADOS">Pallets quebrados</option>
        </select>
      )}
      <textarea name="observacao" rows={2} className="input" required minLength={5} maxLength={500} placeholder="Justificativa *" aria-label="Justificativa" />
    </FormAcao>
  );
}
