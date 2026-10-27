"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cadastrarFornecedorRapido } from "@/actions/fornecedor";
import { CamposPadrao } from "./CamposPadrao";
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
  aviso,
  origem,
  aoFechar,
  aoCadastrar,
}: {
  cnpj: string;
  /** Mantido por compatibilidade com os chamadores (o campo exibe o CNPJ formatado). */
  cnpjFormatado?: string;
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
        <input type="hidden" name="origem" value={origem} />
        <CamposPadrao prefixo="rapido" rotuloNome="Nome / Razão social" cnpjFixo={cnpj} />
        <Mensagem estado={estado} />
        <BotaoEnviar enviando={enviando} className="btn-primary w-full">
          Cadastrar e continuar
        </BotaoEnviar>
      </form>
    </Modal>
  );
}
