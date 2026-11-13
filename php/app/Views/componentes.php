<?php
declare(strict_types=1);
// Componentes de cadastro (CamposPadrao, CamposEndereco, CamposPermissao, PaginaUnidades e o
// cabeçalho/abas dos Cadastros), com o mesmo HTML/classes do sistema original.

/**
 * Campos padronizados (Fornecedor, CD e Ponto de Cross): obrigatórios só SIGLA (se
 * $campoSigla) e NOME; CNPJ (máscara + dígitos), contato, telefone e e-mail opcionais.
 */
function camposPadrao(?array $valores = null, string $rotuloNome = 'Nome', string $prefixo = 'campo', ?string $cnpjFixo = null, ?string $campoSigla = null, ?string $exemploSigla = null): string
{
    $id = fn(string $n) => "$prefixo-$n";
    $v = fn(string $k) => e($valores[$k] ?? '');
    $h = '';
    if ($campoSigla) {
        $h .= '<div><label class="label" for="' . $id('sigla') . '">Sigla *</label><input id="' . $id('sigla') . '" name="' . e($campoSigla) . '" class="input uppercase" required minlength="2" maxlength="20" value="' . $v('sigla') . '"' . ($exemploSigla ? ' placeholder="' . e($exemploSigla) . '"' : '') . ' autocomplete="off"></div>';
    }
    $h .= '<div><label class="label" for="' . $id('nome') . '">' . e($rotuloNome) . ' *</label><input id="' . $id('nome') . '" name="nome" class="input" required minlength="2" maxlength="200" value="' . $v('nome') . '"></div>';
    if ($cnpjFixo) {
        $h .= '<div><input type="hidden" name="cnpj" value="' . e($cnpjFixo) . '"><span class="label">CNPJ</span><p class="input num flex items-center opacity-80">' . e(formatarCnpj($cnpjFixo)) . '</p></div>';
    } else {
        $h .= '<div><label class="label" for="' . $id('cnpj') . '">CNPJ</label><input id="' . $id('cnpj') . '" name="cnpj" class="input num" inputmode="text" placeholder="00.000.000/0000-00" autocomplete="off" data-mascara="cnpj" value="' . e(!empty($valores['cnpj']) ? formatarCnpj($valores['cnpj']) : '') . '"></div>';
    }
    $h .= '<div><label class="label" for="' . $id('contato') . '">Contato responsável</label><input id="' . $id('contato') . '" name="contato" class="input" maxlength="120" value="' . $v('contato') . '"></div>';
    $h .= '<div class="grid gap-4 sm:grid-cols-2"><div><label class="label" for="' . $id('telefone') . '">Telefone</label><input id="' . $id('telefone') . '" name="telefone" type="tel" class="input num" placeholder="(00) 00000-0000" data-mascara="telefone" value="' . $v('telefone') . '"></div>'
        . '<div><label class="label" for="' . $id('email') . '">E-mail</label><input id="' . $id('email') . '" name="email" type="email" class="input" maxlength="160" value="' . $v('email') . '"></div></div>';
    return $h;
}

/** Endereço da unidade: Endereço, Cidade, Estado (UF) e CEP com máscara. */
function camposEndereco(?array $valores = null, bool $obrigatorio = true): string
{
    $ast = $obrigatorio ? ' *' : '';
    $req = $obrigatorio ? ' required' : '';
    $ufs = '<option value="" disabled' . (empty($valores['uf']) ? ' selected' : '') . '>UF</option>';
    foreach (UFS as $uf) $ufs .= '<option value="' . $uf . '"' . (($valores['uf'] ?? '') === $uf ? ' selected' : '') . ">$uf</option>";
    return '<fieldset class="space-y-4" data-testid="campos-endereco">'
        . '<div><label class="label" for="campo-endereco">Endereço' . $ast . '</label><input id="campo-endereco" name="endereco" class="input"' . $req . ' minlength="3" maxlength="200" value="' . e($valores['endereco'] ?? '') . '" placeholder="Rua, número, complemento, bairro"></div>'
        . '<div class="grid grid-cols-[1fr_5.5rem] gap-4"><div><label class="label" for="campo-cidade">Cidade' . $ast . '</label><input id="campo-cidade" name="cidade" class="input"' . $req . ' minlength="2" maxlength="120" value="' . e($valores['cidade'] ?? '') . '"></div>'
        . '<div><label class="label" for="campo-uf">Estado' . $ast . '</label><select id="campo-uf" name="uf" class="input"' . $req . '>' . $ufs . '</select></div></div>'
        . '<div class="sm:w-1/2"><label class="label" for="campo-cep">CEP' . $ast . '</label><input id="campo-cep" name="cep" class="input num" inputmode="numeric"' . $req . ' pattern="\d{5}-\d{3}" title="CEP no formato 00000-000" placeholder="00000-000" data-mascara="cep" value="' . e(!empty($valores['cep']) ? mascaraCep($valores['cep']) : '') . '"></div>'
        . '</fieldset>';
}

/** Perfil + permissões granulares (MASTER/ADMIN: caixas travadas; OPERADOR: tela a tela). */
function camposPermissao(string $perfilInicial, array $permissoesIniciais, bool $podeMaster): string
{
    $total = $perfilInicial !== 'OPERADOR';
    $h = '<div data-permissoes><div><label class="label" for="perfil">Perfil de acesso *</label><select id="perfil" name="perfil" class="input">'
        . '<option value="OPERADOR"' . ($perfilInicial === 'OPERADOR' ? ' selected' : '') . '>Operador (permissões por tela)</option>'
        . '<option value="ADMIN"' . ($perfilInicial === 'ADMIN' ? ' selected' : '') . '>Administrador (todas as telas, visão Nível Brasil)</option>'
        . ($podeMaster || $perfilInicial === 'MASTER' ? '<option value="MASTER"' . ($perfilInicial === 'MASTER' ? ' selected' : '') . '>Master (tudo + configurações das unidades)</option>' : '')
        . '</select></div>';
    $h .= '<fieldset class="poco mt-4 p-4"><div class="mb-3 flex flex-wrap items-center justify-between gap-2"><legend class="label !mb-0">Permissões por tela / funcionalidade</legend>'
        . '<span class="flex gap-2" data-acoes-permissao' . ($total ? ' hidden' : '') . '><button type="button" class="text-[11px] font-semibold text-lima hover:underline" data-marcar-todas>Marcar todas</button>'
        . '<button type="button" class="text-[11px] font-semibold text-t3 hover:underline" data-limpar-todas>Limpar</button></span></div>'
        . '<p class="mb-3 text-[11px] text-t3" data-aviso-total' . ($total ? '' : ' hidden') . '>' . ($perfilInicial === 'MASTER'
            ? 'Master tem acesso a todas as telas, inclusive as configurações das unidades (Hub e módulo de fornecedores).'
            : 'Administrador tem acesso a todas as telas, inclusive inclusão e remoção manual de saldo.') . '</p><div class="grid gap-2">';
    foreach (PERMISSOES as $chave => $rotulo) {
        $marcada = $total || in_array($chave, $permissoesIniciais, true);
        $h .= '<label class="' . cx('flex items-center gap-3 text-[12px]', $total ? 'text-t4' : 'cursor-pointer text-t2') . '"><input type="checkbox" name="permissoes" value="' . $chave . '"'
            . ($marcada ? ' checked' : '') . ($total ? ' disabled' : '') . ' data-marcada="' . (in_array($chave, $permissoesIniciais, true) ? '1' : '0') . '"> ' . e($rotulo) . '</label>';
    }
    return $h . '</div></fieldset></div>';
}

/** Cabeçalho e abas dos Cadastros ((sistema)/cadastros/layout.tsx). */
function cabecalhoCadastros(array $usuario): string
{
    $itens = [];
    if (tem($usuario, 'cadastros')) {
        $itens[] = ['href' => '/cadastros/transportadoras', 'rotulo' => 'Transportadoras'];
        $itens[] = ['href' => '/cadastros/fornecedores', 'rotulo' => 'Fornecedores'];
    }
    if (tem($usuario, 'cds')) {
        $itens[] = ['href' => '/cadastros/cds', 'rotulo' => 'Centros de Distribuição'];
        $itens[] = ['href' => '/cadastros/cross', 'rotulo' => 'Pontos de Cross'];
    }
    if (ehAdmin($usuario)) $itens[] = ['href' => '/cadastros/usuarios', 'rotulo' => 'Usuários e Permissões'];
    return cabecalho('Cadastros', 'Transportadoras, fornecedores, CDs, Pontos de Cross e usuários (com os CDs em que operam). Toda alteração é auditada.') . abasRota($itens);
}

const CONTA_CURTO = [
    'VAZIOS' => 'PBR', 'QUEBRADOS' => 'Quebrados', 'TRANSITO' => 'Trânsito', 'OCORRENCIA' => 'Ocorrência', 'ENVIADO' => 'Enviado', 'RECEBIDO' => 'Recebido',
    'SOBRA' => 'Sobra', 'PERDA' => 'Perda', 'DESCARTE' => 'Descarte', 'AJUSTE' => 'Ajuste', 'COMPRA' => 'Compra', 'FORNECEDOR' => 'Fornecedor', 'CARGA' => 'Carga', 'REMESSA_CROSS' => 'Remessa Cross',
];
const CONTA_COR = [
    'VAZIOS' => 'text-lima bg-lima/10', 'QUEBRADOS' => 'text-ouro bg-ouro/10', 'TRANSITO' => 'text-t1 bg-t2/15', 'OCORRENCIA' => 'text-erro bg-erro/10',
    'ENVIADO' => 'text-t3 bg-t3/10', 'RECEBIDO' => 'text-t3 bg-t3/10', 'SOBRA' => 'text-t3 bg-t3/10', 'PERDA' => 'text-erro bg-erro/10', 'DESCARTE' => 'text-erro bg-erro/10',
    'AJUSTE' => 'text-erro bg-erro/10', 'COMPRA' => 'text-t3 bg-t3/10', 'FORNECEDOR' => 'text-t3 bg-t3/10', 'CARGA' => 'text-t3 bg-t3/10', 'REMESSA_CROSS' => 'text-t3 bg-t3/10',
];

function contaTag(string $conta): string
{
    return '<span class="' . cx('pill normal-case tracking-normal', CONTA_COR[$conta], in_array($conta, ESTOQUES, true) ? '' : 'italic') . '" title="' . e(ROTULO_CONTA[$conta]) . '">' . CONTA_CURTO[$conta] . '</span>';
}

/** "Origem → Destino" de uma movimentação. */
function fluxoContas(string $origem, string $destino): string
{
    return '<span class="inline-flex items-center gap-1.5 whitespace-nowrap">' . contaTag($origem) . icone('arrow-right', 'h-3.5 w-3.5 text-t4', ['aria-label' => 'para']) . contaTag($destino) . '</span>';
}

/** Posição da unidade: Pallets PBR, Quebrados, em trânsito e a receber (Contas.tsx · SaldosEstoques). */
function saldosEstoques(string $cdId, array $destaque = []): string
{
    $s = obterSaldos($cdId);
    $itens = [
        ['VAZIOS', 'Pallets PBR', $s['vazios'], null, 'boxes', 'text-lima'],
        ['QUEBRADOS', 'Pallets Quebrados', $s['quebrados'], null, 'hammer', 'text-ouro'],
        ['TRANSITO', 'Enviados em trânsito', $s['transito'], 'aguardando conferência no destino', 'truck', 'text-t1'],
        ['A_RECEBER', 'A receber', $s['aReceber'], "{$s['valesAReceber']} vale(s) para conferir", 'package-open', 'text-t1'],
    ];
    $h = '<div class="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" data-testid="saldos-unidade">';
    foreach ($itens as [$chave, $rotulo, $valor, $detalhe, $ic, $cor]) {
        $h .= '<div class="' . cx('card-sm flex min-w-0 items-center gap-4 p-4 sm:p-5', in_array($chave, $destaque, true) ? 'ring-1 ring-lima/40' : '') . '">'
            . '<span class="' . cx('poco hidden h-11 w-11 flex-none items-center justify-center !rounded-2xl sm:flex', $cor) . '">' . icone($ic, 'h-5 w-5') . '</span>'
            . '<div class="min-w-0"><p class="label !mb-0.5">' . $rotulo . '</p><p class="num text-[22px] font-semibold leading-tight text-t1 sm:text-[26px]" data-testid="saldo-' . strtolower($chave) . '">' . n($valor) . '</p>'
            . ($detalhe ? '<p class="truncate text-[11px] text-t4">' . e($detalhe) . '</p>' : '') . '</div></div>';
    }
    return $h . '</div>';
}

/** Últimas movimentações da unidade (trilha: data/hora e usuário). */
function ultimasMovimentacoes(string $cdId, ?array $tipos = null, string $titulo = 'Últimas movimentações', int $limite = 10, ?DateTimeInterface $inicio = null, ?DateTimeInterface $fim = null, ?string $fornecedorId = null): string
{
    $w = 'm.`cdId` = ?';
    $p = [$cdId];
    if ($tipos) { $w .= ' AND m.`tipo` IN (' . Db::in($tipos) . ')'; array_push($p, ...$tipos); }
    if ($inicio && $fim) { $w .= ' AND m.`criadoEm` >= ? AND m.`criadoEm` < ?'; array_push($p, dbData($inicio), dbData($fim)); }
    if ($fornecedorId) { $w .= ' AND m.`fornecedorId` = ?'; $p[] = $fornecedorId; }
    $movs = Db::all(
        "SELECT m.*, u.`login`, x.`codigo` AS unidadeCodigo, x.`nome` AS unidadeNome, f.`nome` AS fornecedorNome, v.`numero` AS valeNumero, v.`tipo` AS valeTipo
           FROM `Movimentacao` m JOIN `Usuario` u ON u.`id` = m.`usuarioId` LEFT JOIN `CentroDistribuicao` x ON x.`id` = m.`unidadeId`
           LEFT JOIN `Fornecedor` f ON f.`id` = m.`fornecedorId` LEFT JOIN `ValePallet` v ON v.`id` = m.`valeId`
          WHERE $w ORDER BY m.`criadoEm` DESC LIMIT " . (int) $limite,
        $p,
    );
    if (!$movs) return painel(vazio($inicio ? 'Nenhuma movimentação no período.' : 'Nenhuma movimentação registrada.'), e($titulo));
    $linhas = '';
    foreach ($movs as $m) {
        $ref = $m['unidadeCodigo'] ? "{$m['unidadeCodigo']} - {$m['unidadeNome']}" : ($m['fornecedorNome'] ?? '—');
        $linhas .= '<tr><td class="tabular-nums">' . formatarDataHora($m['criadoEm']) . '</td><td>' . e(ROTULO_TIPO[$m['tipo']]) . '</td><td>' . fluxoContas($m['origem'], $m['destino']) . '</td>'
            . '<td class="num text-right font-semibold text-t1">' . $m['quantidade'] . '</td><td>' . e($ref)
            . ($m['valeNumero'] ? '<span class="ml-1 text-[11px] text-t4">(' . numeroVale($m['valeNumero'], $m['valeTipo']) . ')</span>' : '') . '</td>'
            . '<td>' . e($m['login']) . '</td><td class="max-w-xs truncate text-t3" title="' . e($m['observacao'] ?? '') . '">' . e($m['observacao'] ?? '—') . '</td></tr>';
    }
    return painel('<div class="poco overflow-x-auto"><table class="tabela"><thead><tr><th>Data/Hora</th><th>Tipo</th><th>Origem → Destino</th><th class="text-right">Qtd.</th><th>Referência</th><th>Usuário</th><th>Observação</th></tr></thead><tbody>' . $linhas . '</tbody></table></div>', e($titulo));
}

/** Campo de placa com máscara (InputPlaca). */
function inputPlaca(string $rotulo = 'Placa do veículo', bool $obrigatorio = false, string $id = 'placa', string $nome = 'placa', string $valor = ''): string
{
    return '<div><label class="label" for="' . e($id) . '">' . e($rotulo) . ($obrigatorio ? ' *' : '') . '</label>'
        . '<input id="' . e($id) . '" name="' . e($nome) . '" value="' . e($valor) . '" data-mascara="placa" class="input num uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal" placeholder="ABC-1234 ou ABC1D23"'
        . ($obrigatorio ? ' required' : '') . ' maxlength="8" pattern="[A-Z]{3}-[0-9]{4}|[A-Z]{3}[0-9][A-Z0-9][0-9]{2}" title="Placa no padrão antigo (ABC-1234) ou Mercosul (ABC1D23)" autocomplete="off" inputmode="text" autocapitalize="characters"></div>';
}

/** Histórico analítico das exclusões de vale (HistoricoExclusoes.tsx). */
function historicoExclusoes(string $cdId, int $limite = 20, string $titulo = 'Histórico de vales excluídos', ?DateTimeInterface $inicio = null, ?DateTimeInterface $fim = null): string
{
    $w = "v.`cdId` = ? AND v.`status` = 'CANCELADO'";
    $p = [$cdId];
    if ($inicio && $fim) { $w .= ' AND v.`canceladoEm` >= ? AND v.`canceladoEm` < ?'; array_push($p, dbData($inicio), dbData($fim)); }
    $total = (int) Db::val("SELECT COUNT(*) FROM `ValePallet` v WHERE $w", $p);
    $lista = Db::all("SELECT v.*, u.`login` AS canceladoPorLogin, f.`nome` AS fornecedorNome, x.`codigo` AS unidadeCodigo, x.`nome` AS unidadeNome
                        FROM `ValePallet` v LEFT JOIN `Usuario` u ON u.`id` = v.`canceladoPorId` LEFT JOIN `Fornecedor` f ON f.`id` = v.`fornecedorId`
                        LEFT JOIN `CentroDistribuicao` x ON x.`id` = v.`unidadeId` WHERE $w ORDER BY v.`canceladoEm` DESC LIMIT " . (int) $limite, $p);
    $acoes = $total > $limite ? '<a href="/vales/excluir" class="text-[11px] text-t3 hover:text-lima">Exibindo ' . $limite . ' de ' . $total . ' · ver todos</a>' : '';
    if (!$lista) return painel(vazio($inicio ? 'Nenhum vale excluído no período.' : 'Nenhum vale excluído.'), e($titulo), $acoes);
    $l = '';
    foreach ($lista as $v) {
        $parte = parteVale($v);
        $l .= '<tr><td><a href="/imprimir/vale/' . e($v['id']) . '" class="num font-semibold text-erro hover:underline">' . numeroVale($v['numero'], $v['tipo']) . '</a>'
            . '<p class="max-w-[12rem] truncate text-[11px] text-t4" title="' . e($parte) . '">' . e($parte) . ' · ' . $v['quantidade'] . ' pallet(s)</p></td>'
            . '<td class="num">' . formatarDataHora($v['canceladoEm']) . '</td><td>' . e($v['canceladoPorLogin'] ?? '—') . '</td>'
            . '<td class="font-medium text-t1">' . ($v['motivoCancelamento'] ? ROTULO_MOTIVO_CANCELAMENTO[$v['motivoCancelamento']] : '—') . '</td>'
            . '<td class="max-w-xs whitespace-normal text-t3">' . e($v['observacaoCancelamento'] ?? '—') . '</td></tr>';
    }
    return painel(tabela('<table class="tabela"><thead class="sticky top-0"><tr><th>ID do Vale</th><th>Data/Hora Exclusão</th><th>Usuário</th><th>Motivo</th><th>Observação</th></tr></thead><tbody>' . $l . '</tbody></table>', 'max-h-[26rem] overflow-auto'), e($titulo), $acoes);
}

/** Filtro de período do Painel (FiltroPeriodo.tsx). A seleção vai para a URL. */
function filtroPeriodo(array $periodo, string $rotulo, int $anoAtual, ?array $fornecedores, ?string $fornecedor): string
{
    $opcoes = [['dia', 'Dia', 'calendar-days'], ['semana', 'Semana do Ano', 'calendar-clock'], ['mes', 'Mês', 'calendar'], ['intervalo', 'Intervalo', 'calendar-range'], ['todos', 'Geral', 'infinity']];
    $t = $periodo['tipo'];
    $dados = ['tipo' => $t, 'dia' => $periodo['dia'], 'ano' => $periodo['ano'], 'semana' => $periodo['semana'], 'mes' => $periodo['mes'], 'de' => $periodo['de'], 'ate' => $periodo['ate'], 'fornecedor' => $fornecedor ?? ''];
    $h = '<section class="card mb-6 p-4 sm:p-5" aria-label="Filtro de período" data-filtro-periodo="' . e(json_encode($dados)) . '"><div class="flex flex-wrap items-center justify-between gap-3"><nav class="abas" aria-label="Tipo de período">';
    foreach ($opcoes as [$tipo, $rot, $ic]) {
        $h .= '<button type="button" data-tipo="' . $tipo . '" class="' . cx('aba', $t === $tipo ? 'aba-ativa' : '') . '" aria-pressed="' . ($t === $tipo ? 'true' : 'false') . '">' . icone($ic) . $rot . '</button>';
    }
    $h .= '</nav><p class="flex items-center gap-2 text-[12px] text-t3" aria-live="polite" data-estado-filtro><span class="ponto text-t4"></span>Período: <strong class="text-t1">' . e($rotulo) . '</strong></p></div>';
    $anos = array_filter(range($anoAtual - 4, $anoAtual + 1), fn($a) => $a <= $anoAtual + 1);
    $opAnos = '';
    foreach ($anos as $a) $opAnos .= '<option value="' . $a . '"' . ($a === $periodo['ano'] ? ' selected' : '') . ">$a</option>";
    $opSem = '';
    for ($s = 1; $s <= semanasNoAno($periodo['ano']); $s++) $opSem .= '<option value="' . $s . '"' . ($s === $periodo['semana'] ? ' selected' : '') . '>' . e(rotuloSemana($periodo['ano'], $s)) . '</option>';
    $opMes = '';
    foreach (NOMES_MESES as $i => $m) $opMes .= '<option value="' . ($i + 1) . '"' . ($i + 1 === $periodo['mes'] ? ' selected' : '') . ">$m</option>";
    $mostra = fn(bool $c) => $c ? '' : ' hidden';
    $h .= '<div class="mt-4 flex flex-wrap items-end gap-3" data-linha-filtro' . $mostra($t !== 'todos' || $fornecedores !== null) . '>'
        . '<div data-grupo="dia"' . $mostra($t === 'dia') . '><label class="label" for="filtro-dia">Dia</label><input id="filtro-dia" type="date" class="input" value="' . e($periodo['dia']) . '"></div>'
        . '<div data-grupo="semana mes"' . $mostra($t === 'semana' || $t === 'mes') . '><label class="label" for="filtro-ano">Ano</label><select id="filtro-ano" class="input num">' . $opAnos . '</select></div>'
        . '<div class="min-w-[16rem]" data-grupo="semana"' . $mostra($t === 'semana') . '><label class="label" for="filtro-semana">Semana do ano</label><select id="filtro-semana" class="input">' . $opSem . '</select></div>'
        . '<div data-grupo="mes"' . $mostra($t === 'mes') . '><label class="label" for="filtro-mes">Mês</label><select id="filtro-mes" class="input">' . $opMes . '</select></div>';
    if ($fornecedores !== null) {
        $opF = '<option value="">Todos os fornecedores</option>';
        foreach ($fornecedores as $f) $opF .= '<option value="' . e($f['id']) . '"' . ($f['id'] === $fornecedor ? ' selected' : '') . '>' . e($f['nome']) . '</option>';
        $h .= '<div class="min-w-[14rem]"><label class="label" for="filtro-fornecedor">Fornecedor</label><select id="filtro-fornecedor" class="input">' . $opF . '</select></div>';
    }
    $h .= '<form class="flex flex-wrap items-end gap-3" data-grupo="intervalo"' . $mostra($t === 'intervalo') . '><div><label class="label" for="filtro-de">De</label><input id="filtro-de" type="date" class="input" required value="' . e($periodo['de']) . '" max="' . e($periodo['ate']) . '"></div>'
        . '<div><label class="label" for="filtro-ate">Até</label><input id="filtro-ate" type="date" class="input" required value="' . e($periodo['ate']) . '" min="' . e($periodo['de']) . '"></div><button type="submit" class="btn-primary">Aplicar</button></form>';
    return $h . '</div></section>';
}

/** Ações do vale: baixar PDF e imprimir (BotoesVale.tsx). */
function botoesVale(string $id, bool $compacto = false): string
{
    $sm = $compacto ? ' btn-sm' : '';
    return '<span class="inline-flex flex-wrap items-center gap-2"><a href="/api/vales/' . e($id) . '/pdf" class="btn-primary' . $sm . '" download>' . icone('download') . ' Baixar PDF</a>'
        . '<a href="/imprimir/vale/' . e($id) . '?auto=1" target="_blank" class="btn-secondary' . $sm . '">' . icone('printer') . ' Imprimir</a></span>';
}

/** Campo de leitura óptica do código de barras do vale (LeitorVale.tsx). Comportamento em telas.js. */
function leitorVale(string $dica = 'Leia o código de barras do vale', string $modo = 'localizar'): string
{
    return '<div class="space-y-3" data-leitor-vale="' . e($modo) . '"><form class="flex flex-wrap gap-3"><div class="relative min-w-[14rem] flex-1">'
        . icone('scan-barcode', 'pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-t3')
        . '<input class="input num !pl-12 uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal" placeholder="' . e($dica) . '" aria-label="' . e($dica) . '" autocomplete="off"></div>'
        . '<button type="submit" class="btn-secondary" disabled>Localizar</button></form><div data-leitor-msg hidden></div></div>';
}

/**
 * Modelo do cadastro rápido de fornecedor (ModalFornecedor.tsx). O JavaScript abre o modal com o
 * CNPJ lido da NF-e já fixado (CTP.modalFornecedor em telas.js).
 */
function modeloFornecedorRapido(): string
{
    return '<template data-modelo-fornecedor>' . camposPadrao(null, 'Nome / Razão social', 'rapido', null, 'sigla', 'Ex.: AMBEV') . '</template>';
}
