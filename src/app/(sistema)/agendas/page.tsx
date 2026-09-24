import Link from "next/link";
import { Ban, CircleCheck } from "lucide-react";
import { cancelarAgenda, validarAgenda } from "@/actions/vales";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Painel, StatusBadge, Vazio } from "@/components/ui";
import { obterSaldos } from "@/lib/conta";
import { prisma } from "@/lib/prisma";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { formatarCnpj, formatarNumero, numeroAgenda, numeroVale, rotuloStatusAgenda } from "@/lib/formatos";

export const metadata = { title: "Baixa de Pagamento" };

export default async function AgendasPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const [abertas, historico, saldos] = await Promise.all([
    prisma.agendaDevolucao.findMany({
      where: { status: "ABERTA" },
      include: { fornecedor: true, vales: { orderBy: { numero: "asc" } }, criadoPor: true },
      orderBy: { dataPrevista: "asc" },
    }),
    prisma.agendaDevolucao.findMany({
      where: { status: { not: "ABERTA" } },
      include: { fornecedor: true, vales: { select: { quantidade: true } }, criadoPor: true, validadoPor: true },
      orderBy: { numero: "desc" },
      take: 20,
    }),
    obterSaldos(),
  ]);

  return (
    <>
      <Cabecalho
        titulo="Baixa de Pagamento"
        descricao="Valide as agendas de devolução realizadas. A validação finaliza os vales e dá saída oficial dos pallets da conta corrente."
      >
        <Link href="/vales" className="btn-secondary">Gerar nova agenda</Link>
      </Cabecalho>

      {ok && (
        <div role="status" className="poco mb-5 flex items-center gap-2.5 px-5 py-4 text-[12px] font-medium text-lima">
          <span className="ponto" /> {ok}
        </div>
      )}
      <p className="mb-5 text-[12px] text-t3">
        Saldo atual no pulmão: <strong className="num text-t1">{formatarNumero(saldos.pulmao)}</strong> pallet(s)
      </p>

      {abertas.length === 0 ? (
        <Painel><Vazio>Nenhuma agenda de devolução aberta.</Vazio></Painel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {abertas.map((a) => {
            const total = a.vales.reduce((s, v) => s + v.quantidade, 0);
            return (
              <Painel
                key={a.id}
                titulo={
                  <span>
                    <span className="num text-lima">{numeroAgenda(a.numero)}</span> <span className="text-t4">·</span> {a.fornecedor.nome}
                  </span>
                }
                acoes={<StatusBadge status={a.status} rotulo={rotuloStatusAgenda[a.status]} />}
              >
                <dl className="poco mb-4 grid grid-cols-2 gap-4 p-4 text-[12px]">
                  <div><dt className="label !mb-1">CNPJ</dt><dd className="num text-t2">{formatarCnpj(a.fornecedor.cnpj)}</dd></div>
                  <div><dt className="label !mb-1">Data prevista</dt><dd className="num text-t2">{formatarData(a.dataPrevista)}</dd></div>
                  <div><dt className="label !mb-1">Criada por</dt><dd className="text-t2">{a.criadoPor.login} · <span className="num">{formatarDataHora(a.criadoEm)}</span></dd></div>
                  <div><dt className="label !mb-1">Total a devolver</dt><dd className="num text-[22px] font-semibold text-lima">{formatarNumero(total)}</dd></div>
                </dl>
                {a.observacao && <p className="mb-4 text-[12px] text-t2">Obs.: {a.observacao}</p>}
                <div className="poco mb-5 overflow-x-auto">
                <table className="tabela">
                  <thead><tr><th>Vale</th><th>NF</th><th>Emissão</th><th className="text-right">Qtd.</th></tr></thead>
                  <tbody>
                    {a.vales.map((v) => (
                      <tr key={v.id}>
                        <td className="font-mono">{numeroVale(v.numero)}</td>
                        <td>{v.notaFiscal}</td>
                        <td>{formatarData(v.criadoEm)}</td>
                        <td className="text-right tabular-nums">{v.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <div className="flex flex-wrap items-start gap-3">
                  <FormAcao
                    acao={validarAgenda}
                    className="flex flex-1 flex-col gap-2"
                    confirmar={`Confirmar a baixa da ${numeroAgenda(a.numero)}? ${total} pallet(s) sairão do pulmão.`}
                    botao={<><CircleCheck className="h-4 w-4" /> Validar e dar baixa</>}
                    classeBotao="btn-success"
                  >
                    <input type="hidden" name="agendaId" value={a.id} />
                    <input name="observacao" className="input" placeholder="Observação da baixa (opcional)" maxLength={500} />
                  </FormAcao>
                  <FormAcao
                    acao={cancelarAgenda}
                    className="flex flex-col gap-2"
                    confirmar={`Cancelar a ${numeroAgenda(a.numero)}? Os vales voltarão para Pendente.`}
                    botao={<><Ban className="h-4 w-4" /> Cancelar</>}
                    classeBotao="btn-danger"
                  >
                    <input type="hidden" name="agendaId" value={a.id} />
                  </FormAcao>
                </div>
              </Painel>
            );
          })}
        </div>
      )}

      <Painel titulo="Histórico de agendas" className="mt-6">
        {historico.length === 0 ? (
          <Vazio>Nenhuma agenda finalizada ainda.</Vazio>
        ) : (
          <div className="poco overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr><th>Agenda</th><th>Fornecedor</th><th>Status</th><th className="text-right">Pallets</th><th>Criada</th><th>Baixa</th></tr>
              </thead>
              <tbody>
                {historico.map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono">{numeroAgenda(a.numero)}</td>
                    <td>{a.fornecedor.nome}</td>
                    <td><StatusBadge status={a.status} rotulo={rotuloStatusAgenda[a.status]} /></td>
                    <td className="text-right tabular-nums">{a.vales.reduce((s, v) => s + v.quantidade, 0) || "—"}</td>
                    <td>{a.criadoPor.login} · {formatarDataHora(a.criadoEm)}</td>
                    <td>
                      {a.validadoPor
                        ? `${a.validadoPor.login} · ${formatarDataHora(a.validadoEm)}`
                        : a.canceladoEm
                          ? `Cancelada ${formatarDataHora(a.canceladoEm)}`
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </>
  );
}
