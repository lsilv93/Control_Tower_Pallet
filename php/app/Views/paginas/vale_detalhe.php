<?php
declare(strict_types=1);
// Detalhe do vale (src/app/(sistema)/vales/[id]/page.tsx).
$u = requireCD();
View::$titulo = 'Vale-Pallet';
$vale = carregarValeDoc($params['id']);
if (!$vale || !podeVerVale($u, $vale)) naoEncontrado();
$codigo = numeroVale($vale['numero'], $vale['tipo']);
$conf = $vale['conferenciaId'] ? Db::one('SELECT c.`numero`, x.`login` FROM `Conferencia` c JOIN `Usuario` x ON x.`id` = c.`usuarioId` WHERE c.`id` = ?', [$vale['conferenciaId']]) : null;
$resolvidoPor = $vale['resolvidoPorId'] ? Db::val('SELECT `login` FROM `Usuario` WHERE `id` = ?', [$vale['resolvidoPorId']]) : null;
$agenda = $vale['agendaId'] ? Db::one('SELECT a.`numero`, a.`dataPrevista`, x.`login` AS validadoPor FROM `AgendaDevolucao` a LEFT JOIN `Usuario` x ON x.`id` = a.`validadoPorId` WHERE a.`id` = ?', [$vale['agendaId']]) : null;
$movs = Db::all('SELECT m.*, x.`login`, c.`codigo` AS cdCodigo FROM `Movimentacao` m JOIN `Usuario` x ON x.`id` = m.`usuarioId` JOIN `CentroDistribuicao` c ON c.`id` = m.`cdId` WHERE m.`valeId` = ? ORDER BY m.`criadoEm` ASC', [$vale['id']]);
$dado = fn(string $rot, string $html) => '<div><dt class="label !mb-1">' . e($rot) . '</dt><dd class="text-[13px] text-t1">' . $html . '</dd></div>';
$parte = $vale['fornecedor']['nome'] ?? ($vale['unidade'] ? "{$vale['unidade']['codigo']} - {$vale['unidade']['nome']}" : '—');

echo cabecalho(ROTULO_TIPO_VALE[$vale['tipo']] . " $codigo", "$parte · emitido por {$vale['cd']['codigo']} em " . formatarDataHora($vale['criadoEm']),
    '<a href="' . ($vale['tipo'] === 'OCORRENCIA' ? '/ocorrencias' : '/vales/consulta') . '" class="btn-secondary">' . icone('arrow-left') . ' Voltar</a>' . botoesVale($vale['id']));

$d = $dado('Tipo', e(ROTULO_TIPO_VALE[$vale['tipo']])) . $dado($vale['tipo'] === 'FORNECEDOR' ? 'CD recebedor' : 'Remetente', e("{$vale['cd']['codigo']} - {$vale['cd']['nome']}"));
if ($vale['ocorrencia']) $d .= $dado('Ocorrência', '<span class="' . ($vale['ocorrencia'] === 'FALTA' ? 'font-semibold text-erro' : 'font-semibold') . '">' . ($vale['ocorrencia'] === 'FALTA' ? 'Falta' : 'Sobra') . '</span>');
if ($vale['fornecedor']) $d .= $dado('Fornecedor', e($vale['fornecedor']['nome'])) . $dado('CNPJ', '<span class="num">' . e(formatarCnpj($vale['fornecedor']['cnpj'])) . '</span>');
if ($vale['unidade']) $d .= $dado(($vale['tipo'] === 'OCORRENCIA' ? 'Recebedor' : 'Destino') . ' (' . ROTULO_TIPO_UNIDADE[$vale['unidade']['tipo']] . ')', e("{$vale['unidade']['codigo']} - {$vale['unidade']['nome']}"));
if ($vale['tipo'] !== 'FORNECEDOR') $d .= $dado('Pallets PBR / Pallets Quebrados', '<span class="num">' . n($vale['quantidadeBons']) . ' / ' . n($vale['quantidadeQuebrados']) . '</span>');
if ($vale['tipo'] === 'FORNECEDOR') $d .= $dado('Nota fiscal', '<span class="' . ($vale['semNotaFiscal'] ? 'font-semibold text-ouro' : 'num') . '">' . e(rotuloNf($vale)) . '</span>') . $dado('Conferente', e($vale['conferente'] ?? '—'));
if ($vale['chaveNfe']) $d .= $dado('Chave de acesso NF-e', '<span class="num break-all text-[11px]">' . e($vale['chaveNfe']) . '</span>');
$d .= $dado('Transportadora', e($vale['transportadora'] ?? '—')) . $dado('Placa', '<span class="num">' . e($vale['placa'] ? formatarPlaca($vale['placa']) : '—') . '</span>');
if ($vale['rota']) $d .= $dado('Rota', e($vale['rota']));
if ($vale['dataFaturamento']) $d .= $dado('Data de faturamento', formatarDataPura($vale['dataFaturamento']));
if ($c = $vale['conferenciaOrigem']) $d .= $dado('Conferência de origem', '<span class="num font-semibold text-erro">' . numeroConferencia($c['numero']) . " · declarado {$c['totalDeclarado']} × físico " . ($c['recebidoBons'] + $c['recebidoQuebrados']) . '</span>');
if ($vale['resolucao']) $d .= $dado('Resolução', '<span>' . ROTULO_RESOLUCAO[$vale['resolucao']] . ' · <span class="num">' . formatarDataHora($vale['resolvidoEm']) . '</span> · ' . e($resolvidoPor) . ($vale['observacaoResolucao'] ? ' · ' . e($vale['observacaoResolucao']) : '') . '</span>');
$d .= $dado('Quantidade / tipo', '<span><span class="num text-[20px] font-semibold">' . n($vale['quantidade']) . '</span> pallets PBR</span>')
    . $dado('Emissão', '<span class="num">' . formatarDataHora($vale['criadoEm']) . ' · ' . e($vale['criadoPor']['login']) . '</span>')
    . $dado('ID único', '<span class="num text-[11px]">' . e($vale['id']) . '</span>');
if ($agenda) $d .= $dado('Agenda', '<span class="num">' . numeroAgenda($agenda['numero']) . ' · retirada ' . formatarDataHora($agenda['dataPrevista']) . '</span>');
if ($vale['status'] === 'FINALIZADO') $d .= $dado('Baixa', '<span class="num">' . formatarDataHora($vale['finalizadoEm']) . ' · ' . e($conf ? numeroConferencia($conf['numero']) . " · {$conf['login']}" : ($agenda['validadoPor'] ?? $vale['criadoPor']['login'])) . '</span>');
if ($vale['observacao']) $d .= '<div class="sm:col-span-3">' . $dado('Observação', '<span class="whitespace-pre-line text-[12px]">' . e($vale['observacao']) . '</span>') . '</div>';
if ($vale['status'] === 'CANCELADO') $d .= $dado('Cancelamento', '<span><span class="num">' . formatarDataHora($vale['canceladoEm']) . '</span> · ' . e($vale['canceladoPor']['login'] ?? '') . ' · ' . ($vale['motivoCancelamento'] ? ROTULO_MOTIVO_CANCELAMENTO[$vale['motivoCancelamento']] : '') . ($vale['observacaoCancelamento'] ? ' · ' . e($vale['observacaoCancelamento']) : '') . '</span>');

if (!$movs) {
    $lanc = vazio('Sem lançamentos.');
} else {
    $lanc = '<ul class="space-y-3">';
    foreach ($movs as $m) {
        $lanc .= '<li class="poco p-4"><div class="flex items-center justify-between gap-2"><span class="text-[12px] font-semibold text-t1">' . ROTULO_TIPO[$m['tipo']] . ' <span class="num text-[11px] font-normal text-t4">· livro ' . e($m['cdCodigo']) . '</span></span>'
            . '<span class="num text-[15px] font-semibold text-t1">' . $m['quantidade'] . '</span></div><div class="mt-2">' . fluxoContas($m['origem'], $m['destino']) . '</div>'
            . '<p class="num mt-2 text-[11px] text-t4">' . formatarDataHora($m['criadoEm']) . ' · ' . e($m['login']) . '</p></li>';
    }
    $lanc .= '</ul>';
}
echo '<div class="grid gap-6 xl:grid-cols-3">' . painel('<dl class="poco grid gap-5 p-5 sm:grid-cols-3">' . $d . '</dl>', 'Dados do documento', statusBadge($vale['status'], ROTULO_STATUS_VALE[$vale['status']]), 'xl:col-span-2')
    . painel('<p class="mb-3 text-[12px] text-t3">Lançamentos gerados por este vale (partida dobrada).</p>' . $lanc, 'Conta corrente do vale') . '</div>';
