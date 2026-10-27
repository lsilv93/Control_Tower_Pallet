"use client";

import { useState } from "react";
import { cnpjValido, emailValido, formatarCnpj, mascaraCnpj, mascaraTelefone, normalizarCnpj, telefoneValido } from "@/lib/formatos";

type Valores = { nome?: string | null; cnpj?: string | null; contato?: string | null; telefone?: string | null; email?: string | null };

/**
 * Campos obrigatórios padronizados dos cadastros (Fornecedor, CD e Ponto de Cross):
 * NOME, CNPJ (máscara + validação dos dígitos), CONTATO RESPONSÁVEL, TELEFONE e E-MAIL.
 * O servidor valida de novo.
 */
export function CamposPadrao({ valores, rotuloNome = "Nome", prefixo = "campo", cnpjFixo }: { valores?: Valores; rotuloNome?: string; prefixo?: string; cnpjFixo?: string }) {
  const [cnpj, setCnpj] = useState(valores?.cnpj ? formatarCnpj(valores.cnpj) : "");
  const [telefone, setTelefone] = useState(valores?.telefone ? mascaraTelefone(valores.telefone) : "");
  const [email, setEmail] = useState(valores?.email ?? "");
  const cnpjN = normalizarCnpj(cnpj);
  const cnpjErro = cnpjN.length === 14 && !cnpjValido(cnpjN);
  const telErro = telefone.replace(/\D/g, "").length >= 10 && !telefoneValido(telefone);
  const emailErro = email.includes("@") && email.includes(".") && !emailValido(email);
  const id = (n: string) => `${prefixo}-${n}`;

  return (
    <>
      <div>
        <label className="label" htmlFor={id("nome")}>{rotuloNome} *</label>
        <input id={id("nome")} name="nome" className="input" required minLength={2} maxLength={200} defaultValue={valores?.nome ?? ""} />
      </div>
      {cnpjFixo ? (
        <div>
          <input type="hidden" name="cnpj" value={cnpjFixo} />
          <span className="label">CNPJ</span>
          <p className="input num flex items-center opacity-80">{formatarCnpj(cnpjFixo)}</p>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor={id("cnpj")}>CNPJ *</label>
          <input
            id={id("cnpj")}
            name="cnpj"
            className="input num"
            required
            inputMode="text"
            placeholder="00.000.000/0000-00"
            autoComplete="off"
            value={cnpj}
            onChange={(e) => setCnpj(mascaraCnpj(e.target.value))}
            aria-invalid={cnpjErro}
          />
          {cnpjErro && <p className="mt-1 text-[11px] text-erro">CNPJ inválido — confira os dígitos.</p>}
        </div>
      )}
      <div>
        <label className="label" htmlFor={id("contato")}>Contato responsável *</label>
        <input id={id("contato")} name="contato" className="input" required minLength={2} maxLength={120} defaultValue={valores?.contato ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={id("telefone")}>Telefone *</label>
          <input
            id={id("telefone")}
            name="telefone"
            type="tel"
            className="input num"
            required
            placeholder="(00) 00000-0000"
            value={telefone}
            onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
            aria-invalid={telErro}
          />
          {telErro && <p className="mt-1 text-[11px] text-erro">Telefone inválido (DDD + número).</p>}
        </div>
        <div>
          <label className="label" htmlFor={id("email")}>E-mail *</label>
          <input id={id("email")} name="email" type="email" className="input" required maxLength={160} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={emailErro} />
        </div>
      </div>
    </>
  );
}
