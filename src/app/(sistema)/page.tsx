import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Building2,
  ClipboardList,
  PackageCheck,
  PackagePlus,
  PackageX,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { AtualizacaoAutomatica } from "@/components/AtualizacaoAutomatica";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { Cabecalho, FarolBadge, Indicador, LegendaFarol, Painel, Ponto, StatusBadge, Vazio } from "@/components/ui";
import { obterSaldos } from "@/lib/conta";
import { entradasSaidas, pendenciasPorFornecedor, totaisPorTipo, valesEmAberto } from "@/lib/consultas";
import { fimDoDia, formatarData, inicioDoDia, inicioDoMes } from "@/lib/datas";
import { formatarCnpj, formatarNumero as n, numeroVale, rotuloStatusVale } from "@/lib/formatos";

export default async function DashboardPage() {
  const hoje = inicioDoDia();
  const [saldos, dia, tipoHoje, tipoMes, vales, fornecedores] = await Promise.all([
    obterSaldos(),
    entradasSaidas(hoje, fimDoDia()),
    totaisPorTipo(hoje),
    totaisPorTipo(inicioDoMes()),
    valesEmAberto(),
    pendenciasPorFornecedor(),
  ]);

  const contagem = (lista: { farol: string }[], f: string) => lista.filter((x) => x.farol === f).length;

  return (
    <>
      <Cabecalho titulo="Dashboard" descricao="Conta corrente de pallets PBR em tempo real">
        <AtualizacaoAutomatica />
      </Cabecalho>

      <div className="entrada grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Indicador
          destaque
          titulo="Saldo no pulmão"
          valor={n(saldos.pulmao)}
          detalhe="pallets PBR disponíveis"
          icone={<Boxes className="h-6 w-6" />}
        />
        <Indicador
          titulo="Entradas do dia"
          valor={n(dia.entradas)}
          detalhe="pallets que entraram no pulmão hoje"
          cor="lima"
          icone={<ArrowDownToLine className="h-6 w-6" />}
        />
        <Indicador
          titulo="Saídas do dia"
          valor={n(dia.saidas)}
          detalhe="pallets que saíram do pulmão hoje"
          cor="erro"
          icone={<ArrowUpFromLine className="h-6 w-6" />}
        />
        <Indicador
          titulo="Pendente com fornecedores"
          valor={n(saldos.pendenteFornecedores)}
          detalhe={`${saldos.valesEmAberto} vale(s) em aberto · ${n(saldos.avaria)} avariado(s) em estoque`}
          cor="ouro"
          icone={<ClipboardList className="h-6 w-6" />}
        />
      </div>

      <div className="entrada mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["ENVIO_CD", "Enviados para o CD", <Truck key="i" className="h-5 w-5" />, "neutro"],
            ["RECEBIMENTO_CD", "Recebidos do CD", <Building2 key="i" className="h-5 w-5" />, "neutro"],
            ["DEVOLUCAO_FORNECEDOR", "Devolvidos ao Fornecedor", <PackageX key="i" className="h-5 w-5" />, "ouro"],
            ["RECEBIMENTO_FORNECEDOR", "Recebidos do Fornecedor", <PackagePlus key="i" className="h-5 w-5" />, "lima"],
          ] as const
        ).map(([tipo, titulo, icone, cor]) => (
          <Indicador
            key={tipo}
            titulo={`${titulo} (hoje)`}
            valor={n(tipoHoje(tipo))}
            detalhe={`${n(tipoMes(tipo))} no mês`}
            icone={icone}
            cor={cor}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-6">
        <Painel
          
          titulo={
            <span className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-ouro" /> Farol por idade do vale-pallet
            </span>
          }
          acoes={
            <span className="num flex items-center gap-3 text-[11px] text-t2">
              {(["VERMELHO", "AMARELO", "VERDE"] as const).map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5">
                  <Ponto farol={f} /> {contagem(vales, f)}
                </span>
              ))}
            </span>
          }
        >
          {vales.length === 0 ? (
            <Vazio>Nenhum vale-pallet pendente de devolução.</Vazio>
          ) : (
            <div className="poco max-h-[28rem] overflow-auto">
              <table className="tabela">
                <thead className="sticky top-0">
                  <tr>
                    <th>Farol</th>
                    <th>Vale</th>
                    <th>Fornecedor</th>
                    <th>Idade</th>
                    <th className="text-right">Qtd.</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...vales].sort((a, b) => b.idade - a.idade).map((v) => (
                    <tr key={v.id}>
                      <td><FarolBadge farol={v.farol} /></td>
                      <td>
                        <Link prefetch={false} href={`/imprimir/vale/${v.id}`} className="num font-semibold text-lima hover:text-lima-hover hover:underline">
                          {numeroVale(v.numero)}
                        </Link>
                      </td>
                      <td className="max-w-[11rem] truncate" title={v.fornecedor.nome}>{v.fornecedor.nome}</td>
                      <td className="tabular-nums">
                        <p className="font-semibold">{v.idade} dia(s)</p>
                        <p className="text-[11px] text-t4">{formatarData(v.criadoEm)}</p>
                      </td>
                      <td className="text-right font-semibold tabular-nums">{n(v.quantidade)}</td>
                      <td><StatusBadge status={v.status} rotulo={rotuloStatusVale[v.status]} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <LegendaFarol itens={[["VERMELHO", "30 dias ou mais"], ["AMARELO", "20 a 29 dias"], ["VERDE", "menos de 20 dias"]]} />
        </Painel>

        <Painel
          
          titulo={
            <span className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-lima" /> Farol por fornecedor
            </span>
          }
        >
          {fornecedores.length === 0 ? (
            <Vazio>Nenhum fornecedor com pallets pendentes.</Vazio>
          ) : (
            <div className="poco max-h-[28rem] overflow-auto">
              <table className="tabela">
                <thead className="sticky top-0">
                  <tr>
                    <th>Farol</th>
                    <th>Fornecedor</th>
                    <th className="text-right">Vales</th>
                    <th className="text-right">Pendentes</th>
                  </tr>
                </thead>
                <tbody>
                  {fornecedores.map((f) => (
                    <tr key={f.fornecedor.id}>
                      <td><FarolBadge farol={f.farol} /></td>
                      <td>
                        <p className="max-w-[10rem] truncate font-medium" title={f.fornecedor.nome}>{f.fornecedor.nome}</p>
                        <p className="text-[11px] text-t4">{formatarCnpj(f.fornecedor.cnpj)}</p>
                      </td>
                      <td className="text-right tabular-nums">{f.vales}</td>
                      <td className="text-right font-semibold tabular-nums">{n(f.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <LegendaFarol itens={[["VERMELHO", "acima de 100"], ["AMARELO", "50 a 100"], ["VERDE", "abaixo de 50 pallets"]]} />
        </Painel>
      </div>

      <div className="mt-6">
        <UltimasMovimentacoes />
      </div>
    </>
  );
}
