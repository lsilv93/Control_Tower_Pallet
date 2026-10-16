"use client";

import { useState } from "react";
import { mascaraPlaca } from "@/lib/formatos";

/**
 * Campo de placa com máscara: aceita o padrão antigo (ABC-1234 / ABC1234) e o
 * Mercosul (ABC1D23), sempre em maiúsculas. O servidor valida de novo.
 */
export function InputPlaca({
  id = "placa",
  name = "placa",
  obrigatorio = false,
  rotulo = "Placa do veículo",
  valorInicial = "",
}: {
  id?: string;
  name?: string;
  obrigatorio?: boolean;
  rotulo?: string;
  valorInicial?: string;
}) {
  const [valor, setValor] = useState(mascaraPlaca(valorInicial));
  return (
    <div>
      <label className="label" htmlFor={id}>{rotulo}{obrigatorio ? " *" : ""}</label>
      <input
        id={id}
        name={name}
        value={valor}
        onChange={(e) => setValor(mascaraPlaca(e.target.value))}
        className="input num uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal"
        placeholder="ABC-1234 ou ABC1D23"
        required={obrigatorio}
        maxLength={8}
        pattern="[A-Z]{3}-[0-9]{4}|[A-Z]{3}[0-9][A-Z0-9][0-9]{2}"
        title="Placa no padrão antigo (ABC-1234) ou Mercosul (ABC1D23)"
        autoComplete="off"
        inputMode="text"
        autoCapitalize="characters"
      />
    </div>
  );
}
