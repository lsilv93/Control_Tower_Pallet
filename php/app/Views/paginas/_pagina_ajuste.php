<?php
declare(strict_types=1);
// Ajustes manuais de saldo (src/components/PaginaAjusteSaldo.tsx + FormAjusteSaldo.tsx).

function paginaAjuste(string $modo): void
{
    $u = requireAdmin();
    View::$titulo = $modo === 'inclusao' ? 'Inclusão de Saldo' : 'Remoção de Saldo';
    $tipo = $modo === 'inclusao' ? 'INCLUSAO_MANUAL' : 'REMOCAO_MANUAL';
    $unidades = Db::all('SELECT `id`, `codigo`, `nome`, `tipo` FROM `CentroDistribuicao` WHERE `ativo` = 1 ORDER BY `hub` DESC, `tipo` ASC, `codigo` ASC');
    $estoques = estoquesPorUnidade();
    $historico = Db::all('SELECT m.*, x.`nome` AS usuarioNome, c.`codigo` AS cdCodigo FROM `Movimentacao` m JOIN `Usuario` x ON x.`id` = m.`usuarioId` JOIN `CentroDistribuicao` c ON c.`id` = m.`cdId` WHERE m.`tipo` = ? ORDER BY m.`criadoEm` DESC LIMIT 30', [$tipo]);
    $comSaldo = array_map(fn($x) => $x + ['vazios' => $estoques[$x['id']]['vazios'] ?? 0, 'quebrados' => $estoques[$x['id']]['quebrados'] ?? 0], $unidades);
    $inicial = in_array($u['cd']['id'] ?? '', array_column($unidades, 'id'), true) ? $u['cd']['id'] : '';

    echo cabecalho('Ajuste de Saldo', 'Exclusivo de administradores. Inclusão manual de Pallets PBR ou Pallets Quebrados (Compra, Devolução, Ajuste Estoque ou Inventário) e remoção com justificativa, em qualquer CD ou Ponto de Cross. O saldo nunca fica negativo e tudo é registrado na auditoria.');
    echo abas([['href' => '/estoque/inclusao', 'rotulo' => 'Inclusão manual'], ['href' => '/estoque/remocao', 'rotulo' => 'Remoção manual']], "/estoque/$modo");

    $op = '<option value="" disabled' . ($inicial ? '' : ' selected') . '>Selecione...</option>';
    foreach ($comSaldo as $x) $op .= '<option value="' . e($x['id']) . '"' . ($x['id'] === $inicial ? ' selected' : '') . '>' . ($x['tipo'] === 'CROSS' ? 'Cross' : 'CD') . ' · ' . e("{$x['codigo']} - {$x['nome']}") . '</option>';
    $conteudo = '<div><label class="label" for="unidadeId">CD / Ponto de Cross *</label><select id="unidadeId" name="unidadeId" class="input" required>' . $op . '</select><p class="mt-1 text-[11px] text-t4" data-saldo-unidade hidden></p></div>'
        . '<div class="grid grid-cols-2 gap-4"><div><label class="label" for="estoque">Estoque *</label><select id="estoque" name="estoque" class="input" required><option value="" disabled selected>Selecione...</option><option value="VAZIOS">Pallets PBR</option><option value="QUEBRADOS">Pallets Quebrados</option></select></div>'
        . '<div><label class="label" for="quantidade">Quantidade *</label><input id="quantidade" name="quantidade" type="number" min="1" step="1" class="input" required></div></div>';
    if ($modo === 'inclusao') {
        $mot = '<option value="" disabled selected>Selecione...</option>';
        foreach (MOTIVOS_INCLUSAO as $k => $v) $mot .= "<option value=\"$k\">$v</option>";
        $conteudo .= '<div><label class="label" for="motivo">Motivo *</label><select id="motivo" name="motivo" class="input" required>' . $mot . '</select></div>'
            . '<div><label class="label" for="observacao">Observação *</label><textarea id="observacao" name="observacao" rows="3" class="input" required minlength="10" maxlength="500" placeholder="Descreva a origem dos pallets (mínimo 10 caracteres)"></textarea></div>';
    } else {
        $conteudo .= '<div><label class="label" for="justificativa">Justificativa *</label><textarea id="justificativa" name="justificativa" rows="3" class="input" required minlength="10" maxlength="500" placeholder="Motivo da remoção (mínimo 10 caracteres)"></textarea></div>';
    }
    $form = formAcao($modo === 'inclusao' ? 'pallets/incluir' : 'pallets/remover', $conteudo, [
        'botao' => $modo === 'inclusao' ? icone('plus-circle') . ' Incluir saldo' : icone('minus-circle') . ' Remover saldo',
        'classeBotao' => $modo === 'inclusao' ? 'btn-success w-full' : 'btn-danger w-full', 'textoEnviando' => 'Registrando...',
        'attrs' => ['data-ajuste' => json_encode(['modo' => $modo, 'unidades' => array_map(fn($x) => ['id' => $x['id'], 'codigo' => $x['codigo'], 'vazios' => $x['vazios'], 'quebrados' => $x['quebrados']], $comSaldo)])],
    ]);

    if (!$historico) {
        $tab = vazio('Nenhum lançamento.');
    } else {
        $l = '';
        foreach ($historico as $m) {
            $l .= '<tr><td class="num whitespace-nowrap">' . formatarDataHora($m['criadoEm']) . '</td><td class="num">' . e($m['cdCodigo']) . '</td><td>' . contaTag($modo === 'inclusao' ? $m['destino'] : $m['origem']) . '</td>'
                . '<td class="num text-right font-semibold">' . ($modo === 'inclusao' ? '+' : '−') . n($m['quantidade']) . '</td>'
                . ($modo === 'inclusao' ? '<td>' . (MOTIVOS_INCLUSAO[$m['motivo'] ?? ''] ?? '—') . '</td>' : '')
                . '<td class="max-w-[260px] truncate" title="' . e($m['observacao'] ?? '') . '">' . e($m['observacao']) . '</td><td>' . e($m['usuarioNome']) . '</td></tr>';
        }
        $tab = tabela('<table class="tabela" data-testid="historico-ajustes"><thead><tr><th>Data/hora</th><th>Unidade</th><th>Estoque</th><th class="text-right">Qtd.</th>' . ($modo === 'inclusao' ? '<th>Motivo</th>' : '') . '<th>Observação</th><th>Usuário</th></tr></thead><tbody>' . $l . '</tbody></table>');
    }
    echo '<div class="grid gap-6 lg:grid-cols-5">' . painel($form, $modo === 'inclusao' ? 'Incluir pallets' : 'Remover pallets', '', 'lg:col-span-2')
        . painel($tab, $modo === 'inclusao' ? 'Últimas inclusões' : 'Últimas remoções', '', 'lg:col-span-3') . '</div>';
    View::$scripts[] = 'telas.js';
}
