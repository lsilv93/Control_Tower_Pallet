<?php
declare(strict_types=1);
// Exclusão (cancelamento) de vale (src/app/(sistema)/vales/excluir/page.tsx).
$u = requirePermissao('excluir_vale');
View::$titulo = 'Excluir Vale Pallet';
$cd = $u['cd'];
$busca = q('vale') ?? '';
$numero = $busca !== '' ? lerCodigoVale($busca) : null;
$vale = null;
if ($numero !== null) {
    $v = Db::one('SELECT v.*, f.`nome` AS fornecedorNome, f.`cnpj` AS fornecedorCnpj, x.`codigo` AS unidadeCodigo, x.`nome` AS unidadeNome, c.`login` AS criadoPorLogin, k.`login` AS canceladoPorLogin, a.`numero` AS agendaNumero
                    FROM `ValePallet` v LEFT JOIN `Fornecedor` f ON f.`id` = v.`fornecedorId` LEFT JOIN `CentroDistribuicao` x ON x.`id` = v.`unidadeId` JOIN `Usuario` c ON c.`id` = v.`criadoPorId`
                    LEFT JOIN `Usuario` k ON k.`id` = v.`canceladoPorId` LEFT JOIN `AgendaDevolucao` a ON a.`id` = v.`agendaId` WHERE v.`numero` = ?', [$numero]);
    if ($v && $v['cdId'] === $cd['id']) $vale = $v;
}
echo cabecalho('Excluir Vale Pallet', "Cancelamento de vales emitidos incorretamente em {$cd['codigo']}, antes da conferência. O vale é mantido para auditoria com status Cancelado e o lançamento é estornado: no vale de envio os pallets voltam do trânsito para o estoque de origem (Pallets PBR e Pallets Quebrados); no vale de fornecedor, reduz o saldo com o fornecedor. Vales de ocorrência são resolvidos em Ocorrências.");
echo bannerOk(q('ok'));
echo painel('<form class="flex flex-wrap gap-3" action="/vales/excluir"><div class="relative min-w-[16rem] flex-1">' . icone('search', 'pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-t3')
    . '<input name="vale" value="' . e($busca) . '" class="input num !pl-12 uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal" placeholder="Nº do vale (ex.: VP-000123, VE-000124) ou leia o código de barras" aria-label="ID do Vale Pallet" autocomplete="off"' . ($vale ? '' : ' autofocus') . '></div>'
    . '<button class="btn-primary">Buscar</button></form>'
    . ($busca !== '' && $numero === null ? '<p class="mt-3 text-[12px] text-erro">&quot;' . e($busca) . '&quot; não é um ID de vale válido.</p>' : '')
    . ($numero !== null && !$vale ? '<p class="mt-3 text-[12px] text-erro">Vale nº ' . $numero . ' não encontrado entre os emitidos por esta unidade.</p>' : ''), 'Buscar vale', '', 'mb-6');

if ($vale) {
    $parte = parteVale($vale);
    $dl = '<dl class="poco mb-5 grid gap-4 p-5 text-[12px] sm:grid-cols-4"><div><dt class="label !mb-1">Tipo</dt><dd class="text-t2">' . ROTULO_TIPO_VALE[$vale['tipo']] . '</dd></div>'
        . ($vale['fornecedorNome'] ? '<div><dt class="label !mb-1">CNPJ</dt><dd class="num text-t2">' . e(formatarCnpj($vale['fornecedorCnpj'])) . '</dd></div>' : '')
        . '<div><dt class="label !mb-1">Transportadora</dt><dd class="text-t2">' . e($vale['transportadora'] ?? '—') . ($vale['placa'] ? ' · <span class="num">' . e(formatarPlaca($vale['placa'])) . '</span>' : '') . '</dd></div>'
        . ($vale['tipo'] === 'FORNECEDOR' ? '<div><dt class="label !mb-1">Nota fiscal</dt><dd class="num text-t2">' . e(rotuloNf($vale)) . '</dd></div>' : '')
        . '<div><dt class="label !mb-1">Quantidade</dt><dd class="num text-[22px] font-semibold text-t1">' . n($vale['quantidade']) . '</dd>' . ($vale['tipo'] === 'ENVIO' ? '<dd class="num text-[11px] text-t4">' . n($vale['quantidadeBons']) . ' PBR · ' . n($vale['quantidadeQuebrados']) . ' quebrados</dd>' : '') . '</div>'
        . '<div class="sm:col-span-2"><dt class="label !mb-1">Emissão</dt><dd class="text-t2"><span class="num">' . formatarDataHora($vale['criadoEm']) . '</span> · ' . e($vale['criadoPorLogin']) . '</dd></div>'
        . '<div class="sm:col-span-2"><dt class="label !mb-1">Documento</dt><dd><a href="/imprimir/vale/' . e($vale['id']) . '" class="text-lima hover:underline">Ver / reimprimir vale</a></dd></div></dl>';
    if ($vale['status'] === 'PENDENTE') {
        $mot = '<option value="" disabled selected>Selecione...</option>';
        foreach (ROTULO_MOTIVO_CANCELAMENTO as $k => $r) $mot .= "<option value=\"$k\">$r</option>";
        $dl .= formAcao('vales/excluir', '<input type="hidden" name="valeId" value="' . e($vale['id']) . '"><div class="grid gap-4 sm:grid-cols-[18rem_1fr]">'
            . '<div><label class="label" for="motivo">Motivo do cancelamento *</label><select id="motivo" name="motivo" class="input" required>' . $mot . '</select></div>'
            . '<div><label class="label" for="observacao">Observação</label><textarea id="observacao" name="observacao" rows="2" class="input" maxlength="500" placeholder="Detalhe o motivo (opcional)"></textarea></div></div>',
            ['confirmar' => 'Tem certeza de que deseja excluir este Vale Pallet?', 'botao' => icone('trash-2') . ' Excluir vale', 'classeBotao' => 'btn-danger', 'limpar' => false]);
    } elseif ($vale['status'] === 'AGENDADO') {
        $dl .= '<p class="poco-ouro px-4 py-3 text-[12px] text-ouro">Este vale está na agenda ' . ($vale['agendaNumero'] ? numeroAgenda($vale['agendaNumero']) : '') . '. Para excluí-lo, cancele primeiro a agenda em <a href="/agendas" class="font-semibold underline">Baixa de Pagamento</a>.</p>';
    } elseif ($vale['status'] === 'FINALIZADO') {
        $dl .= '<p class="poco-ouro px-4 py-3 text-[12px] text-ouro">Este vale já foi conferido/baixado e não pode ser excluído.</p>';
    } else {
        $dl .= '<p class="poco-erro px-4 py-3 text-[12px] text-erro-claro">Excluído em ' . formatarDataHora($vale['canceladoEm']) . ' por ' . e($vale['canceladoPorLogin']) . ' · '
            . ($vale['motivoCancelamento'] ? ROTULO_MOTIVO_CANCELAMENTO[$vale['motivoCancelamento']] : '') . ($vale['observacaoCancelamento'] ? ' · ' . e($vale['observacaoCancelamento']) : '') . '</p>';
    }
    echo painel($dl, '<span><span class="num text-lima">' . numeroVale($vale['numero'], $vale['tipo']) . '</span> <span class="text-t4">·</span> ' . e($parte) . '</span>', statusBadge($vale['status'], ROTULO_STATUS_VALE[$vale['status']]), 'mb-6');
}
echo historicoExclusoes($cd['id'], 100);
