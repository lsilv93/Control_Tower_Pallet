<?php
declare(strict_types=1);
// Vale-Pallet A4 em 2 vias com código de barras (src/app/imprimir/vale/[id]/page.tsx).
$u = requireUsuario();
View::$titulo = 'Vale-Pallet';
View::$layout = 'vazio';
$vale = carregarValeDoc($params['id']);
if (!$vale || !podeVerVale($u, $vale)) naoEncontrado();
$doc = documentoVale($vale);
$barras = codigo128Svg($doc['codigo']);
$voltar = $vale['tipo'] === 'FORNECEDOR' ? '/fornecedor/entrada' : ($vale['tipo'] === 'ENVIO' ? ($vale['cdId'] === ($u['cd']['id'] ?? null) ? '/envio' : '/recebimento') : '/ocorrencias');
$cancelado = $vale['status'] === 'CANCELADO';
$SPAN = [1 => 'col-span-1', 2 => 'col-span-2', 3 => 'col-span-3', 4 => 'col-span-4'];

$via = function (string $nomeVia) use ($doc, $barras, $vale, $cancelado, $SPAN): string {
    $h = '<section class="via relative flex flex-col px-[12mm] py-[7mm]">';
    if ($cancelado) $h .= '<div class="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true"><span class="-rotate-[18deg] border-[3px] border-red-700 px-6 py-1 text-[44px] font-black tracking-[0.2em] text-red-700 opacity-40">CANCELADO</span></div>';
    $h .= '<p class="mb-2 border-2 border-slate-900 py-1 text-center text-[12px] font-extrabold uppercase tracking-[0.3em]">' . e($nomeVia) . '</p>'
        . '<header class="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-2"><div class="min-w-0">'
        . '<h1 class="text-xl font-extrabold tracking-tight">' . e($doc['titulo']) . '</h1><p class="text-[10px] text-slate-600">' . e($doc['subtitulo']) . '</p>'
        . '<div class="mt-1.5 text-[9.5px] leading-snug"><p class="text-[8px] font-semibold uppercase tracking-wide text-slate-500" data-testid="emitente-rotulo">' . e($doc['emitente']['rotulo']) . '</p>'
        . '<p><strong>' . e($doc['emitente']['razaoSocial']) . '</strong> · CNPJ ' . e($doc['emitente']['cnpj']) . '</p><p data-testid="emitente-endereco">' . e($doc['emitente']['endereco']) . '</p></div></div>'
        . '<div class="flex flex-none flex-col items-end text-right"><div class="barras mt-1 h-[12mm] w-[58mm]">' . $barras . '</div>'
        . '<p class="mt-0.5 font-mono text-[15px] font-extrabold tracking-[0.2em]">' . e($doc['codigo']) . '</p></div></header>'
        . '<div class="mt-3 grid grid-cols-4 gap-0">';
    foreach (array_merge(...$doc['linhas']) as $c) {
        $h .= '<div class="border border-slate-400 px-3 py-1.5 ' . $SPAN[$c['colunas']] . '"><p class="text-[9px] font-semibold uppercase tracking-wide text-slate-500">' . e($c['rotulo']) . '</p>'
            . '<p class="truncate whitespace-nowrap text-sm font-semibold">' . e($c['valor']) . '</p></div>';
    }
    $h .= '</div><div class="mt-3 flex items-center justify-between border-2 border-slate-900 px-4 py-2"><p class="text-sm font-semibold uppercase">' . e($doc['rotuloQuantidade']) . '</p>'
        . '<p class="text-3xl font-extrabold tabular-nums">' . n($vale['quantidade']) . '</p></div>';
    if ($doc['destaque']) $h .= '<div class="mt-2 border-2 border-slate-900 px-3 py-1.5"><p class="text-[11px] font-extrabold uppercase">' . e($doc['destaque']['titulo']) . '</p><p class="text-[10px]">' . e($doc['destaque']['texto']) . '</p></div>';
    if ($vale['observacao']) $h .= '<p class="mt-2 line-clamp-2 text-xs"><strong>Obs.:</strong> ' . e($vale['observacao']) . '</p>';
    $h .= '<p class="mt-2 text-[10px] leading-snug text-slate-600">' . e($doc['declaracao']) . '</p>'
        . '<div class="mt-auto grid grid-cols-2 gap-10 pt-6 text-center text-[10px]"><div>' . ($doc['nomeAssinatura'] ? '<p class="mb-0.5 text-[11px] font-bold">' . e($doc['nomeAssinatura']) . '</p>' : '')
        . '<div class="border-t border-slate-900 pt-1">' . e($doc['assinaturas'][0]) . '</div></div><div class="self-end border-t border-slate-900 pt-1">' . e($doc['assinaturas'][1]) . '</div></div></section>';
    return $h;
};
?>
<div class="min-h-screen bg-fundo px-[14px] py-6 print:bg-white print:p-0">
  <style>
    @page { size: A4 portrait; margin: 0; }
    .folha { width: 210mm; height: 297mm; }
    .via { height: 148.5mm; box-sizing: border-box; }
    .barras svg { width: 100%; height: 100%; display: block; }
    @media print { .nao-imprimir { display: none !important; } body { background: #fff; } }
  </style>
  <div class="nao-imprimir card mx-auto mb-6 flex w-[210mm] max-w-full flex-wrap items-center justify-between gap-3 p-4">
    <a href="<?= e($voltar) ?>" class="btn-secondary"><?= icone('arrow-left') ?> Voltar</a>
    <p class="text-[12px] text-t3"><strong class="<?= $vale['tipo'] === 'OCORRENCIA' ? 'num text-erro' : 'num text-lima' ?>"><?= e($doc['codigo']) ?></strong> · <?= e(mb_strtolower($doc['titulo'])) ?> · A4 em 2 vias</p>
    <button type="button" class="btn-primary" data-imprimir<?= q('auto') === '1' ? ' data-auto' : '' ?>><?= icone('printer') ?> Imprimir</button>
  </div>
  <div class="folha relative mx-auto overflow-hidden rounded-[6px] bg-white text-slate-900 shadow-[12px_12px_26px_rgba(0,4,8,.62)] print:rounded-none print:shadow-none">
    <?= $via($doc['vias'][0]) ?>
    <div class="absolute inset-x-0 top-[148.5mm] h-0 border-t-2 border-dashed border-slate-400">
      <span class="absolute -top-2.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 bg-white px-2 text-[10px] text-slate-500"><?= icone('scissors', 'h-3 w-3') ?> recorte aqui</span>
    </div>
    <?= $via($doc['vias'][1]) ?>
  </div>
</div>
