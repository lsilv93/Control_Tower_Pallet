<?php
declare(strict_types=1);
/**
 * Recebimento e conferência na unidade ativa (src/app/(sistema)/recebimento/page.tsx +
 * FormConferencia.tsx): vales de envio destinados a ela; divergências geram ocorrência.
 */
$u = requirePermissao('recebimento');
View::$titulo = 'Recebimento / Conferência';
$cd = $u['cd'];
$pendentes = Db::all("SELECT v.*, c.`codigo` AS cdCodigo, c.`nome` AS cdNome, c.`tipo` AS cdTipo, c.`hub` AS cdHub
                        FROM `ValePallet` v JOIN `CentroDistribuicao` c ON c.`id` = v.`cdId`
                       WHERE v.`unidadeId` = ? AND v.`tipo` = 'ENVIO' AND v.`status` = 'PENDENTE' ORDER BY v.`criadoEm` ASC", [$cd['id']]);
$conferencias = Db::all("SELECT c.*, r.`codigo` AS remetenteCodigo, x.`nome` AS usuarioNome FROM `Conferencia` c JOIN `CentroDistribuicao` r ON r.`id` = c.`remetenteId`
                          JOIN `Usuario` x ON x.`id` = c.`usuarioId` WHERE c.`cdId` = ? ORDER BY c.`criadoEm` DESC LIMIT 15", [$cd['id']]);
$transportadoras = Db::all('SELECT `id`, `nome` FROM `Transportadora` WHERE `ativo` = 1 ORDER BY `nome` ASC');

$remetentes = [];
foreach ($pendentes as $v) $remetentes[$v['cdId']] = ['id' => $v['cdId'], 'codigo' => $v['cdCodigo'], 'nome' => $v['cdNome'], 'tipo' => $v['cdTipo'], 'hub' => (bool) $v['cdHub']];
usort($remetentes, fn($a, $b) => strcmp($a['codigo'], $b['codigo']));
$vales = array_map(function ($v) use ($transportadoras) {
    $tid = null;
    foreach ($transportadoras as $t) if (mb_strtoupper(trim($t['nome'])) === mb_strtoupper(trim($v['transportadora'] ?? ''))) $tid = $t['id'];
    return [
        'id' => $v['id'], 'codigo' => numeroVale($v['numero'], $v['tipo']), 'remetenteId' => $v['cdId'], 'bons' => (int) $v['quantidadeBons'],
        'quebrados' => (int) $v['quantidadeQuebrados'], 'quantidade' => (int) $v['quantidade'], 'data' => formatarDataHora($v['criadoEm']),
        'transportadora' => $v['transportadora'], 'transportadoraId' => $tid, 'placa' => $v['placa'],
    ];
}, $pendentes);

echo cabecalho('Recebimento / Conferência', "Selecione os vales recebidos em {$cd['codigo']}, informe a contagem física de Pallets PBR e Pallets Quebrados e registre. Cada tipo entra no seu estoque. Falta gera Vale de Ocorrência devolvido ao remetente; sobra é registrada.");
if (q('ok')) echo '<div role="status" class="poco mb-6 flex items-start gap-2.5 px-4 py-3 text-[12px] font-medium text-lima" data-testid="conferencia-ok">' . icone('circle-check', 'mt-0.5 h-4 w-4 flex-none') . ' ' . e(q('ok')) . '</div>';
echo saldosEstoques($cd['id'], ['A_RECEBER']);

if (!$remetentes) {
    $form = vazio('Nenhum vale pendente de recebimento em ' . e($cd['codigo']) . '.');
} else {
    $inicial = in_array(q('de'), array_column($remetentes, 'id'), true) ? q('de') : (count($remetentes) === 1 ? $remetentes[0]['id'] : '');
    $opRem = '<option value="" disabled' . ($inicial ? '' : ' selected') . '>Selecione...</option>';
    foreach ($remetentes as $r) $opRem .= '<option value="' . e($r['id']) . '"' . ($r['id'] === $inicial ? ' selected' : '') . '>' . ($r['tipo'] === 'CROSS' ? 'Cross' : ($r['hub'] ? 'Hub' : 'CD')) . ' · ' . e("{$r['codigo']} - {$r['nome']}") . '</option>';
    $opTransp = '<option value="">Não informada</option>';
    foreach ($transportadoras as $t) $opTransp .= '<option value="' . e($t['id']) . '">' . e($t['nome']) . '</option>';
    $conteudo = '<div><label class="label" for="remetenteId">CD / Ponto de Cross remetente *</label><select id="remetenteId" name="remetenteId" class="input" required>' . $opRem . '</select></div>'
        . '<fieldset data-vales-conferir hidden></fieldset>'
        . '<div class="poco grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-4">'
        . '<div><p class="text-[10px] uppercase tracking-[0.12em] text-t4">Declarado</p><p class="num text-[22px] font-semibold text-t1" data-testid="total-vales">0</p></div>'
        . '<div><p class="text-[10px] uppercase tracking-[0.12em] text-t4">Pallets PBR</p><p class="num text-[16px] font-semibold text-lima" data-declarado-bons>0</p></div>'
        . '<div><p class="text-[10px] uppercase tracking-[0.12em] text-t4">Pallets Quebrados</p><p class="num text-[16px] font-semibold text-ouro" data-declarado-quebrados>0</p></div>'
        . '<div><p class="text-[10px] uppercase tracking-[0.12em] text-t4">Diferença</p><p class="num text-[16px] font-semibold text-t3" data-testid="diferenca">—</p></div></div>'
        . '<div data-alerta-divergencia hidden></div>'
        . '<div class="grid grid-cols-2 gap-4"><div><label class="label" for="recebidoBons">Pallets PBR recebidos *</label><input id="recebidoBons" name="recebidoBons" type="number" min="0" step="1" class="input" required></div>'
        . '<div><label class="label" for="recebidoQuebrados">Pallets Quebrados recebidos *</label><input id="recebidoQuebrados" name="recebidoQuebrados" type="number" min="0" step="1" class="input" required></div></div>'
        . '<div data-divergencia-confirmada hidden></div><input type="hidden" name="confirmarDivergencia" value="0">'
        . '<div class="space-y-4" data-bloco-justificativa><div class="grid grid-cols-2 gap-4">' . inputPlaca('Placa do veículo')
        . '<div><label class="label" for="transportadoraId">Transportadora</label><select id="transportadoraId" name="transportadoraId" class="input">' . $opTransp . '</select></div></div>'
        . '<div><label class="label" for="observacao">Observação</label><textarea id="observacao" name="observacao" rows="2" class="input" maxlength="500"></textarea></div></div>';
    $form = formAcao('transferencias/conferir', $conteudo, [
        'botao' => icone('clipboard-check') . ' Registrar conferência', 'classeBotao' => 'btn-success w-full', 'textoEnviando' => 'Registrando...', 'limpar' => false,
        'attrs' => ['data-conferencia' => json_encode($vales, JSON_UNESCAPED_UNICODE)],
    ]);
}

$tabPend = !$pendentes ? vazio('Nada em trânsito para esta unidade.') : (function () use ($pendentes) {
    $l = '';
    foreach ($pendentes as $v) {
        $l .= '<tr><td><a href="/vales/' . e($v['id']) . '" class="num font-semibold text-lima hover:underline">' . numeroVale($v['numero'], $v['tipo']) . '</a></td>'
            . '<td>' . e($v['cdCodigo']) . ($v['cdTipo'] === 'CROSS' ? ' (Cross)' : '') . '</td><td class="num text-right">' . n($v['quantidadeBons']) . '</td><td class="num text-right">' . n($v['quantidadeQuebrados']) . '</td>'
            . '<td class="num">' . ($v['dataFaturamento'] ? formatarDataPura($v['dataFaturamento']) : '—') . '</td><td class="num">' . formatarDataHora($v['criadoEm']) . '</td></tr>';
    }
    return tabela('<table class="tabela" data-testid="vales-pendentes-recebimento"><thead><tr><th>Vale</th><th>Remetente</th><th class="text-right">Pallets PBR</th><th class="text-right">Pallets Quebrados</th><th>Faturamento</th><th>Emissão</th></tr></thead><tbody>' . $l . '</tbody></table>');
})();

$tabConf = !$conferencias ? vazio('Nenhuma conferência registrada.') : (function () use ($conferencias) {
    $l = '';
    foreach ($conferencias as $c) {
        $vs = Db::col('SELECT `numero` FROM `ValePallet` WHERE `conferenciaId` = ? ORDER BY `numero`', [$c['id']]);
        $ocs = Db::all('SELECT `id`, `numero` FROM `ValePallet` WHERE `conferenciaOrigemId` = ?', [$c['id']]);
        $l .= '<tr><td class="num font-semibold">' . numeroConferencia($c['numero']) . '</td><td class="num">' . formatarDataHora($c['criadoEm']) . '</td><td>' . e($c['remetenteCodigo']) . '</td>'
            . '<td class="num text-[11px]">' . implode(', ', array_map(fn($x) => numeroVale($x, 'ENVIO'), $vs)) . '</td><td class="num text-right">' . n($c['totalDeclarado']) . '</td>'
            . '<td class="num text-right">' . n($c['recebidoBons']) . '</td><td class="num text-right">' . n($c['recebidoQuebrados']) . '</td><td class="text-right">' . delta((int) $c['diferenca']) . '</td><td>'
            . ($ocs ? implode('', array_map(fn($o) => '<a href="/vales/' . e($o['id']) . '" class="num font-semibold text-erro hover:underline">' . numeroVale($o['numero'], 'OCORRENCIA') . '</a>', $ocs)) : '—')
            . '</td><td>' . e($c['usuarioNome']) . '</td></tr>';
    }
    return tabela('<table class="tabela" data-testid="ultimas-conferencias"><thead><tr><th>Conferência</th><th>Data/hora</th><th>Remetente</th><th>Vales</th><th class="text-right">Declarado</th><th class="text-right">Pallets PBR</th><th class="text-right">Pallets Quebrados</th><th class="text-right">Dif.</th><th>Ocorrência</th><th>Usuário</th></tr></thead><tbody>' . $l . '</tbody></table>');
})();

echo '<div class="grid gap-6 lg:grid-cols-5">' . painel($form, 'Conferir recebimento', '', 'lg:col-span-2')
    . '<div class="space-y-6 lg:col-span-3">' . painel($tabPend, 'Vales a receber (' . count($pendentes) . ')') . painel($tabConf, 'Últimas conferências') . '</div></div>';
View::$scripts[] = 'telas.js';
