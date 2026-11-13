<?php
declare(strict_types=1);

/**
 * Acesso ao MySQL 8.0 via PDO (prepared statements reais, sem emulação). Conexão única por
 * requisição, sempre em UTC; a aplicação converte para America/Sao_Paulo ao exibir.
 *
 * Configuração (variáveis de ambiente): DATABASE_URL=mysql://usuario:senha@host:3306/banco
 * ou DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS. DB_SSL_CA (opcional) ativa TLS.
 */
final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo) return self::$pdo;
        $cfg = self::config();
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $cfg['host'], $cfg['port'], $cfg['nome']);
        $opcoes = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ];
        $ca = getenv('DB_SSL_CA');
        if ($ca) {
            $opcoes[defined('Pdo\Mysql::ATTR_SSL_CA') ? Pdo\Mysql::ATTR_SSL_CA : PDO::MYSQL_ATTR_SSL_CA] = $ca;
        }
        $pdo = new PDO($dsn, $cfg['usuario'], $cfg['senha'], $opcoes);
        $pdo->exec("SET time_zone = '+00:00', NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci");
        return self::$pdo = $pdo;
    }

    /** @return array{host:string,port:int,nome:string,usuario:string,senha:string} */
    public static function config(): array
    {
        $url = getenv('DATABASE_URL') ?: '';
        if ($url && preg_match('#^mysql://#i', $url)) {
            $p = parse_url($url);
            return [
                'host' => $p['host'] ?? 'localhost',
                'port' => (int) ($p['port'] ?? 3306),
                'nome' => ltrim($p['path'] ?? '', '/'),
                'usuario' => urldecode($p['user'] ?? ''),
                'senha' => urldecode($p['pass'] ?? ''),
            ];
        }
        return [
            'host' => getenv('DB_HOST') ?: '127.0.0.1',
            'port' => (int) (getenv('DB_PORT') ?: 3306),
            'nome' => getenv('DB_NAME') ?: 'pallet',
            'usuario' => getenv('DB_USER') ?: 'pallet',
            'senha' => getenv('DB_PASS') ?: '',
        ];
    }

    /** Executa e devolve o statement. */
    public static function run(string $sql, array $params = []): PDOStatement
    {
        $st = self::pdo()->prepare($sql);
        if (array_is_list($params)) {
            foreach ($params as $i => $v) $st->bindValue($i + 1, self::valor($v), self::tipo($v));
        } else {
            foreach ($params as $k => $v) $st->bindValue(':' . ltrim((string) $k, ':'), self::valor($v), self::tipo($v));
        }
        $st->execute();
        return $st;
    }

    /** Todas as linhas. */
    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    /** Primeira linha (ou null). */
    public static function one(string $sql, array $params = []): ?array
    {
        $r = self::run($sql, $params)->fetch();
        return $r === false ? null : $r;
    }

    /** Primeira coluna da primeira linha. */
    public static function val(string $sql, array $params = []): mixed
    {
        $r = self::run($sql, $params)->fetchColumn();
        return $r === false ? null : $r;
    }

    /** Primeira coluna de todas as linhas. */
    public static function col(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll(PDO::FETCH_COLUMN);
    }

    public static function exec(string $sql, array $params = []): int
    {
        return self::run($sql, $params)->rowCount();
    }

    /** INSERT com as colunas do array; gera `id` (cuid) se não informado. Devolve o id. */
    public static function insert(string $tabela, array $dados, bool $comId = true): string
    {
        if ($comId && !array_key_exists('id', $dados)) $dados = ['id' => self::cuid()] + $dados;
        $cols = array_keys($dados);
        $sql = sprintf(
            'INSERT INTO `%s` (%s) VALUES (%s)',
            $tabela,
            implode(', ', array_map(fn($c) => "`$c`", $cols)),
            implode(', ', array_fill(0, count($cols), '?')),
        );
        self::run($sql, array_values($dados));
        return (string) ($dados['id'] ?? self::pdo()->lastInsertId());
    }

    /** UPDATE simples por condição (`WHERE` com placeholders posicionais). Devolve linhas afetadas. */
    public static function update(string $tabela, array $dados, string $where, array $params = []): int
    {
        $sets = implode(', ', array_map(fn($c) => "`$c` = ?", array_keys($dados)));
        return self::exec("UPDATE `$tabela` SET $sets WHERE $where", [...array_values($dados), ...$params]);
    }

    /** Placeholders "?, ?, ?" para IN (...). Lista vazia vira NULL (nunca casa). */
    public static function in(array $lista): string
    {
        return $lista ? implode(', ', array_fill(0, count($lista), '?')) : 'NULL';
    }

    /**
     * Transação ACID. Com `$bloquearConta`, serializa as movimentações da conta corrente
     * (lock nomeado do MySQL): duas saídas simultâneas não conseguem deixar saldo negativo.
     */
    public static function tx(callable $fn, bool $bloquearConta = false): mixed
    {
        $pdo = self::pdo();
        if ($bloquearConta) {
            $ok = (int) self::val("SELECT GET_LOCK('ctp_conta_corrente', 20)");
            if ($ok !== 1) throw new ErroNegocio('Sistema ocupado processando outra movimentação. Tente novamente.');
        }
        $pdo->beginTransaction();
        try {
            $r = $fn();
            $pdo->commit();
            return $r;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        } finally {
            if ($bloquearConta) self::val("SELECT RELEASE_LOCK('ctp_conta_corrente')");
        }
    }

    /** Identificador no formato cuid (25 caracteres, começa com "c"), como os dados existentes. */
    public static function cuid(): string
    {
        static $contador = 0;
        $contador = ($contador + 1) % 1679616;
        $ts = base_convert((string) (int) (microtime(true) * 1000), 10, 36);
        $cont = str_pad(base_convert((string) $contador, 10, 36), 4, '0', STR_PAD_LEFT);
        $alfabeto = '0123456789abcdefghijklmnopqrstuvwxyz';
        $rand = '';
        for ($i = 0; $i < 12; $i++) $rand .= $alfabeto[random_int(0, 35)];
        return substr('c' . str_pad($ts, 8, '0', STR_PAD_LEFT) . $cont . $rand, 0, 25);
    }

    /** Data/hora atual em UTC no formato do banco. */
    public static function agora(): string
    {
        return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s.v');
    }

    private static function valor(mixed $v): mixed
    {
        if ($v instanceof DateTimeInterface) return dbData($v);
        if (is_bool($v)) return $v ? 1 : 0;
        if (is_array($v)) return json_encode($v, JSON_UNESCAPED_UNICODE);
        return $v;
    }

    private static function tipo(mixed $v): int
    {
        return match (true) {
            $v === null => PDO::PARAM_NULL,
            is_int($v), is_bool($v) => PDO::PARAM_INT,
            default => PDO::PARAM_STR,
        };
    }
}

/** Erro de regra de negócio: a mensagem é exibida ao usuário. */
class ErroNegocio extends RuntimeException {}
