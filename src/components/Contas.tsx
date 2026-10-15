import clsx from "clsx";
import { ArrowRight, Boxes, Building2, Hammer, Scale } from "lucide-react";
import type { Conta } from "@prisma/client";
import { ehEstoque, obterSaldos, ROTULO_CONTA } from "@/lib/conta";
import { formatarNumero } from "@/lib/formatos";

const CURTO: Record<Conta, string> = {
  VAZIOS: "Vazios",
  CD: "CD (legado)",
  QUEBRADOS: "Quebrados",
  FORNECEDOR: "Fornecedor",
  COMPRA: "Compra",
  DESCARTE: "Descarte",
  AJUSTE: "Ajuste",
  CARGA: "Carga",
  CUSTODIA: "Saldo devedor",
};

const COR: Record<Conta, string> = {
  VAZIOS: "text-lima bg-lima/10",
  CD: "text-t1 bg-t2/15",
  QUEBRADOS: "text-ouro bg-ouro/10",
  FORNECEDOR: "text-t3 bg-t3/10",
  COMPRA: "text-t3 bg-t3/10",
  DESCARTE: "text-erro bg-erro/10",
  AJUSTE: "text-erro bg-erro/10",
  CARGA: "text-t3 bg-t3/10",
  CUSTODIA: "text-t1 bg-t2/15",
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

type Destaque = "VAZIOS" | "QUEBRADOS" | "FORNECEDOR" | "CUSTODIA";

/** Posição do CD de operação: Vazios, Quebrados, saldo com fornecedores e saldo devedor. */
export async function SaldosEstoques({ cdId, destaque }: { cdId: string; destaque?: Destaque[] }) {
  const s = await obterSaldos(cdId);
  const itens: { chave: Destaque; rotulo: string; valor: number; icone: typeof Boxes; cor: string }[] = [
    { chave: "VAZIOS", rotulo: "Estoque de Vazios", valor: s.vazios, icone: Boxes, cor: "text-lima" },
    { chave: "QUEBRADOS", rotulo: "Estoque de Quebrados", valor: s.quebrados, icone: Hammer, cor: "text-ouro" },
    { chave: "FORNECEDOR", rotulo: "Saldo do CD · fornecedores", valor: s.fornecedores, icone: Building2, cor: "text-t1" },
    { chave: "CUSTODIA", rotulo: "Saldo devedor CDs / Cross", valor: s.devedor, icone: Scale, cor: "text-t1" },
  ];
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {itens.map((i) => (
        <div
          key={i.chave}
          className={clsx("card-sm flex items-center gap-4 p-5", destaque?.includes(i.chave) && "ring-1 ring-lima/40")}
        >
          <span className={clsx("poco flex h-11 w-11 flex-none items-center justify-center !rounded-2xl", i.cor)}>
            <i.icone className="h-5 w-5" />
          </span>
          <div>
            <p className="label !mb-0.5">{i.rotulo}</p>
            <p className="num text-[26px] font-semibold leading-tight text-t1">{formatarNumero(i.valor)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
