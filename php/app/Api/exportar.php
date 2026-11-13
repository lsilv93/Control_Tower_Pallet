<?php
declare(strict_types=1);
// Exportação dos relatórios da unidade: Excel com várias abas ou CSV das movimentações
// (src/app/api/exportar/route.ts).
require_once dirname(__DIR__) . '/Lib/xlsx.php';
$usuario = usuarioAtual();
if (!$usuario) json(['erro' => 'Não autenticado'], 401);
if (!tem($usuario, 'relatorios')) json(['erro' => 'Sem permissão'], 403);
$cd = $usuario['cd'] ?? null;
if (!$cd) json(['erro' => 'Selecione o CD de operação'], 409);

['de' => $de, 'ate' => $ate, 'tipo' => $tipo, 'where' => $where, 'params' => $params] = lerFiltrosRelatorio($_GET, $cd['id']);
$formato = ($_GET['formato'] ?? '') === 'csv' ? 'csv' : 'xlsx';
$inicio = dbData(inicioDoDia($de));
$fim = dbData(fimDoDia($ate));

$movs = Db::all(
    "SELECT m.*, x.`login`, x.`nome` AS usuarioNome, un.`codigo` AS unidadeCodigo, un.`nome` AS unidadeNome, f.`nome` AS fornecedorNome, f.`cnpj` AS fornecedorCnpj,
            v.`numero` AS valeNumero, v.`tipo` AS valeTipo, a.`numero` AS agendaNumero, c.`numero` AS conferenciaNumero
       FROM `Movimentacao` m JOIN `Usuario` x ON x.`id` = m.`usuarioId`
       LEFT JOIN `CentroDistribuicao` un ON un.`id` = m.`unidadeId` LEFT JOIN `Fornecedor` f ON f.`id` = m.`fornecedorId`
       LEFT JOIN `ValePallet` v ON v.`id` = m.`valeId` LEFT JOIN `AgendaDevolucao` a ON a.`id` = m.`agendaId` LEFT JOIN `Conferencia` c ON c.`id` = m.`conferenciaId`
      WHERE $where ORDER BY m.`criadoEm` ASC",
    $params,
);
$linhasMov = array_map(fn($m) => [
    'dataHora' => formatarDataHora($m['criadoEm']),
    'tipo' => ROTULO_TIPO[$m['tipo']],
    'quantidade' => (int) $m['quantidade'],
    'origem' => ROTULO_CONTA[$m['origem']],
    'destino' => ROTULO_CONTA[$m['destino']],
    'cd' => $cd['codigo'],
    'unidade' => $m['unidadeCodigo'] ? "{$m['unidadeCodigo']} - {$m['unidadeNome']}" : '',
    'fornecedor' => $m['fornecedorNome'] ?? '',
    'cnpj' => $m['fornecedorNome'] ? formatarCnpj($m['fornecedorCnpj']) : '',
    'vale' => $m['valeNumero'] ? numeroVale($m['valeNumero'], $m['valeTipo']) : '',
    'agenda' => $m['agendaNumero'] ? numeroAgenda($m['agendaNumero']) : '',
    'retorno' => $m['conferenciaNumero'] ? numeroConferencia($m['conferenciaNumero']) : '',
    'motivo' => $m['motivo'] ?? '',
    'usuario' => $m['login'],
    'nomeUsuario' => $m['usuarioNome'],
    'observacao' => $m['observacao'] ?? '',
], $movs);
$colunasMov = [
    ['header' => 'Data/Hora', 'key' => 'dataHora', 'width' => 20],
    ['header' => 'Tipo', 'key' => 'tipo', 'width' => 30],
    ['header' => 'Quantidade', 'key' => 'quantidade'],
    ['header' => 'Origem', 'key' => 'origem', 'width' => 22],
    ['header' => 'Destino', 'key' => 'destino', 'width' => 22],
    ['header' => 'Unidade (livro)', 'key' => 'cd', 'width' => 16],
    ['header' => 'Outra unidade', 'key' => 'unidade', 'width' => 25],
    ['header' => 'Fornecedor', 'key' => 'fornecedor', 'width' => 30],
    ['header' => 'CNPJ', 'key' => 'cnpj', 'width' => 20],
    ['header' => 'Vale', 'key' => 'vale'],
    ['header' => 'Agenda', 'key' => 'agenda'],
    ['header' => 'Conferência', 'key' => 'retorno'],
    ['header' => 'Motivo', 'key' => 'motivo'],
    ['header' => 'Login', 'key' => 'usuario'],
    ['header' => 'Usuário', 'key' => 'nomeUsuario', 'width' => 25],
    ['header' => 'Observação', 'key' => 'observacao', 'width' => 40],
];

auditar(['acao' => 'EXPORTAR_RELATORIO', 'entidade' => 'Relatorio', 'usuarioId' => $usuario['id'], 'cdId' => $cd['id'], 'detalhes' => ['de' => $de, 'ate' => $ate, 'tipo' => $tipo, 'formato' => $formato]]);
$nomeArquivo = "pallets_{$cd['codigo']}_{$de}_a_{$ate}";

if ($formato === 'csv') {
    $campo = function ($v): string {
        $s = $v === null ? '' : (string) $v;
        return preg_match('/[";\n\r]/', $s) ? '"' . str_replace('"', '""', $s) . '"' : $s;
    };
    $csv = [implode(';', array_map(fn($c) => $campo($c['header']), $colunasMov))];
    foreach ($linhasMov as $l) $csv[] = implode(';', array_map(fn($c) => $campo($l[$c['key']]), $colunasMov));
    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"$nomeArquivo.csv\"");
    echo "\u{FEFF}" . implode("\r\n", $csv);
    exit;
}

$modulo = (bool) $cd['recebimentoFornecedor'];
$saldos = obterSaldos($cd['id']);
$vales = Db::all(
    "SELECT v.*, f.`nome` AS fornecedorNome, f.`cnpj` AS fornecedorCnpj, un.`codigo` AS unidadeCodigo, un.`nome` AS unidadeNome, o.`codigo` AS cdCodigo,
            cp.`login` AS criadoPorLogin, cn.`login` AS canceladoPorLogin, a.`numero` AS agendaNumero, c.`numero` AS conferenciaNumero
       FROM `ValePallet` v JOIN `CentroDistribuicao` o ON o.`id` = v.`cdId` JOIN `Usuario` cp ON cp.`id` = v.`criadoPorId`
       LEFT JOIN `Fornecedor` f ON f.`id` = v.`fornecedorId` LEFT JOIN `CentroDistribuicao` un ON un.`id` = v.`unidadeId`
       LEFT JOIN `Usuario` cn ON cn.`id` = v.`canceladoPorId` LEFT JOIN `AgendaDevolucao` a ON a.`id` = v.`agendaId` LEFT JOIN `Conferencia` c ON c.`id` = v.`conferenciaId`
      WHERE v.`cdId` = ? OR v.`unidadeId` = ? ORDER BY v.`numero` ASC",
    [$cd['id'], $cd['id']],
);
$agendas = Db::all(
    "SELECT a.*, f.`nome` AS fornecedorNome, cp.`login` AS criadoPorLogin, vp.`login` AS validadoPorLogin
       FROM `AgendaDevolucao` a JOIN `Fornecedor` f ON f.`id` = a.`fornecedorId` JOIN `Usuario` cp ON cp.`id` = a.`criadoPorId` LEFT JOIN `Usuario` vp ON vp.`id` = a.`validadoPorId`
      WHERE a.`cdId` = ? ORDER BY a.`numero` ASC",
    [$cd['id']],
);
$valesAgenda = [];
if ($agendas) {
    foreach (Db::all('SELECT `agendaId`, `numero`, `quantidade` FROM `ValePallet` WHERE `agendaId` IN (' . Db::in(array_column($agendas, 'id')) . ') ORDER BY `numero`', array_column($agendas, 'id')) as $v) {
        $valesAgenda[$v['agendaId']][] = $v;
    }
}
$fornecedores = $modulo ? pendenciasPorFornecedor($cd['id']) : [];
$abertos = $modulo ? valesEmAberto($cd['id']) : [];
$auditoria = Db::all("SELECT a.*, x.`login` FROM `Auditoria` a LEFT JOIN `Usuario` x ON x.`id` = a.`usuarioId` WHERE a.`criadoEm` >= ? AND a.`criadoEm` < ? AND a.`cdId` = ? ORDER BY a.`criadoEm` ASC", [$inicio, $fim, $cd['id']]);
$compras = Db::all(
    "SELECT c.*, f.`nome` AS fornecedorNome, f.`cnpj` AS fornecedorCnpj, x.`login` FROM `Compra` c JOIN `Fornecedor` f ON f.`id` = c.`fornecedorId` JOIN `Usuario` x ON x.`id` = c.`usuarioId`
      WHERE c.`criadoEm` >= ? AND c.`criadoEm` < ? AND c.`cdId` = ? ORDER BY c.`criadoEm` ASC",
    [$inicio, $fim, $cd['id']],
);
$conferencias = Db::all(
    "SELECT r.*, d.`codigo` AS cdCodigo, d.`tipo` AS cdTipo, rm.`codigo` AS remCodigo, rm.`tipo` AS remTipo, x.`login`
       FROM `Conferencia` r JOIN `CentroDistribuicao` d ON d.`id` = r.`cdId` JOIN `CentroDistribuicao` rm ON rm.`id` = r.`remetenteId` JOIN `Usuario` x ON x.`id` = r.`usuarioId`
      WHERE r.`criadoEm` >= ? AND r.`criadoEm` < ? AND (r.`cdId` = ? OR r.`remetenteId` = ?) ORDER BY r.`criadoEm` ASC",
    [$inicio, $fim, $cd['id'], $cd['id']],
);
$valesConf = [];
$ocorrConf = [];
if ($conferencias) {
    $ids = array_column($conferencias, 'id');
    foreach (Db::all('SELECT `conferenciaId`, `numero`, `tipo` FROM `ValePallet` WHERE `conferenciaId` IN (' . Db::in($ids) . ') ORDER BY `numero`', $ids) as $v) $valesConf[$v['conferenciaId']][] = $v;
    foreach (Db::all('SELECT `conferenciaOrigemId`, `numero` FROM `ValePallet` WHERE `conferenciaOrigemId` IN (' . Db::in($ids) . ') ORDER BY `numero`', $ids) as $v) $ocorrConf[$v['conferenciaOrigemId']][] = $v;
}
$posicao = posicaoUnidades($usuario['global'] ? null : [$cd['id']]);
$farolVale = array_column($abertos, null, 'id');

$wb = new Xlsx("Control Tower Pallet ({$usuario['login']})");
$wb->aba('Resumo', [['header' => 'Indicador', 'key' => 'k', 'width' => 40], ['header' => 'Valor', 'key' => 'v', 'width' => 30]], array_merge([
    ['k' => 'Gerado em', 'v' => formatarDataHora(agoraUtc())],
    ['k' => 'Gerado por', 'v' => "{$usuario['nome']} ({$usuario['login']})"],
    ['k' => 'Unidade de operação', 'v' => "{$cd['codigo']} - {$cd['nome']}"],
    ['k' => 'Período das movimentações', 'v' => "$de a $ate"],
    ['k' => 'Filtro de tipo', 'v' => $tipo ? ROTULO_TIPO[$tipo] : 'Todos'],
    ['k' => 'Pallets PBR (atual)', 'v' => $saldos['vazios']],
    ['k' => 'Pallets Quebrados (atual)', 'v' => $saldos['quebrados']],
    ['k' => 'Enviados em trânsito', 'v' => $saldos['transito']],
    ['k' => 'A receber (vales destinados à unidade)', 'v' => $saldos['aReceber']],
    ['k' => 'Faltas em aberto (ocorrências)', 'v' => $saldos['ocorrencias']],
], $modulo ? [
    ['k' => 'Saldo com fornecedores (vales pendentes)', 'v' => $saldos['fornecedores']],
    ['k' => 'Vales de fornecedor em aberto', 'v' => $saldos['valesFornecedorEmAberto']],
] : [], [['k' => 'Descartados/destruídos (acumulado)', 'v' => $saldos['descartados']]]));

$wb->aba('Movimentações', $colunasMov, $linhasMov);

$wb->aba('Vales-Pallet', [
    ['header' => 'Vale', 'key' => 'numero'], ['header' => 'Tipo', 'key' => 'tipo', 'width' => 26], ['header' => 'Ocorrência', 'key' => 'ocorrencia'],
    ['header' => 'Status', 'key' => 'status'], ['header' => 'Farol', 'key' => 'farol'], ['header' => 'Idade (dias)', 'key' => 'idade'],
    ['header' => 'Remetente', 'key' => 'remetente', 'width' => 14], ['header' => 'Fornecedor / destino', 'key' => 'fornecedor', 'width' => 30], ['header' => 'CNPJ', 'key' => 'cnpj', 'width' => 20],
    ['header' => 'Transportadora', 'key' => 'transportadora', 'width' => 25], ['header' => 'Placa', 'key' => 'placa'], ['header' => 'Rota', 'key' => 'rota', 'width' => 14],
    ['header' => 'Data de faturamento', 'key' => 'faturamento', 'width' => 16], ['header' => 'Nota Fiscal', 'key' => 'nf', 'width' => 18], ['header' => 'Chave NF-e', 'key' => 'chaveNfe', 'width' => 48],
    ['header' => 'Conferente', 'key' => 'conferente', 'width' => 20], ['header' => 'Pallets PBR', 'key' => 'bons'], ['header' => 'Pallets Quebrados', 'key' => 'quebrados'],
    ['header' => 'Quantidade', 'key' => 'quantidade'], ['header' => 'Resolução', 'key' => 'resolucao', 'width' => 24], ['header' => 'Emissão', 'key' => 'emissao', 'width' => 20],
    ['header' => 'Emitido por', 'key' => 'usuario'], ['header' => 'Agenda / Conferência', 'key' => 'agenda'], ['header' => 'Baixado em', 'key' => 'finalizado', 'width' => 20],
    ['header' => 'Excluído em', 'key' => 'excluido', 'width' => 20], ['header' => 'Excluído por', 'key' => 'excluidoPor'], ['header' => 'Motivo da exclusão', 'key' => 'motivo', 'width' => 24],
    ['header' => 'Observação da exclusão', 'key' => 'obsExclusao', 'width' => 40],
], array_map(fn($v) => [
    'numero' => numeroVale($v['numero'], $v['tipo']),
    'tipo' => ROTULO_TIPO_VALE[$v['tipo']],
    'ocorrencia' => $v['ocorrencia'] ?? '',
    'status' => ROTULO_STATUS_VALE[$v['status']],
    'farol' => $farolVale[$v['id']]['farol'] ?? '',
    'idade' => $farolVale[$v['id']]['idade'] ?? '',
    'remetente' => $v['cdCodigo'],
    'fornecedor' => parteVale($v),
    'cnpj' => $v['fornecedorNome'] ? formatarCnpj($v['fornecedorCnpj']) : '',
    'transportadora' => $v['transportadora'] ?? '',
    'placa' => $v['placa'] ? formatarPlaca($v['placa']) : '',
    'rota' => $v['rota'] ?? '',
    'faturamento' => $v['dataFaturamento'] ? utc($v['dataFaturamento'])->format('d/m/Y') : '',
    'nf' => $v['tipo'] === 'FORNECEDOR' ? rotuloNf($v) : '',
    'chaveNfe' => $v['chaveNfe'] ?? '',
    'conferente' => $v['conferente'] ?? '',
    'bons' => (int) $v['quantidadeBons'],
    'quebrados' => (int) $v['quantidadeQuebrados'],
    'quantidade' => (int) $v['quantidade'],
    'resolucao' => $v['resolucao'] ? ROTULO_RESOLUCAO[$v['resolucao']] : '',
    'emissao' => formatarDataHora($v['criadoEm']),
    'usuario' => $v['criadoPorLogin'],
    'agenda' => $v['agendaNumero'] ? numeroAgenda($v['agendaNumero']) : ($v['conferenciaNumero'] ? numeroConferencia($v['conferenciaNumero']) : ''),
    'finalizado' => $v['finalizadoEm'] ? formatarDataHora($v['finalizadoEm']) : '',
    'excluido' => $v['canceladoEm'] ? formatarDataHora($v['canceladoEm']) : '',
    'excluidoPor' => $v['canceladoPorLogin'] ?? '',
    'motivo' => $v['motivoCancelamento'] ? ROTULO_MOTIVO_CANCELAMENTO[$v['motivoCancelamento']] : '',
    'obsExclusao' => $v['observacaoCancelamento'] ?? '',
], $vales));

if ($modulo) $wb->aba('Agendas', [
    ['header' => 'Agenda', 'key' => 'numero'], ['header' => 'Status', 'key' => 'status'], ['header' => 'Fornecedor', 'key' => 'fornecedor', 'width' => 30],
    ['header' => 'Data prevista', 'key' => 'prevista'], ['header' => 'Vales', 'key' => 'vales', 'width' => 30], ['header' => 'Pallets', 'key' => 'total'],
    ['header' => 'Criada em', 'key' => 'criada', 'width' => 20], ['header' => 'Criada por', 'key' => 'criadoPor'], ['header' => 'Validada em', 'key' => 'validada', 'width' => 20],
    ['header' => 'Validada por', 'key' => 'validadoPor'], ['header' => 'Observação', 'key' => 'obs', 'width' => 40],
], array_map(function ($a) use ($valesAgenda) {
    $vs = $valesAgenda[$a['id']] ?? [];
    return [
        'numero' => numeroAgenda($a['numero']),
        'status' => ROTULO_STATUS_AGENDA[$a['status']],
        'fornecedor' => $a['fornecedorNome'],
        'prevista' => formatarData($a['dataPrevista']),
        'vales' => implode(', ', array_map(fn($v) => numeroVale($v['numero'], 'FORNECEDOR'), $vs)),
        'total' => array_sum(array_map(fn($v) => (int) $v['quantidade'], $vs)),
        'criada' => formatarDataHora($a['criadoEm']),
        'criadoPor' => $a['criadoPorLogin'],
        'validada' => $a['validadoEm'] ? formatarDataHora($a['validadoEm']) : '',
        'validadoPor' => $a['validadoPorLogin'] ?? '',
        'obs' => $a['observacao'] ?? '',
    ];
}, $agendas));

$wb->aba('Compras', [
    ['header' => 'Data/Hora', 'key' => 'dataHora', 'width' => 20], ['header' => 'NF', 'key' => 'nf'], ['header' => 'Série', 'key' => 'serie'],
    ['header' => 'Fornecedor', 'key' => 'fornecedor', 'width' => 30], ['header' => 'CNPJ', 'key' => 'cnpj', 'width' => 20], ['header' => 'Quantidade', 'key' => 'quantidade'],
    ['header' => 'Chave de acesso', 'key' => 'chave', 'width' => 48], ['header' => 'Login', 'key' => 'usuario'], ['header' => 'Observação', 'key' => 'obs', 'width' => 40],
], array_map(fn($c) => [
    'dataHora' => formatarDataHora($c['criadoEm']), 'nf' => $c['notaFiscal'], 'serie' => $c['serie'], 'fornecedor' => $c['fornecedorNome'],
    'cnpj' => formatarCnpj($c['fornecedorCnpj']), 'quantidade' => (int) $c['quantidade'], 'chave' => $c['chaveAcesso'], 'usuario' => $c['login'], 'obs' => $c['observacao'] ?? '',
], $compras));

if ($modulo) $wb->aba('Pendências Fornecedor', [
    ['header' => 'Farol', 'key' => 'farol'], ['header' => 'Fornecedor', 'key' => 'fornecedor', 'width' => 30], ['header' => 'CNPJ', 'key' => 'cnpj', 'width' => 20],
    ['header' => 'Vales em aberto', 'key' => 'vales'], ['header' => 'Pallets pendentes', 'key' => 'total'], ['header' => 'Vale mais antigo', 'key' => 'antigo'],
], array_map(fn($f) => [
    'farol' => $f['farol'], 'fornecedor' => $f['fornecedor']['nome'], 'cnpj' => formatarCnpj($f['fornecedor']['cnpj']),
    'vales' => $f['vales'], 'total' => $f['total'], 'antigo' => formatarData($f['maisAntigo']),
], $fornecedores));

$wb->aba('Conferências', [
    ['header' => 'Conferência', 'key' => 'numero'], ['header' => 'Data/Hora', 'key' => 'dataHora', 'width' => 20], ['header' => 'Remetente', 'key' => 'remetente', 'width' => 22],
    ['header' => 'Recebedor', 'key' => 'recebedor', 'width' => 22], ['header' => 'Vales conferidos', 'key' => 'vales', 'width' => 30], ['header' => 'Declarado', 'key' => 'total'],
    ['header' => 'Pallets PBR recebidos', 'key' => 'bons'], ['header' => 'Pallets Quebrados recebidos', 'key' => 'quebrados'], ['header' => 'Diferença', 'key' => 'diferenca'],
    ['header' => 'Vale de Ocorrência', 'key' => 'ocorrencia'], ['header' => 'Placa', 'key' => 'placa'], ['header' => 'Transportadora', 'key' => 'transportadora', 'width' => 24],
    ['header' => 'Login', 'key' => 'usuario'], ['header' => 'Observação', 'key' => 'obs', 'width' => 40],
], array_map(fn($r) => [
    'numero' => numeroConferencia($r['numero']),
    'dataHora' => formatarDataHora($r['criadoEm']),
    'remetente' => ROTULO_TIPO_UNIDADE[$r['remTipo']] . " {$r['remCodigo']}",
    'recebedor' => ROTULO_TIPO_UNIDADE[$r['cdTipo']] . " {$r['cdCodigo']}",
    'vales' => implode(', ', array_map(fn($v) => numeroVale($v['numero'], $v['tipo']), $valesConf[$r['id']] ?? [])),
    'total' => (int) $r['totalDeclarado'],
    'bons' => (int) $r['recebidoBons'],
    'quebrados' => (int) $r['recebidoQuebrados'],
    'diferenca' => (int) $r['diferenca'],
    'ocorrencia' => implode(', ', array_map(fn($o) => numeroVale($o['numero'], 'OCORRENCIA'), $ocorrConf[$r['id']] ?? [])),
    'placa' => $r['placa'] ? formatarPlaca($r['placa']) : '',
    'transportadora' => $r['transportadora'] ?? '',
    'usuario' => $r['login'],
    'obs' => $r['observacao'] ?? '',
], $conferencias));

$wb->aba('Posição por Unidade', [
    ['header' => 'Tipo', 'key' => 'tipo'], ['header' => 'Sigla', 'key' => 'codigo'], ['header' => 'Unidade', 'key' => 'nome', 'width' => 30],
    ['header' => 'Pallets PBR', 'key' => 'bons'], ['header' => 'Pallets Quebrados', 'key' => 'quebrados'], ['header' => 'Em trânsito (enviados)', 'key' => 'transito'],
    ['header' => 'A receber', 'key' => 'receber'], ['header' => 'Faltas em aberto', 'key' => 'ocorrencias'],
], array_map(fn($p) => [
    'tipo' => $p['unidade']['hub'] ? 'CD Hub' : ROTULO_TIPO_UNIDADE[$p['unidade']['tipo']],
    'codigo' => $p['unidade']['codigo'], 'nome' => $p['unidade']['nome'], 'bons' => $p['vazios'], 'quebrados' => $p['quebrados'],
    'transito' => $p['transito'], 'receber' => $p['aReceber'], 'ocorrencias' => $p['ocorrencias'],
], $posicao));

$wb->aba('Auditoria', [
    ['header' => 'Data/Hora', 'key' => 'dataHora', 'width' => 20], ['header' => 'Login', 'key' => 'usuario'], ['header' => 'Ação', 'key' => 'acao', 'width' => 30],
    ['header' => 'Estoque origem', 'key' => 'origem', 'width' => 22], ['header' => 'Estoque destino', 'key' => 'destino', 'width' => 22], ['header' => 'Quantidade', 'key' => 'quantidade'],
    ['header' => 'Observação / justificativa', 'key' => 'observacao', 'width' => 40], ['header' => 'Entidade', 'key' => 'entidade', 'width' => 20],
    ['header' => 'ID', 'key' => 'entidadeId', 'width' => 28], ['header' => 'Detalhes', 'key' => 'detalhes', 'width' => 60],
], array_map(fn($a) => [
    'dataHora' => formatarDataHora($a['criadoEm']), 'usuario' => $a['login'] ?? '', 'acao' => $a['acao'],
    'origem' => $a['origem'] ? ROTULO_CONTA[$a['origem']] : '', 'destino' => $a['destino'] ? ROTULO_CONTA[$a['destino']] : '',
    'quantidade' => $a['quantidade'] !== null ? (int) $a['quantidade'] : '', 'observacao' => $a['observacao'] ?? '', 'entidade' => $a['entidade'],
    'entidadeId' => $a['entidadeId'] ?? '', 'detalhes' => $a['detalhes'] ? json_encode(json_decode($a['detalhes']), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '',
], $auditoria));

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header("Content-Disposition: attachment; filename=\"$nomeArquivo.xlsx\"");
header('Cache-Control: no-store');
echo $wb->gerar();
