<?php
declare(strict_types=1);
// Painel da unidade (src/app/(sistema)/page.tsx).
$usuario = requireCD();
// Sem acesso ao Painel: vai para a primeira tela liberada ao usuário.
if (!tem($usuario, 'dashboard')) redirecionar(primeiraRota($usuario));
View::$titulo = 'Painel';
$cd = $usuario['cd'];
$hoje = diaLocal();
$periodo = lerPeriodo($_GET, $hoje);
// Módulo de fornecedores só aparece quando liberado pelo Master na unidade.
$moduloFornecedor = $cd['recebimentoFornecedor'];
$fornecedores = $moduloFornecedor ? Db::all('SELECT `id`, `nome` FROM `Fornecedor` ORDER BY `nome` ASC') : [];
$fornecedor = null;
foreach ($fornecedores as $f) if ($f['id'] === q('fornecedor')) $fornecedor = $f;
$fornecedorId = $fornecedor['id'] ?? null;
$intervalo = ['inicio' => $periodo['inicio'], 'fim' => $periodo['fim']];
$granularidade = granularidadePara($periodo['inicio'], $periodo['fim']);
// Pontos de Cross acompanhados: visão global vê todos; um CD regional vê os seus; um Cross vê a si mesmo.
if ($usuario['global']) $idsCross = Db::col("SELECT `id` FROM `CentroDistribuicao` WHERE `tipo` = 'CROSS' AND `ativo` = 1");
elseif ($cd['tipo'] === 'CROSS') $idsCross = Db::col("SELECT `id` FROM `CentroDistribuicao` WHERE `tipo` = 'CROSS' AND `ativo` = 1 AND `id` = ?", [$cd['id']]);
else $idsCross = Db::col("SELECT c.`id` FROM `CentroDistribuicao` c JOIN `CrossCD` x ON x.`crossId` = c.`id` AND x.`cdId` = ? WHERE c.`tipo` = 'CROSS' AND c.`ativo` = 1", [$cd['id']]);

// Kanban: vales já conferidos com divergência ainda em aberto (saem quando a ocorrência é encerrada).
$divergentes = Db::all(
    "SELECT v.*, o.`codigo` AS cdCodigo, d.`codigo` AS unidadeCodigo, c.`numero` AS confNumero, c.`criadoEm` AS confCriadoEm, c.`diferenca` AS confDiferenca
       FROM `ValePallet` v JOIN `CentroDistribuicao` o ON o.`id` = v.`cdId` LEFT JOIN `CentroDistribuicao` d ON d.`id` = v.`unidadeId` JOIN `Conferencia` c ON c.`id` = v.`conferenciaId`
      WHERE v.`tipo` = 'ENVIO' AND v.`status` = 'FINALIZADO' AND (v.`cdId` = ? OR v.`unidadeId` = ?)
        AND EXISTS (SELECT 1 FROM `ValePallet` x WHERE x.`conferenciaOrigemId` = v.`conferenciaId` AND x.`status` = 'PENDENTE')
      ORDER BY v.`criadoEm` ASC LIMIT 30",
    [$cd['id'], $cd['id']],
);
foreach ($divergentes as &$dv) {
    $dv['ocorrencias'] = Db::all("SELECT x.`numero`, a.`codigo` AS aguardandoCodigo FROM `ValePallet` x LEFT JOIN `CentroDistribuicao` a ON a.`id` = x.`aguardandoId` WHERE x.`conferenciaOrigemId` = ? AND x.`status` = 'PENDENTE'", [$dv['conferenciaId']]);
}
unset($dv);
$acumulado = acumuladoresEnvio($cd['id']);
[$aguardW, $aguardP] = filtroAguardandoUsuario($usuario);
$aguardandoAcao = Db::all("SELECT v.*, o.`codigo` AS cdCodigo, d.`codigo` AS unidadeCodigo, a.`codigo` AS aguardandoCodigo FROM `ValePallet` v JOIN `CentroDistribuicao` o ON o.`id` = v.`cdId`
                             LEFT JOIN `CentroDistribuicao` d ON d.`id` = v.`unidadeId` LEFT JOIN `CentroDistribuicao` a ON a.`id` = v.`aguardandoId` WHERE $aguardW ORDER BY v.`criadoEm` ASC LIMIT 6", $aguardP);
$saldos = obterSaldos($cd['id']);
$fluxoPeriodo = fluxo($cd['id'], $intervalo, $fornecedorId);
$porTipo = totaisPorTipo($cd['id'], $intervalo);
$serie = serieFluxo($cd['id'], $intervalo, $granularidade, $fornecedorId);
$saldoAntes = $periodo['inicio'] ? saldosPorConta($cd['id'], $periodo['inicio']) : null;
$pendencias = $moduloFornecedor ? pendenciasPorFornecedor($cd['id']) : [];
$vales = $moduloFornecedor ? valesEmAberto($cd['id'], $fornecedorId) : [];
[$wp, $pp] = sqlPeriodo($periodo, '`canceladoEm`');
$excluidos = (int) Db::val("SELECT COUNT(*) FROM `ValePallet` WHERE `cdId` = ? AND `status` = 'CANCELADO' $wp" . ($fornecedorId ? ' AND `fornecedorId` = ?' : ''), [$cd['id'], ...$pp, ...($fornecedorId ? [$fornecedorId] : [])]);
$transporte = consolidacaoTransporte($cd['id'], $intervalo);
[$wc, $pc] = sqlPeriodo($periodo);
$conferencias = Db::all("SELECT `diferenca` FROM `Conferencia` WHERE `cdId` = ? $wc", [$cd['id'], ...$pc]);
$posicaoCross = $idsCross ? posicaoUnidades($idsCross) : [];
$transito = enviosEmTransito('(v.`cdId` = ? OR v.`unidadeId` = ?)', [$cd['id'], $cd['id']]);
$valesTodos = $moduloFornecedor && $fornecedorId ? valesEmAberto($cd['id']) : null;

$saldoInicial = $fornecedorId ? null : ($saldoAntes ? $saldoAntes['VAZIOS'] + $saldoAntes['QUEBRADOS'] : 0);
$contagem = fn(string $f) => count(array_filter($vales, fn($v) => $v['farol'] === $f));
$sufixo = $fornecedor ? " · {$fornecedor['nome']}" : '';
$fisicos = $saldos['vazios'] + $saldos['quebrados'];
$faltasPeriodo = array_sum(array_map(fn($c) => max(0, -(int) $c['diferenca']), $conferencias));

/** Fatias da rosca: as maiores e o restante em "Outros"; a cor segue a ordem alfabética do rótulo. */
$paraFatias = function (array $itens, int $maximo = 7): array {
    $cores = ['var(--viz-cat-1)', 'var(--viz-cat-2)', 'var(--viz-cat-3)', 'var(--viz-cat-4)', 'var(--viz-cat-5)', 'var(--viz-cat-6)', 'var(--viz-cat-7)'];
    $ord = array_values(array_filter($itens, fn($i) => $i['valor'] > 0));
    usort($ord, fn($a, $b) => $b['valor'] - $a['valor']);
    $exib = count($ord) > $maximo ? array_slice($ord, 0, $maximo - 1) : $ord;
    $resto = array_slice($ord, count($exib));
    $alfa = $exib;
    $col = Collator::create('pt_BR');
    usort($alfa, fn($a, $b) => $col ? $col->compare($a['rotulo'], $b['rotulo']) : strcmp($a['rotulo'], $b['rotulo']));
    $cor = [];
    foreach ($alfa as $k => $i) $cor[$i['id']] = $cores[$k];
    $fatias = array_map(fn($i) => $i + ['cor' => $cor[$i['id']]], $exib);
    if ($resto) $fatias[] = ['id' => 'outros', 'rotulo' => 'Outros (' . count($resto) . ')', 'valor' => array_sum(array_column($resto, 'valor')), 'cor' => 'var(--viz-outros)'];
    return $fatias;
};
$crosses = array_values(array_filter($posicaoCross, fn($p) => $p['vazios'] + $p['quebrados'] > 0));
$totalCross = array_sum(array_map(fn($p) => $p['vazios'] + $p['quebrados'], $crosses));
$barrasCross = array_map(fn($p) => ['id' => $p['unidade']['id'], 'codigo' => $p['unidade']['codigo'], 'nome' => $p['unidade']['nome'], 'saldo' => $p['vazios'] + $p['quebrados'], 'bons' => $p['vazios'], 'quebrados' => $p['quebrados'], 'aReceber' => $p['aReceber']], $crosses);
usort($barrasCross, fn($a, $b) => 0);
$fatiasCross = $paraFatias(array_map(fn($p) => ['id' => $p['unidade']['id'], 'rotulo' => $p['unidade']['codigo'], 'valor' => $p['vazios'] + $p['quebrados'], 'detalhe' => "{$p['unidade']['nome']} · {$p['vazios']} PBR · {$p['quebrados']} quebrados"], $crosses));
$fatiasFornecedor = $paraFatias(array_map(fn($p) => ['id' => $p['fornecedor']['id'], 'rotulo' => $p['fornecedor']['nome'], 'valor' => $p['total'], 'detalhe' => "{$p['vales']} vale(s)"], $pendencias), 6);
$abertos = $valesTodos ?? $vales;
$faixa = fn(int $min, int $max) => array_values(array_filter($abertos, fn($v) => $v['idade'] >= $min && $v['idade'] <= $max));
$fatiasIdade = array_values(array_filter(array_map(fn($f) => ['id' => $f[0], 'rotulo' => $f[1], 'cor' => $f[2], 'valor' => array_sum(array_map(fn($v) => (int) $v['quantidade'], $f[3])), 'detalhe' => count($f[3]) . ' vale(s)'], [
    ['verde', 'Em dia · até 19 dias', 'var(--viz-bom)', $faixa(0, 19)],
    ['amarelo', 'Atenção · 20 a 29 dias', 'var(--viz-alerta)', $faixa(20, 29)],
    ['vermelho', 'Crítico · 30 dias ou mais', 'var(--viz-critico)', $faixa(30, PHP_INT_MAX)],
]), fn($f) => $f['valor'] > 0));
$tipoUnidade = $cd['tipo'] === 'CROSS' ? 'Ponto de Cross' : ($cd['hub'] ? 'CD Hub' : 'CD');
$grafico = fn(string $tipo, mixed $dados) => '<div data-grafico="' . $tipo . '" data-dados="' . e(json_encode($dados, JSON_UNESCAPED_UNICODE)) . '"></div>';

/** KPI compacto: ícone em poço, rótulo, valor em destaque e legenda curta. */
$kpi = function (string $titulo, int $valor, string $legenda, string $ic, string $cor, ?string $rodape = null, ?string $testid = null, string $classe = '', string $filhos = '') {
    $cores = ['lima' => 'text-lima', 'ouro' => 'text-ouro', 'erro' => 'text-erro', 'neutro' => 'text-t1'];
    return '<section class="card-sm relative flex min-w-0 flex-col overflow-hidden p-4 sm:p-5 ' . $classe . '">' . icone($ic, 'pointer-events-none absolute -bottom-5 -right-4 h-28 w-28 opacity-[0.06] ' . $cores[$cor])
        . '<div class="mb-3 flex items-center gap-3"><span class="poco hidden h-10 w-10 flex-none items-center justify-center !rounded-2xl sm:flex ' . $cores[$cor] . '">' . icone($ic, 'h-5 w-5') . '</span>'
        . '<div class="min-w-0"><p class="text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-t3">' . e($titulo) . '</p><p class="mt-0.5 text-[11px] leading-tight text-t4">' . e($legenda) . '</p></div></div>'
        . '<p class="num text-[28px] font-semibold leading-none sm:text-[34px] ' . ($cor === 'lima' ? 'text-lima' : 'text-t1') . '"' . ($testid ? ' data-testid="' . $testid . '"' : '') . '>' . n($valor) . '</p>'
        . '<p class="mt-1 text-[11px] text-t3">pallets</p>' . ($filhos ? '<div class="mt-3">' . $filhos . '</div>' : '') . ($rodape ? '<p class="mt-auto pt-3 text-[11px] text-t3">' . e($rodape) . '</p>' : '') . '</section>';
};

echo cabecalho("Painel · $tipoUnidade {$cd['codigo']}", "{$cd['nome']} · Pallets PBR e Pallets Quebrados em tempo real, envios em trânsito, recebimentos a conferir e ocorrências. Visão consolidada na Torre de Controle.",
    '<a href="/tv" class="btn-secondary" target="_blank" data-testid="link-tv">' . icone('monitor-play') . ' Torre de Controle (TV)</a>'
    . '<div class="flex items-center gap-3" data-atualizacao-automatica><span class="pill bg-lima/10 text-lima"><span class="ponto ponto-pulsante"></span> Ao vivo</span>'
    . '<button type="button" class="btn-secondary" title="Atualização automática a cada 30s" data-atualizar>' . icone('refresh-cw') . '<span class="num" data-hora-atualizacao>' . utc(agoraUtc())->setTimezone(tzLocal())->format('H:i:s') . '</span></button></div>');

echo filtroPeriodo($periodo, $periodo['rotulo'] . $sufixo, (int) substr($hoje, 0, 4), $moduloFornecedor ? $fornecedores : null, $fornecedorId);

echo '<div class="entrada grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5" data-testid="cards-saldos">'
    . $kpi('Pallets PBR', $saldos['vazios'], 'Estoque disponível', 'warehouse', 'lima', null, 'saldo-vazios', 'col-span-2 sm:col-span-1',
        $grafico('composicao', [['rotulo' => 'Pallets PBR', 'valor' => $saldos['vazios'], 'cor' => 'var(--viz-vazios)'], ['rotulo' => 'Pallets Quebrados', 'valor' => $saldos['quebrados'], 'cor' => 'var(--viz-quebrados)']]))
    . $kpi('Pallets Quebrados', $saldos['quebrados'], $cd['hub'] ? 'Aguardando conserto' : 'Enviar ao CDJC para conserto', 'hammer', 'ouro', ($fisicos ? (int) round($saldos['quebrados'] / $fisicos * 100) : 0) . '% do estoque físico', 'saldo-quebrados')
    . $kpi('Em trânsito', $saldos['transito'], 'Enviados, aguardando conferência', 'truck', 'neutro', count(array_filter($transito, fn($v) => $v['cdId'] === $cd['id'])) . ' vale(s) de envio', 'saldo-transito')
    . $kpi('A receber', $saldos['aReceber'], 'Vales destinados a esta unidade', 'package-open', 'neutro', "{$saldos['valesAReceber']} vale(s) para conferir", 'saldo-a-receber')
    . $kpi('Faltas em aberto', $saldos['ocorrencias'], 'Ocorrências a apurar', 'triangle-alert', 'erro', "{$saldos['ocorrenciasAbertas']} ocorrência(s) envolvendo a unidade", 'saldo-ocorrencias')
    . '</div>';

if ($cd['tipo'] === 'CD') {
    echo '<div class="mt-3 grid grid-cols-2 gap-3 sm:gap-4" data-testid="acumuladores-envio">'
        . indicador('Total de Pallets Enviados para Cross', n($acumulado['paraCross']), 'remessas sem consumo do estoque', icone('truck', 'h-5 w-5'), 'neutro')
        . indicador('Total de Pallets Enviados para CDs', n($acumulado['paraCds']), 'saem do estoque de ' . e($cd['codigo']), icone('arrow-up-from-line', 'h-5 w-5'), 'neutro') . '</div>';
}

// Ocorrências que exigem ação do usuário.
if (!$aguardandoAcao) {
    $widget = '<p class="poco px-4 py-3 text-[12px] text-t3" data-testid="widget-ocorrencias">Nenhuma divergência aguardando a sua resposta.</p>';
} else {
    $widget = '<ul class="grid gap-2 md:grid-cols-2 xl:grid-cols-3" data-testid="widget-ocorrencias">';
    foreach ($aguardandoAcao as $o) {
        $widget .= '<li><a href="/ocorrencias?f=acao" class="poco flex items-center gap-3 px-4 py-3 transition hover:ring-1 hover:ring-erro/50">'
            . ($o['ocorrencia'] === 'FALTA' ? '<span class="pill text-erro bg-erro/10">Falta</span>' : '<span class="pill text-t2 bg-t2/10">Sobra</span>')
            . '<span class="min-w-0 flex-1"><span class="num block text-[12px] font-semibold text-t1">' . numeroVale($o['numero'], 'OCORRENCIA') . '</span>'
            . '<span class="num flex items-center gap-1 text-[11px] text-t4">' . e($o['cdCodigo']) . ' ' . icone('arrow-right', 'h-3 w-3') . ' ' . e($o['unidadeCodigo']) . ' · aguardando ' . e($o['aguardandoCodigo']) . '</span></span>'
            . '<span class="num text-[18px] font-semibold text-t1">' . n($o['quantidade']) . '</span></a></li>';
    }
    $widget .= '</ul>';
}
echo '<div class="mt-6">' . painel($widget, tituloIcone('triangle-alert', 'Ocorrências aguardando sua ação', $aguardandoAcao ? 'h-4 w-4 text-erro' : 'h-4 w-4 text-lima'), '<a href="/ocorrencias?f=acao" class="text-[11px] font-semibold text-lima hover:underline">Abrir ocorrências</a>') . '</div>';

if ($idsCross && $cd['tipo'] !== 'CROSS') {
    echo '<div class="mt-6 grid gap-6 xl:grid-cols-5">'
        . painel($grafico('barras-cross', $barrasCross), tituloIcone('network', 'Estoque por Ponto de Cross' . ($usuario['global'] ? '' : ' (região ' . e($cd['codigo']) . ')')), '<span class="num text-[12px] font-semibold text-t1">Total ' . n($totalCross) . ' pallets</span>', 'xl:col-span-3')
        . painel($grafico('rosca', ['dados' => $fatiasCross, 'rotuloTotal' => 'pallets em Cross', 'vazio' => 'Nenhum pallet em estoque nos Pontos de Cross.']), tituloIcone('network', 'Participação de cada Cross'), '<span class="text-[11px] text-t3">% do estoque em Cross</span>', 'xl:col-span-2')
        . '</div>';
}

echo painel(kanbanViagens($transito, $divergentes, $cd['id']), tituloIcone('truck', 'Acompanhamento de viagens · ' . e($cd['codigo'])),
    '<span class="flex flex-wrap items-center gap-3 text-[11px]"><span class="num text-t3">' . count($transito) . ' em viagem · ' . count($divergentes) . ' com divergência</span><a href="/recebimento" class="font-semibold text-lima hover:underline">Conferir recebimento</a></span>', 'mt-6');

if ($moduloFornecedor) {
    echo painel($grafico('vales-fornecedor', ['porFornecedor' => $fatiasFornecedor, 'porIdade' => $fatiasIdade]), tituloIcone('file-clock', 'Vales pendentes de fornecedores'), '<span class="num text-[12px] font-semibold text-t1">' . n($saldos['fornecedores']) . ' pallets</span>', 'mt-6');
}

// Indicadores do período.
$rp = e($periodo['rotulo']);
echo '<h2 class="secao mb-3 mt-8 flex items-center gap-2">Movimentação no período · ' . $rp . '</h2><div class="entrada grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">'
    . ($moduloFornecedor
        ? indicador('Entradas de fornecedor', n($porTipo('RECEBIMENTO_FORNECEDOR')), $rp, icone('package-plus', 'h-5 w-5'))
        : indicador('Inclusões / compras', n($porTipo('INCLUSAO_MANUAL') + $porTipo('COMPRA')), $rp, icone('package-plus', 'h-5 w-5')))
    . indicador('Enviados', n($porTipo('ENVIO')), $rp, icone('arrow-up-from-line', 'h-5 w-5'), 'neutro')
    . indicador('Recebidos (conferidos)', n($porTipo('RECEBIMENTO') + $porTipo('SOBRA')), count($conferencias) . ' conferência(s) · falta ' . n($faltasPeriodo), icone('clipboard-check', 'h-5 w-5'), $faltasPeriodo ? 'erro' : 'lima')
    . indicador('Recuperados (reparo)', n($porTipo('RECUPERADO')), $rp, icone('recycle', 'h-5 w-5'), 'lima')
    . indicador('Descartados / destruídos', n($porTipo('DESCARTE') + $porTipo('CANIBALIZACAO')), n($porTipo('CANIBALIZACAO')) . ' usado(s) em reparo', icone('trash-2', 'h-5 w-5'), 'erro')
    . '</div>';

// Consolidação por transportadora.
if (!$transporte) {
    $tab = vazio('Nenhuma movimentação com transportadora no período.');
} else {
    $l = '';
    foreach ($transporte as $t) {
        $l .= '<tr><td class="font-medium text-t1">' . e($t['transportadora']) . '</td><td class="num text-right">' . $t['operacoes'] . '</td><td class="num text-right">' . n($t['recebidosFornecedor']) . '</td>'
            . '<td class="num text-right">' . n($t['enviados']) . '</td><td class="num text-right text-lima">' . n($t['conferidos']) . '</td><td class="num text-right font-semibold ' . ($t['faltas'] ? 'text-erro' : 'text-t3') . '">' . n($t['faltas']) . '</td></tr>';
    }
    $tab = tabela('<table class="tabela" data-testid="tabela-transporte"><thead class="sticky top-0"><tr><th>Transportadora</th><th class="text-right">Operações</th><th class="text-right">Recebidos (fornecedor)</th><th class="text-right">Enviados</th><th class="text-right">Conferidos</th><th class="text-right">Faltas</th></tr></thead><tbody>' . $l . '</tbody></table>', 'max-h-[24rem] overflow-auto');
}
echo '<div class="mt-6">' . painel($tab, tituloIcone('truck', 'Consolidação por transportadora'), '<span class="text-[11px] text-t3">' . $rp . '</span>') . '</div>';

// Extrato dos estoques físicos.
echo '<div class="mt-6">' . painel(
    $grafico('fluxo', ['serie' => $serie, 'granularidade' => $granularidade, 'saldoInicial' => $saldoInicial])
    . '<p class="mt-3 text-[11px] text-t3">Entradas: recebimentos conferidos, sobras, compras e inclusões. Saídas: envios, descartes e remoções.'
    . ($fluxoPeriodo['transferencias'] > 0 ? ' Quebras e consertos no período: <strong class="num text-t1">' . n($fluxoPeriodo['transferencias']) . '</strong> (não alteram o total).' : '') . '</p>',
    'Extrato dos estoques físicos (Pallets PBR + Pallets Quebrados) · entradas x saídas' . e($sufixo), '<span class="text-[11px] text-t3">' . $rp . ' · por ' . $granularidade . '</span>') . '</div>';

if ($moduloFornecedor) {
    $acoes = '<span class="num flex items-center gap-3 text-[11px] text-t2">';
    foreach (['VERMELHO', 'AMARELO', 'VERDE'] as $f) $acoes .= '<span class="inline-flex items-center gap-1.5">' . ponto($f) . ' ' . $contagem($f) . '</span>';
    $acoes .= '<span class="inline-flex items-center gap-1.5 text-t3">' . icone('file-x', 'h-3.5 w-3.5') . ' ' . n($excluidos) . ' cancelado(s)</span></span>';
    if (!$vales) {
        $corpo = vazio('Nenhum vale-pallet de fornecedor pendente de devolução.');
    } else {
        $ord = $vales;
        usort($ord, fn($a, $b) => $b['idade'] - $a['idade']);
        $l = '';
        foreach ($ord as $v) {
            $l .= '<tr><td>' . farolBadge($v['farol']) . '</td><td><a href="/vales/' . e($v['id']) . '" class="num font-semibold text-lima hover:underline">' . numeroVale($v['numero'], $v['tipo']) . '</a></td>'
                . '<td class="max-w-[14rem] truncate" title="' . e($v['fornecedorNome']) . '">' . e($v['fornecedorNome'] ?? '—') . '</td><td class="tabular-nums"><p class="font-semibold">' . $v['idade'] . ' dia(s)</p><p class="text-[11px] text-t4">' . formatarData($v['criadoEm']) . '</p></td>'
                . '<td class="text-right font-semibold tabular-nums">' . n($v['quantidade']) . '</td><td>' . statusBadge($v['status'], ROTULO_STATUS_VALE[$v['status']]) . '</td></tr>';
        }
        $corpo = '<div class="poco max-h-[24rem] overflow-auto"><table class="tabela"><thead class="sticky top-0"><tr><th>Farol</th><th>Vale</th><th>Fornecedor</th><th>Idade</th><th class="text-right">Qtd.</th><th>Status</th></tr></thead><tbody>' . $l . '</tbody></table></div>';
    }
    echo '<div class="mt-6">' . painel($corpo . legendaFarol([['VERMELHO', '30 dias ou mais'], ['AMARELO', '20 a 29 dias'], ['VERDE', 'menos de 20 dias']]), tituloIcone('triangle-alert', 'Farol Vale-pallet (fornecedores)' . e($sufixo), 'h-4 w-4 text-ouro'), $acoes) . '</div>';
}

echo '<div class="mt-6">' . historicoExclusoes($cd['id'], 10, 'Vales cancelados (excluídos) · ' . $periodo['rotulo'], $periodo['inicio'], $periodo['fim']) . '</div>';
echo '<div class="mt-6">' . ultimasMovimentacoes($cd['id'], null, "Últimas movimentações · {$periodo['rotulo']}$sufixo", 10, $periodo['inicio'], $periodo['fim'], $fornecedorId) . '</div>';
View::$scripts[] = 'graficos.js';
View::$scripts[] = 'telas.js';
