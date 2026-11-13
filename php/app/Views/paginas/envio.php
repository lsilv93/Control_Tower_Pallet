<?php
declare(strict_types=1);
// Envio de pallets (src/app/(sistema)/envio/page.tsx + FormEnvio.tsx).
$u = requirePermissao('envio');
View::$titulo = 'Envio de Pallets';
$cd = $u['cd'];
$MODOS = [
    'CROSS' => ['rotulo' => 'Enviar para Ponto de Cross', 'descricao' => 'Gera o Vale-Pallet de Envio para um Ponto de Cross vinculado a esta unidade. Não exige nem consome o estoque do CD: soma no total enviado para Cross.'],
    'CD' => ['rotulo' => 'Enviar para CD', 'descricao' => 'Gera o Vale-Pallet de Envio para outro CD (ex.: CDJC devolvendo Pallets PBR às filiais).'],
    'HUB' => ['rotulo' => 'Pallets Quebrados para o CDJC', 'descricao' => 'Gera o Vale de Pallets Quebrados para conserto no CD Hub (CDJC).'],
];
$RETORNO = ['rotulo' => 'Retorno ao CD', 'descricao' => 'Devolve Pallets PBR e Pallets Quebrados a um dos CDs vinculados a este Ponto de Cross.'];
$pedido = strtoupper(q('modo') ?? '');
// Ponto de Cross: só o retorno aos CDs vinculados. O Hub não envia quebrados para si mesmo.
$ehCross = $cd['tipo'] === 'CROSS';
$disponiveis = $ehCross ? ['CD'] : ($cd['hub'] ? ['CROSS', 'CD'] : ['CROSS', 'CD', 'HUB']);
$modo = in_array($pedido, $disponiveis, true) ? $pedido : $disponiveis[0];

if ($ehCross) {
    $destinos = Db::all("SELECT c.`id`, c.`codigo`, c.`nome`, c.`tipo`, c.`hub` FROM `CentroDistribuicao` c JOIN `CrossCD` x ON x.`cdId` = c.`id` AND x.`crossId` = ?
                          WHERE c.`ativo` = 1 AND c.`id` <> ? AND c.`tipo` = 'CD' ORDER BY c.`hub` DESC, c.`codigo` ASC", [$cd['id'], $cd['id']]);
} elseif ($modo === 'CROSS') {
    $destinos = Db::all("SELECT c.`id`, c.`codigo`, c.`nome`, c.`tipo`, c.`hub` FROM `CentroDistribuicao` c JOIN `CrossCD` x ON x.`crossId` = c.`id` AND x.`cdId` = ?
                          WHERE c.`ativo` = 1 AND c.`id` <> ? AND c.`tipo` = 'CROSS' ORDER BY c.`hub` DESC, c.`codigo` ASC", [$cd['id'], $cd['id']]);
} elseif ($modo === 'HUB') {
    $destinos = Db::all('SELECT `id`, `codigo`, `nome`, `tipo`, `hub` FROM `CentroDistribuicao` WHERE `ativo` = 1 AND `id` <> ? AND `hub` = 1 ORDER BY `codigo` ASC', [$cd['id']]);
} else {
    $destinos = Db::all("SELECT `id`, `codigo`, `nome`, `tipo`, `hub` FROM `CentroDistribuicao` WHERE `ativo` = 1 AND `id` <> ? AND `tipo` = 'CD' ORDER BY `hub` DESC, `codigo` ASC", [$cd['id']]);
}
$transportadoras = Db::all('SELECT `id`, `nome` FROM `Transportadora` WHERE `ativo` = 1 ORDER BY `nome` ASC');
$acumulado = acumuladoresEnvio($cd['id']);
$saldos = obterSaldos($cd['id']);
$pendentes = Db::all("SELECT v.*, x.`codigo` AS unidadeCodigo, x.`nome` AS unidadeNome FROM `ValePallet` v LEFT JOIN `CentroDistribuicao` x ON x.`id` = v.`unidadeId`
                       WHERE v.`cdId` = ? AND v.`tipo` = 'ENVIO' AND v.`status` = 'PENDENTE' ORDER BY v.`criadoEm` DESC LIMIT 20", [$cd['id']]);
$info = $ehCross ? $RETORNO : $MODOS[$modo];
$consomeEstoque = !($modo === 'CROSS' && !$ehCross);
$tipoDestino = $modo === 'CROSS' ? 'Ponto de Cross' : ($modo === 'HUB' ? 'CD Hub' : 'CD');

echo cabecalho($ehCross ? 'Retorno de Pallets ao CD' : 'Envio de Pallets', $info['descricao'] . ' ' . ($modo === 'CROSS' && !$ehCross ? '' : "Os pallets saem do estoque de {$cd['codigo']} (bloqueado se não houver saldo) e ") . 'ficam em trânsito até a conferência no destino.');
if (count($disponiveis) > 1) {
    echo abas(array_map(fn($m) => ['href' => '/envio?modo=' . strtolower($m), 'rotulo' => $MODOS[$m]['rotulo']], $disponiveis), '/envio?modo=' . strtolower($modo));
}
echo saldosEstoques($cd['id'], $modo === 'HUB' ? ['QUEBRADOS'] : ['VAZIOS', 'TRANSITO']);
if (!$ehCross) {
    echo '<div class="-mt-2 mb-6 grid grid-cols-2 gap-3 sm:gap-4" data-testid="acumuladores-envio">'
        . '<div class="card-sm p-4 sm:p-5"><p class="label !mb-0.5">Total de Pallets Enviados para Cross</p><p class="num text-[22px] font-semibold text-t1 sm:text-[26px]" data-testid="total-enviado-cross">' . n($acumulado['paraCross']) . '</p><p class="text-[11px] text-t4">remessas sem consumo do estoque</p></div>'
        . '<div class="card-sm p-4 sm:p-5"><p class="label !mb-0.5">Total de Pallets Enviados para CDs</p><p class="num text-[22px] font-semibold text-t1 sm:text-[26px]" data-testid="total-enviado-cds">' . n($acumulado['paraCds']) . '</p><p class="text-[11px] text-t4">saem do estoque de ' . e($cd['codigo']) . '</p></div></div>';
}

if (!$destinos) {
    $form = vazio(e($ehCross
        ? "Nenhum CD vinculado a {$cd['codigo']}. Peça a um administrador para vincular os CDs em Cadastros → Pontos de Cross."
        : ($modo === 'HUB' ? 'Nenhum CD Hub cadastrado.' : ($modo === 'CROSS' ? "Nenhum Ponto de Cross ativo vinculado a {$cd['codigo']}. Vincule em Cadastros → Pontos de Cross." : 'Nenhum CD ativo disponível.'))));
} elseif (!$transportadoras) {
    $form = '<p class="poco-erro px-4 py-3 text-[12px] text-erro-claro">Nenhuma transportadora cadastrada. <a href="/cadastros/transportadoras" class="font-semibold underline">Cadastrar transportadora</a></p>';
} else {
    // Destino único (Hub, ou Cross com um só CD) já vem selecionado; com mais de um, a escolha é obrigatória.
    $preSel = ($modo === 'HUB' || $ehCross) && count($destinos) === 1 ? $destinos[0]['id'] : '';
    $opcoesDestino = '<option value="" disabled' . ($preSel ? '' : ' selected') . '>Selecione...</option>';
    foreach ($destinos as $d) $opcoesDestino .= '<option value="' . e($d['id']) . '"' . ($d['id'] === $preSel ? ' selected' : '') . '>' . e("{$d['codigo']} - {$d['nome']}") . ($d['hub'] ? ' (Hub)' : '') . '</option>';
    $disp = fn(int $v, string $k) => $consomeEstoque ? '<p class="mt-1 text-[11px] text-t4" data-disponivel="' . $k . '">Disponível: <span class="num">' . n($v) . '</span></p>' : '';
    $quant = '<div class="' . ($modo === 'HUB' ? '' : 'grid grid-cols-2 gap-4') . '">'
        . ($modo !== 'HUB' ? '<div><label class="label" for="quantidadeBons">Pallets PBR</label><input id="quantidadeBons" name="quantidadeBons" type="number" min="0" step="1" class="input" placeholder="0">' . $disp($saldos['vazios'], 'bons') . '</div>' : '')
        . '<div><label class="label" for="quantidadeQuebrados">Pallets Quebrados' . ($modo === 'HUB' ? ' *' : '') . '</label><input id="quantidadeQuebrados" name="quantidadeQuebrados" type="number" min="0" step="1" class="input" placeholder="0"' . ($modo === 'HUB' ? ' required' : '') . '>' . $disp($saldos['quebrados'], 'quebrados') . '</div></div>';
    $opcTransp = '<option value="" disabled selected>Selecione...</option>';
    foreach ($transportadoras as $t) $opcTransp .= '<option value="' . e($t['id']) . '">' . e($t['nome']) . '</option>';
    $conteudo = '<input type="hidden" name="modo" value="' . $modo . '">'
        . '<div><label class="label" for="unidadeId">' . ($ehCross ? 'CD que recebe a devolução *' : "$tipoDestino de destino *") . '</label><select id="unidadeId" name="unidadeId" class="input" required>' . $opcoesDestino . '</select></div>'
        . $quant
        . (!$consomeEstoque ? '<p class="poco px-4 py-3 text-[11px] text-t3" data-testid="aviso-remessa-cross">Envio para Ponto de Cross <strong class="text-t1">não exige nem consome</strong> o estoque de ' . e($cd['codigo']) . ': soma no total de Pallets Enviados para Cross.</p>' : '')
        . '<div><label class="label" for="transportadoraId">Transportador *</label><select id="transportadoraId" name="transportadoraId" class="input" required>' . $opcTransp . '</select></div>'
        . inputPlaca('Placa do veículo')
        . ($modo === 'CROSS' ? '<div class="grid grid-cols-2 gap-4"><div><label class="label" for="rota">Rota</label><input id="rota" name="rota" class="input" maxlength="60" placeholder="Ex.: R-01/SP" autocomplete="off"></div>'
            . '<div><label class="label" for="dataFaturamento">Data de faturamento</label><input id="dataFaturamento" name="dataFaturamento" type="date" class="input"></div></div>' : '')
        . '<div><label class="label" for="observacao">Observação</label><textarea id="observacao" name="observacao" rows="2" class="input" maxlength="500"></textarea></div>'
        . '<div data-erro-envio hidden></div>';
    $botao = icone('send') . ' ' . ($modo === 'HUB' ? 'Enviar Pallets Quebrados ao CDJC' : ($ehCross ? 'Gerar vale de retorno' : 'Gerar vale de envio'));
    $form = formAcao('transferencias/enviar', $conteudo, [
        'botao' => $botao, 'classeBotao' => 'btn-primary w-full', 'textoEnviando' => 'Enviando...', 'limpar' => false,
        'attrs' => [
            'data-envio' => json_encode([
                'modo' => $modo, 'origem' => $cd['codigo'], 'tipoDestino' => $tipoDestino, 'consomeEstoque' => $consomeEstoque,
                'saldo' => ['vazios' => $saldos['vazios'], 'quebrados' => $saldos['quebrados']],
                'destinos' => array_map(fn($d) => ['id' => $d['id'], 'codigo' => $d['codigo'], 'nome' => $d['nome']], $destinos),
            ], JSON_UNESCAPED_UNICODE),
        ],
    ]);
}

$pend = !$pendentes ? vazio('Nenhum envio em trânsito.') : (function () use ($pendentes) {
    $l = '';
    foreach ($pendentes as $v) {
        $l .= '<tr><td><a href="/vales/' . e($v['id']) . '" class="num font-semibold text-lima hover:underline">' . numeroVale($v['numero'], $v['tipo']) . '</a></td>'
            . '<td>' . e($v['unidadeCodigo'] ? "{$v['unidadeCodigo']} - {$v['unidadeNome']}" : '—') . '</td><td class="num text-right">' . n($v['quantidadeBons']) . '</td>'
            . '<td class="num text-right">' . n($v['quantidadeQuebrados']) . '</td><td class="num">' . formatarDataHora($v['criadoEm']) . '</td></tr>';
    }
    return tabela('<table class="tabela" data-testid="envios-transito"><thead><tr><th>Vale</th><th>Destino</th><th class="text-right">Pallets PBR</th><th class="text-right">Pallets Quebrados</th><th>Emissão</th></tr></thead><tbody>' . $l . '</tbody></table>');
})();

echo '<div class="grid gap-6 lg:grid-cols-5">' . painel($form, e($info['rotulo']), '', 'lg:col-span-2')
    . '<div class="space-y-6 lg:col-span-3">' . painel($pend, 'Enviados em trânsito (aguardando conferência no destino)')
    . ultimasMovimentacoes($cd['id'], ['ENVIO', 'BAIXA_TRANSITO', 'ESTORNO_ENVIO'], 'Últimos envios') . '</div></div>';
View::$scripts[] = 'telas.js';
