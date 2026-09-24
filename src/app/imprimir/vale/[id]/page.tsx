import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Scissors } from "lucide-react";
import { ImpressaoAutomatica } from "@/components/ImpressaoAutomatica";
import { requireUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatarDataHora } from "@/lib/datas";
import { formatarCnpj, formatarNumero, formatarPlaca, numeroVale, rotuloStatusVale } from "@/lib/formatos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vale-Pallet" };

type Vale = NonNullable<Awaited<ReturnType<typeof buscar>>>;

function buscar(id: string) {
  return prisma.valePallet.findUnique({
    where: { id },
    include: { fornecedor: true, criadoPor: { select: { nome: true, login: true } } },
  });
}

function Via({ vale, via }: { vale: Vale; via: string }) {
  const campo = (rotulo: string, valor: React.ReactNode, cls = "") => (
    <div className={`border border-slate-400 px-3 py-1.5 ${cls}`}>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className="whitespace-nowrap text-sm font-semibold">{valor}</p>
    </div>
  );
  return (
    <section className="via flex flex-col px-[12mm] py-[9mm]">
      <header className="flex items-start justify-between border-b-2 border-slate-900 pb-2">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">VALE-PALLET PBR</h1>
          <p className="text-xs text-slate-600">Control Tower Pallet · Comprovante de recebimento de pallets</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-extrabold">{numeroVale(vale.numero)}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-600">{via}</p>
        </div>
      </header>

      <div className="mt-3 grid grid-cols-[1fr_1fr_1fr_auto] gap-0">
        {campo("Fornecedor", vale.fornecedor.nome, "col-span-3")}
        {campo("CNPJ", formatarCnpj(vale.fornecedor.cnpj))}
        {campo("Transportadora", vale.transportadora, "col-span-2")}
        {campo("Placa do veículo", formatarPlaca(vale.placa))}
        {campo("Nota Fiscal", vale.notaFiscal)}
        {campo("Data/Hora de emissão", formatarDataHora(vale.criadoEm), "col-span-2")}
        {campo("Emitido por", vale.criadoPor.login)}
        {campo("Status", rotuloStatusVale[vale.status])}
      </div>

      <div className="mt-3 flex items-center justify-between border-2 border-slate-900 px-4 py-2">
        <p className="text-sm font-semibold uppercase">Quantidade de pallets PBR recebidos</p>
        <p className="text-3xl font-extrabold tabular-nums">{formatarNumero(vale.quantidade)}</p>
      </div>

      {vale.observacao && <p className="mt-2 text-xs"><strong>Obs.:</strong> {vale.observacao}</p>}

      <p className="mt-2 text-[10px] leading-snug text-slate-600">
        Declaramos o recebimento da quantidade de pallets PBR acima, que ficam registrados como crédito do fornecedor
        e serão devolvidos mediante agenda de devolução. Apresente este vale no momento da retirada.
      </p>

      <div className="mt-auto grid grid-cols-2 gap-10 pt-8 text-center text-[10px]">
        <div className="border-t border-slate-900 pt-1">Conferente / Recebedor</div>
        <div className="border-t border-slate-900 pt-1">Motorista / Transportador</div>
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
  await requireUsuario();
  const [{ id }, { auto }] = await Promise.all([params, searchParams]);
  const vale = await buscar(id);
  if (!vale) notFound();

  return (
    <div className="min-h-screen bg-fundo px-[14px] py-6 print:bg-white print:p-0">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        .folha { width: 210mm; height: 297mm; }
        .via { height: 148.5mm; box-sizing: border-box; }
        @media print { .nao-imprimir { display: none !important; } body { background: #fff; } }
      `}</style>
      <div className="nao-imprimir card mx-auto mb-6 flex w-[210mm] max-w-full flex-wrap items-center justify-between gap-3 p-4">
        <Link href="/fornecedor/entrada" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <p className="text-[12px] text-t3">
          Vale <strong className="num text-lima">{numeroVale(vale.numero)}</strong> · A4 em 2 vias
        </p>
        <ImpressaoAutomatica auto={auto === "1"} />
      </div>
      <div className="folha relative mx-auto overflow-hidden rounded-[6px] bg-white text-slate-900 shadow-[12px_12px_26px_rgba(0,4,8,.62)] print:rounded-none print:shadow-none">
        <Via vale={vale} via="1ª via · Empresa" />
        <div className="absolute inset-x-0 top-[148.5mm] h-0 border-t-2 border-dashed border-slate-400">
          <span className="absolute -top-2.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 bg-white px-2 text-[10px] text-slate-500"><Scissors className="h-3 w-3" /> recorte aqui</span>
        </div>
        <Via vale={vale} via="2ª via · Transportador" />
      </div>
    </div>
  );
}
