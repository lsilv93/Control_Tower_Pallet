<?php
declare(strict_types=1);
// Requisição/resposta HTTP: redirecionamentos, JSON, cookies e proteção de origem (CSRF).

/** Interrompe o fluxo e redireciona (tratado pelo front controller). */
final class Redirecionar extends RuntimeException
{
    public function __construct(public readonly string $url)
    {
        parent::__construct($url);
    }
}

/** Interrompe o fluxo com uma resposta já pronta (corpo, status, cabeçalhos). */
final class Responder extends RuntimeException
{
    public function __construct(public readonly string $corpo, public readonly int $status = 200, public readonly array $cabecalhos = [])
    {
        parent::__construct('');
    }
}

/** Página não encontrada (404). */
final class NaoEncontrado extends RuntimeException {}

function redirecionar(string $url): never
{
    throw new Redirecionar($url);
}

function naoEncontrado(): never
{
    throw new NaoEncontrado();
}

/** Resposta JSON imediata. */
function json(array $dados, int $status = 200, array $cabecalhos = []): never
{
    throw new Responder(json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $status, ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store'] + $cabecalhos);
}

/** A requisição veio do JavaScript da aplicação (formulários com fetch). */
function pedidoJs(): bool
{
    return ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'ctp';
}

function metodo(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

/** Parâmetro da query string (texto) ou null. */
function q(string $k): ?string
{
    $v = $_GET[$k] ?? null;
    return is_string($v) ? $v : null;
}

/** Campo do formulário (texto, sem espaços nas pontas) — "" se ausente. */
function f(string $k): string
{
    $v = $_POST[$k] ?? '';
    return is_string($v) ? trim($v) : '';
}

/** Campo do formulário com vários valores (checkboxes name="x[]" ou repetidos). */
function fLista(string $k): array
{
    $v = $_POST[$k] ?? [];
    return array_values(array_filter(is_array($v) ? $v : [$v], 'is_string'));
}

/** Requisição segura: conexão HTTPS (direta ou via proxy). */
function https(): bool
{
    return ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function definirCookie(string $nome, string $valor, int $maxAge): void
{
    setcookie($nome, $valor, [
        'expires' => $maxAge > 0 ? time() + $maxAge : time() - 3600,
        'path' => '/',
        'httponly' => true,
        'secure' => https(),
        'samesite' => 'Lax',
    ]);
    if ($maxAge > 0) $_COOKIE[$nome] = $valor;
    else unset($_COOKIE[$nome]);
}

/**
 * Proteção contra CSRF nas ações (POST): a origem precisa ser o próprio site e o pedido
 * precisa vir do JavaScript da aplicação ou de um formulário do mesmo site.
 */
function verificarOrigem(): void
{
    $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? '';
    $origem = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
    if ($origem !== '' && parse_url($origem, PHP_URL_HOST) . (parse_url($origem, PHP_URL_PORT) ? ':' . parse_url($origem, PHP_URL_PORT) : '') !== $host) {
        throw new Responder('Origem não permitida.', 403);
    }
}
