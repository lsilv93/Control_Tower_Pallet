<?php
declare(strict_types=1);
// Dados iniciais: CD Hub CDJC (com endereço) e usuário MASTER "admin" (senha admin123, ou
// SEED_ADMIN_LOGIN/SEED_ADMIN_PASSWORD). Idempotente: só cria o que não existir.
// Uso: php database/seed.php
require __DIR__ . '/../app/bootstrap.php';

$hub = Db::one('SELECT * FROM `CentroDistribuicao` WHERE `hub` = 1 LIMIT 1');
if (!$hub && (int) Db::val('SELECT COUNT(*) FROM `CentroDistribuicao`') === 0) {
    $id = Db::insert('CentroDistribuicao', [
        'codigo' => 'CDJC',
        'nome' => 'CD Jacareí (Hub Nível Brasil)',
        'tipo' => 'CD',
        'hub' => 1,
        'cnpj' => '59568428001150',
        'contato' => 'Administrador',
        'endereco' => 'Rua Harold Barnsley Holland, 2130, Galpão B, Sala 01, Rio Abaixo',
        'cidade' => 'Jacareí',
        'uf' => 'SP',
        'cep' => '12334403',
        'criadoEm' => Db::agora(),
    ]);
    auditar(['acao' => 'SEED_HUB', 'entidade' => 'CentroDistribuicao', 'entidadeId' => $id, 'cdId' => $id]);
    $hub = Db::one('SELECT * FROM `CentroDistribuicao` WHERE `id` = ?', [$id]);
    echo "[seed] Hub CDJC criado (complete telefone e e-mail em Cadastros → CDs).\n";
}

$total = (int) Db::val('SELECT COUNT(*) FROM `Usuario`');
if ($total > 0) {
    echo "[seed] $total usuário(s) já cadastrado(s) — nada a fazer.\n";
    exit(0);
}
$hub ??= Db::one("SELECT * FROM `CentroDistribuicao` WHERE `tipo` = 'CD' ORDER BY `criadoEm` ASC LIMIT 1");
$login = mb_strtolower(getenv('SEED_ADMIN_LOGIN') ?: 'admin');
$senha = getenv('SEED_ADMIN_PASSWORD') ?: 'admin123';
$id = Db::insert('Usuario', [
    'nome' => 'Administrador',
    'login' => $login,
    'senhaHash' => password_hash($senha, PASSWORD_BCRYPT, ['cost' => 10]),
    'perfil' => 'MASTER',
    'permissoes' => '[]',
    'unidadeId' => $hub['id'],
    'criadoEm' => Db::agora(),
]);
Db::exec('INSERT INTO `UsuarioUnidade` (`usuarioId`, `unidadeId`, `criadoEm`) VALUES (?, ?, ?)', [$id, $hub['id'], Db::agora()]);
auditar(['acao' => 'SEED_ADMIN', 'entidade' => 'Usuario', 'entidadeId' => $id, 'cdId' => $hub['id']]);
echo "[seed] Usuário MASTER \"$login\" criado no {$hub['codigo']}. Altere a senha após o primeiro acesso.\n";
