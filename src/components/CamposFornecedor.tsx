"use client";

import { useState } from "react";

type Fornecedor = { cnpj: string; nome: string };

const normalizar = (v: string) => v.toUpperCase().replace(/[^0-9A-Z]/g, "");
const mascaraCnpj = (v: string) => {
  const d = normalizar(v).slice(0, 14);
  return d
    .replace(/^(\w{2})(\w)/, "$1.$2")
    .replace(/^(\w{2})\.(\w{3})(\w)/, "$1.$2.$3")
    .replace(/\.(\w{3})(\w)/, ".$1/$2")
    .replace(/(\w{4})(\w)/, "$1-$2");
};

/** CNPJ + nome do fornecedor, com preenchimento automático para fornecedores já cadastrados. */
export function CamposFornecedor({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const [cnpj, setCnpj] = useState("");
  const [nome, setNome] = useState("");

  function alterarCnpj(valor: string) {
    const formatado = mascaraCnpj(valor);
    setCnpj(formatado);
    const conhecido = fornecedores.find((f) => f.cnpj === normalizar(formatado));
    if (conhecido) setNome(conhecido.nome);
  }

  function alterarNome(valor: string) {
    setNome(valor);
    const conhecido = fornecedores.find((f) => f.nome.toLowerCase() === valor.toLowerCase());
    if (conhecido) setCnpj(mascaraCnpj(conhecido.cnpj));
  }

  return (
    <>
      <div>
        <label className="label" htmlFor="cnpj">CNPJ *</label>
        <input
          id="cnpj"
          name="cnpj"
          className="input"
          required
          
          placeholder="00.000.000/0000-00"
          value={cnpj}
          onChange={(e) => alterarCnpj(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="fornecedorNome">Nome do Fornecedor *</label>
        <input
          id="fornecedorNome"
          name="fornecedorNome"
          className="input"
          required
          list="lista-fornecedores"
          autoComplete="off"
          value={nome}
          onChange={(e) => alterarNome(e.target.value)}
        />
        <datalist id="lista-fornecedores">
          {fornecedores.map((f) => (
            <option key={f.cnpj} value={f.nome} />
          ))}
        </datalist>
      </div>
    </>
  );
}
