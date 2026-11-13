<?php
declare(strict_types=1);
// Faróis (verde/amarelo/vermelho). Tradução de src/lib/farol.ts.

/** Farol por idade do vale: vermelho ≥ 30 dias, amarelo 20–29, verde < 20. */
function farolPorIdade(int $dias): string
{
    if ($dias >= 30) return 'VERMELHO';
    if ($dias >= 20) return 'AMARELO';
    return 'VERDE';
}

/** Farol por fornecedor: vermelho > 100 pallets, amarelo 50–100, verde < 50. */
function farolPorFornecedor(int $pendentes): string
{
    if ($pendentes > 100) return 'VERMELHO';
    if ($pendentes >= 50) return 'AMARELO';
    return 'VERDE';
}

const ORDEM_FAROL = ['VERMELHO' => 0, 'AMARELO' => 1, 'VERDE' => 2];

function compararFarol(string $a, string $b): int
{
    return ORDEM_FAROL[$a] - ORDEM_FAROL[$b];
}

/** Regras do farol das unidades na Torre de Controle. */
const REGRAS_FAROL_UNIDADE = [
    'slaDias' => ['amarelo' => 3, 'vermelho' => 7],
    'saldoCross' => ['amarelo' => 200, 'vermelho' => 500],
    'ocorrencias' => ['vermelhoQuantidade' => 3, 'vermelhoDias' => 3],
];

/** @return array{farol:string, motivos:string[]} */
function farolUnidade(string $tipo, ?int $diasTransitoMaisAntigo, int $saldo, int $ocorrenciasPendentes, ?int $diasOcorrenciaMaisAntiga): array
{
    $r = REGRAS_FAROL_UNIDADE;
    $avaliados = [];
    $d = $diasTransitoMaisAntigo;
    if ($d !== null && $d >= $r['slaDias']['vermelho']) $avaliados[] = ['VERMELHO', "SLA de devolução estourado ($d dias)"];
    elseif ($d !== null && $d >= $r['slaDias']['amarelo']) $avaliados[] = ['AMARELO', "Vale em trânsito há $d dias"];
    if ($tipo === 'CROSS') {
        if ($saldo >= $r['saldoCross']['vermelho']) $avaliados[] = ['VERMELHO', "Saldo devedor elevado ($saldo)"];
        elseif ($saldo >= $r['saldoCross']['amarelo']) $avaliados[] = ['AMARELO', "Saldo devedor alto ($saldo)"];
    }
    if ($ocorrenciasPendentes > 0) {
        $velha = ($diasOcorrenciaMaisAntiga ?? 0) >= $r['ocorrencias']['vermelhoDias'];
        $muitas = $ocorrenciasPendentes >= $r['ocorrencias']['vermelhoQuantidade'];
        $avaliados[] = [$velha || $muitas ? 'VERMELHO' : 'AMARELO', "$ocorrenciasPendentes ocorrência(s) pendente(s)" . ($velha ? " há $diasOcorrenciaMaisAntiga dias" : '')];
    }
    $farol = 'VERDE';
    foreach ($avaliados as [$f]) if (ORDEM_FAROL[$f] < ORDEM_FAROL[$farol]) $farol = $f;
    usort($avaliados, fn($a, $b) => ORDEM_FAROL[$a[0]] - ORDEM_FAROL[$b[0]]);
    return ['farol' => $farol, 'motivos' => array_map(fn($a) => $a[1], $avaliados)];
}

/** SLA de viagem dos vales de envio (Kanban do Painel). */
const REGRAS_VIAGEM = ['amareloHoras' => 24, 'vermelhoHoras' => 48];

function farolViagem(float $horas): string
{
    if ($horas >= REGRAS_VIAGEM['vermelhoHoras']) return 'VERMELHO';
    if ($horas >= REGRAS_VIAGEM['amareloHoras']) return 'AMARELO';
    return 'VERDE';
}
