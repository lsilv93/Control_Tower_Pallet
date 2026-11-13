<?php
declare(strict_types=1);
// Componentes visuais compartilhados (tradução de src/components/ui.tsx, Cadastro.tsx, FormAcao.tsx).
// Funções que devolvem HTML; as classes CSS são idênticas às do sistema original.

/** Ícone SVG (lucide) com as mesmas classes/atributos do lucide-react. */
function icone(string $nome, string $classe = 'h-4 w-4', array $attrs = []): string
{
    static $icones = null;
    $icones ??= require __DIR__ . '/../Lib/icones_dados.php';
    $extra = '';
    foreach ($attrs as $k => $v) $extra .= ' ' . e($k) . '="' . e($v) . '"';
    if (!isset($attrs['aria-label']) && !isset($attrs['aria-hidden'])) $extra .= ' aria-hidden="true"';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="'
        . e(cx('lucide', "lucide-$nome", $classe)) . '"' . $extra . '>' . ($icones[$nome] ?? '') . '</svg>';
}

function cabecalho(string $titulo, ?string $descricao = null, string $filhos = ''): string
{
    return '<div class="mb-7 flex flex-wrap items-end justify-between gap-4"><div class="min-w-0">'
        . '<h1 class="text-[22px] font-semibold tracking-tight text-t1">' . e($titulo) . '</h1>'
        . ($descricao ? '<p class="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-t3">' . e($descricao) . '</p>' : '')
        . '</div>' . ($filhos !== '' ? '<div class="flex flex-wrap items-center gap-3">' . $filhos . '</div>' : '') . '</div>';
}

/** Card saliente. $titulo e $acoes são HTML. */
function painel(string $conteudo, string $titulo = '', string $acoes = '', string $classe = '', array $attrs = []): string
{
    $extra = '';
    foreach ($attrs as $k => $v) $extra .= ' ' . e($k) . '="' . e($v) . '"';
    $topo = ($titulo !== '' || $acoes !== '')
        ? '<div class="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 class="flex items-center gap-2 text-[13px] font-semibold text-t1">' . $titulo . '</h2>' . $acoes . '</div>'
        : '';
    return '<section class="' . e(cx('card min-w-0 p-5 sm:p-[22px]', $classe)) . '"' . $extra . '>' . $topo . $conteudo . '</section>';
}

/** Título de painel com ícone. */
function tituloIcone(string $icone, string $texto, string $classeIcone = 'h-4 w-4 text-lima'): string
{
    return '<span class="flex items-center gap-2">' . icone($icone, $classeIcone) . ' ' . $texto . '</span>';
}

function tabela(string $conteudo, string $classe = ''): string
{
    return '<div class="' . e(cx('poco overflow-x-auto', $classe)) . '">' . $conteudo . '</div>';
}

const CORES_INDICADOR = ['lima' => 'text-lima', 'ouro' => 'text-ouro', 'erro' => 'text-erro', 'neutro' => 'text-t2'];

/** KPI. $icone = HTML do ícone. $detalhe = HTML. */
function indicador(string $titulo, string $valor, string $detalhe = '', string $icone = '', string $cor = 'lima', bool $destaque = false, array $attrs = []): string
{
    $extra = '';
    foreach ($attrs as $k => $v) $extra .= ' ' . e($k) . '="' . e($v) . '"';
    $h = '<div class="card-sm relative flex min-w-0 items-start gap-4 overflow-hidden p-4 sm:p-5"' . $extra . '>';
    if ($destaque && $icone) $h .= '<div class="pointer-events-none absolute -bottom-6 -right-4 text-lima opacity-[0.07] [&_svg]:h-32 [&_svg]:w-32">' . $icone . '</div>';
    if ($icone) $h .= '<div class="' . e(cx('poco hidden h-11 w-11 flex-none items-center justify-center !rounded-2xl sm:flex', CORES_INDICADOR[$cor])) . '">' . $icone . '</div>';
    $h .= '<div class="relative min-w-0"><p class="label !mb-1">' . e($titulo) . '</p>';
    $h .= '<p class="' . e(cx('num font-semibold leading-tight', $destaque ? 'text-[32px] text-lima sm:text-[40px]' : 'text-[22px] text-t1 sm:text-[26px]')) . '">' . e($valor) . '</p>';
    if ($detalhe !== '') $h .= '<p class="mt-1 text-[11px] leading-snug text-t3">' . $detalhe . '</p>';
    return $h . '</div></div>';
}

const ESTILO_FAROL = [
    'VERMELHO' => ['cor' => 'text-erro', 'fundo' => 'bg-erro/10', 'rotulo' => 'Crítico'],
    'AMARELO' => ['cor' => 'text-ouro', 'fundo' => 'bg-ouro/10', 'rotulo' => 'Atenção'],
    'VERDE' => ['cor' => 'text-lima', 'fundo' => 'bg-lima/10', 'rotulo' => 'Normal'],
];

function ponto(string $farol, bool $pulsante = false): string
{
    return '<span class="' . e(cx('ponto', ESTILO_FAROL[$farol]['cor'], $pulsante ? 'ponto-pulsante' : '')) . '" aria-hidden="true"></span>';
}

function farolBadge(string $farol): string
{
    $s = ESTILO_FAROL[$farol];
    return '<span class="' . e(cx('pill', $s['cor'], $s['fundo'])) . '"><span class="' . e(cx('ponto', $farol === 'VERMELHO' ? 'ponto-pulsante' : '')) . '"'
        . ($farol === 'VERMELHO' ? ' style="animation-name:pulso-erro"' : '') . '></span>' . e($s['rotulo']) . '</span>';
}

/** @param array<array{0:string,1:string}> $itens */
function legendaFarol(array $itens): string
{
    $h = '<p class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-t3">';
    foreach ($itens as [$f, $t]) $h .= '<span class="inline-flex items-center gap-1.5">' . ponto($f) . ' ' . e($t) . '</span>';
    return $h . '</p>';
}

const ESTILO_STATUS = [
    'PENDENTE' => 'text-ouro bg-ouro/10',
    'AGENDADO' => 'text-t2 bg-t2/10',
    'FINALIZADO' => 'text-lima bg-lima/10',
    'CANCELADO' => 'text-erro bg-erro/10',
    'ABERTA' => 'text-lima bg-lima/10',
    'VALIDADA' => 'text-lima bg-lima/10',
    'CANCELADA' => 'text-t4 bg-t4/10',
];

function statusBadge(string $status, string $rotulo): string
{
    return '<span class="' . e(cx('pill', ESTILO_STATUS[$status] ?? 'text-t2')) . '"><span class="ponto"></span>' . e($rotulo) . '</span>';
}

function vazio(string $html): string
{
    return '<p class="poco px-5 py-8 text-center text-[12px] text-t3">' . $html . '</p>';
}

function delta(int $valor): string
{
    if ($valor === 0) return '<span class="num text-t4">0</span>';
    return '<span class="' . e(cx('num font-semibold', $valor > 0 ? 'text-lima' : 'text-erro')) . '">' . ($valor > 0 ? "+$valor" : (string) $valor) . '</span>';
}

/** Abas de navegação. @param array<array{href:string, rotulo:string, icone?:string}> $itens */
function abas(array $itens, string $ativo): string
{
    $h = '<nav class="abas mb-6">';
    foreach ($itens as $i) {
        $a = $i['href'] === $ativo;
        $h .= '<a href="' . e($i['href']) . '" class="' . e(cx('aba', $a ? 'aba-ativa' : '')) . '"' . ($a ? ' aria-current="page"' : '') . '>' . ($i['icone'] ?? '') . e($i['rotulo']) . '</a>';
    }
    return $h . '</nav>';
}

/** Abas ligadas à rota atual (prefixo). */
function abasRota(array $itens): string
{
    $caminho = caminhoAtual();
    $h = '<nav class="abas mb-6">';
    foreach ($itens as $i) {
        $a = str_starts_with($caminho, $i['href']);
        $h .= '<a href="' . e($i['href']) . '" class="' . e(cx('aba', $a ? 'aba-ativa' : '')) . '"' . ($a ? ' aria-current="page"' : '') . '>' . e($i['rotulo']) . '</a>';
    }
    return $h . '</nav>';
}

/** Campo de texto com rótulo (id campo-{nome}). Atributos extras em $attrs. */
function campo(string $nome, string $rotulo, ?string $valor = null, bool $obrigatorio = false, string $classe = '', array $attrs = []): string
{
    $extra = '';
    foreach ($attrs as $k => $v) {
        if ($v === false || $v === null) continue;
        $extra .= $v === true ? ' ' . e($k) : ' ' . e($k) . '="' . e($v) . '"';
    }
    return '<div' . ($classe ? ' class="' . e($classe) . '"' : '') . '><label class="label" for="campo-' . e($nome) . '">' . e($rotulo) . ($obrigatorio ? ' *' : '') . '</label>'
        . '<input id="campo-' . e($nome) . '" name="' . e($nome) . '" value="' . e($valor ?? '') . '"' . ($obrigatorio ? ' required' : '') . ' class="input"' . $extra . '></div>';
}

function bannerOk(?string $mensagem): string
{
    if (!$mensagem) return '';
    return '<div role="status" class="poco mb-5 flex items-center gap-2.5 px-5 py-4 text-[12px] font-medium text-lima"><span class="ponto"></span> ' . e($mensagem) . '</div>';
}

function situacao(bool $ativo): string
{
    return statusBadge($ativo ? 'FINALIZADO' : 'CANCELADA', $ativo ? 'Ativo' : 'Inativo');
}

/** Ações da linha: editar (via ?editar=id) e ativar/inativar. */
function acoesLinha(string $tipo, string $id, bool $ativo, string $caminho, bool $podeInativar = true): string
{
    $h = '<div class="flex items-center justify-end gap-2"><a href="' . e("$caminho?editar=$id") . '" class="btn-secondary btn-sm">' . icone('pencil', 'h-3.5 w-3.5') . ' Editar</a>';
    if ($podeInativar) {
        $h .= formAcao('cadastros/alternar-ativo', '<input type="hidden" name="tipo" value="' . e($tipo) . '"><input type="hidden" name="id" value="' . e($id) . '">', [
            'botao' => $ativo ? 'Inativar' : 'Ativar',
            'classeBotao' => $ativo ? 'btn-danger btn-sm' : 'btn-secondary btn-sm',
            'classe' => 'inline',
        ]);
    }
    return $h . '</div>';
}

function rodapeForm(bool $editando, string $caminho): string
{
    return $editando ? '<a href="' . e($caminho) . '" class="btn-secondary">Cancelar edição</a>' : '';
}

/**
 * Formulário ligado a uma ação do servidor (POST /acao/{nome}, via fetch em app.js). Exibe a
 * mensagem de retorno (role=status) e limpa os campos após sucesso quando `limpar` = true.
 * Opções: botao, classeBotao, confirmar, limpar (padrão true), classe (padrão "space-y-4"),
 * attrs (atributos extras do <form>), textoEnviando.
 */
function formAcao(string $acao, string $conteudo, array $o = []): string
{
    $attrs = ['data-acao' => "/acao/$acao", 'class' => $o['classe'] ?? 'space-y-4', 'novalidate' => null];
    if (($o['limpar'] ?? true) === true) $attrs['data-limpar'] = '1';
    if (!empty($o['confirmar'])) $attrs['data-confirmar'] = $o['confirmar'];
    unset($attrs['novalidate']);
    foreach ($o['attrs'] ?? [] as $k => $v) $attrs[$k] = $v;
    $a = '';
    foreach ($attrs as $k => $v) $a .= $v === true ? ' ' . e($k) : ' ' . e($k) . '="' . e($v) . '"';
    $botao = isset($o['botao'])
        ? '<button type="submit" class="' . e($o['classeBotao'] ?? 'btn-primary') . '" data-enviando="' . e($o['textoEnviando'] ?? 'Salvando...') . '">' . $o['botao'] . '</button>'
        : '';
    return "<form method=\"post\" action=\"/acao/" . e($acao) . "\"$a>" . $conteudo . '<div data-mensagem hidden></div>' . $botao . '</form>';
}

/** Mensagem de retorno de uma ação (mesmo HTML que o JavaScript gera). */
function mensagemEstado(?array $estado): string
{
    if (!$estado) return '';
    $ok = $estado['ok'];
    return '<div role="status" class="' . e(cx('flex items-start gap-2.5 px-4 py-3 text-[12px] font-medium', $ok ? 'poco text-lima' : 'poco-erro text-erro-claro')) . '">'
        . '<span class="' . e(cx('ponto mt-[5px]', $ok ? 'text-lima' : 'text-erro')) . '"></span><span>' . e($estado['mensagem']) . '</span></div>';
}

/** Opções de <select>. @param array<array{0:string,1:string}>|array<string,string> $opcoes */
function opcoes(array $opcoes, ?string $selecionado = null, ?string $vazio = null): string
{
    $h = $vazio !== null ? '<option value="">' . e($vazio) . '</option>' : '';
    foreach ($opcoes as $k => $v) {
        [$valor, $rotulo] = is_array($v) ? $v : [(string) $k, $v];
        $h .= '<option value="' . e($valor) . '"' . ((string) $valor === (string) $selecionado ? ' selected' : '') . '>' . e($rotulo) . '</option>';
    }
    return $h;
}

/** Atributos HTML a partir de array (true = booleano, false/null = omitido). */
function attrs(array $a): string
{
    $h = '';
    foreach ($a as $k => $v) {
        if ($v === false || $v === null) continue;
        $h .= $v === true ? ' ' . e($k) : ' ' . e($k) . '="' . e($v) . '"';
    }
    return $h;
}
