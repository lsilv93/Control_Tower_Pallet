<?php
declare(strict_types=1);
// Consultas do painel, TV e relatórios (src/lib/consultas.ts) em SQL nativo MySQL.

/** Condição de período sobre `criadoEm` (alias opcional). @return array{0:string,1:array} */
function _periodoSql(array $p, string $col = '`criadoEm`'): array
{
    $w = '';
    $par = [];
    if (!empty($p['inicio'])) { $w .= " AND $col >= ?"; $par[] = dbData($p['inicio']); }
    if (!empty($p['fim'])) { $w .= " AND $col < ?"; $par[] = dbData($p['fim']); }
    return [$w, $par];
}

/** Soma por tipo de movimentação no período. Devolve função tipo → total. */
function totaisPorTipo(string $cdId, array $periodo = []): Closure
{
    [$w, $p] = _periodoSql($periodo);
    $linhas = Db::all("SELECT `tipo`, SUM(`quantidade`) AS q FROM `Movimentacao` WHERE `cdId` = ? $w GROUP BY `tipo`", [$cdId, ...$p]);
    $t = [];
    foreach ($linhas as $l) $t[$l['tipo']] = (int) $l['q'];
    return fn(string $tipo): int => $t[$tipo] ?? 0;
}

/**
 * Fluxo dos estoques físicos (bons + quebrados) no período: entradas (conta externa → estoque),
 * saídas (estoque → conta externa) e transferências internas (quebra, conserto).
 */
function fluxo(string $cdId, array $periodo = [], ?string $fornecedorId = null): array
{
    [$w, $p] = _periodoSql($periodo);
    if ($fornecedorId) { $w .= ' AND `fornecedorId` = ?'; $p[] = $fornecedorId; }
    $r = Db::one(
        "SELECT
            COALESCE(SUM(CASE WHEN `destino` IN ('VAZIOS','QUEBRADOS') AND `origem` NOT IN ('VAZIOS','QUEBRADOS') THEN `quantidade` END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN `origem` IN ('VAZIOS','QUEBRADOS') AND `destino` NOT IN ('VAZIOS','QUEBRADOS') THEN `quantidade` END), 0) AS saidas,
            COALESCE(SUM(CASE WHEN `origem` IN ('VAZIOS','QUEBRADOS') AND `destino` IN ('VAZIOS','QUEBRADOS') THEN `quantidade` END), 0) AS transferencias
          FROM `Movimentacao` WHERE `cdId` = ? $w",
        [$cdId, ...$p],
    );
    return ['entradas' => (int) $r['entradas'], 'saidas' => (int) $r['saidas'], 'transferencias' => (int) $r['transferencias']];
}

/** Agrupamento do gráfico de fluxo pelo tamanho do período. */
function granularidadePara(?DateTimeInterface $inicio, ?DateTimeInterface $fim): string
{
    if (!$inicio || !$fim) return 'mes';
    $dias = ($fim->getTimestamp() - $inicio->getTimestamp()) / 86400;
    return $dias <= 45 ? 'dia' : ($dias <= 200 ? 'semana' : 'mes');
}

/** Série de entradas x saídas por dia/semana/mês (fuso de São Paulo, UTC-3). */
function serieFluxo(string $cdId, array $periodo, string $granularidade, ?string $fornecedorId = null): array
{
    $local = "CONVERT_TZ(`criadoEm`, '+00:00', '-03:00')";
    $grupo = match ($granularidade) {
        'dia' => "DATE($local)",
        'semana' => "DATE_SUB(DATE($local), INTERVAL WEEKDAY($local) DAY)",
        default => "DATE_FORMAT($local, '%Y-%m-01')",
    };
    [$w, $p] = _periodoSql($periodo);
    if ($fornecedorId) { $w .= ' AND `fornecedorId` = ?'; $p[] = $fornecedorId; }
    $linhas = Db::all(
        "SELECT $grupo AS inicio,
                COALESCE(SUM(CASE WHEN `destino` IN ('VAZIOS','QUEBRADOS') AND `origem` NOT IN ('VAZIOS','QUEBRADOS') THEN `quantidade` END), 0) AS entradas,
                COALESCE(SUM(CASE WHEN `origem` IN ('VAZIOS','QUEBRADOS') AND `destino` NOT IN ('VAZIOS','QUEBRADOS') THEN `quantidade` END), 0) AS saidas
           FROM `Movimentacao` WHERE `cdId` = ? $w GROUP BY 1 ORDER BY 1",
        [$cdId, ...$p],
    );
    return array_map(fn($l) => ['inicio' => substr((string) $l['inicio'], 0, 10), 'entradas' => (int) $l['entradas'], 'saidas' => (int) $l['saidas']], $linhas);
}

/** Vales de fornecedor em aberto (pendentes ou agendados) do CD, com idade e farol. */
function valesEmAberto(string $cdId, ?string $fornecedorId = null): array
{
    $sql = "SELECT v.*, f.`nome` AS fornecedorNome, f.`cnpj` AS fornecedorCnpj, f.`sigla` AS fornecedorSigla,
                   u.`nome` AS criadoPorNome, u.`login` AS criadoPorLogin,
                   a.`numero` AS agendaNumero, a.`dataPrevista` AS agendaDataPrevista, a.`status` AS agendaStatus
              FROM `ValePallet` v
              LEFT JOIN `Fornecedor` f ON f.`id` = v.`fornecedorId`
              JOIN `Usuario` u ON u.`id` = v.`criadoPorId`
              LEFT JOIN `AgendaDevolucao` a ON a.`id` = v.`agendaId`
             WHERE v.`cdId` = ? AND v.`tipo` = 'FORNECEDOR' AND v.`status` IN ('PENDENTE','AGENDADO')";
    $p = [$cdId];
    if ($fornecedorId) { $sql .= ' AND v.`fornecedorId` = ?'; $p[] = $fornecedorId; }
    $vales = Db::all("$sql ORDER BY v.`criadoEm` ASC", $p);
    foreach ($vales as &$v) {
        $v['idade'] = idadeEmDias($v['criadoEm']);
        $v['farol'] = farolPorIdade($v['idade']);
    }
    return $vales;
}

/** Pendências do CD agrupadas por fornecedor, ordenadas pelo farol mais crítico. */
function pendenciasPorFornecedor(string $cdId): array
{
    $grupos = Db::all(
        "SELECT v.`fornecedorId`, f.`id`, f.`nome`, f.`sigla`, f.`cnpj`, SUM(v.`quantidade`) AS total, COUNT(*) AS vales, MIN(v.`criadoEm`) AS maisAntigo
           FROM `ValePallet` v JOIN `Fornecedor` f ON f.`id` = v.`fornecedorId`
          WHERE v.`cdId` = ? AND v.`tipo` = 'FORNECEDOR' AND v.`status` IN ('PENDENTE','AGENDADO')
          GROUP BY v.`fornecedorId`, f.`id`, f.`nome`, f.`sigla`, f.`cnpj`",
        [$cdId],
    );
    $r = array_map(fn($g) => [
        'fornecedor' => ['id' => $g['id'], 'nome' => $g['nome'], 'sigla' => $g['sigla'], 'cnpj' => $g['cnpj']],
        'total' => (int) $g['total'],
        'vales' => (int) $g['vales'],
        'maisAntigo' => $g['maisAntigo'],
        'farol' => farolPorFornecedor((int) $g['total']),
    ], $grupos);
    usort($r, fn($a, $b) => compararFarol($a['farol'], $b['farol']) ?: $b['total'] - $a['total']);
    return $r;
}

/**
 * Posição (bons, quebrados, trânsito, ocorrências e a receber) de cada unidade ativa —
 * ou só das informadas. Base do painel, da TV e das exportações.
 */
function posicaoUnidades(?array $ids = null): array
{
    if ($ids !== null && !$ids) return [];
    $f = $ids !== null ? ' AND `id` IN (' . Db::in($ids) . ')' : '';
    $unidades = Db::all("SELECT `id`, `codigo`, `nome`, `tipo`, `hub` FROM `CentroDistribuicao` WHERE `ativo` = 1 $f ORDER BY `hub` DESC, `tipo` ASC, `codigo` ASC", $ids ?? []);
    $estoques = estoquesPorUnidade($ids);
    $fr = $ids !== null ? ' AND `unidadeId` IN (' . Db::in($ids) . ')' : '';
    $receber = [];
    foreach (Db::all("SELECT `unidadeId`, SUM(`quantidade`) AS q, COUNT(*) AS n FROM `ValePallet` WHERE `tipo` = 'ENVIO' AND `status` = 'PENDENTE' $fr GROUP BY `unidadeId`", $ids ?? []) as $g) {
        $receber[$g['unidadeId']] = $g;
    }
    return array_map(function ($u) use ($estoques, $receber) {
        $u['hub'] = (bool) $u['hub'];
        $e = $estoques[$u['id']] ?? null;
        $r = $receber[$u['id']] ?? null;
        return [
            'unidade' => $u,
            'vazios' => $e['vazios'] ?? 0,
            'quebrados' => $e['quebrados'] ?? 0,
            'transito' => $e['transito'] ?? 0,
            'ocorrencias' => $e['ocorrencias'] ?? 0,
            'aReceber' => (int) ($r['q'] ?? 0),
            'valesAReceber' => (int) ($r['n'] ?? 0),
        ];
    }, $unidades);
}

/**
 * Vales de envio em trânsito com origem e destino. $where/$params: condição extra sobre v
 * (ex.: "(v.`cdId` = ? OR v.`unidadeId` = ?)").
 */
function enviosEmTransito(string $where = '', array $params = []): array
{
    return Db::all(
        "SELECT v.*, o.`codigo` AS cdCodigo, o.`tipo` AS cdTipo, o.`hub` AS cdHub,
                d.`codigo` AS unidadeCodigo, d.`tipo` AS unidadeTipo, d.`hub` AS unidadeHub
           FROM `ValePallet` v JOIN `CentroDistribuicao` o ON o.`id` = v.`cdId` LEFT JOIN `CentroDistribuicao` d ON d.`id` = v.`unidadeId`
          WHERE v.`tipo` = 'ENVIO' AND v.`status` = 'PENDENTE'" . ($where ? " AND $where" : '') . ' ORDER BY v.`criadoEm` ASC',
        $params,
    );
}

/**
 * Consolidação das movimentações do CD por transportadora no período: recebimentos de
 * fornecedor, envios (vales emitidos) e recebimentos conferidos (com faltas).
 */
function consolidacaoTransporte(string $cdId, array $periodo = []): array
{
    [$w, $p] = _periodoSql($periodo);
    $vales = Db::all(
        "SELECT `transportadora`, `tipo`, SUM(`quantidade`) AS q, COUNT(*) AS n FROM `ValePallet`
          WHERE `cdId` = ? AND `tipo` IN ('FORNECEDOR','ENVIO') AND `status` <> 'CANCELADO' $w GROUP BY `transportadora`, `tipo`",
        [$cdId, ...$p],
    );
    $conferencias = Db::all("SELECT `transportadora`, `recebidoBons`, `recebidoQuebrados`, `diferenca` FROM `Conferencia` WHERE `cdId` = ? $w", [$cdId, ...$p]);
    $mapa = [];
    $linha = function (?string $t) use (&$mapa): string {
        $nome = preg_replace('/\s+/', ' ', trim($t ?? '')) ?: 'Não informada';
        $k = mb_strtoupper($nome);
        $mapa[$k] ??= ['transportadora' => $nome, 'operacoes' => 0, 'recebidosFornecedor' => 0, 'enviados' => 0, 'conferidos' => 0, 'faltas' => 0];
        return $k;
    };
    foreach ($vales as $g) {
        $k = $linha($g['transportadora']);
        $mapa[$k]['operacoes'] += (int) $g['n'];
        if ($g['tipo'] === 'FORNECEDOR') $mapa[$k]['recebidosFornecedor'] += (int) $g['q'];
        else $mapa[$k]['enviados'] += (int) $g['q'];
    }
    foreach ($conferencias as $c) {
        $k = $linha($c['transportadora']);
        $mapa[$k]['operacoes'] += 1;
        $mapa[$k]['conferidos'] += (int) $c['recebidoBons'] + (int) $c['recebidoQuebrados'];
        $mapa[$k]['faltas'] += max(0, -(int) $c['diferenca']);
    }
    $r = array_values($mapa);
    usort($r, fn($a, $b) => ($b['recebidosFornecedor'] + $b['enviados'] + $b['conferidos']) - ($a['recebidosFornecedor'] + $a['enviados'] + $a['conferidos']));
    return $r;
}

/** Acumuladores de envio (vales não cancelados): para Pontos de Cross e para outros CDs. */
function acumuladoresEnvio(string $cdId): array
{
    $r = Db::one(
        "SELECT COALESCE(SUM(CASE WHEN d.`tipo` = 'CROSS' THEN v.`quantidade` END), 0) AS paraCross,
                COALESCE(SUM(CASE WHEN d.`tipo` IS NULL OR d.`tipo` <> 'CROSS' THEN v.`quantidade` END), 0) AS paraCds
           FROM `ValePallet` v LEFT JOIN `CentroDistribuicao` d ON d.`id` = v.`unidadeId`
          WHERE v.`cdId` = ? AND v.`tipo` = 'ENVIO' AND v.`status` <> 'CANCELADO'",
        [$cdId],
    );
    return ['paraCross' => (int) $r['paraCross'], 'paraCds' => (int) $r['paraCds']];
}
