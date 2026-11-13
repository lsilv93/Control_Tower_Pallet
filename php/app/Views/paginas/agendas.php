<?php
declare(strict_types=1);
// Baixa de pagamento das agendas de devolução (src/app/(sistema)/agendas/page.tsx).
$u = requireModuloFornecedor();
View::$titulo = 'Baixa de Pagamento';
$cd = $u['cd'];
$abertas = Db::all("SELECT a.*, f.`nome` AS fornecedorNome, f.`cnpj` AS fornecedorCnpj, x.`login` AS criadoPorLogin FROM `AgendaDevolucao` a JOIN `Fornecedor` f ON f.`id` = a.`fornecedorId` JOIN `Usuario` x ON x.`id` = a.`criadoPorId`
                     WHERE a.`status` = 'ABERTA' AND a.`cdId` = ? ORDER BY a.`dataPrevista` ASC", [$cd['id']]);
$historico = Db::all("SELECT a.*, f.`nome` AS fornecedorNome, x.`login` AS criadoPorLogin, y.`login` AS validadoPorLogin, (SELECT COALESCE(SUM(v.`quantidade`),0) FROM `ValePallet` v WHERE v.`agendaId` = a.`id`) AS total
                       FROM `AgendaDevolucao` a JOIN `Fornecedor` f ON f.`id` = a.`fornecedorId` JOIN `Usuario` x ON x.`id` = a.`criadoPorId` LEFT JOIN `Usuario` y ON y.`id` = a.`validadoPorId`
                      WHERE a.`status` <> 'ABERTA' AND a.`cdId` = ? ORDER BY a.`numero` DESC LIMIT 20", [$cd['id']]);
$saldos = obterSaldos($cd['id']);
echo cabecalho('Baixa de Pagamento', "Valide as agendas de devolução realizadas em {$cd['codigo']}. A baixa finaliza os vales, subtrai do estoque de Pallets PBR e reduz a dívida com o fornecedor.", '<a href="/vales" class="btn-secondary">Gerar nova agenda</a>');
if (q('ok')) echo '<div role="status" class="poco mb-5 flex items-center gap-2.5 px-5 py-4 text-[12px] font-medium text-lima"><span class="ponto"></span> ' . e(q('ok')) . '</div>';
echo '<p class="mb-5 flex flex-wrap items-center gap-2 text-[12px] text-t3">A baixa dá saída oficial: ' . fluxoContas('VAZIOS', 'FORNECEDOR') . ' · Saldo do estoque de Pallets PBR: <strong class="num text-t1">' . n($saldos['vazios']) . '</strong></p>';
if ($abertas) echo '<div class="card mb-6 p-5"><p class="label">Conferência por leitura óptica</p>' . leitorVale('Leia o código de barras do vale para localizá-lo na agenda') . '</div>';
if (!$abertas) {
    echo painel(vazio('Nenhuma agenda de devolução aberta.'));
} else {
    echo '<div class="grid gap-4 lg:grid-cols-2">';
    foreach ($abertas as $a) {
        $vales = Db::all('SELECT * FROM `ValePallet` WHERE `agendaId` = ? ORDER BY `numero` ASC', [$a['id']]);
        $total = array_sum(array_map(fn($v) => (int) $v['quantidade'], $vales));
        $l = '';
        foreach ($vales as $v) $l .= '<tr data-vale="' . $v['numero'] . '"><td class="font-mono">' . numeroVale($v['numero']) . '</td><td>' . e(rotuloNf($v)) . '</td><td>' . formatarData($v['criadoEm']) . '</td><td class="text-right tabular-nums">' . $v['quantidade'] . '</td></tr>';
        $ag = numeroAgenda($a['numero']);
        $corpo = '<dl class="poco mb-4 grid grid-cols-2 gap-4 p-4 text-[12px]"><div><dt class="label !mb-1">CNPJ</dt><dd class="num text-t2">' . e(formatarCnpj($a['fornecedorCnpj'])) . '</dd></div>'
            . '<div><dt class="label !mb-1">Retirada agendada</dt><dd class="num font-semibold text-t1">' . formatarDataHora($a['dataPrevista']) . '</dd></div>'
            . '<div><dt class="label !mb-1">Criada por</dt><dd class="text-t2">' . e($a['criadoPorLogin']) . ' · <span class="num">' . formatarDataHora($a['criadoEm']) . '</span></dd></div>'
            . '<div><dt class="label !mb-1">Total a devolver</dt><dd class="num text-[22px] font-semibold text-lima">' . n($total) . '</dd></div></dl>'
            . ($a['observacao'] ? '<p class="mb-4 text-[12px] text-t2">Obs.: ' . e($a['observacao']) . '</p>' : '')
            . '<div class="poco mb-5 overflow-x-auto"><table class="tabela"><thead><tr><th>Vale</th><th>NF</th><th>Emissão</th><th class="text-right">Qtd.</th></tr></thead><tbody>' . $l . '</tbody></table></div>'
            . '<div class="flex flex-wrap items-start gap-3">'
            . formAcao('vales/validar-agenda', '<input type="hidden" name="agendaId" value="' . e($a['id']) . '"><input name="observacao" class="input" placeholder="Observação da baixa (opcional)" maxlength="500">',
                ['classe' => 'flex flex-1 flex-col gap-2', 'confirmar' => "Confirmar a baixa da $ag? $total pallet(s) sairão do estoque de Pallets PBR.", 'botao' => icone('circle-check') . ' Validar e dar baixa', 'classeBotao' => 'btn-success'])
            . formAcao('vales/cancelar-agenda', '<input type="hidden" name="agendaId" value="' . e($a['id']) . '">',
                ['classe' => 'flex flex-col gap-2', 'confirmar' => "Cancelar a $ag? Os vales voltarão para Pendente.", 'botao' => icone('ban') . ' Cancelar', 'classeBotao' => 'btn-danger'])
            . '</div>';
        echo painel($corpo, '<span><span class="num text-lima">' . $ag . '</span> <span class="text-t4">·</span> ' . e($a['fornecedorNome']) . '</span>', statusBadge($a['status'], ROTULO_STATUS_AGENDA[$a['status']]));
    }
    echo '</div>';
}
if (!$historico) {
    $h = vazio('Nenhuma agenda finalizada ainda.');
} else {
    $l = '';
    foreach ($historico as $a) {
        $l .= '<tr><td class="font-mono">' . numeroAgenda($a['numero']) . '</td><td>' . e($a['fornecedorNome']) . '</td><td>' . statusBadge($a['status'], ROTULO_STATUS_AGENDA[$a['status']]) . '</td>'
            . '<td class="text-right tabular-nums">' . ((int) $a['total'] ?: '—') . '</td><td>' . e($a['criadoPorLogin']) . ' · ' . formatarDataHora($a['criadoEm']) . '</td><td>'
            . ($a['validadoPorLogin'] ? e($a['validadoPorLogin']) . ' · ' . formatarDataHora($a['validadoEm']) : ($a['canceladoEm'] ? 'Cancelada ' . formatarDataHora($a['canceladoEm']) : '—')) . '</td></tr>';
    }
    $h = '<div class="poco overflow-x-auto"><table class="tabela"><thead><tr><th>Agenda</th><th>Fornecedor</th><th>Status</th><th class="text-right">Pallets</th><th>Criada</th><th>Baixa</th></tr></thead><tbody>' . $l . '</tbody></table></div>';
}
echo painel($h, 'Histórico de agendas', '', 'mt-6');
View::$scripts[] = 'telas.js';
