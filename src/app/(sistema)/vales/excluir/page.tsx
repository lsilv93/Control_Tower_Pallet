import { requirePermissao } from "@/lib/auth";
import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import { excluirVale } from "@/actions/vales";
import { BannerOk } from "@/components/Cadastro";
import { FormAcao } from "@/components/FormAcao";
import { HistoricoExclusoes } from "@/components/HistoricoExclusoes";
import { Cabecalho, Painel, StatusBadge } from "@/components/ui";
import { formatarDataHora } from "@/lib/datas";
import {
  formatarCnpj,
  rotuloNf,
  formatarNumero,
  formatarPlaca,
  lerCodigoVale,
  numeroAgenda,
  numeroVale,
  rotuloMotivoCancelamento,
  rotuloStatusVale,
} from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Excluir Vale Pallet" };

export default async function ExcluirValePage({ searchParams }: { searchParams: Promise<{ vale?: string; ok?: string }> }) {
  await requirePermissao("excluir_vale");
  const { vale: busca = "", ok } = await searchParams;
  const numero = busca ? lerCodigoVale(busca) : null;
  const vale =
    numero !== null
      ? await prisma.valePallet.findUnique({
          where: { numero },
          include: { fornecedor: true, criadoPor: { select: { login: true } }, agenda: true, canceladoPor: { select: { login: true } } },
        })
      : null;

  return (
    <>
      <Cabecalho
        titulo="Excluir Vale Pallet"
        descricao="Cancelamento de vales emitidos incorretamente. O vale é mantido para auditoria com status Cancelado e a entrada original é estornada do Estoque do CD (CD → Fornecedor)."
      />
      <BannerOk mensagem={ok} />

      <Painel titulo="Buscar vale" className="mb-6">
        <form className="flex flex-wrap gap-3" action="/vales/excluir">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-t3" />
            <input
              name="vale"
              defaultValue={busca}
              className="input num !pl-12 uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal"
              placeholder="ID do Vale Pallet (ex.: VP-000123) ou leia o código de barras"
              aria-label="ID do Vale Pallet"
              autoComplete="off"
              autoFocus={!vale}
            />
          </div>
          <button className="btn-primary">Buscar</button>
        </form>
        {busca && numero === null && <p className="mt-3 text-[12px] text-erro">&quot;{busca}&quot; não é um ID de vale válido.</p>}
        {numero !== null && !vale && <p className="mt-3 text-[12px] text-erro">Vale {numeroVale(numero)} não encontrado.</p>}
      </Painel>

      {vale && (
        <Painel
          className="mb-6"
          titulo={
            <span>
              <span className="num text-lima">{numeroVale(vale.numero)}</span> <span className="text-t4">·</span> {vale.fornecedor.nome}
            </span>
          }
          acoes={<StatusBadge status={vale.status} rotulo={rotuloStatusVale[vale.status]} />}
        >
          <dl className="poco mb-5 grid gap-4 p-5 text-[12px] sm:grid-cols-4">
            <div><dt className="label !mb-1">CNPJ</dt><dd className="num text-t2">{formatarCnpj(vale.fornecedor.cnpj)}</dd></div>
            <div><dt className="label !mb-1">Transportadora</dt><dd className="text-t2">{vale.transportadora} · <span className="num">{formatarPlaca(vale.placa)}</span></dd></div>
            <div><dt className="label !mb-1">Nota fiscal</dt><dd className="num text-t2">{rotuloNf(vale)}</dd></div>
            <div><dt className="label !mb-1">Quantidade</dt><dd className="num text-[22px] font-semibold text-t1">{formatarNumero(vale.quantidade)}</dd></div>
            <div className="sm:col-span-2"><dt className="label !mb-1">Emissão</dt><dd className="text-t2"><span className="num">{formatarDataHora(vale.criadoEm)}</span> · {vale.criadoPor.login}</dd></div>
            <div className="sm:col-span-2"><dt className="label !mb-1">Documento</dt><dd><Link prefetch={false} href={`/imprimir/vale/${vale.id}`} className="text-lima hover:underline">Ver / reimprimir vale</Link></dd></div>
          </dl>

          {vale.status === "PENDENTE" && (
            <FormAcao
              acao={excluirVale}
              confirmar="Tem certeza de que deseja excluir este Vale Pallet?"
              botao={<><Trash2 className="h-4 w-4" /> Excluir vale</>}
              classeBotao="btn-danger"
              limpar={false}
            >
              <input type="hidden" name="valeId" value={vale.id} />
              <div className="grid gap-4 sm:grid-cols-[18rem_1fr]">
                <div>
                  <label className="label" htmlFor="motivo">Motivo do cancelamento *</label>
                  <select id="motivo" name="motivo" className="input" required defaultValue="">
                    <option value="" disabled>Selecione...</option>
                    {Object.entries(rotuloMotivoCancelamento).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>{rotulo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="observacao">Observação</label>
                  <textarea id="observacao" name="observacao" rows={2} className="input" maxLength={500} placeholder="Detalhe o motivo (opcional)" />
                </div>
              </div>
            </FormAcao>
          )}
          {vale.status === "AGENDADO" && (
            <p className="poco-ouro px-4 py-3 text-[12px] text-ouro">
              Este vale está na agenda {vale.agenda ? numeroAgenda(vale.agenda.numero) : ""}. Para excluí-lo, cancele primeiro a agenda em{" "}
              <Link href="/agendas" className="font-semibold underline">Baixa de Pagamento</Link>.
            </p>
          )}
          {vale.status === "FINALIZADO" && (
            <p className="poco-ouro px-4 py-3 text-[12px] text-ouro">Este vale já foi devolvido ao fornecedor (finalizado) e não pode ser excluído.</p>
          )}
          {vale.status === "CANCELADO" && (
            <p className="poco-erro px-4 py-3 text-[12px] text-erro-claro">
              Excluído em {formatarDataHora(vale.canceladoEm)} por {vale.canceladoPor?.login} ·{" "}
              {vale.motivoCancelamento ? rotuloMotivoCancelamento[vale.motivoCancelamento] : ""}
              {vale.observacaoCancelamento ? ` · ${vale.observacaoCancelamento}` : ""}
            </p>
          )}
        </Painel>
      )}

      <HistoricoExclusoes limite={100} />
    </>
  );
}
