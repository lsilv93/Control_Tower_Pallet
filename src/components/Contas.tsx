import clsx from "clsx";
import { ArrowRight, Boxes, Building2, Hammer } from "lucide-react";
import type { Conta } from "@prisma/client";
import { ehEstoque, obterSaldos, ROTULO_CONTA } from "@/lib/conta";
import { formatarNumero } from "@/lib/formatos";

const CURTO: Record<Conta, string> = {
  VAZIOS: "Vazios",
  CD: "CD",
  QUEBRADOS: "Quebrados",
  FORNECEDOR: "Fornecedor",
  COMPRA: "Compra",
  DESCARTE: "Descarte",
  AJUSTE: "Ajuste",
};

const COR: Record<Conta, string> = {
  VAZIOS: "text-lima bg-lima/10",
  CD: "text-t1 bg-t2/15",
  QUEBRADOS: "text-ouro bg-ouro/10",
  FORNECEDOR: "text-t3 bg-t3/10",
  COMPRA: "text-t3 bg-t3/10",
  DESCARTE: "text-erro bg-erro/10",
  AJUSTE: "text-erro bg-erro/10",
};

export function ContaTag({ conta }: { conta: Conta }) {
  return (
    <span className={clsx("pill normal-case tracking-normal", COR[conta], !ehEstoque(conta) && "italic")} title={ROTULO_CONTA[conta]}>
      {CURTO[conta]}
    </span>
  );
}

/** "Origem → Destino" de uma movimentação (partida dobrada). */
export function Fluxo({ origem, destino }: { origem: Conta; destino: Conta }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <ContaTag conta={origem} />
      <ArrowRight className="h-3.5 w-3.5 text-t4" aria-label="para" />
      <ContaTag conta={destino} />
    </span>
  );
}

/** Saldos atuais dos 3 estoques, para as telas operacionais. */
export async function SaldosEstoques({ destaque }: { destaque?: Conta[] }) {
  const s = await obterSaldos();
  const itens = [
    { conta: "VAZIOS" as const, valor: s.vazios, icone: Boxes, cor: "text-lima" },
    { conta: "CD" as const, valor: s.cd, icone: Building2, cor: "text-t1" },
    { conta: "QUEBRADOS" as const, valor: s.quebrados, icone: Hammer, cor: "text-ouro" },
  ];
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      {itens.map((i) => (
        <div
          key={i.conta}
          className={clsx("card-sm flex items-center gap-4 p-5", destaque?.includes(i.conta) && "ring-1 ring-lima/40")}
        >
          <span className={clsx("poco flex h-11 w-11 flex-none items-center justify-center !rounded-2xl", i.cor)}>
            <i.icone className="h-5 w-5" />
          </span>
          <div>
            <p className="label !mb-0.5">{ROTULO_CONTA[i.conta]}</p>
            <p className="num text-[26px] font-semibold leading-tight text-t1">{formatarNumero(i.valor)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
