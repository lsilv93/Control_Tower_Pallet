<?php
declare(strict_types=1);
// Agendar retirada: vales de fornecedor em aberto (src/app/(sistema)/vales/page.tsx + SelecaoVales.tsx).
$u = requireModuloFornecedor();
View::$titulo = 'Vales Pendentes';
$cd = $u['cd'];
$busca = q('q') ?? '';
$status = q('status') ?? '';
$vales = valesEmAberto($cd['id']);
if ($status === 'PENDENTE' || $status === 'AGENDADO') $vales = array_values(array_filter($vales, fn($v) => $v['status'] === $status));
if ($busca !== '') {
    $cn = normalizarCnpj($busca) ?: $busca;
    $num = preg_replace('/^V[PEOA]-?/i', '', $busca);
    $vales = array_values(array_filter($vales, fn($v) => mb_stripos($v['fornecedorNome'] ?? '', $busca) !== false
        || str_contains((string) $v['fornecedorCnpj'], $cn) || mb_stripos((string) $v['notaFiscal'], $busca) !== false
        || (preg_match('/^\d+$/', $num) && (int) $v['numero'] === (int) $num)));
}
$hoje = diaLocal();
echo cabecalho('Agendar Retirada', "Vales-pallet de fornecedor em aberto em {$cd['codigo']}. Selecione vales pendentes para gerar a agenda de devolução (uma agenda por fornecedor).",
    '<a href="/fornecedor/entrada" class="btn-secondary">' . icone('package-plus') . ' Nova entrada</a>');
echo '<form class="card mb-4 flex flex-wrap items-end gap-3 p-4"><div class="min-w-[16rem] flex-1"><label class="label" for="q">Buscar</label><input id="q" name="q" value="' . e($busca) . '" class="input" placeholder="Fornecedor, CNPJ, NF ou nº do vale"></div>'
    . '<div><label class="label" for="status">Status</label><select id="status" name="status" class="input">' . opcoes(['' => 'Pendentes e agendados', 'PENDENTE' => 'Pendente', 'AGENDADO' => 'Agendado'], $status) . '</select></div><button class="btn-secondary">Filtrar</button></form>';
echo '<div class="card mb-5 p-5"><p class="label">Leitura óptica do vale</p>' . leitorVale('Leia o código de barras do vale para selecioná-lo', 'selecionar') . '</div>';

$linhas = '';
foreach ($vales as $v) {
    $linhas .= '<tr data-vale="' . $v['numero'] . '" data-id="' . e($v['id']) . '" data-qtd="' . $v['quantidade'] . '" data-cnpj="' . e($v['fornecedorCnpj']) . '" data-status="' . $v['status'] . '" data-codigo="' . numeroVale($v['numero'], 'FORNECEDOR') . '" data-fornecedor="' . e($v['fornecedorNome']) . '" data-agenda="' . ($v['agendaNumero'] ? numeroAgenda($v['agendaNumero']) : '') . '">'
        . '<td>' . ($v['status'] === 'PENDENTE' ? '<input type="checkbox" name="valeIds" value="' . e($v['id']) . '" aria-label="Selecionar ' . numeroVale($v['numero'], 'FORNECEDOR') . '">' : '') . '</td>'
        . '<td>' . farolBadge($v['farol']) . '</td><td><a href="/imprimir/vale/' . e($v['id']) . '" class="num font-semibold text-lima hover:underline">' . numeroVale($v['numero'], $v['tipo']) . '</a></td>'
        . '<td><p class="max-w-[14rem] truncate font-medium text-t1" title="' . e($v['fornecedorNome']) . '">' . e($v['fornecedorNome'] ?? '—') . '</p><p class="text-[11px] text-t4">' . e($v['fornecedorNome'] ? formatarCnpj($v['fornecedorCnpj']) : '') . '</p></td>'
        . '<td>' . e(rotuloNf($v)) . '</td><td><p class="max-w-[10rem] truncate">' . e($v['transportadora'] ?? '—') . '</p><p class="text-[11px] text-t4">' . e($v['placa'] ? formatarPlaca($v['placa']) : '—') . '</p></td>'
        . '<td><p>' . formatarData($v['criadoEm']) . '</p><p class="text-[11px] text-t4">' . e($v['criadoPorLogin']) . '</p></td><td class="text-right tabular-nums">' . $v['idade'] . ' d</td>'
        . '<td class="text-right font-semibold tabular-nums text-t1">' . $v['quantidade'] . '</td><td>' . statusBadge($v['status'], ROTULO_STATUS_VALE[$v['status']]) . ($v['agendaNumero'] ? '<p class="mt-0.5 text-[11px] text-t4">' . numeroAgenda($v['agendaNumero']) . '</p>' : '') . '</td></tr>';
}
if (!$vales) $linhas = '<tr><td colspan="10" class="py-10 text-center text-t3">Nenhum vale em aberto.</td></tr>';
// Próxima hora cheia de hoje (ou 08:00 de amanhã se já passou das 17h).
$horaLocal = (int) agoraUtc()->setTimezone(tzLocal())->format('G') + 1;
$sugestao = $horaLocal <= 17 ? sprintf('%sT%02d:00', $hoje, max($horaLocal, 8)) : agoraUtc()->setTimezone(tzLocal())->modify('+1 day')->format('Y-m-d') . 'T08:00';
echo '<div data-selecao-vales="' . e(json_encode(['hoje' => $hoje, 'sugestao' => $sugestao])) . '"><div class="card p-3 sm:p-4"><div class="poco overflow-x-auto"><table class="tabela"><thead><tr><th class="w-8"><input type="checkbox" aria-label="Selecionar todos os pendentes" data-todos></th>'
    . '<th>Farol</th><th>Vale</th><th>Fornecedor</th><th>NF</th><th>Transportadora / Placa</th><th>Emissão</th><th class="text-right">Idade</th><th class="text-right">Qtd.</th><th>Status</th></tr></thead><tbody>' . $linhas . '</tbody></table></div></div>'
    . '<div class="card sticky bottom-4 z-10 mt-5 flex flex-wrap items-end gap-4 p-5"><div class="min-w-[10rem] text-[12px]"><p class="label !mb-1">Selecionados</p><p class="num text-[13px] font-semibold text-t1" data-resumo>0 vale(s) · 0 pallet(s)</p></div>'
    . '<button type="button" class="btn-primary ml-auto" disabled data-agendar>' . icone('calendar-plus') . ' Selecione vales</button>'
    . '<form data-acao="/acao/vales/agendar" class="w-full" data-form-agendar><div data-mensagem hidden></div></form></div></div>';
View::$scripts[] = 'telas.js';
