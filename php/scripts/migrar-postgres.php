<?php
declare(strict_types=1);
/**
 * Migração dos dados do banco PostgreSQL (versão Next.js/Prisma) para o MySQL 8 (versão PHP).
 * Copia todas as tabelas com os mesmos IDs, números de vale/agenda/conferência e datas (UTC),
 * na ordem das chaves estrangeiras. O destino precisa ter o schema aplicado (database/schema.sql).
 *
 * Uso:
 *   ORIGEM_URL="postgresql://usuario:senha@host:5432/banco?sslmode=require" \
 *   DATABASE_URL="mysql://usuario:senha@host:3306/banco" php scripts/migrar-postgres.php [--apagar] [--simular]
 *
 *   --apagar   esvazia as tabelas do MySQL antes de copiar (sem ele, o destino precisa estar vazio)
 *   --simular  lê tudo e confere, mas desfaz a gravação no MySQL ao final
 *
 * Requer as extensões pdo_pgsql e pdo_mysql. Ao final compara a contagem de linhas e os saldos.
 */

require __DIR__ . '/../app/bootstrap.php';

const TABELAS = [
    'CentroDistribuicao', 'Usuario', 'UsuarioUnidade', 'CrossCD', 'Fornecedor', 'Transportadora', 'Compra',
    'Conferencia', 'AgendaDevolucao', 'ValePallet', 'OcorrenciaInteracao', 'Movimentacao', 'Auditoria', 'SessaoRevogada',
];

$args = array_slice($argv, 1);
$apagar = in_array('--apagar', $args, true);
$simular = in_array('--simular', $args, true);
// TRUNCATE não pode ser desfeito: a simulação só roda sobre um destino vazio.
if ($apagar && $simular) {
    fwrite(STDERR, "[migrar] --simular não pode ser combinado com --apagar (use um banco MySQL vazio para simular).\n");
    exit(1);
}

function sair(string $msg): never
{
    fwrite(STDERR, "[migrar] $msg\n");
    exit(1);
}

$url = getenv('ORIGEM_URL') ?: sair('Informe ORIGEM_URL (postgresql://usuario:senha@host:5432/banco).');
$p = parse_url($url);
if (!$p || !in_array($p['scheme'] ?? '', ['postgres', 'postgresql'], true)) sair('ORIGEM_URL inválida.');
parse_str($p['query'] ?? '', $qs);
$dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $p['host'], $p['port'] ?? 5432, ltrim($p['path'] ?? '', '/'))
    . (isset($qs['sslmode']) ? ';sslmode=' . $qs['sslmode'] : '');
$pg = new PDO($dsn, urldecode($p['user'] ?? ''), urldecode($p['pass'] ?? ''), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pg->exec("SET TIME ZONE 'UTC'");
$my = Db::pdo();

// Colunas e tipos do destino (MySQL).
$colunas = [];
foreach (Db::all('SELECT TABLE_NAME t, COLUMN_NAME c, DATA_TYPE d FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY ORDINAL_POSITION') as $r) {
    $colunas[$r['t']][$r['c']] = $r['d'];
}
foreach (TABELAS as $t) if (!isset($colunas[$t])) sair("Tabela $t não existe no MySQL. Aplique database/schema.sql antes.");

if (!$apagar) {
    foreach (TABELAS as $t) {
        if ((int) Db::val("SELECT COUNT(*) FROM `$t`") > 0) sair("O destino já tem dados em $t. Use --apagar para substituí-los.");
    }
}

/** text[] do Postgres ("{a,b}") → lista. */
function listaPg(mixed $v): array
{
    if (is_array($v)) return $v;
    $s = trim((string) $v, '{}');
    if ($s === '') return [];
    return array_map(fn($x) => trim($x, '"'), str_getcsv($s, ',', '"', '\\'));
}

/** Valor do PostgreSQL ($tipoPg = information_schema.data_type) → valor da coluna MySQL ($tipo). */
function converter(mixed $v, string $tipo, string $tipoPg): mixed
{
    if ($v === null) return null;
    if ($tipoPg === 'ARRAY') return json_encode(listaPg($v), JSON_UNESCAPED_UNICODE);
    return match ($tipo) {
        'tinyint' => is_bool($v) ? (int) $v : (in_array($v, ['t', 'true', '1', 1], true) ? 1 : 0),
        'json' => is_string($v) ? $v : json_encode($v, JSON_UNESCAPED_UNICODE),
        'datetime' => substr(str_replace('T', ' ', (string) $v), 0, 23),
        default => $v,
    };
}

$my->exec('SET FOREIGN_KEY_CHECKS = 0');
$my->beginTransaction();
try {
    if ($apagar) {
        // Movimentacao e Auditoria são imutáveis (gatilhos bloqueiam DELETE): TRUNCATE não aciona gatilhos,
        // mas encerra a transação no MySQL; por isso o esvaziamento acontece antes, fora dela.
        $my->rollBack();
        foreach (array_reverse(TABELAS) as $t) $my->exec("TRUNCATE TABLE `$t`");
        $my->beginTransaction();
    }
    $contagem = [];
    foreach (TABELAS as $t) {
        $cols = $colunas[$t];
        $tiposPg = array_column($pg->query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = " . $pg->quote($t))->fetchAll(), 'data_type', 'column_name');
        $origem = array_keys($tiposPg);
        if (!$origem) sair("Tabela $t não encontrada no PostgreSQL.");
        $comuns = array_values(array_intersect(array_keys($cols), $origem));
        $faltando = array_diff(array_keys($cols), $origem);
        if ($faltando) echo "[migrar] $t: colunas sem origem (usam o padrão do MySQL): " . implode(', ', $faltando) . "\n";
        $lista = implode(', ', array_map(fn($c) => "\"$c\"", $comuns));
        $ins = $my->prepare("INSERT INTO `$t` (" . implode(', ', array_map(fn($c) => "`$c`", $comuns)) . ') VALUES (' . implode(', ', array_fill(0, count($comuns), '?')) . ')');
        $st = $pg->query("SELECT $lista FROM \"$t\"" . (in_array('numero', $comuns, true) ? ' ORDER BY "numero"' : ''));
        $n = 0;
        while ($row = $st->fetch()) {
            $ins->execute(array_map(fn($c) => converter($row[$c], $cols[$c], $tiposPg[$c]), $comuns));
            $n++;
        }
        $contagem[$t] = $n;
        echo str_pad($t, 22) . " $n linha(s)\n";
    }
    // Conferência: contagens e saldos por unidade/conta iguais nos dois bancos.
    foreach (TABELAS as $t) {
        $a = (int) $pg->query("SELECT COUNT(*) FROM \"$t\"")->fetchColumn();
        if ($a !== $contagem[$t]) throw new RuntimeException("Contagem divergente em $t: PostgreSQL $a, MySQL {$contagem[$t]}.");
    }
    $sqlSaldo = fn(string $q) => "SELECT {$q}cdId{$q} AS cd, c, SUM(q) AS s FROM (SELECT {$q}cdId{$q}, destino AS c, quantidade AS q FROM {$q}Movimentacao{$q} UNION ALL SELECT {$q}cdId{$q}, origem, -quantidade FROM {$q}Movimentacao{$q}) x GROUP BY 1, 2";
    $sPg = array_map(fn($r) => "{$r['cd']}|{$r['c']}|" . (int) $r['s'], $pg->query($sqlSaldo('"'))->fetchAll());
    $sMy = array_map(fn($r) => "{$r['cd']}|{$r['c']}|" . (int) $r['s'], Db::all($sqlSaldo('`')));
    sort($sPg);
    sort($sMy);
    if ($sPg !== $sMy) throw new RuntimeException('Saldos por unidade/conta divergentes entre PostgreSQL e MySQL.');
    echo "[migrar] Contagens e saldos conferem (" . count($sMy) . " saldos por unidade/conta).\n";

    if ($simular) {
        $my->rollBack();
        echo "[migrar] --simular: nada foi gravado.\n";
    } else {
        $my->commit();
        echo "[migrar] Migração concluída.\n";
    }
} catch (Throwable $e) {
    if ($my->inTransaction()) $my->rollBack();
    sair('Falha: ' . $e->getMessage() . ' — nada foi gravado.');
} finally {
    $my->exec('SET FOREIGN_KEY_CHECKS = 1');
}
