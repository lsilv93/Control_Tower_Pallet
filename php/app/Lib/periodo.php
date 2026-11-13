<?php
declare(strict_types=1);
// Filtro de período do Painel: Dia, Semana ISO, Mês, Intervalo e Geral (src/lib/periodo.ts).

const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function _utcDia(string $dia): int
{
    return (new DateTimeImmutable($dia . 'T00:00:00Z'))->getTimestamp();
}
function _isoDia(int $ts): string
{
    return gmdate('Y-m-d', $ts);
}
function _brDia(string $dia, bool $comAno = true): string
{
    [$a, $m, $d] = explode('-', $dia);
    return $comAno ? "$d/$m/$a" : "$d/$m";
}
function _diaValido(?string $dia): bool
{
    return $dia !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dia) && _isoDia(_utcDia($dia)) === $dia;
}

/** Semana ISO 8601. @return array{ano:int, semana:int} */
function semanaIso(string $dia): array
{
    $t = _utcDia($dia);
    $diaSemana = ((int) gmdate('w', $t) + 6) % 7;
    $quinta = $t + (3 - $diaSemana) * 86400;
    $ano = (int) gmdate('Y', $quinta);
    return ['ano' => $ano, 'semana' => 1 + intdiv($quinta - gmmktime(0, 0, 0, 1, 1, $ano), 7 * 86400)];
}

/** @return array{inicio:string, fim:string} */
function diasDaSemana(int $ano, int $semana): array
{
    $jan4 = gmmktime(0, 0, 0, 1, 4, $ano);
    $segunda1 = $jan4 - (((int) gmdate('w', $jan4) + 6) % 7) * 86400;
    $inicio = $segunda1 + ($semana - 1) * 7 * 86400;
    return ['inicio' => _isoDia($inicio), 'fim' => _isoDia($inicio + 6 * 86400)];
}

function semanasNoAno(int $ano): int
{
    return semanaIso("$ano-12-28")['semana'];
}

function rotuloSemana(int $ano, int $semana): string
{
    $s = diasDaSemana($ano, $semana);
    return "Semana $semana/$ano · " . _brDia($s['inicio'], false) . ' a ' . _brDia($s['fim'], false);
}

/** Interpreta os parâmetros da URL. Sem parâmetros: o dia de hoje. */
function lerPeriodo(array $p, ?string $hoje = null): array
{
    $hoje ??= diaLocal();
    $semanaHoje = semanaIso($hoje);
    $anoHoje = (int) substr($hoje, 0, 4);
    $tipo = in_array($p['periodo'] ?? '', ['dia', 'semana', 'mes', 'intervalo', 'todos'], true) ? $p['periodo'] : 'dia';
    $dia = _diaValido($p['dia'] ?? null) ? $p['dia'] : $hoje;
    $anoP = (int) ($p['ano'] ?? 0);
    $ano = $anoP >= 2000 && $anoP <= 2100 ? $anoP : ($tipo === 'semana' ? $semanaHoje['ano'] : $anoHoje);
    $semana = min(max((int) ($p['semana'] ?? 0) ?: $semanaHoje['semana'], 1), semanasNoAno($ano));
    $mesP = (int) ($p['mes'] ?? 0);
    $mes = $mesP >= 1 && $mesP <= 12 ? $mesP : (int) substr($hoje, 5, 2);
    $de = _diaValido($p['de'] ?? null) ? $p['de'] : _isoDia(_utcDia($hoje) - 6 * 86400);
    $ate = _diaValido($p['ate'] ?? null) ? $p['ate'] : $hoje;
    if ($de > $ate) [$de, $ate] = [$ate, $de];

    $base = compact('tipo', 'dia', 'ano', 'semana', 'mes', 'de', 'ate') + ['inicio' => null, 'fim' => null];
    switch ($tipo) {
        case 'todos':
            return ['rotulo' => 'Geral · todo o histórico'] + $base;
        case 'semana':
            $s = diasDaSemana($ano, $semana);
            return ['inicio' => inicioDoDia($s['inicio']), 'fim' => fimDoDia($s['fim']), 'rotulo' => rotuloSemana($ano, $semana)] + $base;
        case 'mes':
            $primeiro = sprintf('%d-%02d-01', $ano, $mes);
            $proximo = $mes === 12 ? sprintf('%d-01-01', $ano + 1) : sprintf('%d-%02d-01', $ano, $mes + 1);
            return ['inicio' => inicioDoDia($primeiro), 'fim' => inicioDoDia($proximo), 'rotulo' => NOMES_MESES[$mes - 1] . " de $ano"] + $base;
        case 'intervalo':
            return ['inicio' => inicioDoDia($de), 'fim' => fimDoDia($ate), 'rotulo' => _brDia($de) . ' a ' . _brDia($ate)] + $base;
        default:
            return ['inicio' => inicioDoDia($dia), 'fim' => fimDoDia($dia), 'rotulo' => $dia === $hoje ? 'Hoje · ' . _brDia($dia) : _brDia($dia)] + $base;
    }
}

/**
 * Condição SQL de data para o período (vazia em "todos").
 * @return array{0:string, 1:array} [" AND col >= ? AND col < ?", params]
 */
function sqlPeriodo(array $p, string $coluna = 'criadoEm'): array
{
    if (empty($p['inicio']) || empty($p['fim'])) return ['', []];
    return [" AND $coluna >= ? AND $coluna < ?", [dbData($p['inicio']), dbData($p['fim'])]];
}
