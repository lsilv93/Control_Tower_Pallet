<?php
declare(strict_types=1);
/**
 * Torre de Controle (gestão à vista), liberada a todos os usuários (src/app/tv/page.tsx):
 * CDs e Pontos de Cross em tabelas separadas, com farol por unidade. Filtro superior: Visão
 * Geral ou unidades específicas. Em TVs/monitores tudo cabe na altura da tela.
 */
requireUsuario();
View::$titulo = 'Torre de Controle';
View::$layout = 'vazio';
View::$scripts[] = 'tv.js';
$opcoes = unidadesFiltroTV();
$pedidos = array_filter(array_map(fn($c) => mb_strtoupper(trim($c)), explode(',', q('u') ?? '')));
$escolhidas = array_values(array_filter($opcoes, fn($o) => in_array(mb_strtoupper($o['codigo']), $pedidos, true)));
$d = dadosTV($escolhidas ? array_column($escolhidas, 'id') : null);
$versao = versaoTV();
$t = $d['totais'];
$r = REGRAS_FAROL_UNIDADE;
$mostrarCds = !$d['filtrado'] || $d['cds'];
$mostrarCross = !$d['filtrado'] || $d['crosses'];

$FAROL = [
    'VERDE' => ['cor' => 'bg-[#22c55e]', 'fundo' => 'bg-[#22c55e]/10 text-[#22c55e]', 'rotulo' => 'Normal'],
    'AMARELO' => ['cor' => 'bg-[#eab308]', 'fundo' => 'bg-[#eab308]/10 text-[#eab308]', 'rotulo' => 'Atenção'],
    'VERMELHO' => ['cor' => 'bg-[#ef4444]', 'fundo' => 'bg-[#ef4444]/10 text-[#ef4444]', 'rotulo' => 'Crítico'],
];
$luz = fn(string $f) => '<span class="inline-flex items-center gap-2" title="' . $FAROL[$f]['rotulo'] . '"><span class="' . cx('h-4 w-4 flex-none rounded-full shadow-[0_0_12px_currentColor]', $FAROL[$f]['cor'], $f === 'VERMELHO' ? 'animate-pulse' : '') . '" aria-hidden="true"></span><span class="sr-only">' . $FAROL[$f]['rotulo'] . '</span></span>';
$pct = fn(?float $v) => $v === null ? '—' : str_replace('.', ',', preg_replace('/\.0$/', '', number_format($v * 100, 1, '.', ''))) . '%';
$corAcur = fn(?float $v) => $v === null ? 'text-t4' : ($v >= 0.98 ? 'text-lima' : ($v >= 0.95 ? 'text-ouro' : 'text-erro'));
$kpi = fn(string $rot, string $valor, string $det, string $cor, string $ic) => '<section class="card relative overflow-hidden p-4 lg:px-5 lg:py-[1.6vh]">' . icone($ic, "pointer-events-none absolute -bottom-6 -right-4 h-28 w-28 opacity-[0.07] $cor")
    . '<p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-t3 lg:text-[clamp(10px,1.3vh,13px)]">' . e($rot) . '</p>'
    . '<p class="' . cx('num mt-1.5 text-[32px] font-semibold leading-none lg:text-[clamp(26px,5.2vh,60px)]', $cor) . '">' . e($valor) . '</p>'
    . '<p class="mt-1.5 truncate text-[12px] text-t3 lg:text-[clamp(11px,1.4vh,14px)]">' . e($det) . '</p></section>';

$tabela = function (string $titulo, string $ic, array $linhas, bool $cross, string $testid, int $peso) use ($FAROL, $luz, $pct, $corAcur) {
    $max = max(1, ...array_map(fn($l) => $l['total'], $linhas ?: [['total' => 1]]));
    $tb = array_sum(array_column($linhas, 'vazios'));
    $tq = array_sum(array_column($linhas, 'quebrados'));
    $h = '<section class="card flex min-h-0 flex-col p-4 lg:min-h-[150px] lg:basis-0 lg:px-5 lg:py-[1.4vh]" style="flex-grow:' . $peso . '"><div class="mb-2 flex flex-none flex-wrap items-center justify-between gap-3">'
        . '<h2 class="flex items-center gap-2 text-[15px] font-semibold uppercase tracking-[0.12em] text-t1">' . icone($ic, 'h-5 w-5 text-lima') . ' ' . $titulo . ' <span class="text-t4">(' . count($linhas) . ')</span></h2>'
        . '<span class="num text-[13px] text-t2"><span class="text-lima">●</span> ' . n($tb) . ' PBR · <span class="text-ouro">●</span> ' . n($tq) . ' quebrados</span></div>';
    if (!$linhas) return $h . '<p class="poco px-4 py-6 text-center text-[13px] text-t3">Nenhuma unidade nesta seleção.</p></section>';
    $h .= '<div class="flex min-h-0 flex-1 flex-col" data-paginador data-testid="' . $testid . '-area"><div class="min-h-0 flex-1 overflow-x-auto lg:overflow-y-hidden" data-paginador-area>'
        . '<table class="w-full min-w-[980px] text-[14px]" data-testid="' . $testid . '"><thead><tr class="text-left text-[11px] uppercase tracking-[0.12em] text-t4">'
        . '<th class="pb-2 pr-2 font-semibold">Farol</th><th class="pb-2 font-semibold">Unidade</th><th class="pb-2 text-right font-semibold">Pallets PBR</th><th class="pb-2 text-right font-semibold">Quebrados</th>'
        . '<th class="pb-2 text-right font-semibold">Total</th><th class="w-[16%] pb-2 pl-4 font-semibold">Composição</th><th class="pb-2 text-right font-semibold">Em trânsito</th><th class="pb-2 text-right font-semibold">A receber</th>'
        . '<th class="pb-2 text-right font-semibold">Ocorrências</th><th class="pb-2 text-right font-semibold">SLA</th><th class="pb-2 text-right font-semibold">Acuracidade</th><th class="pb-2 pl-4 font-semibold">Situação</th></tr></thead><tbody>';
    foreach ($linhas as $l) {
        $u = $l['unidade'];
        $larg = fn(int $v) => ($v / $max * 100) . '%';
        $h .= '<tr class="' . cx('border-t border-[var(--groove)] align-middle', $l['farol'] === 'VERMELHO' ? 'bg-[#ef4444]/[0.06]' : '') . '"><td class="py-[0.7vh] pr-2">' . $luz($l['farol']) . '</td>'
            . '<td class="py-[0.7vh]"><span class="num text-[15px] font-semibold text-t1">' . e($u['codigo']) . '</span>' . ($u['hub'] ? '<span class="ml-2 rounded-full bg-lima/15 px-2 py-0.5 text-[10px] font-bold text-lima">HUB</span>' : '')
            . '<span class="block max-w-[14rem] truncate text-[11px] text-t4" title="' . e($u['nome']) . '">' . e($cross ? 'Atende: ' . (implode(', ', $l['cdsAtendidos']) ?: '—') : $u['nome']) . '</span></td>'
            . '<td class="num py-[0.7vh] text-right text-[20px] font-semibold text-lima">' . n($l['vazios']) . '</td><td class="num py-[0.7vh] text-right text-[20px] font-semibold text-ouro">' . n($l['quebrados']) . '</td>'
            . '<td class="num py-[0.7vh] text-right text-[16px] font-semibold text-t1">' . n($l['total']) . '</td>'
            . '<td class="py-[0.7vh] pl-4"><div class="flex h-3 w-full min-w-[120px] overflow-hidden rounded-full bg-[var(--groove)]" role="img" aria-label="' . $l['vazios'] . ' Pallets PBR e ' . $l['quebrados'] . ' Pallets Quebrados"><div class="h-full bg-lima" style="width:' . $larg($l['vazios']) . '"></div><div class="h-full bg-ouro" style="width:' . $larg($l['quebrados']) . '"></div></div></td>'
            . '<td class="num py-[0.7vh] text-right text-t2">' . n($l['transito']) . '</td><td class="num py-[0.7vh] text-right text-t2">' . n($l['aReceber']) . '</td>'
            . '<td class="' . cx('num py-[0.7vh] text-right font-semibold', $l['ocorrenciasPendentes'] ? 'text-erro' : 'text-t4') . '">' . n($l['ocorrenciasPendentes']) . '</td>'
            . '<td class="num py-[0.7vh] text-right text-t2">' . ($l['diasTransitoMaisAntigo'] === null ? '—' : $l['diasTransitoMaisAntigo'] . 'd') . '</td>'
            . '<td class="' . cx('num py-[0.7vh] text-right font-semibold', $corAcur($l['acuracidade'])) . '">' . $pct($l['acuracidade']) . '</td><td class="py-[0.7vh] pl-4 text-[12px]">'
            . (!$l['motivos'] ? '<span class="' . cx('rounded-full px-2.5 py-1 text-[11px] font-semibold', $FAROL['VERDE']['fundo']) . '">Normal</span>'
                : '<span class="' . cx('block max-w-[18rem] truncate font-medium', $l['farol'] === 'VERMELHO' ? 'text-[#ef4444]' : 'text-[#eab308]') . '" title="' . e(implode(' · ', $l['motivos'])) . '">' . e(implode(' · ', $l['motivos'])) . '</span>')
            . '</td></tr>';
    }
    return $h . '</tbody></table></div><p class="num hidden h-5 flex-none text-right text-[11px] font-semibold text-t3 lg:block" data-testid="' . $testid . '-pagina"></p></div></section>';
};
$opFiltro = array_map(fn($o) => ['codigo' => $o['codigo'], 'nome' => $o['nome'], 'tipo' => $o['tipo'], 'hub' => $o['hub']], $opcoes);
$sel = array_column($escolhidas, 'codigo');
?>
<main class="flex min-h-dvh flex-col gap-3 p-[14px] lg:h-dvh lg:min-h-0 lg:gap-[1.2vh] lg:overflow-hidden lg:p-[1.6vh]" data-testid="tela-tv">
  <header class="flex flex-none flex-wrap items-center justify-between gap-3">
    <div class="flex min-w-0 items-center gap-3">
      <a href="/" class="btn-icone" title="Voltar ao sistema" aria-label="Voltar ao sistema"><?= icone('arrow-left', 'h-5 w-5') ?></a>
      <span class="fill-lima hidden h-11 w-11 flex-none items-center justify-center rounded-2xl sm:flex"><?= icone('boxes', 'h-6 w-6') ?></span>
      <div class="min-w-0">
        <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-t3">Torre de Controle · Gestão à Vista · Pallets PBR</p>
        <h1 class="text-[clamp(20px,2.2vw,32px)] font-semibold leading-tight text-t1" data-testid="titulo-tv">
          <?= $d['filtrado'] ? 'Visão <span class="text-lima">' . e(implode(' + ', $sel)) . '</span>' : 'Visão Geral · <span class="text-lima">Brasil</span>' ?><span class="ml-3 text-[clamp(12px,1vw,15px)] font-medium text-t3"><?= count($d['cds']) ?> CD(s) · <?= count($d['crosses']) ?> Ponto(s) de Cross</span>
        </h1>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <div class="card-sm flex items-center gap-4 px-4 py-2" data-testid="resumo-farois">
        <?php foreach (['VERMELHO', 'AMARELO', 'VERDE'] as $f): ?><span class="num flex items-center gap-2 text-[18px] font-semibold text-t1"><?= $luz($f) ?> <?= $t['farois'][$f] ?></span><?php endforeach ?>
      </div>
      <div class="flex items-center gap-4 text-right" data-atualizacao-tv="<?= e($versao) ?>">
        <div><p class="num text-[34px] font-semibold leading-none text-t1" data-relogio>--:--</p><p class="text-[11px] text-t3" data-data></p></div>
        <span class="pill bg-lima/10 text-lima" data-status-tv><span class="ponto ponto-pulsante"></span> Ao vivo · --:--:--</span>
      </div>
      <button type="button" class="btn-primary" title="Expandir para tela cheia" aria-pressed="false" data-testid="botao-tela-cheia" data-tela-cheia><?= icone('maximize-2') ?> Tela cheia</button>
    </div>
  </header>

  <div class="flex-none">
    <div class="flex flex-wrap items-center gap-2" data-testid="filtro-tv" data-filtro-tv="<?= e(json_encode(['opcoes' => $opFiltro, 'selecionados' => $sel], JSON_UNESCAPED_UNICODE)) ?>">
      <button type="button" data-visao-geral class="<?= cx('pill gap-1.5 px-3 py-1.5 text-[12px] font-semibold', !$sel ? 'fill-lima' : 'bg-[var(--groove)] text-t2 hover:text-t1') ?>" aria-pressed="<?= !$sel ? 'true' : 'false' ?>" data-testid="filtro-visao-geral"><?= icone('globe-2', 'h-3.5 w-3.5') ?> Visão Geral</button>
      <div class="relative" data-caixa-filtro>
        <button type="button" data-abrir-filtro class="<?= cx('pill gap-1.5 px-3 py-1.5 text-[12px] font-semibold', $sel ? 'fill-lima' : 'bg-[var(--groove)] text-t2 hover:text-t1') ?>" aria-expanded="false" data-testid="filtro-unidades"><?= !$sel ? 'Filtrar unidades' : count($sel) . ' unidade(s)' ?> <?= icone('chevron-down', 'h-3.5 w-3.5') ?></button>
      </div>
      <?php foreach ($sel as $c): ?><button type="button" data-remover="<?= e($c) ?>" class="pill num gap-1 bg-[var(--groove)] px-2.5 py-1 text-[12px] font-semibold text-t1 hover:text-erro" title="Remover <?= e($c) ?> do filtro"><?= e($c) ?> <?= icone('x', 'h-3 w-3') ?></button><?php endforeach ?>
    </div>
  </div>

  <div class="grid flex-none grid-cols-2 gap-3 xl:grid-cols-5 lg:gap-[1.2vh]">
    <?= $kpi($d['filtrado'] ? 'Pallets PBR · seleção' : 'Pallets PBR · Brasil', n($t['bons']), 'CDs ' . n($t['cds']['bons']) . ' · Cross ' . n($t['crosses']['bons']), 'text-lima', 'boxes') ?>
    <?= $kpi($d['filtrado'] ? 'Quebrados · seleção' : 'Pallets Quebrados · Brasil', n($t['quebrados']), 'CDs ' . n($t['cds']['quebrados']) . ' · Cross ' . n($t['crosses']['quebrados']), 'text-ouro', 'hammer') ?>
    <?= $kpi('Em trânsito', n($t['transito']), n($t['valesEmViagem']) . ' vale(s) em viagem · ' . n($t['quebradosAoHub']) . ' quebrados ao Hub', 'text-t1', 'truck') ?>
    <?= $kpi('Ocorrências pendentes', n($t['ocorrenciasPendentes']), n($t['ocorrenciasQuantidade']) . ' pallet(s) em divergência', $t['ocorrenciasPendentes'] ? 'text-erro' : 'text-t1', 'triangle-alert') ?>
    <div class="col-span-2 xl:col-span-1"><?= $kpi('Acuracidade', $pct($t['acuracidade']), 'recebidos ' . n($t['recebidosConferidos']) . ' x enviados ' . n($t['enviadosConferidos']), $corAcur($t['acuracidade']), 'target') ?></div>
  </div>

  <div class="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:gap-[1.2vh]">
    <?= $mostrarCds ? $tabela('Centros de Distribuição', 'building-2', $d['cds'], false, 'tv-cds', max(2, count($d['cds']) + 1)) : '' ?>
    <?= $mostrarCross ? $tabela('Pontos de Cross', 'network', $d['crosses'], true, 'tv-cross', max(2, count($d['crosses']) + 1)) : '' ?>
  </div>

  <p class="flex flex-none flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-t3 lg:text-[clamp(10px,1.3vh,12px)]" data-testid="legenda-farol">
    <span class="font-semibold uppercase tracking-[0.12em] text-t4">Farol</span>
    <span class="flex items-center gap-2"><?= $luz('VERMELHO') ?> trânsito há <?= $r['slaDias']['vermelho'] ?>+ dias, saldo de Cross ≥ <?= $r['saldoCross']['vermelho'] ?>, <?= $r['ocorrencias']['vermelhoQuantidade'] ?>+ ocorrências ou ocorrência há <?= $r['ocorrencias']['vermelhoDias'] ?>+ dias</span>
    <span class="flex items-center gap-2"><?= $luz('AMARELO') ?> trânsito há <?= $r['slaDias']['amarelo'] ?>+ dias, saldo de Cross ≥ <?= $r['saldoCross']['amarelo'] ?> ou ocorrência pendente</span>
    <span class="flex items-center gap-2"><?= $luz('VERDE') ?> dentro do SLA, sem pendências</span>
  </p>
</main>
