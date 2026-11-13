<?php
declare(strict_types=1);
// Usuário logado, unidade de operação e guardas de acesso (tradução de src/lib/auth.ts).

/** Usuário logado (validado no banco: inativados perdem o acesso) e unidade ativa; cache por requisição. */
function usuarioAtual(): ?array
{
    static $cache = false;
    if ($cache !== false) return $cache;
    return $cache = carregarUsuarioAtual();
}

function carregarUsuarioAtual(): ?array
{
    $sessao = verificarSessao($_COOKIE[SESSION_COOKIE] ?? null);
    if (!$sessao) return null;
    // Sessão encerrada pelo botão Sair: o token não vale mais, mesmo se alguém tiver uma cópia.
    if (!empty($sessao['jti']) && Db::val('SELECT 1 FROM `SessaoRevogada` WHERE `jti` = ?', [$sessao['jti']])) return null;
    $u = Db::one('SELECT `id`, `nome`, `login`, `perfil`, `ativo`, `permissoes`, `unidadeId` FROM `Usuario` WHERE `id` = ?', [$sessao['sub'] ?? '']);
    if (!$u || !$u['ativo']) return null;
    $campos = '`id`, `codigo`, `nome`, `tipo`, `hub`, `recebimentoFornecedor`, `ativo`';
    $principal = normalizarUnidade(Db::one("SELECT $campos FROM `CentroDistribuicao` WHERE `id` = ?", [$u['unidadeId']]));
    $perfil = $u['perfil'];
    $global = temVisaoGlobal(['perfil' => $perfil]);
    if ($global) {
        $cds = array_map('normalizarUnidade', Db::all("SELECT $campos FROM `CentroDistribuicao` WHERE `ativo` = 1 ORDER BY `hub` DESC, `tipo` ASC, `codigo` ASC"));
    } else {
        // Demais: as unidades vinculadas (CDs e/ou Cross) ativas, inclusive a principal.
        $vinc = Db::all("SELECT c.`id`, c.`codigo`, c.`nome`, c.`tipo`, c.`hub`, c.`recebimentoFornecedor`, c.`ativo`
                           FROM `UsuarioUnidade` uu JOIN `CentroDistribuicao` c ON c.`id` = uu.`unidadeId` WHERE uu.`usuarioId` = ?", [$u['id']]);
        $mapa = [];
        if ($principal['ativo']) $mapa[$principal['id']] = $principal;
        foreach ($vinc as $v) if ($v['ativo']) $mapa[$v['id']] = normalizarUnidade($v);
        $cds = array_values($mapa);
        usort($cds, fn($a, $b) => ((int) $b['hub'] - (int) $a['hub']) ?: (strcmp($a['tipo'], $b['tipo']) ?: strcmp($a['codigo'], $b['codigo'])));
    }
    $cds = array_map(fn($c) => array_diff_key($c, ['ativo' => 1]), $cds);
    $escolhido = $_COOKIE[CD_COOKIE] ?? null;
    $cd = count($cds) === 1 ? $cds[0] : (array_values(array_filter($cds, fn($c) => $c['id'] === $escolhido))[0] ?? null);
    // As regras de acesso seguem a unidade em operação (ex.: operando um Cross valem as restrições de Cross).
    $unidade = $cd ?? array_diff_key($principal, ['ativo' => 1]);
    $permissoes = json_decode((string) $u['permissoes'], true) ?: [];
    return [
        'id' => $u['id'],
        'nome' => $u['nome'],
        'login' => $u['login'],
        'perfil' => $perfil,
        'permissoes' => $permissoes,
        'unidade' => $unidade,
        'global' => $global,
        'cds' => $cds,
        'cd' => $cd,
    ];
}

function normalizarUnidade(?array $c): ?array
{
    if (!$c) return null;
    foreach (['hub', 'recebimentoFornecedor', 'ativo'] as $k) if (array_key_exists($k, $c)) $c[$k] = (bool) $c[$k];
    return $c;
}

function requireUsuario(): array
{
    $u = usuarioAtual();
    if (!$u) redirecionar('/login');
    return $u;
}

/** Usuário com unidade de operação definida; sem unidade, abre a seleção. */
function requireCD(): array
{
    $u = requireUsuario();
    if (!$u['cd']) redirecionar('/selecionar-cd');
    return $u;
}

function requirePermissao(string $p): array
{
    $u = requireCD();
    if (!tem($u, $p)) redirecionar('/sem-acesso');
    return $u;
}

/** Cadastros globais (não dependem da unidade de operação). */
function requirePermissaoGlobal(string $p): array
{
    $u = requireUsuario();
    if (!tem($u, $p)) redirecionar('/sem-acesso');
    return $u;
}

function requireAlguma(string ...$ps): array
{
    $u = requireCD();
    foreach ($ps as $p) if (tem($u, $p)) return $u;
    redirecionar('/sem-acesso');
}

/** Módulo "Recebimento Pallet Fornecedor": permissão + módulo liberado pelo Master na unidade. */
function requireModuloFornecedor(string $p = 'fornecedor'): array
{
    $u = requirePermissao($p);
    if (!$u['cd']['recebimentoFornecedor']) redirecionar('/sem-acesso?modulo=fornecedor');
    return $u;
}

function requireAdmin(): array
{
    $u = requireUsuario();
    if (!ehAdmin($u)) redirecionar('/sem-acesso');
    return $u;
}

function requireAdminCD(): array
{
    $u = requireCD();
    if (!ehAdmin($u)) redirecionar('/sem-acesso');
    return $u;
}

function requireMaster(): array
{
    $u = requireUsuario();
    if (!ehMaster($u)) redirecionar('/sem-acesso');
    return $u;
}

/** Vale visível: visão global ou uma das unidades do usuário é a emissora ou a destinatária. */
function podeVerVale(array $u, array $v): bool
{
    if ($u['global']) return true;
    foreach ($u['cds'] as $c) if ($c['id'] === $v['cdId'] || $c['id'] === ($v['unidadeId'] ?? null)) return true;
    return false;
}

/** Ids das unidades do escopo (null = todas: Master/Admin). */
function unidadesDoEscopo(array $u): ?array
{
    return $u['global'] ? null : array_column($u['cds'], 'id');
}
