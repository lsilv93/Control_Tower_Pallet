import Link from "next/link";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Boxes, Building2, FileX, Hammer, Layers, TriangleAlert } from "lucide-react";
import { AtualizacaoAutomatica } from "@/components/AtualizacaoAutomatica";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { HistoricoExclusoes } from "@/components/HistoricoExclusoes";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { BarraComposicao } from "@/components/graficos/BarraComposicao";
import { GraficoFluxo } from "@/components/graficos/GraficoFluxo";
import { GraficoPendencias } from "@/components/graficos/GraficoPendencias";
import { Cabecalho, FarolBadge, Indicador, LegendaFarol, Painel, Ponto, StatusBadge, Vazio } from "@/components/ui";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/lib/auth";
import { primeiraRota, tem } from "@/lib/permissoes";
import { obterSaldos, saldosPorConta } from "@/lib/conta";
import { fluxo, granularidadePara, pendenciasPorFornecedor, serieFluxo, totaisPorTipo, valesEmAberto } from "@/lib/consultas";
import { diaLocal, formatarData } from "@/lib/datas";
import { formatarNumero as n, numeroVale, rotuloStatusVale } from "@/lib/formatos";
import { filtroData, lerPeriodo } from "@/lib/periodo";
import { prisma } from "@/lib/prisma";

type Busca = { periodo?: string; dia?: string; ano?: string; semana?: string; mes?: string; de?: string; ate?: string; fornecedor?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const usuario = await requireUsuario();
  // Sem acesso ao Dashboard: vai para a primeira tela liberada ao usuário.
  if (!tem(usuario, "dashboard")) redirect(primeiraRota(usuario));
  const busca = await searchParams;
  const hoje = diaLocal();
  // Filtros globais: período (Dia/Semana/Mês/Intervalo/Geral) e fornecedor.
  const periodo = lerPeriodo(busca, hoje);
  const fornecedores = await prisma.fornecedor.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const fornecedor = fornecedores.find((f) => f.id === busca.fornecedor);
  const fornecedorId = fornecedor?.id;
  const intervalo = { inicio: periodo.inicio, fim: periodo.fim };
  const granularidade = granularidadePara(periodo.inicio, periodo.fim);

  const [saldos, fluxoPeriodo, porTipo, serie, saldoAntes, pendencias, vales, excluidos] = await Promise.all([
    obterSaldos(),
    fluxo(intervalo, fornecedorId),
    totaisPorTipo(intervalo),
    serieFluxo(intervalo, granularidade, fornecedorId),
    periodo.inicio ? saldosPorConta(undefined, periodo.inicio) : null,
    pendenciasPorFornecedor(),
    valesEmAberto(fornecedorId ? { fornecedorId } : {}),
    prisma.valePallet.count({ where: { status: "CANCELADO", canceladoEm: filtroData(periodo), ...(fornecedorId ? { fornecedorId } : {}) } }),
  ]);
  const saldoInicial = fornecedorId ? null : saldoAntes ? saldoAntes.VAZIOS + saldoAntes.CD + saldoAntes.QUEBRADOS : 0;
  const contagem = (f: string) => vales.filter((x) => x.farol === f).length;
  const sufixo = fornecedor ? ` · ${fornecedor.nome}` : "";

  return (
    <>
      <Cabecalho titulo="Centro de Comando" descricao="Conta corrente de pallets PBR em partida dobrada · Vazios, CD e Quebrados em tempo real">
        <AtualizacaoAutomatica />
      </Cabecalho>

      <FiltroPeriodo
        key={JSON.stringify(periodo) + (fornecedorId ?? "")}
        rotulo={periodo.rotulo + sufixo}
        anoAtual={Number(hoje.slice(0, 4))}
        atual={{ tipo: periodo.tipo, dia: periodo.dia, ano: periodo.ano, semana: periodo.semana, mes: periodo.mes, de: periodo.de, ate: periodo.ate }}
        fornecedores={fornecedores}
        fornecedor={fornecedorId}
      />

      {/* Hero + estoques */}
      <div className="entrada grid gap-4 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <section className="card-sm relative overflow-hidden p-6 md:col-span-2 xl:col-span-1">
          <div className="pointer-events-none absolute -bottom-8 -right-6 text-lima opacity-[0.06]">
            <Layers className="h-40 w-40" />
          </div>
          <p className="label">Total geral de pallets no sistema</p>
          <p className="text-[52px] font-semibold leading-none text-lima">{n(saldos.total)}</p>
          <p className="mb-5 mt-2 text-[11px] text-t3">Vazios + CD + Quebrados · posição atual</p>
          <BarraComposicao
            itens={[
              { rotulo: "Vazios", valor: saldos.vazios, cor: "var(--viz-vazios)" },
              { rotulo: "CD", valor: saldos.cd, cor: "var(--viz-cd)" },
              { rotulo: "Quebrados", valor: saldos.quebrados, cor: "var(--viz-quebrados)" },
            ]}
          />
        </section>
        <Indicador titulo="Saldo total · Estoque Vazios" valor={n(saldos.vazios)} detalhe="pulmão de vazios · atual" icone={<Boxes className="h-6 w-6" />} />
        <Indicador titulo="Saldo total · Estoque CD" valor={n(saldos.cd)} detalhe="centro de distribuição · atual" cor="neutro" icone={<Building2 className="h-6 w-6" />} />
        <Indicador titulo="Saldo total · Estoque Quebrados" valor={n(saldos.quebrados)} detalhe="aguardando conserto ou descarte · atual" cor="ouro" icone={<Hammer className="h-6 w-6" />} />
      </div>

      {/* Indicadores do período */}
      <div className="entrada mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card-sm p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="poco flex h-9 w-9 items-center justify-center !rounded-xl text-t2"><ArrowLeftRight className="h-4 w-4" /></span>
            <p className="label !mb-0">SSTK · transferências CD</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-t3">Enviados</p>
              <p className="num text-[24px] font-semibold text-t1">{n(porTipo("ENVIO_CD"))}</p>
            </div>
            <div>
              <p className="text-[11px] text-t3">Recebidos</p>
              <p className="num text-[24px] font-semibold text-t1">{n(porTipo("RECEBIMENTO_CD"))}</p>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-t3">Vazios ↔ CD · {periodo.rotulo}</p>
        </div>
        <Indicador titulo="Entradas no período" valor={n(fluxoPeriodo.entradas)} detalhe={`fornecedor, compra e ajuste → estoques${sufixo}`} cor="lima" icone={<ArrowDownToLine className="h-6 w-6" />} />
        <Indicador titulo="Saídas no período" valor={n(fluxoPeriodo.saidas)} detalhe={`devoluções, estornos, descarte e ajuste${sufixo}`} cor="erro" icone={<ArrowUpFromLine className="h-6 w-6" />} />
        <Indicador
          titulo="Pendente com fornecedores"
          valor={n(fornecedorId ? vales.reduce((s, v) => s + v.quantidade, 0) : saldos.pendenteFornecedores)}
          detalhe={`${fornecedorId ? vales.length : saldos.valesEmAberto} vale(s) em aberto · ${n(excluidos)} cancelado(s) no período`}
          cor="ouro"
          icone={<FileX className="h-6 w-6" />}
        />
      </div>

      {/* Gráficos gerenciais */}
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Painel className="xl:col-span-3" titulo={`Extrato da conta corrente · entradas x saídas${sufixo}`} acoes={<span className="text-[11px] text-t3">{periodo.rotulo} · por {granularidade}</span>}>
          <GraficoFluxo serie={serie} granularidade={granularidade} saldoInicial={saldoInicial} />
          {fluxoPeriodo.transferencias > 0 && (
            <p className="mt-3 text-[11px] text-t3">
              Transferências internas no período (Vazios ↔ CD, quebra, conserto): <strong className="num text-t1">{n(fluxoPeriodo.transferencias)}</strong> — não alteram o total.
            </p>
          )}
        </Painel>
        <Painel className="xl:col-span-2" titulo="Pendências de devolução por fornecedor" acoes={<span className="text-[11px] text-t3">posição atual</span>}>
          <GraficoPendencias
            selecionado={fornecedorId}
            dados={pendencias.slice(0, 10).map((p) => ({
              id: p.fornecedor.id,
              nome: p.fornecedor.nome,
              total: p.total,
              vales: p.vales,
              farol: p.farol,
              maisAntigo: formatarData(p.maisAntigo),
            }))}
          />
          {pendencias.length > 10 && <p className="mt-2 text-[11px] text-t3">Exibindo os 10 maiores de {pendencias.length} fornecedores.</p>}
          <LegendaFarol itens={[["VERMELHO", "acima de 100"], ["AMARELO", "50 a 100"], ["VERDE", "abaixo de 50 pallets"]]} />
        </Painel>
      </div>

      {/* Farol Vale-pallet */}
      <div className="mt-6">
        <Painel
          titulo={<span className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-ouro" /> Farol Vale-pallet{sufixo}</span>}
          acoes={
            <span className="num flex items-center gap-3 text-[11px] text-t2">
              {(["VERMELHO", "AMARELO", "VERDE"] as const).map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5"><Ponto farol={f} /> {contagem(f)}</span>
              ))}
            </span>
          }
        >
          {vales.length === 0 ? (
            <Vazio>Nenhum vale-pallet pendente de devolução.</Vazio>
          ) : (
            <div className="poco max-h-[24rem] overflow-auto">
              <table className="tabela">
                <thead className="sticky top-0">
                  <tr><th>Farol</th><th>Vale</th><th>Fornecedor</th><th>Idade</th><th className="text-right">Qtd.</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {[...vales].sort((a, b) => b.idade - a.idade).map((v) => (
                    <tr key={v.id}>
                      <td><FarolBadge farol={v.farol} /></td>
                      <td><Link prefetch={false} href={`/vales/${v.id}`} className="num font-semibold text-lima hover:underline">{numeroVale(v.numero)}</Link></td>
                      <td className="max-w-[14rem] truncate" title={v.fornecedor.nome}>{v.fornecedor.nome}</td>
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
      </div>

      <div className="mt-6">
        <HistoricoExclusoes limite={10} inicio={periodo.inicio} fim={periodo.fim} titulo={`Vales cancelados (excluídos) · ${periodo.rotulo}`} />
      </div>
      <div className="mt-6">
        <UltimasMovimentacoes inicio={periodo.inicio} fim={periodo.fim} fornecedorId={fornecedorId} titulo={`Últimas movimentações · ${periodo.rotulo}${sufixo}`} />
      </div>
    </>
  );
}
