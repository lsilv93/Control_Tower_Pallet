"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { ScanBarcode } from "lucide-react";
import { consultarVale, type ResultadoLeituraVale } from "@/actions/vales";

type Encontrado = Extract<ResultadoLeituraVale, { ok: true }>;

/**
 * Campo para leitura óptica do código de barras do vale (leitor USB/Bluetooth
 * envia o código + Enter). Por padrão localiza e destaca a linha
 * `[data-vale="<número>"]` na página; `aoLer` permite outra ação (ex.: selecionar).
 */
export function LeitorVale({
  aoLer,
  dica = "Leia o código de barras do vale",
}: {
  aoLer?: (vale: Encontrado) => string | null;
  dica?: string;
}) {
  const [valor, setValor] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string; id?: string } | null>(null);
  const [lendo, iniciar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);

  function destacar(numero: number) {
    const el = document.querySelector<HTMLElement>(`[data-vale="${numero}"]`);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("destaque-leitura");
    setTimeout(() => el.classList.remove("destaque-leitura"), 2500);
    return true;
  }

  function ler(codigo: string) {
    iniciar(async () => {
      const r = await consultarVale(codigo);
      setValor("");
      campo.current?.focus();
      if (!r.ok) {
        setMsg({ ok: false, texto: r.erro });
        return;
      }
      const tratado = aoLer?.(r);
      if (tratado) {
        destacar(r.numero);
        setMsg({ ok: true, texto: tratado, id: r.id });
      } else if (destacar(r.numero)) {
        setMsg({ ok: true, texto: `Localizado: ${r.texto}`, id: r.id });
      } else {
        setMsg({ ok: true, texto: r.texto, id: r.id });
      }
    });
  }

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valor.trim()) ler(valor);
        }}
      >
        <div className="relative min-w-[14rem] flex-1">
          <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-t3" />
          <input
            ref={campo}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="input num !pl-12 uppercase tracking-wider"
            placeholder={dica}
            aria-label={dica}
            autoComplete="off"
          />
        </div>
        <button type="submit" className="btn-secondary" disabled={lendo || !valor.trim()}>
          {lendo ? "Lendo..." : "Localizar"}
        </button>
      </form>
      {msg && (
        <div role="status" className={clsx("flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[12px] font-medium", msg.ok ? "poco text-lima" : "poco-erro text-erro-claro")}>
          <span className={clsx("ponto", msg.ok ? "text-lima" : "text-erro")} />
          <span>{msg.texto}</span>
          {msg.id && (
            <Link prefetch={false} href={`/imprimir/vale/${msg.id}`} className="text-t2 underline hover:text-lima">
              Abrir vale
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
