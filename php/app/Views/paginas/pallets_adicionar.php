<?php
declare(strict_types=1);
// Compra de Pallets (src/app/(sistema)/pallets/adicionar/page.tsx + FluxoCompra.tsx).
$u = requirePermissao('compras');
View::$titulo = 'Compra de Pallets';
View::$scripts[] = 'telas.js';
$cnpjs = array_values(array_filter(Db::col('SELECT `cnpj` FROM `Fornecedor` WHERE `ativo` = 1')));

echo cabecalho('Compra de Pallets', "Entrada de pallets novos pela leitura do código de barras da NF-e. Destino: estoque de Pallets PBR de {$u['cd']['codigo']}.");
echo saldosEstoques($u['cd']['id'], ['VAZIOS']);

$fluxo = '<div class="space-y-5" data-fluxo-compra="' . e(json_encode(['cnpjs' => $cnpjs])) . '">'
    . '<div><label class="label" for="leitura">Código de barras da NF-e (chave de acesso)</label>'
    . '<form class="flex flex-wrap gap-3" data-leitura-nfe><div class="relative min-w-[16rem] flex-1">' . icone('scan-barcode', 'pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-t3')
    . '<input id="leitura" name="leitura" class="input num !pl-12 tracking-wider" placeholder="Aponte o leitor para o código de barras do DANFE" autocomplete="off" inputmode="numeric" autofocus></div>'
    . '<button type="submit" class="btn-primary" disabled>Identificar</button></form>'
    . '<div class="mt-3 flex flex-wrap gap-2">'
    . '<button type="button" class="btn-secondary btn-sm" data-simular="cadastrado"' . ($cnpjs ? '' : ' disabled') . '>' . icone('sparkles', 'h-3.5 w-3.5') . ' Simular leitura (fornecedor cadastrado)</button>'
    . '<button type="button" class="btn-secondary btn-sm" data-simular="novo">' . icone('sparkles', 'h-3.5 w-3.5') . ' Simular leitura (fornecedor novo)</button>'
    . '<button type="button" class="btn-secondary btn-sm" data-camera hidden>' . icone('camera', 'h-3.5 w-3.5') . ' Ler com a câmera</button></div></div>'
    . '<div data-erro hidden></div><div data-nf hidden></div><div data-ultima hidden></div></div>'
    . modeloFornecedorRapido();
echo painel($fluxo, '<span class="flex items-center gap-3">Compra ' . fluxoContas('COMPRA', 'VAZIOS') . '</span>');
echo '<div class="mt-6">' . ultimasMovimentacoes($u['cd']['id'], ['COMPRA'], 'Últimas compras') . '</div>';
