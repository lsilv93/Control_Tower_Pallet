"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cadastrarFornecedorRapido } from "@/actions/fornecedor";
import { BotaoEnviar, Mensagem, useAcao } from "./FormAcao";

export function Modal({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aoFechar]);
  // Portal no <body>: ancestrais animados (transform) criariam contexto de empilhamento
  // e prenderiam o overlay "fixed" dentro do card.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000814]/70 p-[14px]" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="card entrada max-h-[92vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-t1">{titulo}</h2>
          <button type="button" className="btn-icone" onClick={aoFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Cadastro de fornecedor com CNPJ pré-preenchido (aberto quando o CNPJ não existe na base). */
export function ModalFornecedor({
  cnpj,
  cnpjFormatado,
  aviso,
  origem,
  aoFechar,
  aoCadastrar,
}: {
  cnpj: string;
  cnpjFormatado: string;
  aviso: string;
  origem: string;
  aoFechar: () => void;
  aoCadastrar: () => void;
}) {
  const { estado, enviando, aoEnviar } = useAcao(cadastrarFornecedorRapido);
  const concluir = useRef(aoCadastrar);
  concluir.current = aoCadastrar;
  useEffect(() => {
    if (estado?.ok) concluir.current();
  }, [estado]);

  return (
    <Modal titulo="Cadastro de fornecedor" aoFechar={aoFechar}>
      <p className="poco-ouro mb-5 px-4 py-3 text-[12px] text-ouro">{aviso}</p>
      <form onSubmit={aoEnviar} className="space-y-4">
        <input type="hidden" name="cnpj" value={cnpj} />
        <input type="hidden" name="origem" value={origem} />
        <div>
          <span className="label">CNPJ</span>
          <p className="input num flex items-center opacity-80">{cnpjFormatado}</p>
        </div>
        <div>
          <label className="label" htmlFor="rapido-nome">Nome / Razão social *</label>
          <input id="rapido-nome" name="nome" className="input" required minLength={2} maxLength={200} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="rapido-endereco">Endereço</label>
          <input id="rapido-endereco" name="endereco" className="input" maxLength={200} />
        </div>
        <div className="grid grid-cols-[1fr_5rem] gap-4">
          <div>
            <label className="label" htmlFor="rapido-cidade">Cidade</label>
            <input id="rapido-cidade" name="cidade" className="input" maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="rapido-uf">UF</label>
            <input id="rapido-uf" name="uf" className="input uppercase" maxLength={2} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="rapido-contato">Contato</label>
            <input id="rapido-contato" name="contato" className="input" maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="rapido-telefone">Telefone</label>
            <input id="rapido-telefone" name="telefone" type="tel" className="input" maxLength={40} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="rapido-email">E-mail</label>
          <input id="rapido-email" name="email" type="email" className="input" maxLength={160} />
        </div>
        <Mensagem estado={estado} />
        <BotaoEnviar enviando={enviando} className="btn-primary w-full">
          Cadastrar e continuar
        </BotaoEnviar>
      </form>
    </Modal>
  );
}
