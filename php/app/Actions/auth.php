<?php
declare(strict_types=1);
// Login, logout, unidade de operação e senha (src/actions/auth.ts).

function acao_auth_entrar(): array
{
    $login = mb_strtolower(f('login'));
    $senha = (string) ($_POST['senha'] ?? '');
    if ($login === '' || $senha === '') return falha('Informe login e senha.');

    $usuario = Db::one('SELECT `id`, `login`, `nome`, `perfil`, `senhaHash`, `ativo` FROM `Usuario` WHERE `login` = ?', [$login]);
    if (!$usuario || !$usuario['ativo'] || !password_verify($senha, $usuario['senhaHash'])) {
        auditar(['acao' => 'LOGIN_FALHOU', 'entidade' => 'Usuario', 'detalhes' => ['login' => $login]]);
        return falha('Login ou senha inválidos.');
    }
    try {
        $token = assinarSessao(['sub' => $usuario['id'], 'login' => $usuario['login'], 'nome' => $usuario['nome'], 'perfil' => $usuario['perfil']]);
    } catch (RuntimeException) {
        return falha('Configuração do servidor incompleta: a variável AUTH_SECRET não está definida neste ambiente. Cadastre-a nas variáveis de ambiente do servidor.');
    }
    definirCookie(SESSION_COOKIE, $token, SESSION_MAX_AGE);
    // A cada acesso a unidade de operação é escolhida de novo (modal para quem tem mais de uma).
    definirCookie(CD_COOKIE, '', 0);
    auditar(['acao' => 'LOGIN', 'entidade' => 'Usuario', 'entidadeId' => $usuario['id'], 'usuarioId' => $usuario['id']]);
    redirecionar('/');
}

/**
 * Logout seguro: apaga PRIMEIRO os cookies de sessão e de unidade, depois revoga o token no
 * servidor (uma cópia do cookie não vale mais) e registra a auditoria.
 */
function acao_auth_sair(): array
{
    $token = $_COOKIE[SESSION_COOKIE] ?? null;
    definirCookie(SESSION_COOKIE, '', 0);
    definirCookie(CD_COOKIE, '', 0);
    try {
        $sessao = verificarSessao($token);
        if ($sessao && !empty($sessao['jti'])) {
            $expira = (new DateTimeImmutable('@' . (int) ($sessao['exp'] ?? time() + SESSION_MAX_AGE)))->setTimezone(tzUtc());
            Db::exec('INSERT IGNORE INTO `SessaoRevogada` (`jti`, `usuarioId`, `expiraEm`, `criadoEm`) VALUES (?, ?, ?, ?)', [$sessao['jti'], $sessao['sub'], dbData($expira), Db::agora()]);
            // Tokens já expirados não precisam mais ficar na lista.
            Db::exec('DELETE FROM `SessaoRevogada` WHERE `expiraEm` < ?', [Db::agora()]);
            auditar(['acao' => 'LOGOUT', 'entidade' => 'Usuario', 'entidadeId' => $sessao['sub'], 'usuarioId' => $sessao['sub']]);
        }
    } catch (Throwable $e) {
        // Os cookies já foram apagados: a sessão está encerrada no navegador mesmo se o banco falhar.
        error_log('Falha ao registrar o logout: ' . $e->getMessage());
    }
    if (!pedidoJs()) redirecionar('/login');
    return sucesso('Sessão encerrada.', ['destino' => '/login']);
}

/** Define a unidade de operação da sessão (só unidades permitidas ao usuário). */
function acao_auth_selecionar_cd(): array
{
    $u = requireUsuario();
    $cdId = f('cdId');
    $cd = null;
    foreach ($u['cds'] as $c) if ($c['id'] === $cdId) $cd = $c;
    if (!$cd) return falha('Selecione uma unidade permitida para o seu usuário.');
    if (count($u['cds']) === 1 && $u['cd'] && $u['cd']['id'] !== $cd['id']) return falha('Seu usuário opera somente na unidade vinculada.');
    definirCookie(CD_COOKIE, $cd['id'], SESSION_MAX_AGE);
    auditar([
        'acao' => 'SELECIONAR_CD',
        'entidade' => 'CentroDistribuicao',
        'entidadeId' => $cd['id'],
        'usuarioId' => $u['id'],
        'cdId' => $cd['id'],
        'detalhes' => ['cd' => "{$cd['codigo']} - {$cd['nome']}"],
    ]);
    redirecionar('/');
}

function acao_auth_alterar_senha(): array
{
    $u = requireUsuario();
    $atual = (string) ($_POST['atual'] ?? '');
    $nova = (string) ($_POST['nova'] ?? '');
    $confirmacao = (string) ($_POST['confirmacao'] ?? '');
    if ($atual === '') return falha('Informe a senha atual.');
    if (mb_strlen($nova) < 6) return falha('A nova senha deve ter ao menos 6 caracteres.');
    if ($nova !== $confirmacao) return falha('A confirmação não confere com a nova senha.');
    $hash = Db::val('SELECT `senhaHash` FROM `Usuario` WHERE `id` = ?', [$u['id']]);
    if (!password_verify($atual, (string) $hash)) return falha('Senha atual incorreta.');
    Db::update('Usuario', ['senhaHash' => password_hash($nova, PASSWORD_BCRYPT, ['cost' => 10])], '`id` = ?', [$u['id']]);
    auditar(['acao' => 'ALTERAR_SENHA', 'entidade' => 'Usuario', 'entidadeId' => $u['id'], 'usuarioId' => $u['id']]);
    return sucesso('Senha alterada com sucesso.');
}
