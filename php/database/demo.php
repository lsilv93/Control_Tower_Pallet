<?php
declare(strict_types=1);
// Cadastros de demonstração (CDs regionais, Pontos de Cross, transportadoras e usuários de
// teste, senha teste123). Não cria saldos. Só executa se ainda não houver movimentações.
// Uso: php database/demo.php
require __DIR__ . '/../app/bootstrap.php';

if ((int) Db::val('SELECT COUNT(*) FROM `Movimentacao`') > 0) {
    echo "[demo] Já existem movimentações — nada foi alterado.\n";
    exit(0);
}
$hub = Db::one('SELECT * FROM `CentroDistribuicao` WHERE `hub` = 1 LIMIT 1') ?? throw new RuntimeException('Rode o seed antes.');
$unidade = function (string $codigo, string $nome, string $cnpj, string $tipo, array $cdsAtendidos = []): string {
    $id = Db::val('SELECT `id` FROM `CentroDistribuicao` WHERE `codigo` = ?', [$codigo]);
    if ($id) return $id;
    $id = Db::insert('CentroDistribuicao', [
        'codigo' => $codigo, 'nome' => $nome, 'cnpj' => $cnpj, 'tipo' => $tipo, 'contato' => 'Gerente da unidade',
        'telefone' => '(11) 4000-0000', 'email' => strtolower($codigo) . '@exemplo.com.br', 'criadoEm' => Db::agora(),
    ]);
    foreach ($cdsAtendidos as $cdId) Db::exec('INSERT INTO `CrossCD` (`crossId`, `cdId`, `criadoEm`) VALUES (?, ?, ?)', [$id, $cdId, Db::agora()]);
    return $id;
};
$cdsp = $unidade('CDSP', 'CD São Paulo', '11444777000161', 'CD');
$cdrj = $unidade('CDRJ', 'CD Rio de Janeiro', '19131243000197', 'CD');
$unidade('XCPS', 'Cross Campinas', '04252011000110', 'CROSS', [$cdsp, $hub['id']]);
$unidade('XSJC', 'Cross São José dos Campos', '07526557000100', 'CROSS', [$hub['id']]);
$unidade('XNIT', 'Cross Niterói', '60746948000112', 'CROSS', [$cdrj]);
foreach ([['Transportes Rápido', '45997418000153'], ['LogBR Cargas', '33000167000101']] as [$nome, $cnpj]) {
    Db::exec('INSERT IGNORE INTO `Transportadora` (`id`, `nome`, `cnpj`, `criadoEm`) VALUES (?, ?, ?, ?)', [Db::cuid(), $nome, $cnpj, Db::agora()]);
}
$senhaHash = password_hash('teste123', PASSWORD_BCRYPT, ['cost' => 10]);
$operador = ['dashboard', 'envio', 'recebimento', 'quebras', 'vales', 'excluir_vale', 'relatorios'];
$id = fn(string $codigo) => Db::val('SELECT `id` FROM `CentroDistribuicao` WHERE `codigo` = ?', [$codigo]);
foreach ([
    ['hub', 'Operador Hub CDJC', [$hub['codigo']], [...$operador, 'reparo', 'tv']],
    ['sp', 'Operador CD São Paulo', ['CDSP'], $operador],
    ['rj', 'Operador CD Rio', ['CDRJ'], $operador],
    ['campinas', 'Operador Cross Campinas', ['XCPS'], $operador],
    ['multi', 'Operador SP + Campinas', ['CDSP', 'XCPS'], $operador],
] as [$login, $nome, $codigos, $permissoes]) {
    if (Db::val('SELECT 1 FROM `Usuario` WHERE `login` = ?', [$login])) continue;
    $uid = Db::insert('Usuario', ['nome' => $nome, 'login' => $login, 'senhaHash' => $senhaHash, 'perfil' => 'OPERADOR', 'permissoes' => json_encode($permissoes), 'unidadeId' => $id($codigos[0]), 'criadoEm' => Db::agora()]);
    foreach ($codigos as $c) Db::exec('INSERT INTO `UsuarioUnidade` (`usuarioId`, `unidadeId`, `criadoEm`) VALUES (?, ?, ?)', [$uid, $id($c), Db::agora()]);
}
echo "[demo] Unidades, transportadoras e usuários de teste (senha teste123) criados.\n";
