import Link from "next/link";
import { ArrowUpFromLine, Building2, ClipboardCheck, FileClock, FileX, Hammer, MonitorPlay, Network, PackagePlus, Recycle, Trash2, TriangleAlert, Truck, Warehouse } from "lucide-react";
import { AtualizacaoAutomatica } from "@/components/AtualizacaoAutomatica";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { HistoricoExclusoes } from "@/components/HistoricoExclusoes";
import { SaldosDevedores } from "@/components/SaldosDevedores";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { BarraComposicao } from "@/components/graficos/BarraComposicao";
import { GraficoFluxo } from "@/components/graficos/GraficoFluxo";
import { GraficoBarrasCross } from "@/components/graficos/GraficoBarrasCross";
import { GraficoRosca, type FatiaRosca } from "@/components/graficos/GraficoRosca";
import { PainelValesFornecedor } from "@/components/graficos/PainelValesFornecedor";
import { Cabecalho, FarolBadge, Indicador, LegendaFarol, Painel, Ponto, StatusBadge, Tabela, Vazio } from "@/components/ui";
import { redirect } from "next/navigation";
import { requireCD } from "@/lib/auth";
import { primeiraRota, tem } from "@/lib/permissoes";
import { obterSaldos, saldosPorConta } from "@/lib/conta";
import { consolidacaoTransporte, devedoresPorUnidade, fluxo, granularidadePara, pendenciasPorFornecedor, serieFluxo, totaisPorTipo, valesEmAberto } from "@/lib/consultas";
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

  const [saldos, fluxoPeriodo, porTipo, serie, saldoAntes, pendencias, vales, excluidos, transporte, retornos, devedores, valesTodos] = await Promise.all([
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
    devedoresPorUnidade(cd.id),
    fornecedorId ? valesEmAberto(cd.id) : null,
  ]);
  const saldoInicial = fornecedorId ? null : saldoAntes ? saldoAntes.VAZIOS + saldoAntes.QUEBRADOS : 0;
  const contagem = (f: string) => vales.filter((x) => x.farol === f).length;
  const sufixo = fornecedor ? ` · ${fornecedor.nome}` : "";
  const fisicos = saldos.vazios + saldos.quebrados;

  // ---- posição atual para os KPIs e gráficos gerenciais ----
  const crosses = devedores.filter((d) => d.unidade.tipo === "CROSS" && d.saldo > 0);
  const cdsDestino = devedores.filter((d) => d.unidade.tipo === "CD" && d.saldo > 0);
  const totalCross = crosses.reduce((s, d) => s + d.saldo, 0);
  const totalCds = cdsDestino.reduce((s, d) => s + d.saldo, 0);
  const barrasCross = crosses.map((d) => ({
    id: d.unidade.id,
    codigo: d.unidade.codigo,
    nome: d.unidade.nome,
    saldo: d.saldo,
    vales: d.vales,
    maisAntigo: formatarData(d.maisAntigo),
    idade: d.idade,
  }));
  const fatiasCross = paraFatias(crosses.map((d) => ({ id: d.unidade.id, rotulo: d.unidade.codigo, valor: d.saldo, detalhe: `${d.unidade.nome} · ${d.vales} vale(s)` })));
  const fatiasFornecedor = paraFatias(pendencias.map((p) => ({ id: p.fornecedor.id, rotulo: p.fornecedor.nome, valor: p.total, detalhe: `${p.vales} vale(s)` })), 6);
  const abertos = valesTodos ?? vales;
  const faixa = (min: number, max: number) => abertos.filter((v) => v.idade >= min && v.idade <= max);
  const fatiasIdade: FatiaRosca[] = [
    { id: "verde", rotulo: "Em dia · até 19 dias", cor: "var(--viz-bom)", lista: faixa(0, 19) },
    { id: "amarelo", rotulo: "Atenção · 20 a 29 dias", cor: "var(--viz-alerta)", lista: faixa(20, 29) },
    { id: "vermelho", rotulo: "Crítico · 30 dias ou mais", cor: "var(--viz-critico)", lista: faixa(30, Number.MAX_SAFE_INTEGER) },
  ]
    .map((f) => ({ id: f.id, rotulo: f.rotulo, cor: f.cor, valor: f.lista.reduce((s, v) => s + v.quantidade, 0), detalhe: `${f.lista.length} vale(s)` }))
    .filter((f) => f.valor > 0);

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

      {/* KPIs superiores · posição atual do CD */}
      <div className="entrada grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" data-testid="cards-saldos">
        <Kpi titulo="Vazios" valor={saldos.vazios} legenda="Estoque físico ativo" icone={Warehouse} cor="lima" testid="saldo-vazios">
          <BarraComposicao
            itens={[
              { rotulo: "Vazios", valor: saldos.vazios, cor: "var(--viz-vazios)" },
              { rotulo: "Quebrados", valor: saldos.quebrados, cor: "var(--viz-quebrados)" },
            ]}
          />
        </Kpi>
        <Kpi titulo="Quebrados" valor={saldos.quebrados} legenda="Aguardando reparo ou descarte" icone={Hammer} cor="ouro" rodape={`${fisicos ? Math.round((saldos.quebrados / fisicos) * 100) : 0}% do estoque físico`} />
        <Kpi titulo="Devedor Cross" valor={totalCross} legenda="Custódia externa" icone={Network} cor="neutro" rodape={`${crosses.length} Ponto(s) de Cross devendo`} />
        <Kpi titulo="Devedor CDs" valor={totalCds} legenda="Transferências pendentes" icone={Building2} cor="neutro" rodape={`${cdsDestino.length} CD(s) devendo`} />
        <Kpi titulo="Vales pendentes" valor={saldos.fornecedores} legenda="Débito com fornecedores" icone={FileClock} cor="erro" rodape={`${saldos.valesFornecedorEmAberto} vale(s) a pagar`} />
      </div>

      {/* Gráficos gerenciais */}
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Painel
          className="xl:col-span-3"
          titulo={<span className="flex items-center gap-2"><Network className="h-4 w-4 text-lima" /> Saldo devedor por Ponto de Cross</span>}
          acoes={<span className="num text-[12px] font-semibold text-t1">Total {n(totalCross)} pallets</span>}
        >
          <GraficoBarrasCross dados={barrasCross} />
        </Painel>
        <Painel
          className="xl:col-span-2"
          titulo={<span className="flex items-center gap-2"><Network className="h-4 w-4 text-lima" /> Participação de cada Cross</span>}
          acoes={<span className="text-[11px] text-t3">% do saldo externo</span>}
        >
          <GraficoRosca dados={fatiasCross} rotuloTotal="pallets em Cross" vazio="Nenhum saldo devedor em Pontos de Cross." />
        </Painel>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Painel
          className="xl:col-span-2"
          titulo={<span className="flex items-center gap-2"><FileClock className="h-4 w-4 text-lima" /> Vales pendentes de fornecedores</span>}
          acoes={<span className="num text-[12px] font-semibold text-t1">{n(saldos.fornecedores)} pallets</span>}
        >
          <PainelValesFornecedor porFornecedor={fatiasFornecedor} porIdade={fatiasIdade} />
        </Painel>
        <div className="xl:col-span-3">
          <SaldosDevedores cdId={cd.id} titulo="Detalhamento dos saldos devedores (CDs e Cross)" />
        </div>
      </div>

      {/* Indicadores do período */}
      <h2 className="secao mb-3 mt-8 flex items-center gap-2">Movimentação no período · {periodo.rotulo}</h2>
      <div className="entrada grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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

const CORES = ["var(--viz-cat-1)", "var(--viz-cat-2)", "var(--viz-cat-3)", "var(--viz-cat-4)", "var(--viz-cat-5)", "var(--viz-cat-6)", "var(--viz-cat-7)"];

/**
 * Fatias da rosca: as maiores (até `maximo`) e o restante somado em "Outros". A cor
 * segue a entidade (ordem alfabética do rótulo entre as exibidas), não a posição no ranking.
 */
function paraFatias(itens: { id: string; rotulo: string; valor: number; detalhe?: string }[], maximo = 7): FatiaRosca[] {
  const ordenados = [...itens].filter((i) => i.valor > 0).sort((a, b) => b.valor - a.valor);
  const exibidos = ordenados.length > maximo ? ordenados.slice(0, maximo - 1) : ordenados;
  const resto = ordenados.slice(exibidos.length);
  const cor = new Map([...exibidos].sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")).map((i, k) => [i.id, CORES[k]]));
  const fatias: FatiaRosca[] = exibidos.map((i) => ({ ...i, cor: cor.get(i.id)! }));
  if (resto.length) {
    fatias.push({ id: "outros", rotulo: `Outros (${resto.length})`, valor: resto.reduce((s, i) => s + i.valor, 0), cor: "var(--viz-outros)" });
  }
  return fatias;
}

const CORES_KPI = { lima: "text-lima", ouro: "text-ouro", erro: "text-erro", neutro: "text-t1" } as const;

/** KPI compacto: ícone em poço, rótulo, valor em destaque e legenda curta. */
function Kpi({
  titulo,
  valor,
  legenda,
  icone: Icone,
  cor,
  rodape,
  testid,
  children,
}: {
  titulo: string;
  valor: number;
  legenda: string;
  icone: typeof Warehouse;
  cor: keyof typeof CORES_KPI;
  rodape?: string;
  testid?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="card-sm relative flex min-w-0 flex-col overflow-hidden p-5">
      <Icone className={`pointer-events-none absolute -bottom-5 -right-4 h-28 w-28 opacity-[0.06] ${CORES_KPI[cor]}`} aria-hidden />
      <div className="mb-3 flex items-center gap-3">
        <span className={`poco flex h-10 w-10 flex-none items-center justify-center !rounded-2xl ${CORES_KPI[cor]}`}>
          <Icone className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-t3">{titulo}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-t4">{legenda}</p>
        </div>
      </div>
      <p className={`num text-[34px] font-semibold leading-none ${cor === "lima" ? "text-lima" : "text-t1"}`} data-testid={testid}>{n(valor)}</p>
      <p className="mt-1 text-[11px] text-t3">pallets PBR</p>
      {children && <div className="mt-3">{children}</div>}
      {rodape && <p className="mt-auto pt-3 text-[11px] text-t3">{rodape}</p>}
    </section>
  );
}
