import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { FormConferencia, type ValeConferencia } from "@/components/FormConferencia";
import { SaldosEstoques } from "@/components/Contas";
import { Cabecalho, Delta, Painel, Tabela, Vazio } from "@/components/ui";
import { requirePermissao } from "@/lib/auth";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { formatarNumero as n, numeroConferencia, numeroVale } from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Recebimento / Conferência" };

/**
 * Recebimento e conferência na unidade ativa: vales de envio destinados a ela (de CDs,
 * Pontos de Cross ou do Hub). Bons entram em Vazios e quebrados em Quebrados; divergências
 * geram Vale de Ocorrência auditável pelas duas pontas.
 */
export default async function RecebimentoPage({ searchParams }: { searchParams: Promise<{ ok?: string; de?: string }> }) {
  const u = await requirePermissao("recebimento");
  const { ok, de } = await searchParams;
  const [pendentes, conferencias] = await Promise.all([
    prisma.valePallet.findMany({
      where: { unidadeId: u.cd.id, tipo: "ENVIO", status: "PENDENTE" },
      include: { cd: { select: { id: true, codigo: true, nome: true, tipo: true, hub: true } } },
      orderBy: { criadoEm: "asc" },
    }),
    prisma.conferencia.findMany({
      where: { cdId: u.cd.id },
      include: { remetente: { select: { codigo: true } }, usuario: { select: { nome: true } }, ocorrencias: { select: { id: true, numero: true, ocorrencia: true } }, vales: { select: { numero: true } } },
      orderBy: { criadoEm: "desc" },
      take: 15,
    }),
  ]);

  const remetentes = [...new Map(pendentes.map((v) => [v.cd.id, v.cd])).values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  const vales: ValeConferencia[] = pendentes.map((v) => ({
    id: v.id,
    codigo: numeroVale(v.numero, v.tipo),
    remetenteId: v.cdId,
    bons: v.quantidadeBons,
    quebrados: v.quantidadeQuebrados,
    quantidade: v.quantidade,
    data: formatarDataHora(v.criadoEm),
    transportadora: v.transportadora,
    placa: v.placa,
  }));

  return (
    <>
      <Cabecalho
        titulo="Recebimento / Conferência"
        descricao={`Selecione os vales recebidos em ${u.cd.codigo}, informe a contagem física de Pallets PBR e Pallets Quebrados e registre. Cada tipo entra no seu estoque. Falta gera Vale de Ocorrência devolvido ao remetente; sobra é registrada.`}
      />
      {ok && (
        <div role="status" className="poco mb-6 flex items-start gap-2.5 px-4 py-3 text-[12px] font-medium text-lima" data-testid="conferencia-ok">
          <CircleCheck className="mt-0.5 h-4 w-4 flex-none" /> {ok}
        </div>
      )}
      <SaldosEstoques cdId={u.cd.id} destaque={["A_RECEBER"]} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Painel titulo="Conferir recebimento" className="lg:col-span-2">
          {remetentes.length === 0 ? (
            <Vazio>Nenhum vale pendente de recebimento em {u.cd.codigo}.</Vazio>
          ) : (
            <FormConferencia remetentes={remetentes} vales={vales} remetenteInicial={de} />
          )}
        </Painel>
        <div className="space-y-6 lg:col-span-3">
          <Painel titulo={`Vales a receber (${pendentes.length})`}>
            {pendentes.length === 0 ? (
              <Vazio>Nada em trânsito para esta unidade.</Vazio>
            ) : (
              <Tabela>
                <table className="tabela" data-testid="vales-pendentes-recebimento">
                  <thead><tr><th>Vale</th><th>Remetente</th><th className="text-right">Pallets PBR</th><th className="text-right">Pallets Quebrados</th><th>Faturamento</th><th>Emissão</th></tr></thead>
                  <tbody>
                    {pendentes.map((v) => (
                      <tr key={v.id}>
                        <td><Link prefetch={false} href={`/vales/${v.id}`} className="num font-semibold text-lima hover:underline">{numeroVale(v.numero, v.tipo)}</Link></td>
                        <td>{v.cd.codigo}{v.cd.tipo === "CROSS" ? " (Cross)" : ""}</td>
                        <td className="num text-right">{n(v.quantidadeBons)}</td>
                        <td className="num text-right">{n(v.quantidadeQuebrados)}</td>
                        <td className="num">{v.dataFaturamento ? formatarData(v.dataFaturamento) : "—"}</td>
                        <td className="num">{formatarDataHora(v.criadoEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Tabela>
            )}
          </Painel>
          <Painel titulo="Últimas conferências">
            {conferencias.length === 0 ? (
              <Vazio>Nenhuma conferência registrada.</Vazio>
            ) : (
              <Tabela>
                <table className="tabela" data-testid="ultimas-conferencias">
                  <thead><tr><th>Conferência</th><th>Data/hora</th><th>Remetente</th><th>Vales</th><th className="text-right">Declarado</th><th className="text-right">Pallets PBR</th><th className="text-right">Pallets Quebrados</th><th className="text-right">Dif.</th><th>Ocorrência</th><th>Usuário</th></tr></thead>
                  <tbody>
                    {conferencias.map((c) => (
                      <tr key={c.id}>
                        <td className="num font-semibold">{numeroConferencia(c.numero)}</td>
                        <td className="num">{formatarDataHora(c.criadoEm)}</td>
                        <td>{c.remetente.codigo}</td>
                        <td className="num text-[11px]">{c.vales.map((v) => numeroVale(v.numero, "ENVIO")).join(", ")}</td>
                        <td className="num text-right">{n(c.totalDeclarado)}</td>
                        <td className="num text-right">{n(c.recebidoBons)}</td>
                        <td className="num text-right">{n(c.recebidoQuebrados)}</td>
                        <td className="text-right"><Delta valor={c.diferenca} /></td>
                        <td>
                          {c.ocorrencias.length === 0
                            ? "—"
                            : c.ocorrencias.map((o) => (
                                <Link key={o.id} prefetch={false} href={`/vales/${o.id}`} className="num font-semibold text-erro hover:underline">
                                  {numeroVale(o.numero, "OCORRENCIA")}
                                </Link>
                              ))}
                        </td>
                        <td>{c.usuario.nome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Tabela>
            )}
          </Painel>
        </div>
      </div>
    </>
  );
}
