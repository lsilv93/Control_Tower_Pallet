<?php
declare(strict_types=1);
/**
 * Conta corrente em partida dobrada, um livro por unidade (Movimentacao.cdId = CD, Hub ou
 * Ponto de Cross). Toda movimentação debita uma conta (origem) e credita outra (destino).
 * Estoques físicos (NUNCA negativos): VAZIOS e QUEBRADOS; TRANSITO e OCORRENCIA também
 * nunca negativos. As demais são contrapartidas externas. (Tradução de src/lib/conta.ts.)
 */

const CONTAS = ['VAZIOS', 'QUEBRADOS', 'TRANSITO', 'OCORRENCIA', 'ENVIADO', 'RECEBIDO', 'SOBRA', 'PERDA', 'DESCARTE', 'AJUSTE', 'COMPRA', 'FORNECEDOR', 'CARGA', 'REMESSA_CROSS'];
const ESTOQUES = ['VAZIOS', 'QUEBRADOS'];
/** Contas que nunca podem ficar negativas. */
const CONTROLADAS = ['VAZIOS', 'QUEBRADOS', 'TRANSITO', 'OCORRENCIA'];

/** Regras: origem e destino permitidos por tipo de movimentação. */
const REGRAS = [
    // CD → CD e Cross → CD: sai do estoque (com saldo). CD → Cross: sai do acumulador REMESSA_CROSS.
    'ENVIO' => ['origem' => ['VAZIOS', 'QUEBRADOS', 'REMESSA_CROSS'], 'destino' => ['TRANSITO']],
    'BAIXA_TRANSITO' => ['origem' => ['TRANSITO'], 'destino' => ['ENVIADO']],
    'RECEBIMENTO' => ['origem' => ['RECEBIDO'], 'destino' => ESTOQUES],
    'FALTA' => ['origem' => ['TRANSITO'], 'destino' => ['OCORRENCIA']],
    'SOBRA' => ['origem' => ['SOBRA'], 'destino' => ESTOQUES],
    'DIVERGENCIA_ENVIADO' => ['origem' => ['OCORRENCIA', 'VAZIOS', 'QUEBRADOS', 'REMESSA_CROSS'], 'destino' => ['ENVIADO']],
    'DIVERGENCIA_RECEBIDO' => ['origem' => ['RECEBIDO'], 'destino' => ['VAZIOS', 'QUEBRADOS', 'SOBRA']],
    'OCORRENCIA_PERDA' => ['origem' => ['OCORRENCIA'], 'destino' => ['PERDA']],
    'ESTORNO_ENVIO' => ['origem' => ['TRANSITO'], 'destino' => ['VAZIOS', 'QUEBRADOS', 'REMESSA_CROSS']],
    'QUEBRA' => ['origem' => ['VAZIOS'], 'destino' => ['QUEBRADOS']],
    'RECUPERADO' => ['origem' => ['QUEBRADOS'], 'destino' => ['VAZIOS']],
    'CANIBALIZACAO' => ['origem' => ['QUEBRADOS'], 'destino' => ['DESCARTE']],
    'DESCARTE' => ['origem' => ESTOQUES, 'destino' => ['DESCARTE']],
    'INCLUSAO_MANUAL' => ['origem' => ['AJUSTE'], 'destino' => ESTOQUES],
    'REMOCAO_MANUAL' => ['origem' => ESTOQUES, 'destino' => ['AJUSTE']],
    'COMPRA' => ['origem' => ['COMPRA'], 'destino' => ['VAZIOS']],
    'RECEBIMENTO_FORNECEDOR' => ['origem' => ['FORNECEDOR'], 'destino' => ['CARGA']],
    'DEVOLUCAO_FORNECEDOR' => ['origem' => ['VAZIOS'], 'destino' => ['FORNECEDOR']],
    'ESTORNO_VALE' => ['origem' => ['CARGA'], 'destino' => ['FORNECEDOR']],
];

/** Vales de fornecedor em aberto (ainda devidos). */
const STATUS_ABERTOS = ['PENDENTE', 'AGENDADO'];

const ROTULO_CONTA = [
    'VAZIOS' => 'Pallets PBR',
    'QUEBRADOS' => 'Pallets Quebrados',
    'TRANSITO' => 'Em trânsito',
    'OCORRENCIA' => 'Ocorrência (falta a devolver)',
    'ENVIADO' => 'Enviado a outra unidade',
    'RECEBIDO' => 'Recebido de outra unidade',
    'SOBRA' => 'Sobra na conferência',
    'PERDA' => 'Perda',
    'DESCARTE' => 'Descarte',
    'AJUSTE' => 'Ajuste manual',
    'COMPRA' => 'Compra',
    'FORNECEDOR' => 'Fornecedor',
    'CARGA' => 'Carga de fornecedor',
    'REMESSA_CROSS' => 'Remessa a Ponto de Cross (sem consumo de estoque)',
];
const ROTULO_CONTA_CURTO = ['VAZIOS' => 'Pallets PBR', 'QUEBRADOS' => 'Pallets Quebrados', 'TRANSITO' => 'trânsito', 'OCORRENCIA' => 'ocorrência'];

function saldosZerados(): array
{
    return array_fill_keys(CONTAS, 0);
}

/** Saldo de cada conta da unidade = entradas (destino) − saídas (origem). Opcionalmente até uma data. */
function saldosPorConta(string $cdId, ?DateTimeInterface $ate = null): array
{
    $cond = '`cdId` = ?' . ($ate ? ' AND `criadoEm` < ?' : '');
    $p = $ate ? [$cdId, dbData($ate), $cdId, dbData($ate)] : [$cdId, $cdId];
    $linhas = Db::all(
        "SELECT conta, SUM(q) AS saldo FROM (
            SELECT `destino` AS conta, SUM(`quantidade`) AS q FROM `Movimentacao` WHERE $cond GROUP BY `destino`
            UNION ALL
            SELECT `origem` AS conta, -SUM(`quantidade`) AS q FROM `Movimentacao` WHERE $cond GROUP BY `origem`
         ) x GROUP BY conta",
        $p,
    );
    $s = saldosZerados();
    foreach ($linhas as $l) $s[$l['conta']] = (int) $l['saldo'];
    return $s;
}

/**
 * Estoques (bons, quebrados), trânsito e ocorrências de várias unidades (TV, painel).
 * @return array<string, array{vazios:int, quebrados:int, transito:int, ocorrencias:int}>
 */
function estoquesPorUnidade(?array $cdIds = null): array
{
    if ($cdIds !== null && !$cdIds) return [];
    $filtro = $cdIds !== null ? ' AND `cdId` IN (' . Db::in($cdIds) . ')' : '';
    $p = $cdIds ?? [];
    $linhas = Db::all(
        "SELECT `cdId`, conta, SUM(q) AS saldo FROM (
            SELECT `cdId`, `destino` AS conta, SUM(`quantidade`) AS q FROM `Movimentacao`
             WHERE `destino` IN ('VAZIOS','QUEBRADOS','TRANSITO','OCORRENCIA') $filtro GROUP BY `cdId`, `destino`
            UNION ALL
            SELECT `cdId`, `origem` AS conta, -SUM(`quantidade`) AS q FROM `Movimentacao`
             WHERE `origem` IN ('VAZIOS','QUEBRADOS','TRANSITO','OCORRENCIA') $filtro GROUP BY `cdId`, `origem`
         ) x GROUP BY `cdId`, conta",
        [...$p, ...$p],
    );
    $chave = ['VAZIOS' => 'vazios', 'QUEBRADOS' => 'quebrados', 'TRANSITO' => 'transito', 'OCORRENCIA' => 'ocorrencias'];
    $mapa = [];
    foreach ($linhas as $l) {
        $mapa[$l['cdId']] ??= ['vazios' => 0, 'quebrados' => 0, 'transito' => 0, 'ocorrencias' => 0];
        $mapa[$l['cdId']][$chave[$l['conta']]] += (int) $l['saldo'];
    }
    return $mapa;
}

/** Posição da unidade: estoques, trânsito, a receber, ocorrências e fornecedores. */
function obterSaldos(string $cdId): array
{
    $contas = saldosPorConta($cdId);
    $aReceber = Db::one("SELECT COALESCE(SUM(`quantidade`),0) AS q, COUNT(*) AS n FROM `ValePallet` WHERE `unidadeId` = ? AND `tipo` = 'ENVIO' AND `status` = 'PENDENTE'", [$cdId]);
    $fornecedor = Db::one("SELECT COALESCE(SUM(`quantidade`),0) AS q, COUNT(*) AS n FROM `ValePallet` WHERE `cdId` = ? AND `tipo` = 'FORNECEDOR' AND `status` IN ('PENDENTE','AGENDADO')", [$cdId]);
    $ocorrenciasAbertas = (int) Db::val("SELECT COUNT(*) FROM `ValePallet` WHERE `tipo` = 'OCORRENCIA' AND `status` = 'PENDENTE' AND (`cdId` = ? OR `unidadeId` = ?)", [$cdId, $cdId]);
    return [
        'vazios' => $contas['VAZIOS'],
        'quebrados' => $contas['QUEBRADOS'],
        'transito' => $contas['TRANSITO'],
        'ocorrencias' => $contas['OCORRENCIA'],
        'ocorrenciasAbertas' => $ocorrenciasAbertas,
        'aReceber' => (int) $aReceber['q'],
        'valesAReceber' => (int) $aReceber['n'],
        'descartados' => $contas['DESCARTE'],
        'fornecedores' => (int) $fornecedor['q'],
        'valesFornecedorEmAberto' => (int) $fornecedor['n'],
        'contas' => $contas,
    ];
}

function resolverConta(array $permitidas, ?string $informada, string $papel): string
{
    if ($informada) {
        if (!in_array($informada, $permitidas, true)) throw new ErroNegocio("Conta de $papel inválida para esta movimentação.");
        return $informada;
    }
    if (count($permitidas) !== 1) throw new ErroNegocio("Informe a conta de $papel.");
    return $permitidas[0];
}

/**
 * Lança uma movimentação no livro da unidade. Deve rodar dentro de Db::tx(..., true)
 * (conta bloqueada). Valida a regra do tipo e BLOQUEIA qualquer lançamento que deixaria
 * negativo um estoque, o trânsito ou as ocorrências; grava a auditoria na mesma transação.
 *
 * $l: tipo, quantidade, usuarioId, cdId, [origem], [destino], [observacao], [motivo],
 *     [unidadeId], [fornecedorId], [valeId], [agendaId], [compraId], [conferenciaId]
 */
function lancar(array $l, ?string $codigoUnidade = null): string
{
    $q = $l['quantidade'] ?? null;
    if (!is_int($q) || $q <= 0) throw new ErroNegocio('A quantidade deve ser um número inteiro maior que zero.');
    if (empty($l['cdId'])) throw new ErroNegocio('Selecione a unidade de operação.');
    $regra = REGRAS[$l['tipo']];
    $origem = resolverConta($regra['origem'], $l['origem'] ?? null, 'origem');
    $destino = resolverConta($regra['destino'], $l['destino'] ?? null, 'destino');
    if ($origem === $destino) throw new ErroNegocio('Origem e destino não podem ser iguais.');

    if (in_array($origem, CONTROLADAS, true)) {
        $saldos = saldosPorConta($l['cdId']);
        if ($saldos[$origem] < $q) {
            $onde = $codigoUnidade ? " em $codigoUnidade" : '';
            $rot = ROTULO_CONTA_CURTO[$origem] ?? ROTULO_CONTA[$origem];
            throw new ErroNegocio("Saldo insuficiente de $rot$onde: disponível {$saldos[$origem]}, solicitado $q. A operação foi bloqueada (o saldo não pode ficar negativo).");
        }
    }

    $id = Db::insert('Movimentacao', [
        'tipo' => $l['tipo'],
        'quantidade' => $q,
        'origem' => $origem,
        'destino' => $destino,
        'observacao' => ($l['observacao'] ?? null) ?: null,
        'motivo' => ($l['motivo'] ?? null) ?: null,
        'criadoEm' => Db::agora(),
        'usuarioId' => $l['usuarioId'],
        'cdId' => $l['cdId'],
        'unidadeId' => $l['unidadeId'] ?? null,
        'fornecedorId' => $l['fornecedorId'] ?? null,
        'valeId' => $l['valeId'] ?? null,
        'agendaId' => $l['agendaId'] ?? null,
        'compraId' => $l['compraId'] ?? null,
        'conferenciaId' => $l['conferenciaId'] ?? null,
    ]);
    $detalhes = array_filter(['unidadeId' => $l['unidadeId'] ?? null, 'motivo' => $l['motivo'] ?? null]);
    auditar([
        'acao' => 'MOVIMENTACAO_' . $l['tipo'],
        'entidade' => 'Movimentacao',
        'entidadeId' => $id,
        'usuarioId' => $l['usuarioId'],
        'cdId' => $l['cdId'],
        'origem' => $origem,
        'destino' => $destino,
        'quantidade' => $q,
        'observacao' => $l['observacao'] ?? null,
        'detalhes' => $detalhes ?: null,
    ]);
    return $id;
}

/** Registro na trilha de auditoria imutável. */
function auditar(array $a): void
{
    Db::insert('Auditoria', [
        'acao' => $a['acao'],
        'entidade' => $a['entidade'],
        'entidadeId' => $a['entidadeId'] ?? null,
        'usuarioId' => $a['usuarioId'] ?? null,
        'cdId' => $a['cdId'] ?? null,
        'origem' => $a['origem'] ?? null,
        'destino' => $a['destino'] ?? null,
        'quantidade' => $a['quantidade'] ?? null,
        'observacao' => $a['observacao'] ?? null,
        'detalhes' => isset($a['detalhes']) ? json_encode($a['detalhes'], JSON_UNESCAPED_UNICODE) : null,
        'criadoEm' => Db::agora(),
    ]);
}

/** Executa `$fn` numa transação ACID com a conta corrente bloqueada. */
function comContaBloqueada(callable $fn): mixed
{
    return Db::tx($fn, true);
}
