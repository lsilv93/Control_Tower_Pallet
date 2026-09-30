"use client";

import { useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { CircleCheck, Lock, UserPlus } from "lucide-react";
import { buscarFornecedorPorCnpj } from "@/actions/fornecedor";
import { cnpjValido, formatarCnpj, normalizarCnpj } from "@/lib/formatos";
import { ModalFornecedor } from "./ModalFornecedor";

const mascaraCnpj = (v: string) => {
  const d = normalizarCnpj(v).slice(0, 14);
  return d
    .replace(/^(\w{2})(\w)/, "$1.$2")
    .replace(/^(\w{2})\.(\w{3})(\w)/, "$1.$2.$3")
    .replace(/\.(\w{3})(\w)/, ".$1/$2")
    .replace(/(\w{4})(\w)/, "$1-$2");
};

type Situacao =
  | { tipo: "vazio" }
  | { tipo: "invalido" }
  | { tipo: "buscando" }
  | { tipo: "ok"; nome: string }
  | { tipo: "inativo"; nome: string }
  | { tipo: "nao_encontrado"; cnpj: string };

/**
 * CNPJ + Nome do Fornecedor. O nome fica bloqueado para digitação: só é liberado
 * e preenchido automaticamente a partir do cadastro, depois de um CNPJ válido.
 * CNPJ não cadastrado abre o cadastro de fornecedor e, ao salvar, volta preenchido.
 */
export function CamposFornecedor() {
  const [cnpj, setCnpj] = useState("");
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "vazio" });
  const [modal, setModal] = useState(false);
  const [, iniciar] = useTransition();
  const ultimaBusca = useRef("");

  function buscar(valor: string) {
    const normalizado = normalizarCnpj(valor);
    ultimaBusca.current = normalizado;
    setSituacao({ tipo: "buscando" });
    iniciar(async () => {
      const r = await buscarFornecedorPorCnpj(normalizado);
      if (ultimaBusca.current !== normalizado) return; // usuário já mudou o CNPJ
      if (r.status === "ok") setSituacao({ tipo: "ok", nome: r.nome });
      else if (r.status === "inativo") setSituacao({ tipo: "inativo", nome: r.nome });
      else if (r.status === "nao_encontrado") {
        setSituacao({ tipo: "nao_encontrado", cnpj: r.cnpj });
        setModal(true);
      } else setSituacao({ tipo: "invalido" });
    });
  }

  function alterarCnpj(valor: string) {
    const formatado = mascaraCnpj(valor);
    setCnpj(formatado);
    const normalizado = normalizarCnpj(formatado);
    if (normalizado.length < 14) {
      ultimaBusca.current = "";
      setSituacao({ tipo: "vazio" });
    } else if (!cnpjValido(normalizado)) {
      ultimaBusca.current = "";
      setSituacao({ tipo: "invalido" });
    } else if (normalizado !== ultimaBusca.current) {
      buscar(normalizado);
    }
  }

  const liberado = situacao.tipo === "ok";
  const nome = situacao.tipo === "ok" || situacao.tipo === "inativo" ? situacao.nome : "";

  return (
    <>
      <div>
        <label className="label" htmlFor="cnpj">CNPJ *</label>
        <input
          id="cnpj"
          name="cnpj"
          className="input num"
          required
          placeholder="00.000.000/0000-00"
          autoComplete="off"
          value={cnpj}
          onChange={(e) => alterarCnpj(e.target.value)}
          aria-invalid={situacao.tipo === "invalido"}
          aria-describedby="cnpj-situacao"
        />
        <p id="cnpj-situacao" className={clsx("mt-1.5 min-h-[16px] text-[11px]", {
          "text-t4": situacao.tipo === "vazio" || situacao.tipo === "buscando",
          "text-erro": situacao.tipo === "invalido" || situacao.tipo === "inativo",
          "text-lima": situacao.tipo === "ok",
          "text-ouro": situacao.tipo === "nao_encontrado",
        })}>
          {situacao.tipo === "vazio" && "Digite o CNPJ para liberar o fornecedor."}
          {situacao.tipo === "buscando" && "Consultando cadastro..."}
          {situacao.tipo === "invalido" && "CNPJ inválido — confira os dígitos."}
          {situacao.tipo === "ok" && "Fornecedor encontrado no cadastro."}
          {situacao.tipo === "inativo" && "Fornecedor inativo — reative-o em Cadastros para emitir vales."}
          {situacao.tipo === "nao_encontrado" && "CNPJ não cadastrado."}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="fornecedorNome">Nome do Fornecedor *</label>
        <div className="relative">
          <input
            id="fornecedorNome"
            className={clsx("input pr-11", liberado ? "font-semibold" : "cursor-not-allowed")}
            value={nome}
            placeholder={liberado ? "" : "Preenchido automaticamente pelo CNPJ"}
            readOnly
            disabled={!liberado}
            tabIndex={-1}
            aria-readonly
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
            {liberado ? <CircleCheck className="h-4 w-4 text-lima" /> : <Lock className="h-4 w-4 text-t4" />}
          </span>
        </div>
        {situacao.tipo === "nao_encontrado" && !modal && (
          <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => setModal(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Cadastrar fornecedor
          </button>
        )}
      </div>

      {modal && situacao.tipo === "nao_encontrado" && (
        <ModalFornecedor
          cnpj={situacao.cnpj}
          cnpjFormatado={formatarCnpj(situacao.cnpj)}
          origem="cadastro automático (entrada de fornecedor)"
          aviso="Este CNPJ ainda não está cadastrado. Cadastre o fornecedor para continuar a entrada; ao salvar, você volta para a entrada com os dados preenchidos."
          aoFechar={() => setModal(false)}
          aoCadastrar={() => {
            setModal(false);
            buscar(situacao.cnpj);
          }}
        />
      )}
    </>
  );
}
