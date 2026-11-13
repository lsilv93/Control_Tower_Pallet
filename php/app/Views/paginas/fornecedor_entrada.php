<?php
declare(strict_types=1);
// Recebimento Pallet Fornecedor (src/app/(sistema)/fornecedor/entrada/page.tsx + FormRecebimento.tsx).
$usuario = requireModuloFornecedor();
View::$titulo = 'Recebimento Pallet Fornecedor';
View::$scripts[] = 'telas.js';
$transportadoras = Db::all('SELECT `id`, `nome` FROM `Transportadora` WHERE `ativo` = 1 ORDER BY `nome`');
$fornecedores = Db::all('SELECT `id`, `sigla`, `nome` FROM `Fornecedor` WHERE `ativo` = 1 ORDER BY `nome`');

echo cabecalho('Recebimento Pallet Fornecedor', "Bipe o código de barras da NF-e (ou use a opção Sem Nota Fiscal). Gera o Vale-Pallet de Fornecedor e sobe o saldo de {$usuario['cd']['codigo']} com o fornecedor (pendente de devolução/pagamento). Os Pallets PBR só saem na baixa/pagamento.");
echo saldosEstoques($usuario['cd']['id']);

$opF = '<option value="" disabled selected>Selecione...</option>';
foreach ($fornecedores as $f) $opF .= '<option value="' . e($f['id']) . '">' . e(($f['sigla'] ? "{$f['sigla']} - " : '') . $f['nome']) . '</option>';
$opT = '<option value="" disabled selected>Selecione...</option>';
foreach ($transportadoras as $t) $opT .= '<option value="' . e($t['id']) . '">' . e($t['nome']) . '</option>';

$c = '<input type="hidden" name="modo" value="NF">'
    . '<div class="flex flex-wrap items-center justify-between gap-3"><p class="label !mb-0" data-titulo-modo>Leitura da nota fiscal</p>'
    . '<label class="pill cursor-pointer select-none !px-4 !py-2 text-[11px] text-t2" data-rotulo-sem-nf><input type="checkbox" data-sem-nf class="mr-1">' . icone('file-x-2', 'h-3.5 w-3.5') . ' Sem Nota Fiscal</label></div>'
    // Com NF
    . '<div class="space-y-4" data-bloco-nf><div><label class="label" for="chave">Código de barras da NF-e (chave de acesso · 44 dígitos)</label>'
    . '<div class="flex flex-wrap gap-3"><div class="relative min-w-[16rem] flex-1">' . icone('scan-barcode', 'pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-lima')
    . '<input id="chave" name="chave" class="input num !min-h-[56px] !pl-14 !text-[16px] tracking-[0.12em]" placeholder="Bipe ou digite a chave e tecle Enter" autocomplete="off" inputmode="numeric" aria-describedby="chave-ajuda" autofocus></div>'
    . '<button type="button" class="btn-secondary" data-ler-outra hidden>' . icone('rotate-ccw') . ' Ler outra NF</button>'
    . '<button type="button" class="btn-primary" data-validar disabled>Validar</button></div>'
    . '<p id="chave-ajuda" class="mt-1.5 text-[11px] text-t4">O leitor envia os 44 dígitos e o Enter automaticamente.</p></div>'
    . '<div data-erro hidden></div><div data-nf hidden></div></div>'
    // Sem NF
    . '<div class="space-y-3" data-bloco-sem-nf hidden><p class="poco-ouro px-4 py-3 text-[12px] text-ouro">Opção <strong>Sem Nota Fiscal</strong>: o vale será impresso com &quot;SEM NOTA FISCAL&quot; e uma observação de destaque.</p>'
    . '<div class="md:w-1/2"><label class="label" for="fornecedorId">Fornecedor *</label><select id="fornecedorId" name="fornecedorId" class="input" disabled>' . $opF . '</select>'
    . (!$fornecedores ? '<p class="mt-1 text-[11px] text-erro">Nenhum fornecedor ativo cadastrado. Cadastre em Cadastros → Fornecedores.</p>' : '') . '</div></div>'
    // Dados operacionais
    . '<div><p class="label">Dados do recebimento</p><div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">'
    . '<div><label class="label" for="quantidade">Quantidade de pallets *</label><input id="quantidade" name="quantidade" type="number" min="1" step="1" class="input" required></div>'
    . '<div><label class="label" for="conferente">Conferente *</label><input id="conferente" name="conferente" class="input" required minlength="2" maxlength="120" value="' . e($usuario['nome']) . '"></div>'
    . '<div><label class="label" for="transportadoraId">Transportadora *</label><select id="transportadoraId" name="transportadoraId" class="input" required>' . $opT . '</select></div>'
    . inputPlaca('Placa do veículo', true)
    . '<div class="md:col-span-2 xl:col-span-4"><label class="label" for="observacao">Observações</label><textarea id="observacao" name="observacao" rows="2" class="input" maxlength="500"></textarea></div></div></div>';

$form = formAcao('fornecedor/registrar-entrada', $c, [
    'botao' => icone('circle-check') . ' Salvar e gerar Vale-Pallet', 'textoEnviando' => 'Gerando vale...', 'limpar' => false, 'classe' => 'space-y-6',
    'attrs' => ['data-recebimento-fornecedor' => '1'],
]);
echo painel($form . modeloFornecedorRapido(), 'Recebimento pallet fornecedor');
echo '<div class="mt-6">' . ultimasMovimentacoes($usuario['cd']['id'], ['RECEBIMENTO_FORNECEDOR'], 'Últimos recebimentos de fornecedor') . '</div>';
