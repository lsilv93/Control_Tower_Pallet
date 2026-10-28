import Link from "next/link";
import { ArrowUpFromLine, ClipboardCheck, FileClock, FileX, Hammer, MonitorPlay, Network, PackageOpen, PackagePlus, Recycle, Trash2, TriangleAlert, Truck, Warehouse } from "lucide-react";
import { AtualizacaoAutomatica } from "@/components/AtualizacaoAutomatica";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { HistoricoExclusoes } from "@/components/HistoricoExclusoes";
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
import { consolidacaoTransporte, enviosEmTransito, fluxo, granularidadePara, pendenciasPorFornecedor, posicaoUnidades, serieFluxo, totaisPorTipo, valesEmAberto } from "@/lib/consultas";
import { diaLocal, formatarData } from "@/lib/datas";
import { formatarDataHora } from "@/lib/datas";
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
  // Módulo de fornecedores só aparece quando liberado pelo Master na unidade.
  const moduloFornecedor = cd.recebimentoFornecedor;
  const fornecedores = moduloFornecedor ? await prisma.fornecedor.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [];
  const fornecedor = fornecedores.find((f) => f.id === busca.fornecedor);
  const fornecedorId = fornecedor?.id;
  const intervalo = { inicio: periodo.inicio, fim: periodo.fim };
  const granularidade = granularidadePara(periodo.inicio, periodo.fim);
  // Pontos de Cross acompanhados: visão global vê todos; um CD regional vê os seus; um Cross vê a si mesmo.
  const filtroCross = usuario.global ? {} : cd.tipo === "CROSS" ? { id: cd.id } : { cdRegionalId: cd.id };
  const idsCross = (await prisma.centroDistribuicao.findMany({ where: { tipo: "CROSS", ativo: true, ...filtroCross }, select: { id: true } })).map((c) => c.id);

  const [saldos, fluxoPeriodo, porTipo, serie, saldoAntes, pendencias, vales, excluidos, transporte, conferencias, posicaoCross, transito, valesTodos] = await Promise.all([
    obterSaldos(cd.id),
    fluxo(cd.id, intervalo, fornecedorId),
    totaisPorTipo(cd.id, intervalo),
    serieFluxo(cd.id, intervalo, granularidade, fornecedorId),
    periodo.inicio ? saldosPorConta(prisma, cd.id, periodo.inicio) : null,
    moduloFornecedor ? pendenciasPorFornecedor(cd.id) : [],
    moduloFornecedor ? valesEmAberto(cd.id, fornecedorId ? { fornecedorId } : {}) : [],
    prisma.valePallet.count({ where: { cdId: cd.id, status: "CANCELADO", canceladoEm: filtroData(periodo), ...(fornecedorId ? { fornecedorId } : {}) } }),
    consolidacaoTransporte(cd.id, intervalo),
    prisma.conferencia.findMany({ where: { cdId: cd.id, criadoEm: filtroData(periodo) }, select: { diferenca: true } }),
    idsCross.length ? posicaoUnidades(idsCross) : [],
    enviosEmTransito({ OR: [{ cdId: cd.id }, { unidadeId: cd.id }] }),
    moduloFornecedor && fornecedorId ? valesEmAberto(cd.id) : null,
  ]);
  const saldoInicial = fornecedorId ? null : saldoAntes ? saldoAntes.VAZIOS + saldoAntes.QUEBRADOS : 0;
  const contagem = (f: string) => vales.filter((x) => x.farol === f).length;
  const sufixo = fornecedor ? ` · ${fornecedor.nome}` : "";
  const fisicos = saldos.vazios + saldos.quebrados;
  const faltasPeriodo = conferencias.reduce((s, c) => s + Math.max(0, -c.diferenca), 0);

  // ---- posição dos Pontos de Cross para os gráficos gerenciais ----
  const crosses = posicaoCross.filter((p) => p.vazios + p.quebrados > 0);
  const totalCross = crosses.reduce((s, p) => s + p.vazios + p.quebrados, 0);
  const barrasCross = crosses.map((p) => ({ id: p.unidade.id, codigo: p.unidade.codigo, nome: p.unidade.nome, saldo: p.vazios + p.quebrados, bons: p.vazios, quebrados: p.quebrados, aReceber: p.aReceber }));
  const fatiasCross = paraFatias(crosses.map((p) => ({ id: p.unidade.id, rotulo: p.unidade.codigo, valor: p.vazios + p.quebrados, detalhe: `${p.unidade.nome} · ${p.vazios} PBR · ${p.quebrados} quebrados` })));
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
  const tipoUnidade = cd.tipo === "CROSS" ? "Ponto de Cross" : cd.hub ? "CD Hub" : "CD";

  return (
    <>
      <Cabecalho
        titulo={`Painel · ${tipoUnidade} ${cd.codigo}`}
        descricao={`${cd.nome} · Pallets PBR e Pallets Quebrados em tempo real, envios em trânsito, recebimentos a conferir e ocorrências.${usuario.global ? " Visão Nível Brasil disponível na Torre de Controle." : ""}`}
      >
        {usuario.global && tem(usuario, "tv") && (
          <Link href="/tv" className="btn-secondary" target="_blank">
            <MonitorPlay className="h-4 w-4" /> Torre de Controle (TV)
          </Link>
        )}
        <AtualizacaoAutomatica />
      </Cabecalho>

      <FiltroPeriodo
        key={JSON.stringify(periodo) + (fornecedorId ?? "")}
        rotulo={periodo.rotulo + sufixo}
        anoAtual={Number(hoje.slice(0, 4))}
        atual={{ tipo: periodo.tipo, dia: periodo.dia, ano: periodo.ano, semana: periodo.semana, mes: periodo.mes, de: periodo.de, ate: periodo.ate }}
        fornecedores={moduloFornecedor ? fornecedores : undefined}
        fornecedor={fornecedorId}
      />

      {/* KPIs superiores · posição atual da unidade */}
      <div className="entrada grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5" data-testid="cards-saldos">
        <Kpi titulo="Pallets PBR" valor={saldos.vazios} legenda="Estoque disponível" icone={Warehouse} cor="lima" testid="saldo-vazios" className="col-span-2 sm:col-span-1">
          <BarraComposicao
            itens={[
              { rotulo: "Pallets PBR", valor: saldos.vazios, cor: "var(--viz-vazios)" },
              { rotulo: "Pallets Quebrados", valor: saldos.quebrados, cor: "var(--viz-quebrados)" },
            ]}
          />
        </Kpi>
        <Kpi titulo="Pallets Quebrados" valor={saldos.quebrados} legenda={cd.hub ? "Aguardando conserto" : "Enviar ao CDJC para conserto"} icone={Hammer} cor="ouro" testid="saldo-quebrados" rodape={`${fisicos ? Math.round((saldos.quebrados / fisicos) * 100) : 0}% do estoque físico`} />
        <Kpi titulo="Em trânsito" valor={saldos.transito} legenda="Enviados, aguardando conferência" icone={Truck} cor="neutro" testid="saldo-transito" rodape={`${transito.filter((v) => v.cdId === cd.id).length} vale(s) de envio`} />
        <Kpi titulo="A receber" valor={saldos.aReceber} legenda="Vales destinados a esta unidade" icone={PackageOpen} cor="neutro" testid="saldo-a-receber" rodape={`${saldos.valesAReceber} vale(s) para conferir`} />
        <Kpi titulo="Faltas em aberto" valor={saldos.ocorrencias} legenda="Ocorrências a apurar" icone={TriangleAlert} cor="erro" testid="saldo-ocorrencias" rodape={`${saldos.ocorrenciasAbertas} ocorrência(s) envolvendo a unidade`} />
      </div>

      {/* Gráficos gerenciais · Pontos de Cross */}
      {idsCross.length > 0 && cd.tipo !== "CROSS" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-5">
          <Painel
            className="xl:col-span-3"
            titulo={<span className="flex items-center gap-2"><Network className="h-4 w-4 text-lima" /> Estoque por Ponto de Cross{usuario.global ? "" : ` (região ${cd.codigo})`}</span>}
            acoes={<span className="num text-[12px] font-semibold text-t1">Total {n(totalCross)} pallets</span>}
          >
            <GraficoBarrasCross dados={barrasCross} />
          </Painel>
          <Painel
            className="xl:col-span-2"
            titulo={<span className="flex items-center gap-2"><Network className="h-4 w-4 text-lima" /> Participação de cada Cross</span>}
            acoes={<span className="text-[11px] text-t3">% do estoque em Cross</span>}
          >
            <GraficoRosca dados={fatiasCross} rotuloTotal="pallets em Cross" vazio="Nenhum pallet em estoque nos Pontos de Cross." />
          </Painel>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        {moduloFornecedor && (
          <Painel
            className="xl:col-span-2"
            titulo={<span className="flex items-center gap-2"><FileClock className="h-4 w-4 text-lima" /> Vales pendentes de fornecedores</span>}
            acoes={<span className="num text-[12px] font-semibold text-t1">{n(saldos.fornecedores)} pallets</span>}
          >
            <PainelValesFornecedor porFornecedor={fatiasFornecedor} porIdade={fatiasIdade} />
          </Painel>
        )}
        <Painel
          className={moduloFornecedor ? "xl:col-span-3" : "xl:col-span-5"}
          titulo={<span className="flex items-center gap-2"><Truck className="h-4 w-4 text-lima" /> Vales em trânsito (enviados e a receber)</span>}
          acoes={<Link href="/recebimento" className="text-[11px] font-semibold text-lima hover:underline">Conferir recebimento</Link>}
        >
          {transito.length === 0 ? (
            <Vazio>Nenhum vale em trânsito envolvendo {cd.codigo}.</Vazio>
          ) : (
            <Tabela className="max-h-[22rem] overflow-auto">
              <table className="tabela" data-testid="tabela-transito">
                <thead className="sticky top-0"><tr><th>Vale</th><th>Sentido</th><th>Origem → Destino</th><th className="text-right">Pallets PBR</th><th className="text-right">Pallets Quebrados</th><th>Emissão</th></tr></thead>
                <tbody>
                  {transito.map((v) => (
                    <tr key={v.id}>
                      <td><Link prefetch={false} href={`/vales/${v.id}`} className="num font-semibold text-lima hover:underline">{numeroVale(v.numero, v.tipo)}</Link></td>
                      <td>{v.cdId === cd.id ? <span className="pill text-t2 bg-t2/10">Enviado</span> : <span className="pill text-lima bg-lima/10">A receber</span>}</td>
                      <td className="num">{v.cd.codigo} → {v.unidade?.codigo ?? "—"}</td>
                      <td className="num text-right">{n(v.quantidadeBons)}</td>
                      <td className="num text-right">{n(v.quantidadeQuebrados)}</td>
                      <td className="num">{formatarDataHora(v.criadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tabela>
          )}
        </Painel>
      </div>

      {/* Indicadores do período */}
      <h2 className="secao mb-3 mt-8 flex items-center gap-2">Movimentação no período · {periodo.rotulo}</h2>
      <div className="entrada grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        {moduloFornecedor ? (
          <Indicador titulo="Entradas de fornecedor" valor={n(porTipo("RECEBIMENTO_FORNECEDOR"))} detalhe={periodo.rotulo} icone={<PackagePlus className="h-5 w-5" />} />
        ) : (
          <Indicador titulo="Inclusões / compras" valor={n(porTipo("INCLUSAO_MANUAL") + porTipo("COMPRA"))} detalhe={periodo.rotulo} icone={<PackagePlus className="h-5 w-5" />} />
        )}
        <Indicador titulo="Enviados" valor={n(porTipo("ENVIO"))} detalhe={periodo.rotulo} cor="neutro" icone={<ArrowUpFromLine className="h-5 w-5" />} />
        <Indicador
          titulo="Recebidos (conferidos)"
          valor={n(porTipo("RECEBIMENTO") + porTipo("SOBRA"))}
          detalhe={`${conferencias.length} conferência(s) · falta ${n(faltasPeriodo)}`}
          cor={faltasPeriodo ? "erro" : "lima"}
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
                    <th className="text-right">Conferidos</th><th className="text-right">Faltas</th>
                  </tr>
                </thead>
                <tbody>
                  {transporte.map((t) => (
                    <tr key={t.transportadora}>
                      <td className="font-medium text-t1">{t.transportadora}</td>
                      <td className="num text-right">{t.operacoes}</td>
                      <td className="num text-right">{n(t.recebidosFornecedor)}</td>
                      <td className="num text-right">{n(t.enviados)}</td>
                      <td className="num text-right text-lima">{n(t.conferidos)}</td>
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
        <Painel titulo={`Extrato dos estoques físicos (Pallets PBR + Pallets Quebrados) · entradas x saídas${sufixo}`} acoes={<span className="text-[11px] text-t3">{periodo.rotulo} · por {granularidade}</span>}>
          <GraficoFluxo serie={serie} granularidade={granularidade} saldoInicial={saldoInicial} />
          <p className="mt-3 text-[11px] text-t3">
            Entradas: recebimentos conferidos, sobras, compras e inclusões. Saídas: envios, descartes e remoções.
            {fluxoPeriodo.transferencias > 0 && <> Quebras e consertos no período: <strong className="num text-t1">{n(fluxoPeriodo.transferencias)}</strong> (não alteram o total).</>}
          </p>
        </Painel>
      </div>

      {moduloFornecedor && (
        <>
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

        </>
      )}

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
  className,
  children,
}: {
  titulo: string;
  valor: number;
  legenda: string;
  icone: typeof Warehouse;
  cor: keyof typeof CORES_KPI;
  rodape?: string;
  testid?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={`card-sm relative flex min-w-0 flex-col overflow-hidden p-4 sm:p-5 ${className ?? ""}`}>
      <Icone className={`pointer-events-none absolute -bottom-5 -right-4 h-28 w-28 opacity-[0.06] ${CORES_KPI[cor]}`} aria-hidden />
      <div className="mb-3 flex items-center gap-3">
        <span className={`poco hidden h-10 w-10 flex-none items-center justify-center !rounded-2xl sm:flex ${CORES_KPI[cor]}`}>
          <Icone className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-t3">{titulo}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-t4">{legenda}</p>
        </div>
      </div>
      <p className={`num text-[28px] font-semibold leading-none sm:text-[34px] ${cor === "lima" ? "text-lima" : "text-t1"}`} data-testid={testid}>{n(valor)}</p>
      <p className="mt-1 text-[11px] text-t3">pallets</p>
      {children && <div className="mt-3">{children}</div>}
      {rodape && <p className="mt-auto pt-3 text-[11px] text-t3">{rodape}</p>}
    </section>
  );
}
