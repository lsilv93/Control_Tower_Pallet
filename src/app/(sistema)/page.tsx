import Link from "next/link";
import { ArrowUpFromLine, Boxes, Building2, ClipboardCheck, FileX, Hammer, MonitorPlay, PackagePlus, Recycle, Scale, Trash2, TriangleAlert, Truck } from "lucide-react";
import { AtualizacaoAutomatica } from "@/components/AtualizacaoAutomatica";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { HistoricoExclusoes } from "@/components/HistoricoExclusoes";
import { SaldosDevedores } from "@/components/SaldosDevedores";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { BarraComposicao } from "@/components/graficos/BarraComposicao";
import { GraficoFluxo } from "@/components/graficos/GraficoFluxo";
import { GraficoPendencias } from "@/components/graficos/GraficoPendencias";
import { Cabecalho, FarolBadge, Indicador, LegendaFarol, Painel, Ponto, StatusBadge, Tabela, Vazio } from "@/components/ui";
import { redirect } from "next/navigation";
import { requireCD } from "@/lib/auth";
import { primeiraRota, tem } from "@/lib/permissoes";
import { obterSaldos, saldosPorConta } from "@/lib/conta";
import { consolidacaoTransporte, fluxo, granularidadePara, pendenciasPorFornecedor, serieFluxo, totaisPorTipo, valesEmAberto } from "@/lib/consultas";
import { diaLocal, formatarData } from "@/lib/datas";
import { formatarNumero as n, numeroVale, rotuloStatusVale } from "@/lib/formatos";
import { filtroData, lerPeriodo } from "@/lib/periodo";
import { prisma } from "@/lib/prisma";

type Busca = { periodo?: string; dia?: string; ano?: string; semana?: string; mes?: string; de?: string; ate?: string; fornecedor?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const usuario = await requireCD();
  // Sem acesso ao Dashboard: vai para a primeira tela liberada ao usuário.
  if (!tem(usuario, "dashboard")) redirect(primeiraRota(usuario));
  const cd = usuario.cd;
  const busca = await searchParams;
  const hoje = diaLocal();
  // Filtros globais: período (Dia/Semana/Mês/Intervalo/Geral) e fornecedor.
  const periodo = lerPeriodo(busca, hoje);
  const fornecedores = await prisma.fornecedor.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const fornecedor = fornecedores.find((f) => f.id === busca.fornecedor);
  const fornecedorId = fornecedor?.id;
  const intervalo = { inicio: periodo.inicio, fim: periodo.fim };
  const granularidade = granularidadePara(periodo.inicio, periodo.fim);

  const [saldos, fluxoPeriodo, porTipo, serie, saldoAntes, pendencias, vales, excluidos, transporte, retornos] = await Promise.all([
    obterSaldos(cd.id),
    fluxo(cd.id, intervalo, fornecedorId),
    totaisPorTipo(cd.id, intervalo),
    serieFluxo(cd.id, intervalo, granularidade, fornecedorId),
    periodo.inicio ? saldosPorConta(prisma, cd.id, periodo.inicio) : null,
    pendenciasPorFornecedor(cd.id),
    valesEmAberto(cd.id, fornecedorId ? { fornecedorId } : {}),
    prisma.valePallet.count({ where: { cdId: cd.id, status: "CANCELADO", canceladoEm: filtroData(periodo), ...(fornecedorId ? { fornecedorId } : {}) } }),
    consolidacaoTransporte(cd.id, intervalo),
    prisma.retornoConferencia.aggregate({ where: { cdId: cd.id, criadoEm: filtroData(periodo) }, _sum: { falta: true }, _count: true }),
  ]);
  const saldoInicial = fornecedorId ? null : saldoAntes ? saldoAntes.VAZIOS + saldoAntes.QUEBRADOS : 0;
  const contagem = (f: string) => vales.filter((x) => x.farol === f).length;
  const sufixo = fornecedor ? ` · ${fornecedor.nome}` : "";
  const fisicos = saldos.vazios + saldos.quebrados;

  return (
    <>
      <Cabecalho
        titulo={`Control Tower · CD ${cd.codigo}`}
        descricao={`${cd.nome} · Vazios e Quebrados em tempo real, saldo com fornecedores e saldos devedores de CDs destino e Pontos de Cross.`}
      >
        {tem(usuario, "tv") && (
          <Link href="/tv" className="btn-secondary" target="_blank">
            <MonitorPlay className="h-4 w-4" /> Tela TV
          </Link>
        )}
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

      {/* Cards em destaque (posição atual do CD) */}
      <div className="entrada grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="cards-saldos">
        <section className="card-sm relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -bottom-8 -right-6 text-lima opacity-[0.06]">
            <Boxes className="h-40 w-40" />
          </div>
          <p className="label">Saldo de pallets vazios</p>
          <p className="num text-[46px] font-semibold leading-none text-lima" data-testid="saldo-vazios">{n(saldos.vazios)}</p>
          <p className="mb-4 mt-2 text-[11px] text-t3">pulmão de vazios · atual</p>
          <BarraComposicao
            itens={[
              { rotulo: "Vazios", valor: saldos.vazios, cor: "var(--viz-vazios)" },
              { rotulo: "Quebrados", valor: saldos.quebrados, cor: "var(--viz-quebrados)" },
            ]}
          />
          <p className="mt-2 text-[11px] text-t4">Estoque físico total: <strong className="num text-t2">{n(fisicos)}</strong></p>
        </section>
        <Indicador titulo="Saldo do CD · entradas de fornecedores" valor={n(saldos.fornecedores)} detalhe={`${saldos.valesFornecedorEmAberto} vale(s) pendente(s) de devolução/pagamento`} cor="neutro" icone={<Building2 className="h-6 w-6" />} />
        <Indicador titulo="Saldo de pallets quebrados" valor={n(saldos.quebrados)} detalhe="aguardando conserto ou descarte" cor="ouro" icone={<Hammer className="h-6 w-6" />} />
        <Indicador titulo="Saldo devedor · CDs e Cross" valor={n(saldos.devedor)} detalhe="pallets enviados ainda não retornados" cor="neutro" icone={<Scale className="h-6 w-6" />} />
      </div>

      {/* Indicadores do período */}
      <div className="entrada mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Indicador titulo="Entradas de fornecedor" valor={n(porTipo("RECEBIMENTO_FORNECEDOR"))} detalhe={periodo.rotulo} icone={<PackagePlus className="h-5 w-5" />} />
        <Indicador titulo="Enviados a CDs / Cross" valor={n(porTipo("ENVIO_UNIDADE"))} detalhe={periodo.rotulo} cor="neutro" icone={<ArrowUpFromLine className="h-5 w-5" />} />
        <Indicador
          titulo="Retornos recebidos"
          valor={n(porTipo("RETORNO_UNIDADE"))}
          detalhe={`${retornos._count} conferência(s) · falta ${n(retornos._sum.falta ?? 0)}`}
          cor={retornos._sum.falta ? "erro" : "lima"}
          icone={<ClipboardCheck className="h-5 w-5" />}
        />
        <Indicador titulo="Recuperados (reparo)" valor={n(porTipo("RECUPERADO"))} detalhe={periodo.rotulo} cor="lima" icone={<Recycle className="h-5 w-5" />} />
        <Indicador
          titulo="Descartados / destruídos"
          valor={n(porTipo("DESCARTE") + porTipo("CANIBALIZACAO"))}
          detalhe={`${n(porTipo("CANIBALIZACAO"))} usado(s) em reparo`}
          cor="erro"
          icone={<Trash2 className="h-5 w-5" />}
        />
      </div>

      {/* Saldos devedores e pendências de fornecedor */}
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SaldosDevedores cdId={cd.id} titulo="Saldos devedores por Ponto de Cross e CD destino" />
        </div>
        <Painel className="xl:col-span-2" titulo="Vales pendentes por fornecedor" acoes={<span className="num text-[12px] font-semibold text-t1">Total {n(saldos.fornecedores)}</span>}>
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

      {/* Consolidação por transportadora */}
      <div className="mt-6">
        <Painel
          titulo={<span className="flex items-center gap-2"><Truck className="h-4 w-4 text-lima" /> Consolidação por transportadora</span>}
          acoes={<span className="text-[11px] text-t3">{periodo.rotulo}</span>}
        >
          {transporte.length === 0 ? (
            <Vazio>Nenhuma movimentação com transportadora no período.</Vazio>
          ) : (
            <Tabela className="max-h-[24rem] overflow-auto">
              <table className="tabela" data-testid="tabela-transporte">
                <thead className="sticky top-0">
                  <tr>
                    <th>Transportadora</th><th className="text-right">Operações</th>
                    <th className="text-right">Recebidos (fornecedor)</th><th className="text-right">Enviados</th>
                    <th className="text-right">Retornados</th><th className="text-right">Faltas</th>
                  </tr>
                </thead>
                <tbody>
                  {transporte.map((t) => (
                    <tr key={t.transportadora}>
                      <td className="font-medium text-t1">{t.transportadora}</td>
                      <td className="num text-right">{t.operacoes}</td>
                      <td className="num text-right">{n(t.recebidosFornecedor)}</td>
                      <td className="num text-right">{n(t.enviados)}</td>
                      <td className="num text-right text-lima">{n(t.retornados)}</td>
                      <td className={`num text-right font-semibold ${t.faltas ? "text-erro" : "text-t3"}`}>{n(t.faltas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tabela>
          )}
        </Painel>
      </div>

      {/* Extrato dos estoques físicos */}
      <div className="mt-6">
        <Painel titulo={`Extrato dos estoques físicos (Vazios + Quebrados) · entradas x saídas${sufixo}`} acoes={<span className="text-[11px] text-t3">{periodo.rotulo} · por {granularidade}</span>}>
          <GraficoFluxo serie={serie} granularidade={granularidade} saldoInicial={saldoInicial} />
          <p className="mt-3 text-[11px] text-t3">
            Entradas: retornos de CD/Cross, compras e inclusões. Saídas: pagamentos a fornecedores, descartes e correções.
            {fluxoPeriodo.transferencias > 0 && <> Quebras e consertos no período: <strong className="num text-t1">{n(fluxoPeriodo.transferencias)}</strong> (não alteram o total).</>}
          </p>
        </Painel>
      </div>

      {/* Farol Vale-pallet */}
      <div className="mt-6">
        <Painel
          titulo={<span className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-ouro" /> Farol Vale-pallet (fornecedores){sufixo}</span>}
          acoes={
            <span className="num flex items-center gap-3 text-[11px] text-t2">
              {(["VERMELHO", "AMARELO", "VERDE"] as const).map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5"><Ponto farol={f} /> {contagem(f)}</span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-t3"><FileX className="h-3.5 w-3.5" /> {n(excluidos)} cancelado(s)</span>
            </span>
          }
        >
          {vales.length === 0 ? (
            <Vazio>Nenhum vale-pallet de fornecedor pendente de devolução.</Vazio>
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
                      <td><Link prefetch={false} href={`/vales/${v.id}`} className="num font-semibold text-lima hover:underline">{numeroVale(v.numero, v.tipo)}</Link></td>
                      <td className="max-w-[14rem] truncate" title={v.fornecedor?.nome}>{v.fornecedor?.nome ?? "—"}</td>
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
        <HistoricoExclusoes cdId={cd.id} limite={10} inicio={periodo.inicio} fim={periodo.fim} titulo={`Vales cancelados (excluídos) · ${periodo.rotulo}`} />
      </div>
      <div className="mt-6">
        <UltimasMovimentacoes cdId={cd.id} inicio={periodo.inicio} fim={periodo.fim} fornecedorId={fornecedorId} titulo={`Últimas movimentações · ${periodo.rotulo}${sufixo}`} />
      </div>
    </>
  );
}
