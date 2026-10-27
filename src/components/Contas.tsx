import clsx from "clsx";
import { ArrowRight, Boxes, Hammer, PackageOpen, Truck } from "lucide-react";
import type { Conta } from "@prisma/client";
import { ehEstoque, obterSaldos, ROTULO_CONTA } from "@/lib/conta";
import { formatarNumero } from "@/lib/formatos";

const CURTO: Record<Conta, string> = {
  VAZIOS: "Bons",
  QUEBRADOS: "Quebrados",
  TRANSITO: "Trânsito",
  OCORRENCIA: "Ocorrência",
  ENVIADO: "Enviado",
  RECEBIDO: "Recebido",
  SOBRA: "Sobra",
  PERDA: "Perda",
  DESCARTE: "Descarte",
  AJUSTE: "Ajuste",
  COMPRA: "Compra",
  FORNECEDOR: "Fornecedor",
  CARGA: "Carga",
};

const COR: Record<Conta, string> = {
  VAZIOS: "text-lima bg-lima/10",
  QUEBRADOS: "text-ouro bg-ouro/10",
  TRANSITO: "text-t1 bg-t2/15",
  OCORRENCIA: "text-erro bg-erro/10",
  ENVIADO: "text-t3 bg-t3/10",
  RECEBIDO: "text-t3 bg-t3/10",
  SOBRA: "text-t3 bg-t3/10",
  PERDA: "text-erro bg-erro/10",
  DESCARTE: "text-erro bg-erro/10",
  AJUSTE: "text-erro bg-erro/10",
  COMPRA: "text-t3 bg-t3/10",
  FORNECEDOR: "text-t3 bg-t3/10",
  CARGA: "text-t3 bg-t3/10",
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

type Destaque = "VAZIOS" | "QUEBRADOS" | "TRANSITO" | "A_RECEBER";

/** Posição da unidade de operação: pallets bons, quebrados, em trânsito e a receber. */
export async function SaldosEstoques({ cdId, destaque }: { cdId: string; destaque?: Destaque[] }) {
  const s = await obterSaldos(cdId);
  const itens: { chave: Destaque; rotulo: string; valor: number; detalhe?: string; icone: typeof Boxes; cor: string }[] = [
    { chave: "VAZIOS", rotulo: "Pallets bons (vazios)", valor: s.vazios, icone: Boxes, cor: "text-lima" },
    { chave: "QUEBRADOS", rotulo: "Pallets quebrados", valor: s.quebrados, icone: Hammer, cor: "text-ouro" },
    { chave: "TRANSITO", rotulo: "Enviados em trânsito", valor: s.transito, detalhe: "aguardando conferência no destino", icone: Truck, cor: "text-t1" },
    { chave: "A_RECEBER", rotulo: "A receber", valor: s.aReceber, detalhe: `${s.valesAReceber} vale(s) para conferir`, icone: PackageOpen, cor: "text-t1" },
  ];
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="saldos-unidade">
      {itens.map((i) => (
        <div key={i.chave} className={clsx("card-sm flex items-center gap-4 p-5", destaque?.includes(i.chave) && "ring-1 ring-lima/40")}>
          <span className={clsx("poco flex h-11 w-11 flex-none items-center justify-center !rounded-2xl", i.cor)}>
            <i.icone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="label !mb-0.5">{i.rotulo}</p>
            <p className="num text-[26px] font-semibold leading-tight text-t1" data-testid={`saldo-${i.chave.toLowerCase()}`}>{formatarNumero(i.valor)}</p>
            {i.detalhe && <p className="truncate text-[11px] text-t4">{i.detalhe}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
