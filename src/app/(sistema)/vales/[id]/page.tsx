import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BotoesVale } from "@/components/BotoesVale";
import { Fluxo } from "@/components/Contas";
import { Cabecalho, Painel, StatusBadge, Vazio } from "@/components/ui";
import { requirePermissao } from "@/lib/auth";
import { formatarDataHora } from "@/lib/datas";
import {
  formatarCnpj,
  rotuloNf,
  formatarNumero,
  formatarPlaca,
  numeroAgenda,
  numeroVale,
  rotuloMotivoCancelamento,
  rotuloStatusVale,
  rotuloTipo,
} from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Vale-Pallet" };

export default async function DetalheValePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissao("vales");
  const vale = await prisma.valePallet.findUnique({
    where: { id: (await params).id },
    include: {
      fornecedor: true,
      criadoPor: { select: { login: true, nome: true } },
      canceladoPor: { select: { login: true } },
      agenda: { include: { validadoPor: { select: { login: true } } } },
      movimentacoes: { include: { usuario: { select: { login: true } } }, orderBy: { criadoEm: "asc" } },
    },
  });
  if (!vale) notFound();

  const dado = (rotulo: string, valor: React.ReactNode) => (
    <div>
      <dt className="label !mb-1">{rotulo}</dt>
      <dd className="text-[13px] text-t1">{valor}</dd>
    </div>
  );

  return (
    <>
      <Cabecalho titulo={`Vale-Pallet ${numeroVale(vale.numero)}`} descricao={`${vale.fornecedor.nome} · emitido em ${formatarDataHora(vale.criadoEm)}`}>
        <Link href="/vales/consulta" className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Consulta</Link>
        <BotoesVale id={vale.id} />
      </Cabecalho>

      <div className="grid gap-6 xl:grid-cols-3">
        <Painel titulo="Dados do documento" acoes={<StatusBadge status={vale.status} rotulo={rotuloStatusVale[vale.status]} />} className="xl:col-span-2">
          <dl className="poco grid gap-5 p-5 sm:grid-cols-3">
            {dado("Fornecedor", vale.fornecedor.nome)}
            {dado("CNPJ", <span className="num">{formatarCnpj(vale.fornecedor.cnpj)}</span>)}
            {dado("Nota fiscal", <span className={vale.semNotaFiscal ? "font-semibold text-ouro" : "num"}>{rotuloNf(vale)}</span>)}
            {dado("Conferente", vale.conferente ?? "—")}
            {vale.chaveNfe && dado("Chave de acesso NF-e", <span className="num break-all text-[11px]">{vale.chaveNfe}</span>)}
            {dado("Transportadora", vale.transportadora)}
            {dado("Placa", <span className="num">{formatarPlaca(vale.placa)}</span>)}
            {dado("Quantidade / tipo", <span><span className="num text-[20px] font-semibold">{formatarNumero(vale.quantidade)}</span> pallets PBR</span>)}
            {dado("Emissão", <span className="num">{formatarDataHora(vale.criadoEm)} · {vale.criadoPor.login}</span>)}
            {dado("ID único", <span className="num text-[11px]">{vale.id}</span>)}
            {vale.agenda && dado("Agenda", <span className="num">{numeroAgenda(vale.agenda.numero)} · retirada {formatarDataHora(vale.agenda.dataPrevista)}</span>)}
            {vale.status === "FINALIZADO" && dado("Baixa", <span className="num">{formatarDataHora(vale.finalizadoEm)} · {vale.agenda?.validadoPor?.login ?? "-"}</span>)}
            {vale.status === "CANCELADO" &&
              dado(
                "Cancelamento",
                <span>
                  <span className="num">{formatarDataHora(vale.canceladoEm)}</span> · {vale.canceladoPor?.login} ·{" "}
                  {vale.motivoCancelamento ? rotuloMotivoCancelamento[vale.motivoCancelamento] : ""}
                  {vale.observacaoCancelamento ? ` · ${vale.observacaoCancelamento}` : ""}
                </span>,
              )}
          </dl>
        </Painel>
        <Painel titulo="Conta corrente do vale">
          <p className="mb-3 text-[12px] text-t3">Lançamentos gerados por este vale (partida dobrada).</p>
          {vale.movimentacoes.length === 0 ? (
            <Vazio>Sem lançamentos.</Vazio>
          ) : (
            <ul className="space-y-3">
              {vale.movimentacoes.map((m) => (
                <li key={m.id} className="poco p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-t1">{rotuloTipo[m.tipo]}</span>
                    <span className="num text-[15px] font-semibold text-t1">{m.quantidade}</span>
                  </div>
                  <div className="mt-2"><Fluxo origem={m.origem} destino={m.destino} /></div>
                  <p className="num mt-2 text-[11px] text-t4">{formatarDataHora(m.criadoEm)} · {m.usuario.login}</p>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>
    </>
  );
}
