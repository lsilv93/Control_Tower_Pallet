<?php
declare(strict_types=1);
// Relatórios da unidade (src/app/(sistema)/relatorios/page.tsx).
$u = requirePermissao('relatorios');
View::$titulo = 'Relatórios';
const LIMITE_RELATORIO = 500;
$fl = lerFiltrosRelatorio($_GET, $u['cd']['id']);
['de' => $de, 'ate' => $ate, 'tipo' => $tipo, 'where' => $where, 'params' => $params] = $fl;
$movs = Db::all(
    "SELECT m.*, x.`login`, un.`codigo` AS unidadeCodigo, un.`nome` AS unidadeNome, f.`nome` AS fornecedorNome,
            v.`numero` AS valeNumero, v.`tipo` AS valeTipo, a.`numero` AS agendaNumero, c.`numero` AS conferenciaNumero
       FROM `Movimentacao` m JOIN `Usuario` x ON x.`id` = m.`usuarioId`
       LEFT JOIN `CentroDistribuicao` un ON un.`id` = m.`unidadeId` LEFT JOIN `Fornecedor` f ON f.`id` = m.`fornecedorId`
       LEFT JOIN `ValePallet` v ON v.`id` = m.`valeId` LEFT JOIN `AgendaDevolucao` a ON a.`id` = m.`agendaId` LEFT JOIN `Conferencia` c ON c.`id` = m.`conferenciaId`
      WHERE $where ORDER BY m.`criadoEm` DESC LIMIT " . LIMITE_RELATORIO,
    $params,
);
$total = (int) Db::val("SELECT COUNT(*) FROM `Movimentacao` m WHERE $where", $params);
$porTipo = Db::all("SELECT m.`tipo`, SUM(m.`quantidade`) AS soma, COUNT(*) AS n FROM `Movimentacao` m WHERE $where GROUP BY m.`tipo`", $params);
$saldos = obterSaldos($u['cd']['id']);
$fluxoPeriodo = fluxo($u['cd']['id'], ['inicio' => inicioDoDia($de), 'fim' => fimDoDia($ate)]);
$qs = http_build_query(array_filter(['de' => $de, 'ate' => $ate, 'tipo' => $tipo]));
$liquido = $fluxoPeriodo['entradas'] - $fluxoPeriodo['saidas'];

echo cabecalho('Relatórios', "Consulta e exportação das movimentações, vales, conferências e agendas de {$u['cd']['codigo']}.",
    '<a href="/api/exportar?' . e($qs) . '" class="btn-success">' . icone('download') . ' Exportar Excel (.xlsx)</a>'
    . '<a href="/api/exportar?' . e($qs) . '&amp;formato=csv" class="btn-secondary">' . icone('file-text') . ' Movimentações (.csv)</a>');

echo '<form class="card mb-6 flex flex-wrap items-end gap-3 p-4">'
    . '<div><label class="label" for="de">De</label><input id="de" name="de" type="date" value="' . e($de) . '" class="input"></div>'
    . '<div><label class="label" for="ate">Até</label><input id="ate" name="ate" type="date" value="' . e($ate) . '" class="input"></div>'
    . '<div><label class="label" for="tipo">Tipo</label><select id="tipo" name="tipo" class="input">' . opcoes(ROTULO_TIPO, $tipo ?? '', 'Todos') . '</select></div>'
    . '<button class="btn-primary">Aplicar filtros</button></form>';

echo '<div class="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">'
    . indicador('Pallets PBR (atual)', n($saldos['vazios']))
    . indicador('Pallets Quebrados (atual)', n($saldos['quebrados']), '', '', 'ouro')
    . indicador('Em trânsito (atual)', n($saldos['transito']), 'a receber: ' . n($saldos['aReceber']) . ' · faltas em aberto: ' . n($saldos['ocorrencias']), '', 'neutro')
    . indicador('Variação líquida no período', $liquido > 0 ? "+$liquido" : (string) $liquido, "entradas {$fluxoPeriodo['entradas']} · saídas {$fluxoPeriodo['saidas']} · $total lançamento(s)", '', 'neutro')
    . '</div>';

if (!$porTipo) {
    $resumo = vazio('Sem movimentações no período.');
} else {
    $resumo = '<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">';
    foreach ($porTipo as $g) {
        $resumo .= '<div class="poco flex items-center justify-between px-4 py-3"><div><p class="text-[12px] font-medium">' . e(ROTULO_TIPO[$g['tipo']]) . '</p><p class="text-[11px] text-t3">' . $g['n'] . ' lançamento(s)</p></div>'
            . '<p class="text-xl font-semibold tabular-nums">' . n((int) $g['soma']) . '</p></div>';
    }
    $resumo .= '</div>';
}
echo painel($resumo, 'Resumo por tipo no período', '', 'mb-6');

if (!$movs) {
    $lista = vazio('Sem movimentações no período.');
} else {
    $linhas = '';
    foreach ($movs as $m) {
        $docs = array_filter([
            $m['valeNumero'] ? numeroVale($m['valeNumero'], $m['valeTipo']) : null,
            $m['agendaNumero'] ? numeroAgenda($m['agendaNumero']) : null,
            $m['conferenciaNumero'] ? numeroConferencia($m['conferenciaNumero']) : null,
        ]);
        $linhas .= '<tr><td class="tabular-nums">' . formatarDataHora($m['criadoEm']) . '</td><td>' . e(ROTULO_TIPO[$m['tipo']]) . '</td><td>' . fluxoContas($m['origem'], $m['destino']) . '</td>'
            . '<td class="text-right font-semibold tabular-nums text-t1">' . $m['quantidade'] . '</td>'
            . '<td>' . e($m['unidadeCodigo'] ? "{$m['unidadeCodigo']} - {$m['unidadeNome']}" : ($m['fornecedorNome'] ?? '—')) . '</td>'
            . '<td class="font-mono text-[11px]">' . e(implode(' / ', $docs) ?: '—') . '</td><td>' . e($m['login']) . '</td>'
            . '<td class="max-w-xs truncate text-t3" title="' . e($m['observacao'] ?? '') . '">' . e($m['observacao'] ?? '—') . '</td></tr>';
    }
    $lista = '<div class="poco max-h-[36rem] overflow-auto"><table class="tabela"><thead class="sticky top-0"><tr><th>Data/Hora</th><th>Tipo</th><th>Origem → Destino</th><th class="text-right">Qtd.</th>'
        . '<th>CD/Cross · Fornecedor</th><th>Documento</th><th>Usuário</th><th>Observação</th></tr></thead><tbody>' . $linhas . '</tbody></table></div>';
}
echo painel($lista, 'Movimentações', $total > LIMITE_RELATORIO ? '<span class="text-[11px] text-t3">Exibindo ' . LIMITE_RELATORIO . " de $total. Exporte para ver todas.</span>" : '');
echo '<p class="mt-6 text-[12px] text-t3">A trilha completa de auditoria (com origem, destino, quantidade e justificativa) está na tela <a href="/auditoria" class="font-semibold text-lima hover:underline">Auditoria</a>.</p>';
