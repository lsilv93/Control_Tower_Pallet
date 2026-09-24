"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Camera, CircleCheck, RotateCcw, ScanBarcode, Sparkles, X } from "lucide-react";
import { cadastrarFornecedorRapido, identificarCompra, registrarCompra, type Identificacao } from "@/actions/pallets";
import { gerarChaveNFe } from "@/lib/nfe";
import { BotaoEnviar, Mensagem, useAcao } from "./FormAcao";

type Identificada = Extract<Identificacao, { ok: true }>;

// BarcodeDetector ainda não está nos tipos do TypeScript.
type Detector = { detect(fonte: CanvasImageSource): Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opcoes: { formats: string[] }) => Detector;
  }
}

/**
 * Compra de pallets: lê a chave da NF-e (código de barras do DANFE) com leitor
 * USB/Bluetooth (que "digita" o código + Enter), com a câmera, ou simulada.
 */
export function FluxoCompra({ cnpjsCadastrados }: { cnpjsCadastrados: string[] }) {
  const [leitura, setLeitura] = useState("");
  const [nf, setNf] = useState<Identificada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [ultimaCompra, setUltimaCompra] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [temCamera, setTemCamera] = useState(false);
  const [lendo, iniciar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);
  const compra = useAcao(registrarCompra);

  useEffect(() => {
    setTemCamera(typeof window !== "undefined" && !!window.BarcodeDetector && !!navigator.mediaDevices);
    campo.current?.focus();
  }, []);

  // Após registrar a compra, volta para a leitura da próxima NF.
  useEffect(() => {
    if (compra.estado?.ok) {
      setUltimaCompra(compra.estado.mensagem);
      setNf(null);
      setLeitura("");
      campo.current?.focus();
    }
  }, [compra.estado]);

  function identificar(codigo: string) {
    setErro(null);
    setUltimaCompra(null);
    setNf(null);
    iniciar(async () => {
      const r = await identificarCompra(codigo);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setNf(r);
      setLeitura(r.chave);
      // Fornecedor não cadastrado: abre o cadastro rápido automaticamente.
      if (!r.fornecedor) setModal(true);
    });
  }

  function simular(novo: boolean) {
    const cnpj = !novo && cnpjsCadastrados.length ? cnpjsCadastrados[Math.floor(Math.random() * cnpjsCadastrados.length)] : undefined;
    const chave = gerarChaveNFe({ cnpj });
    setLeitura(chave);
    identificar(chave);
  }

  function recomecar() {
    setNf(null);
    setErro(null);
    setLeitura("");
    campo.current?.focus();
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="leitura">Código de barras da NF-e (chave de acesso)</label>
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (leitura.trim()) identificar(leitura);
          }}
        >
          <div className="relative min-w-[16rem] flex-1">
            <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-t3" />
            <input
              ref={campo}
              id="leitura"
              value={leitura}
              onChange={(e) => setLeitura(e.target.value)}
              className="input num !pl-12 tracking-wider"
              placeholder="Aponte o leitor para o código de barras do DANFE"
              autoComplete="off"
              inputMode="numeric"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={lendo || !leitura.trim()}>
            {lendo ? "Lendo..." : "Identificar"}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={() => simular(false)} disabled={lendo || !cnpjsCadastrados.length}>
            <Sparkles className="h-3.5 w-3.5" /> Simular leitura (fornecedor cadastrado)
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => simular(true)} disabled={lendo}>
            <Sparkles className="h-3.5 w-3.5" /> Simular leitura (fornecedor novo)
          </button>
          {temCamera && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => setCamera(true)}>
              <Camera className="h-3.5 w-3.5" /> Ler com a câmera
            </button>
          )}
        </div>
      </div>

      {erro && <Mensagem estado={{ ok: false, mensagem: erro, ts: 0 }} />}

      {nf && (
        <div className="poco space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="label !mb-1">Nota fiscal</p>
              <p className="num text-[22px] font-semibold text-t1">
                {nf.notaFiscal} <span className="text-[12px] text-t3">série {nf.serie}</span>
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="label !mb-1">Fornecedor (emitente)</p>
              {nf.fornecedor ? (
                <p className="flex items-center gap-2 text-[14px] font-semibold text-lima">
                  <CircleCheck className="h-4 w-4 flex-none" /> {nf.fornecedor.nome}
                </p>
              ) : (
                <p className="text-[13px] font-semibold text-ouro">Não cadastrado</p>
              )}
              <p className="num text-[12px] text-t3">{nf.cnpjFormatado}</p>
            </div>
          </div>
          <p className="num break-all text-[11px] text-t4">Chave: {nf.chave}</p>

          {nf.fornecedor ? (
            <form onSubmit={compra.aoEnviar} className="space-y-4">
              <input type="hidden" name="chave" value={nf.chave} />
              <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                <div>
                  <label className="label" htmlFor="quantidadeCompra">Quantidade de pallets *</label>
                  <input id="quantidadeCompra" name="quantidade" type="number" min={1} step={1} className="input" required autoFocus />
                </div>
                <div>
                  <label className="label" htmlFor="obsCompra">Observação</label>
                  <input id="obsCompra" name="observacao" className="input" maxLength={500} />
                </div>
              </div>
              <Mensagem estado={compra.estado} />
              <div className="flex flex-wrap gap-3">
                <BotaoEnviar enviando={compra.enviando} textoEnviando="Registrando...">
                  <CircleCheck className="h-4 w-4" /> Registrar compra
                </BotaoEnviar>
                <button type="button" className="btn-secondary" onClick={recomecar}>
                  <RotateCcw className="h-4 w-4" /> Ler outra NF
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => setModal(true)}>
                Cadastrar fornecedor
              </button>
              <button type="button" className="btn-secondary" onClick={recomecar}>
                <RotateCcw className="h-4 w-4" /> Ler outra NF
              </button>
            </div>
          )}
        </div>
      )}

      {!nf && ultimaCompra && <Mensagem estado={{ ok: true, mensagem: ultimaCompra, ts: 0 }} />}

      {modal && nf && !nf.fornecedor && (
        <ModalFornecedor
          cnpj={nf.cnpj}
          cnpjFormatado={nf.cnpjFormatado}
          aoFechar={() => setModal(false)}
          aoCadastrar={() => {
            setModal(false);
            identificar(nf.chave);
          }}
        />
      )}

      {camera && (
        <LeitorCamera
          aoLer={(codigo) => {
            setCamera(false);
            setLeitura(codigo);
            identificar(codigo);
          }}
          aoFechar={() => setCamera(false)}
        />
      )}
    </div>
  );
}

function Modal({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: React.ReactNode }) {
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

function ModalFornecedor({
  cnpj,
  cnpjFormatado,
  aoFechar,
  aoCadastrar,
}: {
  cnpj: string;
  cnpjFormatado: string;
  aoFechar: () => void;
  aoCadastrar: () => void;
}) {
  return (
    <Modal titulo="Cadastro rápido de fornecedor" aoFechar={aoFechar}>
      <p className="poco-ouro mb-5 px-4 py-3 text-[12px] text-ouro">
        O CNPJ emitente desta NF ainda não está cadastrado. Cadastre o fornecedor para continuar a compra.
      </p>
      <FormFornecedorRapido cnpj={cnpj} cnpjFormatado={cnpjFormatado} aoCadastrar={aoCadastrar} />
    </Modal>
  );
}

function FormFornecedorRapido({ cnpj, cnpjFormatado, aoCadastrar }: { cnpj: string; cnpjFormatado: string; aoCadastrar: () => void }) {
  const { estado, enviando, aoEnviar } = useAcao(cadastrarFornecedorRapido);
  useEffect(() => {
    if (estado?.ok) aoCadastrar();
  }, [estado, aoCadastrar]);
  return (
    <form onSubmit={aoEnviar} className="space-y-4">
      <input type="hidden" name="cnpj" value={cnpj} />
      <div>
        <label className="label">CNPJ</label>
        <p className="input num flex items-center opacity-80">{cnpjFormatado}</p>
      </div>
      <div>
        <label className="label" htmlFor="rapido-nome">Nome / Razão social *</label>
        <input id="rapido-nome" name="nome" className="input" required minLength={2} maxLength={200} autoFocus />
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
      <Mensagem estado={estado} />
      <BotaoEnviar enviando={enviando} className="btn-primary w-full">
        Cadastrar e continuar
      </BotaoEnviar>
    </form>
  );
}

/** Leitura pela câmera com a API BarcodeDetector (Chrome/Edge no Android e desktop compatível). */
function LeitorCamera({ aoLer, aoFechar }: { aoLer: (codigo: string) => void; aoFechar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const callback = useRef(aoLer);
  callback.current = aoLer;

  useEffect(() => {
    let fluxo: MediaStream | null = null;
    let ativo = true;
    (async () => {
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = fluxo;
        await video.current.play();
        const detector = new window.BarcodeDetector!({ formats: ["code_128", "itf", "ean_13", "qr_code"] });
        while (ativo) {
          const achados = await detector.detect(video.current).catch(() => []);
          const codigo = achados.find((a) => a.rawValue.replace(/\D/g, "").length >= 44)?.rawValue ?? achados[0]?.rawValue;
          if (codigo) {
            callback.current(codigo);
            return;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setErro("Não foi possível acessar a câmera. Verifique a permissão do navegador.");
      }
    })();
    return () => {
      ativo = false;
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <Modal titulo="Ler código com a câmera" aoFechar={aoFechar}>
      {erro ? (
        <Mensagem estado={{ ok: false, mensagem: erro, ts: 0 }} />
      ) : (
        <div className="poco overflow-hidden p-2">
          <video ref={video} className="w-full rounded-[18px]" muted playsInline />
        </div>
      )}
      <p className="mt-3 text-[11px] text-t3">Enquadre o código de barras do DANFE na horizontal.</p>
    </Modal>
  );
}

