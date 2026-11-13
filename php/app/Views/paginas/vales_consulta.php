<?php
declare(strict_types=1);
// Consulta de vales (src/app/(sistema)/vales/consulta/page.tsx).
$u = requirePermissao('vales');
View::$titulo = 'Consulta de Vales';
const LIMITE_CONSULTA = 200;
$STATUS = ['PENDENTE', 'AGENDADO', 'FINALIZADO', 'CANCELADO'];
$TIPOS = ['ENVIO', 'OCORRENCIA', 'FORNECEDOR'];
$re = '/^\d{4}-\d{2}-\d{2}$/';
$tipo = in_array(q('tipo'), $TIPOS, true) ? q('tipo') : null;
$numero = q('numero') ? lerCodigoVale(q('numero')) : null;
$status = in_array(q('status'), $STATUS, true) ? q('status') : null;
$de = q('de') && preg_match($re, q('de')) ? q('de') : null;
$ate = q('ate') && preg_match($re, q('ate')) ? q('ate') : null;

// Escopo: visão global vê todos; o operador vê os vales emitidos ou destinados às suas unidades.
$w = ['1 = 1'];
$p = [];
if (!$u['global']) {
    $minhas = array_column($u['cds'], 'id');
    $w[] = '(v.`cdId` IN (' . Db::in($minhas) . ') OR v.`unidadeId` IN (' . Db::in($minhas) . '))';
    array_push($p, ...$minhas, ...$minhas);
}
if (q('unidade')) { $w[] = '(v.`cdId` = ? OR v.`unidadeId` = ?)'; array_push($p, q('unidade'), q('unidade')); }
if ($numero !== null) { $w[] = 'v.`numero` = ?'; $p[] = $numero; }
if ($tipo) { $w[] = 'v.`tipo` = ?'; $p[] = $tipo; }
if (q('fornecedor')) { $w[] = 'v.`fornecedorId` = ?'; $p[] = q('fornecedor'); }
if ($status) { $w[] = 'v.`status` = ?'; $p[] = $status; }
if ($de) { $w[] = 'v.`criadoEm` >= ?'; $p[] = dbData(inicioDoDia($de)); }
if ($ate) { $w[] = 'v.`criadoEm` < ?'; $p[] = dbData(fimDoDia($ate)); }
$where = implode(' AND ', $w);
$fornecedores = Db::all('SELECT `id`, `nome` FROM `Fornecedor` ORDER BY `nome` ASC');
$unidades = Db::all('SELECT `id`, `codigo`, `nome`, `tipo` FROM `CentroDistribuicao` ORDER BY `tipo` ASC, `codigo` ASC');
$vales = Db::all("SELECT v.*, f.`nome` AS fornecedorNome, f.`cnpj` AS fornecedorCnpj, d.`codigo` AS unidadeCodigo, o.`codigo` AS cdCodigo
                    FROM `ValePallet` v LEFT JOIN `Fornecedor` f ON f.`id` = v.`fornecedorId` LEFT JOIN `CentroDistribuicao` d ON d.`id` = v.`unidadeId` JOIN `CentroDistribuicao` o ON o.`id` = v.`cdId`
                   WHERE $where ORDER BY v.`numero` DESC LIMIT " . LIMITE_CONSULTA, $p);
$tot = Db::one("SELECT COUNT(*) AS n, COALESCE(SUM(v.`quantidade`),0) AS q FROM `ValePallet` v WHERE $where", $p);
$numeroInvalido = q('numero') && $numero === null;

echo cabecalho('Consulta de Vales-Pallet', ($u['global'] ? 'Visão Nível Brasil: todos os vales.' : 'Vales emitidos ou destinados a ' . implode(', ', array_column($u['cds'], 'codigo')) . '.') . ' Envio (VE), ocorrência (VO) e fornecedor (VP). Busque por número, tipo, unidade, status ou período. Cada vale pode ser baixado em PDF ou impresso.');
$opT = '<option value="">Todos</option>';
foreach ($TIPOS as $t) $opT .= '<option value="' . $t . '"' . ($t === $tipo ? ' selected' : '') . '>' . ROTULO_TIPO_VALE[$t] . '</option>';
$opU = '<option value="">Todos</option>';
foreach ($unidades as $x) $opU .= '<option value="' . e($x['id']) . '"' . ($x['id'] === q('unidade') ? ' selected' : '') . '>' . ($x['tipo'] === 'CROSS' ? 'Cross' : 'CD') . ' · ' . e("{$x['codigo']} - {$x['nome']}") . '</option>';
$opF = '<option value="">Todos</option>';
foreach ($fornecedores as $x) $opF .= '<option value="' . e($x['id']) . '"' . ($x['id'] === q('fornecedor') ? ' selected' : '') . '>' . e($x['nome']) . '</option>';
$opS = '<option value="">Todos</option>';
foreach ($STATUS as $s) $opS .= '<option value="' . $s . '"' . ($s === $status ? ' selected' : '') . '>' . ROTULO_STATUS_VALE[$s] . '</option>';
echo painel('<form class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end" action="/vales/consulta">'
    . '<div><label class="label" for="numero">Número do vale</label><input id="numero" name="numero" value="' . e(q('numero') ?? '') . '" class="input num uppercase placeholder:normal-case" placeholder="VE-000123" autocomplete="off"></div>'
    . '<div><label class="label" for="tipo">Tipo</label><select id="tipo" name="tipo" class="input">' . $opT . '</select></div>'
    . '<div><label class="label" for="unidade">CD / Ponto de Cross</label><select id="unidade" name="unidade" class="input">' . $opU . '</select></div>'
    . '<div><label class="label" for="fornecedor">Fornecedor</label><select id="fornecedor" name="fornecedor" class="input">' . $opF . '</select></div>'
    . '<div><label class="label" for="status">Status</label><select id="status" name="status" class="input">' . $opS . '</select></div>'
    . '<div><label class="label" for="de">Emitido de</label><input id="de" name="de" type="date" value="' . e($de ?? '') . '" class="input"></div>'
    . '<div><label class="label" for="ate">até</label><input id="ate" name="ate" type="date" value="' . e($ate ?? '') . '" class="input"></div>'
    . '<div class="flex gap-2"><button class="btn-primary">' . icone('search') . ' Buscar</button><a href="/vales/consulta" class="btn-secondary">Limpar</a></div></form>'
    . ($numeroInvalido ? '<p class="mt-3 text-[12px] text-erro">&quot;' . e(q('numero')) . '&quot; não é um número de vale válido.</p>' : ''), classe: 'mb-6');

if (!$vales) {
    $corpo = vazio('Nenhum vale encontrado para os filtros.');
} else {
    $l = '';
    foreach ($vales as $v) {
        $l .= '<tr><td><a href="/vales/' . e($v['id']) . '" class="num font-semibold hover:underline ' . ($v['tipo'] === 'OCORRENCIA' ? 'text-erro' : 'text-lima') . '">' . numeroVale($v['numero'], $v['tipo']) . '</a>'
            . ($v['tipo'] === 'FORNECEDOR'
                ? '<p class="' . ($v['semNotaFiscal'] ? 'text-[11px] font-semibold text-ouro' : 'text-[11px] text-t4') . '">' . e($v['semNotaFiscal'] ? rotuloNf($v) : 'NF ' . rotuloNf($v)) . '</p>'
                : '<p class="text-[11px] text-t4">' . ROTULO_TIPO_VALE[$v['tipo']] . ($v['ocorrencia'] ? ' · ' . ($v['ocorrencia'] === 'FALTA' ? 'falta' : 'sobra') : '') . '</p>')
            . '</td><td class="num">' . formatarDataHora($v['criadoEm']) . '</td><td>'
            . ($v['fornecedorNome'] ? '<p class="max-w-[14rem] truncate font-medium text-t1" title="' . e($v['fornecedorNome']) . '">' . e($v['fornecedorNome']) . '</p><p class="num text-[11px] text-t4">' . e(formatarCnpj($v['fornecedorCnpj'])) . '</p>'
                : '<p class="num max-w-[14rem] truncate font-medium text-t1">' . e($v['cdCodigo']) . ' → ' . e($v['unidadeCodigo'] ?? '—') . '</p>')
            . '</td><td class="max-w-[10rem] truncate">' . e($v['transportadora'] ?? '—') . '</td><td class="num text-right font-semibold text-t1">' . $v['quantidade'] . '</td>'
            . '<td>' . statusBadge($v['status'], ROTULO_STATUS_VALE[$v['status']]) . '</td><td class="text-right">' . botoesVale($v['id'], true) . '</td></tr>';
    }
    $corpo = tabela('<table class="tabela"><thead><tr><th>Vale</th><th>Emissão</th><th>Origem → destino / fornecedor</th><th>Transportadora</th><th class="text-right">Qtd.</th><th>Status</th><th class="text-right">Documento</th></tr></thead><tbody>' . $l . '</tbody></table>');
}
echo painel($corpo, "Resultado: {$tot['n']} vale(s) · " . n($tot['q']) . ' pallet(s)', $tot['n'] > LIMITE_CONSULTA ? '<span class="text-[11px] text-t3">Exibindo os ' . LIMITE_CONSULTA . ' mais recentes.</span>' : '');
