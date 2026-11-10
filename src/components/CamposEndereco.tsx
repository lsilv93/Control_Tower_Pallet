"use client";

import { useState } from "react";
import { mascaraCep, UFS } from "@/lib/formatos";

type Valores = { endereco?: string | null; cidade?: string | null; uf?: string | null; cep?: string | null };

/**
 * Endereço da unidade (CD ou Ponto de Cross): Endereço, Cidade, Estado (lista de UFs) e CEP
 * com máscara. Impresso como emitente no Vale-Pallet. O servidor valida de novo.
 */
export function CamposEndereco({ valores, obrigatorio = true }: { valores?: Valores; obrigatorio?: boolean }) {
  const [cep, setCep] = useState(valores?.cep ? mascaraCep(valores.cep) : "");
  const asterisco = obrigatorio ? " *" : "";
  return (
    <fieldset className="space-y-4" data-testid="campos-endereco">
      <div>
        <label className="label" htmlFor="campo-endereco">Endereço{asterisco}</label>
        <input id="campo-endereco" name="endereco" className="input" required={obrigatorio} minLength={3} maxLength={200} defaultValue={valores?.endereco ?? ""} placeholder="Rua, número, complemento, bairro" />
      </div>
      <div className="grid grid-cols-[1fr_5.5rem] gap-4">
        <div>
          <label className="label" htmlFor="campo-cidade">Cidade{asterisco}</label>
          <input id="campo-cidade" name="cidade" className="input" required={obrigatorio} minLength={2} maxLength={120} defaultValue={valores?.cidade ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="campo-uf">Estado{asterisco}</label>
          <select id="campo-uf" name="uf" className="input" required={obrigatorio} defaultValue={valores?.uf ?? ""}>
            <option value="" disabled>UF</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
      </div>
      <div className="sm:w-1/2">
        <label className="label" htmlFor="campo-cep">CEP{asterisco}</label>
        <input id="campo-cep" name="cep" className="input num" inputMode="numeric" required={obrigatorio} pattern="\d{5}-\d{3}" title="CEP no formato 00000-000" placeholder="00000-000" value={cep} onChange={(e) => setCep(mascaraCep(e.target.value))} />
      </div>
    </fieldset>
  );
}
