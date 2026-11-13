<?php
declare(strict_types=1);
// Auditoria: log imutável (src/app/(sistema)/auditoria/page.tsx).
$u = requirePermissao('auditoria');
View::$titulo = 'Auditoria';
const LIMITE_AUDITORIA = 300;
$admin = $u['global'];
['filtros' => $filtros, 'where' => $where, 'params' => $params, 'descricao' => $descricao] = lerFiltrosAuditoria($_GET, ['cd' => $u['cd'], 'cds' => $u['cds'], 'admin' => $admin]);
$registros = Db::all(
    "SELECT a.*, x.`login`, c.`codigo` AS cdCodigo FROM `Auditoria` a LEFT JOIN `Usuario` x ON x.`id` = a.`usuarioId` LEFT JOIN `CentroDistribuicao` c ON c.`id` = a.`cdId`
      WHERE $where ORDER BY a.`criadoEm` DESC LIMIT " . LIMITE_AUDITORIA,
    $params,
);
$total = (int) Db::val("SELECT COUNT(*) FROM `Auditoria` a WHERE $where", $params);
$usuarios = Db::all('SELECT `id`, `login`, `nome` FROM `Usuario` ORDER BY `login`');
$acoes = Db::col('SELECT DISTINCT `acao` FROM `Auditoria` ORDER BY `acao`');
$movimentado = (int) Db::val("SELECT COALESCE(SUM(a.`quantidade`), 0) FROM `Auditoria` a WHERE $where AND a.`quantidade` IS NOT NULL", $params);
$qs = http_build_query(array_filter($filtros));

echo cabecalho('Auditoria', 'Log imutável de todas as movimentações, inclusões, baixas, cancelamentos e ajustes manuais, com data/hora, usuário, tipo de operação, CD, origem/destino, quantidade e observações. Registros não podem ser alterados nem apagados (bloqueio no banco de dados).',
    '<a href="/api/auditoria/exportar?formato=xlsx&amp;' . e($qs) . '" class="btn-primary">' . icone('file-spreadsheet') . ' Exportar Excel</a>'
    . '<a href="/api/auditoria/exportar?formato=pdf&amp;' . e($qs) . '" class="btn-secondary">' . icone('file-text') . ' Exportar PDF</a>');

$opCd = '';
foreach ($u['cds'] as $c) $opCd .= '<option value="' . e($c['id']) . '"' . ($filtros['cd'] === $c['id'] ? ' selected' : '') . '>' . e($c['codigo']) . ($c['id'] === ($u['cd']['id'] ?? '') ? ' (atual)' : '') . '</option>';
if ($admin) $opCd .= '<option value="TODOS"' . ($filtros['cd'] === 'TODOS' ? ' selected' : '') . '>Todas as unidades (inclui login e cadastros)</option>';
$opU = '<option value="">Todos</option>';
foreach ($usuarios as $x) $opU .= '<option value="' . e($x['id']) . '"' . ($filtros['usuario'] === $x['id'] ? ' selected' : '') . '>' . e("{$x['login']} · {$x['nome']}") . '</option>';
$opA = '<option value="">Todas</option><option value="MOVIMENTACAO"' . ($filtros['acao'] === 'MOVIMENTACAO' ? ' selected' : '') . '>Todas as movimentações de estoque</option>';
foreach ($acoes as $a) $opA .= '<option value="' . e($a) . '"' . ($filtros['acao'] === $a ? ' selected' : '') . '>' . e(rotuloAcao($a)) . '</option>';

echo painel('<form class="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.2fr_1.6fr_auto] xl:items-end" action="/auditoria">'
    . '<div><label class="label" for="cd">CD da operação</label><select id="cd" name="cd" class="input">' . $opCd . '</select></div>'
    . '<div><label class="label" for="de">De</label><input id="de" name="de" type="date" value="' . e($filtros['de']) . '" class="input"></div>'
    . '<div><label class="label" for="ate">Até</label><input id="ate" name="ate" type="date" value="' . e($filtros['ate']) . '" class="input"></div>'
    . '<div><label class="label" for="usuario">Usuário</label><select id="usuario" name="usuario" class="input">' . $opU . '</select></div>'
    . '<div><label class="label" for="acao">Tipo de ação / movimentação</label><select id="acao" name="acao" class="input">' . $opA . '</select></div>'
    . '<div class="flex gap-2"><button class="btn-primary">Filtrar</button><a href="/auditoria" class="btn-secondary">Limpar</a></div></form>', '', '', 'mb-6');

if (!$registros) {
    $lista = vazio('Nenhum registro para os filtros.');
} else {
    $linhas = '';
    foreach ($registros as $r) {
        $destaque = str_starts_with($r['acao'], 'MOVIMENTACAO_AJUSTE') || str_starts_with($r['acao'], 'MOVIMENTACAO_INCLUSAO') || $r['acao'] === 'GERAR_VALE_OCORRENCIA';
        $fluxoR = $r['origem'] && $r['destino'] ? fluxoContas($r['origem'], $r['destino']) : ($r['origem'] ? contaTag($r['origem']) : '—');
        $obs = $r['observacao'] !== null ? e($r['observacao']) : ($r['detalhes'] ? '<span class="num text-[11px]">' . e(json_encode(json_decode($r['detalhes']), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) . '</span>' : '—');
        $linhas .= '<tr' . ($destaque ? ' class="bg-erro/[.06]"' : '') . '><td class="num">' . formatarDataHora($r['criadoEm']) . '</td><td>' . e($r['login'] ?? '—') . '</td><td class="num">' . e($r['cdCodigo'] ?? '—') . '</td>'
            . '<td class="font-medium text-t1">' . e(rotuloAcao($r['acao'])) . '</td><td>' . $fluxoR . '</td><td class="num text-right font-semibold text-t1">' . ($r['quantidade'] ?? '—') . '</td>'
            . '<td class="max-w-md whitespace-normal text-t3">' . $obs . '</td></tr>';
    }
    $lista = tabela('<table class="tabela"><thead class="sticky top-0"><tr><th>Data/Hora</th><th>Usuário</th><th>CD</th><th>Tipo de ação</th><th>Origem → destino</th><th class="text-right">Qtd.</th><th>Observação / justificativa</th></tr></thead><tbody>' . $linhas . '</tbody></table>', 'max-h-[40rem] overflow-auto');
}
echo painel($lista, tituloIcone('lock', "$total registro(s) · " . n($movimentado) . ' pallet(s) movimentados'),
    '<span class="text-[11px] text-t3">' . e($descricao) . ($total > LIMITE_AUDITORIA ? ' · exibindo ' . LIMITE_AUDITORIA . ' (exporte para ver todos)' : '') . '</span>');
