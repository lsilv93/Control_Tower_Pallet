<?php
declare(strict_types=1);
// Inicialização: configuração, carga das bibliotecas e tratamento de erros.

date_default_timezone_set('UTC');
mb_internal_encoding('UTF-8');

// Variáveis de ambiente de um arquivo .env (opcional, para hospedagem compartilhada).
$env = dirname(__DIR__) . '/.env';
if (is_file($env)) {
    foreach (file($env, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linha) {
        if (str_starts_with(trim($linha), '#') || !str_contains($linha, '=')) continue;
        [$k, $v] = array_map('trim', explode('=', $linha, 2));
        $v = trim($v, "\"'");
        if (getenv($k) === false) putenv("$k=$v");
    }
}

/** Versão dos arquivos estáticos (cache do navegador). */
const ASSET_VERSAO = '20261113';

require __DIR__ . '/Core/Db.php';
require __DIR__ . '/Core/Http.php';
require __DIR__ . '/Core/View.php';
foreach (['datas', 'formatos', 'permissoes', 'farol', 'periodo', 'nfe', 'sessao', 'auth', 'conta', 'consultas', 'ocorrencias', 'auditoria', 'documento_vale', 'codigo_barras', 'tv'] as $lib) {
    require __DIR__ . "/Lib/$lib.php";
}
require __DIR__ . '/Views/ui.php';
require __DIR__ . '/Actions/_estado.php';
