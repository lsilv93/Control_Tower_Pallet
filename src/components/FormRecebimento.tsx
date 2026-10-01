"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { CircleCheck, FileX2, RotateCcw, ScanBarcode, UserPlus } from "lucide-react";
import { identificarNfRecebimento, registrarRecebimentoFornecedor, type IdentificacaoNf } from "@/actions/fornecedor";
import { normalizarChave } from "@/lib/nfe";
import { CamposFornecedor } from "./CamposFornecedor";
import { BotaoEnviar, Mensagem, useAcao } from "./FormAcao";
import { ModalFornecedor } from "./ModalFornecedor";

type NfOk = Extract<IdentificacaoNf, { ok: true }>;

/**
 * Recebimento de pallets de fornecedor.
 * - Com NF (padrão): foco no código de barras da NF-e; o leitor "digita" os 44
 *   dígitos (+ Enter) e o sistema extrai CNPJ e número da NF, busca o fornecedor e
 *   preenche os campos. Fornecedor não cadastrado abre o cadastro com o CNPJ.
 * - Sem Nota Fiscal: o código de barras some e o fornecedor é buscado pelo CNPJ.
 */
export function FormRecebimento({ transportadoras, conferentePadrao }: { transportadoras: string[]; conferentePadrao: string }) {
  const [semNf, setSemNf] = useState(false);
  const [leitura, setLeitura] = useState("");
  const [nf, setNf] = useState<NfOk | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [lendo, iniciar] = useTransition();
  const { estado, enviando, aoEnviar } = useAcao(registrarRecebimentoFornecedor);
  const campoChave = useRef<HTMLInputElement>(null);
  const campoQtd = useRef<HTMLInputElement>(null);
  const ultimaLida = useRef("");

  // Foco inicial no código de barras.
  useEffect(() => {
    campoChave.current?.focus();
  }, []);

  function identificar(codigo: string) {
    const chave = normalizarChave(codigo);
    if (!chave) return;
    ultimaLida.current = chave;
    setErro(null);
    setNf(null);
    iniciar(async () => {
      const r = await identificarNfRecebimento(chave);
      if (!r.ok) {
        setErro(r.erro);
        campoChave.current?.select();
        return;
      }
      setNf(r);
      setLeitura(r.chave);
      if (!r.fornecedor) setModal(true); // CNPJ não cadastrado: cadastro com CNPJ pré-preenchido
      else if (r.fornecedor.ativo) setTimeout(() => campoQtd.current?.focus(), 50);
    });
  }

  function trocarModo(sem: boolean) {
    setSemNf(sem);
    setNf(null);
    setErro(null);
    setLeitura("");
    ultimaLida.current = "";
    setTimeout(() => (sem ? document.getElementById("cnpj") : campoChave.current)?.focus(), 50);
  }

  function lerOutra() {
    setNf(null);
    setErro(null);
    setLeitura("");
    ultimaLida.current = "";
    campoChave.current?.focus();
  }

  const fornecedorPronto = semNf || (nf?.fornecedor?.ativo ?? false);

  return (
    <form onSubmit={aoEnviar} className="space-y-6">
      <input type="hidden" name="modo" value={semNf ? "SEM_NF" : "NF"} />

      {/* Alternância Com NF / Sem Nota Fiscal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label !mb-0">{semNf ? "Recebimento sem nota fiscal" : "Leitura da nota fiscal"}</p>
        <label className={clsx("pill cursor-pointer select-none !px-4 !py-2 text-[11px]", semNf ? "bg-ouro/15 text-ouro" : "text-t2")}>
          <input type="checkbox" checked={semNf} onChange={(e) => trocarModo(e.target.checked)} className="mr-1" />
          <FileX2 className="h-3.5 w-3.5" /> Sem Nota Fiscal
        </label>
      </div>

      {!semNf ? (
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="chave">Código de barras da NF-e (chave de acesso · 44 dígitos)</label>
            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-[16rem] flex-1">
                <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-lima" />
                <input
                  ref={campoChave}
                  id="chave"
                  name="chave"
                  value={leitura}
                  readOnly={!!nf}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLeitura(v);
                    setErro(null);
                    // Leitores sem Enter: identifica ao completar 44 dígitos.
                    const n = normalizarChave(v);
                    if (n.length === 44 && n !== ultimaLida.current) identificar(n);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault(); // Enter valida a chave, não envia o formulário
                      if (!nf) identificar(leitura);
                    }
                  }}
                  className="input num !min-h-[56px] !pl-14 !text-[16px] tracking-[0.12em]"
                  placeholder="Bipe ou digite a chave e tecle Enter"
                  autoComplete="off"
                  inputMode="numeric"
                  aria-describedby="chave-ajuda"
                />
              </div>
              {nf ? (
                <button type="button" className="btn-secondary" onClick={lerOutra}><RotateCcw className="h-4 w-4" /> Ler outra NF</button>
              ) : (
                <button type="button" className="btn-primary" disabled={lendo || !leitura.trim()} onClick={() => identificar(leitura)}>
                  {lendo ? "Lendo..." : "Validar"}
                </button>
              )}
            </div>
            <p id="chave-ajuda" className="mt-1.5 text-[11px] text-t4">
              {normalizarChave(leitura).length > 0 && !nf ? `${normalizarChave(leitura).length} de 44 dígitos` : "O leitor envia os 44 dígitos e o Enter automaticamente."}
            </p>
          </div>

          {erro && <Mensagem estado={{ ok: false, mensagem: erro, ts: 0 }} />}

          {nf && (
            <div className="poco grid gap-4 p-5 sm:grid-cols-3">
              <div className="sm:col-span-3 flex items-center gap-2 text-[12px] font-semibold">
                {nf.fornecedor?.ativo ? (
                  <><CircleCheck className="h-4 w-4 text-lima" /><span className="text-lima">Fornecedor encontrado no cadastro</span></>
                ) : nf.fornecedor ? (
                  <span className="text-erro">Fornecedor inativo — reative-o em Cadastros para receber.</span>
                ) : (
                  <span className="text-ouro">CNPJ não cadastrado — conclua o cadastro do fornecedor para prosseguir.</span>
                )}
              </div>
              <div className="sm:col-span-3">
                <p className="label !mb-1">Fornecedor</p>
                <p className="text-[16px] font-semibold text-t1">{nf.fornecedor?.nome ?? "—"}</p>
              </div>
              <div>
                <p className="label !mb-1">CNPJ</p>
                <p className="num text-[14px] text-t1">{nf.cnpjFormatado}</p>
              </div>
              <div>
                <p className="label !mb-1">Número da NF</p>
                <p className="num text-[20px] font-semibold text-t1">{nf.notaFiscal}</p>
              </div>
              <div>
                <p className="label !mb-1">Série</p>
                <p className="num text-[14px] text-t1">{nf.serie}</p>
              </div>
              {!nf.fornecedor && (
                <div className="sm:col-span-3">
                  <button type="button" className="btn-primary" onClick={() => setModal(true)}><UserPlus className="h-4 w-4" /> Cadastrar fornecedor</button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="poco-ouro px-4 py-3 text-[12px] text-ouro">
            Opção <strong>Sem Nota Fiscal</strong>: o vale será impresso com &quot;SEM NOTA FISCAL&quot; e uma observação de destaque.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <CamposFornecedor />
          </div>
        </div>
      )}

      {/* Dados operacionais (sempre liberados) */}
      <div>
        <p className="label">Dados do recebimento</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="label" htmlFor="quantidade">Quantidade de pallets *</label>
            <input ref={campoQtd} id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="conferente">Conferente *</label>
            <input id="conferente" name="conferente" className="input" required minLength={2} maxLength={120} defaultValue={conferentePadrao} />
          </div>
          <div>
            <label className="label" htmlFor="transportadora">Transportadora *</label>
            <input id="transportadora" name="transportadora" className="input" required maxLength={200} list="lista-transportadoras" autoComplete="off" />
            <datalist id="lista-transportadoras">
              {transportadoras.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="placa">Placa do veículo *</label>
            <input
              id="placa"
              name="placa"
              className="input uppercase placeholder:normal-case"
              required
              placeholder="ABC1D23"
              maxLength={8}
              pattern="[A-Za-z]{3}-?[0-9][A-Za-z0-9][0-9]{2}"
              title="Placa no formato ABC1234 ou ABC1D23"
            />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <label className="label" htmlFor="observacao">Observações</label>
            <textarea id="observacao" name="observacao" rows={2} className="input" maxLength={500} />
          </div>
        </div>
      </div>

      <Mensagem estado={estado} />
      <BotaoEnviar enviando={enviando || !fornecedorPronto} textoEnviando={enviando ? "Gerando vale..." : semNf ? "Gerando..." : "Leia a NF para continuar"}>
        <CircleCheck className="h-4 w-4" /> Salvar e gerar Vale-Pallet
      </BotaoEnviar>

      {modal && nf && !nf.fornecedor && (
        <ModalFornecedor
          cnpj={nf.cnpj}
          cnpjFormatado={nf.cnpjFormatado}
          origem="cadastro automático (recebimento com NF)"
          aviso="O CNPJ emitente desta NF não está cadastrado. Conclua o cadastro do fornecedor; ao salvar, você volta ao recebimento com os dados preenchidos."
          aoFechar={() => setModal(false)}
          aoCadastrar={() => {
            setModal(false);
            ultimaLida.current = "";
            identificar(nf.chave);
          }}
        />
      )}
    </form>
  );
}
