<?php
declare(strict_types=1);
// Indicadores da Torre de Controle (src/lib/tv.ts).

/** Acuracidade das remessas: 1 − Σ|recebido − declarado| / Σdeclarado; null = sem conferência. */
function acuracidade(int $declarado, int $divergencia): ?float
{
    return $declarado > 0 ? max(0.0, 1 - $divergencia / $declarado) : null;
}

/**
 * Indicadores da Torre de Controle (gestão à vista; sem dados de fornecedores).
 * $ids: unidades selecionadas no filtro; null/vazio = Visão Geral (todas as unidades).
 */
function dadosTV(?array $ids = null): array
{
    $hoje = diaLocal();
    $sel = $ids ?: null;
    $envolveW = $sel ? '(v.`cdId` IN (' . Db::in($sel) . ') OR v.`unidadeId` IN (' . Db::in($sel) . '))' : '';
    $envolveP = $sel ? [...$sel, ...$sel] : [];

    $posicao = posicaoUnidades($sel);
    $transito = enviosEmTransito($envolveW, $envolveP);
    $conferencias = Db::all('SELECT `remetenteId`, `totalDeclarado`, `recebidoBons`, `recebidoQuebrados`, `diferenca` FROM `Conferencia`' . ($sel ? ' WHERE `remetenteId` IN (' . Db::in($sel) . ')' : ''), $sel ?? []);
    $hojeConf = Db::one(
        'SELECT COALESCE(SUM(`recebidoBons`),0) AS bons, COALESCE(SUM(`recebidoQuebrados`),0) AS quebrados, COUNT(*) AS n FROM `Conferencia` WHERE `criadoEm` >= ? AND `criadoEm` < ?'
            . ($sel ? ' AND `cdId` IN (' . Db::in($sel) . ')' : ''),
        [dbData(inicioDoDia($hoje)), dbData(fimDoDia($hoje)), ...($sel ?? [])],
    );
    $ocorrencias = Db::all("SELECT v.`cdId`, v.`unidadeId`, v.`quantidade`, v.`criadoEm` FROM `ValePallet` v WHERE v.`tipo` = 'OCORRENCIA' AND v.`status` = 'PENDENTE'" . ($envolveW ? " AND $envolveW" : ''), $envolveP);
    $vinculos = Db::all('SELECT x.`crossId`, c.`codigo` FROM `CrossCD` x JOIN `CentroDistribuicao` c ON c.`id` = x.`cdId` ORDER BY c.`codigo` ASC');

    // Acuracidade por remetente.
    $porRemetente = [];
    foreach ($conferencias as $c) {
        $a = $porRemetente[$c['remetenteId']] ?? ['enviados' => 0, 'recebidos' => 0, 'divergencia' => 0];
        $a['enviados'] += (int) $c['totalDeclarado'];
        $a['recebidos'] += (int) $c['recebidoBons'] + (int) $c['recebidoQuebrados'];
        $a['divergencia'] += abs((int) $c['diferenca']);
        $porRemetente[$c['remetenteId']] = $a;
    }
    $geral = ['enviados' => 0, 'recebidos' => 0, 'divergencia' => 0];
    foreach ($porRemetente as $a) foreach ($geral as $k => $_) $geral[$k] += $a[$k];

    // SLA: vale em trânsito mais antigo envolvendo a unidade (enviado por ela ou destinado a ela).
    $maisAntigo = [];
    $quebradosAoHub = [];
    foreach ($transito as $v) {
        foreach ([$v['cdId'], $v['unidadeId']] as $id) {
            if (!$id) continue;
            if (!isset($maisAntigo[$id]) || $v['criadoEm'] < $maisAntigo[$id]) $maisAntigo[$id] = $v['criadoEm'];
        }
        if ($v['unidadeHub']) $quebradosAoHub[$v['cdId']] = ($quebradosAoHub[$v['cdId']] ?? 0) + (int) $v['quantidadeQuebrados'];
    }
    // Ocorrências pendentes por unidade envolvida (remetente ou recebedora).
    $pendentes = [];
    foreach ($ocorrencias as $o) {
        foreach ([$o['cdId'], $o['unidadeId']] as $id) {
            if (!$id) continue;
            $p = $pendentes[$id] ?? null;
            $pendentes[$id] = ['n' => ($p['n'] ?? 0) + 1, 'desde' => $p && $p['desde'] < $o['criadoEm'] ? $p['desde'] : $o['criadoEm']];
        }
    }
    $atende = [];
    foreach ($vinculos as $v) $atende[$v['crossId']][] = $v['codigo'];

    $linhas = array_map(function ($p) use ($porRemetente, $maisAntigo, $pendentes, $quebradosAoHub, $atende) {
        $id = $p['unidade']['id'];
        $a = $porRemetente[$id] ?? null;
        $antigo = $maisAntigo[$id] ?? null;
        $oc = $pendentes[$id] ?? null;
        $dias = $antigo ? idadeEmDias($antigo) : null;
        $total = $p['vazios'] + $p['quebrados'];
        return $p + [
            'total' => $total,
            'enviadosConferidos' => $a['enviados'] ?? 0,
            'recebidosConferidos' => $a['recebidos'] ?? 0,
            'acuracidade' => $a ? acuracidade($a['enviados'], $a['divergencia']) : null,
            'ocorrenciasPendentes' => $oc['n'] ?? 0,
            'diasTransitoMaisAntigo' => $dias,
            'transitoHubQuebrados' => $quebradosAoHub[$id] ?? 0,
            'cdsAtendidos' => $atende[$id] ?? [],
        ] + farolUnidade($p['unidade']['tipo'], $dias, $total, $oc['n'] ?? 0, $oc ? idadeEmDias($oc['desde']) : null);
    }, $posicao);

    $cds = array_values(array_filter($linhas, fn($l) => $l['unidade']['tipo'] === 'CD'));
    $crosses = array_values(array_filter($linhas, fn($l) => $l['unidade']['tipo'] === 'CROSS'));
    $soma = fn(array $ls, string $k) => array_sum(array_column($ls, $k));
    $subtotal = fn(array $ls) => ['bons' => $soma($ls, 'vazios'), 'quebrados' => $soma($ls, 'quebrados'), 'transito' => $soma($ls, 'transito')];
    $hub = null;
    foreach ($cds as $l) if ($l['unidade']['hub']) { $hub = $l; break; }
    $farois = ['VERMELHO' => 0, 'AMARELO' => 0, 'VERDE' => 0];
    foreach ($linhas as $l) $farois[$l['farol']]++;

    return [
        'filtrado' => (bool) $sel,
        'hub' => $hub,
        'cds' => $cds,
        'crosses' => $crosses,
        'totais' => [
            'bons' => $soma($linhas, 'vazios'),
            'quebrados' => $soma($linhas, 'quebrados'),
            'transito' => $soma($linhas, 'transito'),
            'cds' => $subtotal($cds),
            'crosses' => $subtotal($crosses),
            'quebradosAoHub' => $soma($linhas, 'transitoHubQuebrados'),
            'valesEmViagem' => count($transito),
            'ocorrenciasPendentes' => count($ocorrencias),
            'ocorrenciasQuantidade' => array_sum(array_map(fn($o) => (int) $o['quantidade'], $ocorrencias)),
            'recebidosHoje' => (int) $hojeConf['bons'] + (int) $hojeConf['quebrados'],
            'conferenciasHoje' => (int) $hojeConf['n'],
            'acuracidade' => acuracidade($geral['enviados'], $geral['divergencia']),
            'enviadosConferidos' => $geral['enviados'],
            'recebidosConferidos' => $geral['recebidos'],
            'farois' => $farois,
        ],
    ];
}

/** "Versão" global dos dados: muda a cada movimentação, vale ou resposta de ocorrência. */
function versaoTV(): string
{
    $ultimo = Db::one('SELECT `id`, `criadoEm` FROM `Movimentacao` ORDER BY `criadoEm` DESC LIMIT 1');
    $vales = (int) Db::val('SELECT COUNT(*) FROM `ValePallet`');
    $interacoes = (int) Db::val('SELECT COUNT(*) FROM `OcorrenciaInteracao`');
    return ($ultimo ? msDe($ultimo['criadoEm']) . '-' . $ultimo['id'] : '0') . "-$vales-$interacoes";
}

/** Unidades ativas oferecidas no filtro superior da TV. */
function unidadesFiltroTV(): array
{
    return array_map('normalizarUnidade', Db::all("SELECT `id`, `codigo`, `nome`, `tipo`, `hub` FROM `CentroDistribuicao` WHERE `ativo` = 1 ORDER BY `tipo` ASC, `hub` DESC, `codigo` ASC"));
}
