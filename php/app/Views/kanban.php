<?php
declare(strict_types=1);
/**
 * Kanban de viagens do Painel (src/components/KanbanViagens.tsx): vales de envio em viagem
 * envolvendo a unidade, em colunas pelo farol do SLA de viagem. Conferido sem divergência, o
 * vale sai do quadro; com divergência fica na última coluna até a ocorrência ser encerrada.
 */

const COR_VIAGEM = ['VERDE' => '#22c55e', 'AMARELO' => '#eab308', 'VERMELHO' => '#ef4444'];

function _gradienteViagem(): string
{
    $p = REGRAS_VIAGEM['amareloHoras'] / REGRAS_VIAGEM['vermelhoHoras'] * 100;
    $c = COR_VIAGEM;
    return "linear-gradient(90deg, {$c['VERDE']} 0%, {$c['VERDE']} " . ($p - 8) . "%, {$c['AMARELO']} " . ($p + 8) . "%, #f97316 82%, {$c['VERMELHO']} 100%)";
}

/** 07/11/26 20:49 */
function _dataHoraCurta(string $d): string
{
    return utc($d)->setTimezone(tzLocal())->format('d/m/y H:i');
}

function _duracao(float $horas): string
{
    $h = (int) floor($horas);
    if ($h < 1) return max(1, (int) round($horas * 60)) . ' min';
    if ($h < 48) return $h . 'h' . str_pad((string) (int) floor(($horas - $h) * 60), 2, '0', STR_PAD_LEFT);
    return intdiv($h, 24) . 'd ' . ($h % 24) . 'h';
}

/** Linha de progresso: nós do despacho ao SLA, trecho percorrido com a escala de cores e o caminhão. */
function _linhaViagem(float $horas, bool $chegou): string
{
    $sla = REGRAS_VIAGEM['vermelhoHoras'];
    $p = $chegou ? 1.0 : min($horas / $sla, 1.0);
    $farol = $chegou ? 'VERMELHO' : farolViagem($horas);
    $h = '<div class="pt-1" role="img" aria-label="' . ($chegou ? 'Recebido no destino com divergência' : 'Em viagem há ' . _duracao($horas) . "; SLA de {$sla}h") . '"><div class="relative mx-2 h-7">'
        . '<div class="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--groove)]"></div>'
        . '<div class="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" style="width:' . ($p * 100) . '%;background-image:' . _gradienteViagem() . ';background-size:' . ($p > 0 ? 100 / $p : 100) . '% 100%"></div>';
    foreach ([0, 0.25, 0.5, 0.75, 1] as $x) {
        $atingido = $x <= $p + 0.001;
        $cor = COR_VIAGEM[farolViagem($x * $sla)];
        $fundo = $atingido ? $cor : 'var(--groove)';
        $h .= '<span class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style="left:' . ($x * 100) . "%;border-color:$fundo;background:$fundo" . ($atingido && $x == 1 ? ";box-shadow:0 0 0 3px {$cor}33" : '') . '"></span>';
    }
    $h .= '<span class="' . cx('absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg', $farol === 'VERMELHO' && !$chegou ? 'animate-pulse' : '') . '" style="left:' . ($p * 100) . '%;background:' . COR_VIAGEM[$farol] . '">'
        . icone($chegou ? 'map-pin' : 'truck', 'h-4 w-4 text-black') . '</span></div>'
        . '<div class="mt-1 flex justify-between text-[10px] text-t4"><span>Despacho</span><span>' . REGRAS_VIAGEM['amareloHoras'] . 'h</span><span>Destino · SLA ' . $sla . 'h</span></div></div>';
    return $h;
}

function _cartaoViagem(array $v, string $cdAtual, int $agoraMs, bool $divergente): string
{
    $horas = ($agoraMs - msDe($v['criadoEm'])) / 3600000;
    $farol = farolViagem($horas);
    $codigo = numeroVale($v['numero'], 'ENVIO');
    $enviado = $v['cdId'] === $cdAtual;
    $h = '<article class="poco space-y-2.5 p-3.5" data-testid="viagem-' . $codigo . '"><header class="flex items-start justify-between gap-2"><div class="min-w-0">'
        . '<a href="/vales/' . e($v['id']) . '" class="num text-[13px] font-semibold text-lima hover:underline">' . $codigo . '</a>'
        . '<p class="num mt-0.5 flex items-center gap-1 text-[12px] text-t2">' . e($v['cdCodigo']) . ' ' . icone('arrow-right', 'h-3 w-3 flex-none text-t3', ['aria-label' => 'para']) . ' ' . e($v['unidadeCodigo'] ?? '—')
        . '<span class="' . cx('pill ml-1 !px-1.5 !py-0 text-[10px]', $enviado ? 'bg-t2/10 text-t2' : 'bg-lima/10 text-lima') . '">' . ($enviado ? 'Enviado' : 'A receber') . '</span></p></div>'
        . '<div class="text-right"><p class="num text-[20px] font-semibold leading-none text-t1">' . n($v['quantidade']) . '</p><p class="text-[10px] text-t4">' . n($v['quantidadeBons']) . ' PBR · ' . n($v['quantidadeQuebrados']) . ' quebr.</p></div></header>'
        . _linhaViagem($horas, $divergente)
        . '<dl class="space-y-0.5 text-[11px]"><div class="flex justify-between gap-2"><dt class="text-t4">Despacho</dt><dd class="num whitespace-nowrap text-t2">' . _dataHoraCurta($v['criadoEm']) . '</dd></div>';
    if ($divergente) {
        $h .= '<div class="flex justify-between gap-2"><dt class="text-t4">Recebido</dt><dd class="num whitespace-nowrap text-t2">' . _dataHoraCurta($v['confCriadoEm']) . '</dd></div></dl>';
        $ocs = '';
        foreach ($v['ocorrencias'] as $o) $ocs .= ' · ' . numeroVale($o['numero'], 'OCORRENCIA') . ' aguardando ' . ($o['aguardandoCodigo'] ?? '—');
        $h .= '<a href="/ocorrencias?f=pendentes" class="flex items-start gap-1.5 rounded-lg bg-erro/10 px-2.5 py-1.5 text-[11px] text-erro hover:underline" data-testid="status-viagem">' . icone('triangle-alert', 'mt-0.5 h-3.5 w-3.5 flex-none')
            . '<span>Recebido com divergência · Conferência ' . numeroConferencia($v['confNumero']) . ' (' . ((int) $v['confDiferenca'] > 0 ? '+' : '') . n($v['confDiferenca']) . ')' . e($ocs) . '</span></a>';
    } else {
        $h .= '<div class="flex justify-between gap-2"><dt class="text-t4">Em viagem há</dt><dd class="num whitespace-nowrap font-semibold" style="color:' . COR_VIAGEM[$farol] . '">' . _duracao($horas) . '</dd></div></dl>'
            . '<p class="flex items-center gap-1.5 text-[11px] font-semibold" style="color:' . COR_VIAGEM[$farol] . '" data-testid="status-viagem"><span class="ponto ponto-pulsante" style="background:' . COR_VIAGEM[$farol] . '"></span> Em Viagem / Aguardando Recebimento</p>';
    }
    return $h . '</article>';
}

/** @param array $viagens vales em trânsito (enviosEmTransito) @param array $divergentes vales conferidos com ocorrência pendente */
function kanbanViagens(array $viagens, array $divergentes, string $cdAtual): string
{
    $agora = msDe(agoraUtc());
    $colunas = [
        ['VERDE', 'No prazo', 'até ' . REGRAS_VIAGEM['amareloHoras'] . 'h de viagem'],
        ['AMARELO', 'Atenção', REGRAS_VIAGEM['amareloHoras'] . 'h a ' . REGRAS_VIAGEM['vermelhoHoras'] . 'h de viagem'],
        ['VERMELHO', 'Atrasado', 'SLA de ' . REGRAS_VIAGEM['vermelhoHoras'] . 'h estourado'],
        ['DIVERGENCIA', 'Recebido com divergência', 'aguardando a ocorrência'],
    ];
    $h = '<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="kanban-viagens">';
    foreach ($colunas as [$chave, $titulo, $detalhe]) {
        $itens = $chave === 'DIVERGENCIA' ? $divergentes : array_values(array_filter($viagens, fn($v) => farolViagem(($agora - msDe($v['criadoEm'])) / 3600000) === $chave));
        $cor = $chave === 'DIVERGENCIA' ? '#f43f5e' : COR_VIAGEM[$chave];
        $h .= '<section class="flex min-w-0 flex-col rounded-2xl border border-[var(--groove)] p-3" data-testid="kanban-col-' . $chave . '"><header class="mb-3 flex items-center justify-between gap-2"><span class="flex items-center gap-2">'
            . '<span class="h-3 w-3 rounded-full" style="background:' . $cor . ';box-shadow:0 0 10px ' . $cor . '"></span><span><span class="block text-[12px] font-semibold uppercase tracking-[0.1em] text-t1">' . $titulo . '</span>'
            . '<span class="block text-[10px] text-t4">' . $detalhe . '</span></span></span><span class="num rounded-full bg-[var(--groove)] px-2 py-0.5 text-[12px] font-semibold text-t1">' . count($itens) . '</span></header>';
        if (!$itens) {
            $h .= '<p class="rounded-xl border border-dashed border-[var(--groove)] px-3 py-5 text-center text-[11px] text-t4">Nenhum vale</p>';
        } else {
            $h .= '<div class="max-h-[34rem] space-y-3 overflow-y-auto pr-0.5">';
            foreach ($itens as $v) $h .= _cartaoViagem($v, $cdAtual, $agora, $chave === 'DIVERGENCIA');
            $h .= '</div>';
        }
        $h .= '</section>';
    }
    return $h . '</div>';
}
