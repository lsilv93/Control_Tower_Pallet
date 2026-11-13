<?php
declare(strict_types=1);
// Token de sessão assinado (JWT HS256) em cookie httpOnly; revogável no logout (SessaoRevogada).

const SESSION_COOKIE = 'ctp_session';
/** Unidade de operação escolhida no modal (validada no servidor a cada requisição). */
const CD_COOKIE = 'ctp_cd';
const SESSION_MAX_AGE = 60 * 60 * 12; // 12 horas (um turno)

function segredoSessao(): string
{
    $s = getenv('AUTH_SECRET');
    if (!$s) throw new RuntimeException('AUTH_SECRET não configurado');
    return $s;
}

function b64url(string $s): string
{
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}

function b64urlDecode(string $s): string
{
    return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)) ?: '';
}

/** @param array{sub:string, login:string, nome:string, perfil:string} $payload */
function assinarSessao(array $payload): string
{
    $agora = time();
    $corpo = $payload + ['jti' => bin2hex(random_bytes(16)), 'iat' => $agora, 'exp' => $agora + SESSION_MAX_AGE];
    $cab = b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $dados = b64url(json_encode($corpo, JSON_UNESCAPED_UNICODE));
    $assinatura = b64url(hash_hmac('sha256', "$cab.$dados", segredoSessao(), true));
    return "$cab.$dados.$assinatura";
}

/** Payload do token válido (assinatura e validade) ou null. */
function verificarSessao(?string $token): ?array
{
    if (!$token || substr_count($token, '.') !== 2) return null;
    [$cab, $dados, $assinatura] = explode('.', $token);
    $esperada = b64url(hash_hmac('sha256', "$cab.$dados", segredoSessao(), true));
    if (!hash_equals($esperada, $assinatura)) return null;
    $p = json_decode(b64urlDecode($dados), true);
    if (!is_array($p) || ($p['exp'] ?? 0) < time()) return null;
    return $p;
}
