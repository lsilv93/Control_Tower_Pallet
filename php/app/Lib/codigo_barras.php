<?php
declare(strict_types=1);
// Código de barras Code 128 (conjunto B, com C para sequências numéricas) em SVG, sem
// dependências: nítido na impressão. Substitui o bwip-js (src/lib/codigoBarras.ts).

/** Larguras (barra, espaço, barra, espaço, barra, espaço) de cada símbolo 0..106. */
const CODE128 = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

/** Símbolos Code 128 (valores) do texto, alternando B e C como os codificadores automáticos. */
function code128Valores(string $texto): array
{
    $valores = [];
    $i = 0;
    $len = strlen($texto);
    $conjunto = null;
    $digitosAdiante = function (int $i) use ($texto, $len): int {
        $n = 0;
        while ($i + $n < $len && ctype_digit($texto[$i + $n])) $n++;
        return $n;
    };
    while ($i < $len) {
        $d = $digitosAdiante($i);
        $usarC = $d >= 4 && ($d % 2 === 0 || $conjunto === 'C' || $i === 0);
        if ($usarC && $d >= 2) {
            if ($conjunto === null) $valores[] = 105; elseif ($conjunto !== 'C') $valores[] = 99;
            $conjunto = 'C';
            $pares = intdiv($d, 2);
            for ($k = 0; $k < $pares; $k++, $i += 2) $valores[] = (int) substr($texto, $i, 2);
            continue;
        }
        if ($conjunto === null) $valores[] = 104; elseif ($conjunto !== 'B') $valores[] = 100;
        $conjunto = 'B';
        $c = ord($texto[$i]);
        if ($c < 32 || $c > 127) $c = 63; // caractere fora do conjunto B vira "?"
        $valores[] = $c - 32;
        $i++;
    }
    $soma = $valores[0];
    foreach ($valores as $p => $v) if ($p > 0) $soma += $v * $p;
    $valores[] = $soma % 103;
    $valores[] = 106;
    return $valores;
}

/**
 * Código de barras em SVG. $altura em mm, $escala = pixels por módulo (como no bwip-js),
 * zona de silêncio de 12 módulos de cada lado (exigida pelo Code 128) e fundo branco.
 */
function codigo128Svg(string $texto, float $altura = 12, int $escala = 2): string
{
    $modulos = [];
    foreach (code128Valores($texto) as $v) {
        foreach (str_split(CODE128[$v]) as $k => $w) $modulos[] = [$k % 2 === 0, (int) $w];
    }
    $pad = 12;
    $total = array_sum(array_column($modulos, 1)) + 2 * $pad;
    $alturaPx = (int) round($altura * 72 / 25.4 * $escala / 2 * 2);
    $padV = 2 * $escala;
    $largura = $total * $escala;
    $alturaTotal = $alturaPx + 2 * $padV;
    $x = $pad;
    $barras = '';
    foreach ($modulos as [$barra, $w]) {
        if ($barra) $barras .= sprintf('M%d %dh%dv%dh-%dZ', $x * $escala, $padV, $w * $escala, $alturaPx, $w * $escala);
        $x += $w;
    }
    return sprintf(
        '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d"><rect x="0" y="0" width="%d" height="%d" fill="#FFFFFF"/><path d="%s" fill="#000000"/></svg>',
        $largura, $alturaTotal, $largura, $alturaTotal, $barras,
    );
}

/** Módulos do código (para desenhar no PDF). @return array<array{0:bool,1:int}> */
function codigo128Modulos(string $texto): array
{
    $m = [];
    foreach (code128Valores($texto) as $v) foreach (str_split(CODE128[$v]) as $k => $w) $m[] = [$k % 2 === 0, (int) $w];
    return $m;
}
