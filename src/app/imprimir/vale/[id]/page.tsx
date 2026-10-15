import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Scissors } from "lucide-react";
import clsx from "clsx";
import { ImpressaoAutomatica } from "@/components/ImpressaoAutomatica";
import { requireAlguma } from "@/lib/auth";
import { codigo128Svg } from "@/lib/codigoBarras";
import { documentoVale, INCLUDE_VALE_DOC, type DocumentoVale } from "@/lib/documentoVale";
import { EMISSOR } from "@/lib/emissor";
import { prisma } from "@/lib/prisma";
import { formatarNumero } from "@/lib/formatos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vale-Pallet" };

const SPAN = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3", 4: "col-span-4" } as const;

function Via({ doc, via, barras, quantidade, cancelado, observacao, cd }: {
  doc: DocumentoVale;
  via: string;
  barras: string;
  quantidade: number;
  cancelado: boolean;
  observacao: string | null;
  cd: string;
}) {
  return (
    <section className="via relative flex flex-col px-[12mm] py-[7mm]">
      {cancelado && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="-rotate-[18deg] border-[3px] border-red-700 px-6 py-1 text-[44px] font-black tracking-[0.2em] text-red-700 opacity-40">
            CANCELADO
          </span>
        </div>
      )}
      {/* Identificação da via: borda em vez de fundo, para sair mesmo sem "gráficos de fundo" na impressão */}
      <p className="mb-2 border-2 border-slate-900 py-1 text-center text-[12px] font-extrabold uppercase tracking-[0.3em]">{via}</p>
      <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-2">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight">{doc.titulo}</h1>
          <p className="text-[10px] text-slate-600">{doc.subtitulo}</p>
          <div className="mt-1.5 text-[9.5px] leading-snug">
            <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">Remetente (emissor) · CD {cd}</p>
            <p>
              <strong>{EMISSOR.razaoSocial}</strong> · {EMISSOR.nomeFantasia} · CNPJ {EMISSOR.cnpj}
            </p>
            <p>
              {EMISSOR.endereco}, {EMISSOR.cidade}, CEP {EMISSOR.cep}
            </p>
          </div>
        </div>
        <div className="flex flex-none flex-col items-end text-right">
          {/* Código de barras Code 128 do número do vale: a leitura óptica identifica o vale na devolução/conferência */}
          <div className="barras mt-1 h-[12mm] w-[58mm]" dangerouslySetInnerHTML={{ __html: barras }} />
          <p className="mt-0.5 font-mono text-[15px] font-extrabold tracking-[0.2em]">{doc.codigo}</p>
        </div>
      </header>

      <div className="mt-3 grid grid-cols-4 gap-0">
        {doc.linhas.flat().map((c, i) => (
          <div key={i} className={clsx("border border-slate-400 px-3 py-1.5", SPAN[c.colunas])}>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{c.rotulo}</p>
            <p className="truncate whitespace-nowrap text-sm font-semibold">{c.valor}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-2 border-slate-900 px-4 py-2">
        <p className="text-sm font-semibold uppercase">{doc.rotuloQuantidade}</p>
        <p className="text-3xl font-extrabold tabular-nums">{formatarNumero(quantidade)}</p>
      </div>

      {doc.destaque && (
        <div className="mt-2 border-2 border-slate-900 px-3 py-1.5">
          <p className="text-[11px] font-extrabold uppercase">{doc.destaque.titulo}</p>
          <p className="text-[10px]">{doc.destaque.texto}</p>
        </div>
      )}
      {observacao && <p className="mt-2 line-clamp-2 text-xs"><strong>Obs.:</strong> {observacao}</p>}

      <p className="mt-2 text-[10px] leading-snug text-slate-600">{doc.declaracao}</p>

      <div className="mt-auto grid grid-cols-2 gap-10 pt-6 text-center text-[10px]">
        <div>
          {doc.nomeAssinatura && <p className="mb-0.5 text-[11px] font-bold">{doc.nomeAssinatura}</p>}
          <div className="border-t border-slate-900 pt-1">{doc.assinaturas[0]}</div>
        </div>
        <div className="self-end border-t border-slate-900 pt-1">{doc.assinaturas[1]}</div>
      </div>
    </section>
  );
}

export default async function ImprimirValePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const u = await requireAlguma("vales", "entrada", "agendas", "excluir_vale", "cd");
  const [{ id }, { auto }] = await Promise.all([params, searchParams]);
  const vale = await prisma.valePallet.findUnique({ where: { id }, include: INCLUDE_VALE_DOC });
  if (!vale || vale.cdId !== u.cd.id) notFound();
  const doc = documentoVale(vale);
  const barras = codigo128Svg(doc.codigo);
  const voltar = vale.tipo === "FORNECEDOR" ? "/fornecedor/entrada" : vale.tipo === "ENVIO" ? (vale.unidade?.tipo === "CROSS" ? "/cross/envio" : "/cd/envio") : "/retorno";
  const comum = { doc, barras, quantidade: vale.quantidade, cancelado: vale.status === "CANCELADO", observacao: vale.observacao, cd: vale.cd.codigo };

  return (
    <div className="min-h-screen bg-fundo px-[14px] py-6 print:bg-white print:p-0">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        .folha { width: 210mm; height: 297mm; }
        .via { height: 148.5mm; box-sizing: border-box; }
        .barras svg { width: 100%; height: 100%; display: block; }
        @media print { .nao-imprimir { display: none !important; } body { background: #fff; } }
      `}</style>
      <div className="nao-imprimir card mx-auto mb-6 flex w-[210mm] max-w-full flex-wrap items-center justify-between gap-3 p-4">
        <Link href={voltar} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <p className="text-[12px] text-t3">
          <strong className={vale.tipo === "OCORRENCIA" ? "num text-erro" : "num text-lima"}>{doc.codigo}</strong> · {doc.titulo.toLowerCase()} · A4 em 2 vias
        </p>
        <ImpressaoAutomatica auto={auto === "1"} />
      </div>
      <div className="folha relative mx-auto overflow-hidden rounded-[6px] bg-white text-slate-900 shadow-[12px_12px_26px_rgba(0,4,8,.62)] print:rounded-none print:shadow-none">
        <Via {...comum} via={doc.vias[0]} />
        <div className="absolute inset-x-0 top-[148.5mm] h-0 border-t-2 border-dashed border-slate-400">
          <span className="absolute -top-2.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 bg-white px-2 text-[10px] text-slate-500"><Scissors className="h-3 w-3" /> recorte aqui</span>
        </div>
        <Via {...comum} via={doc.vias[1]} />
      </div>
    </div>
  );
}
