<?php
declare(strict_types=1);
// Datas no fuso de operação (America/Sao_Paulo, UTC-3 sem horário de verão). O banco guarda UTC.

const TZ_OPERACAO = 'America/Sao_Paulo';

function tzLocal(): DateTimeZone
{
    static $tz = null;
    return $tz ??= new DateTimeZone(TZ_OPERACAO);
}

function tzUtc(): DateTimeZone
{
    static $tz = null;
    return $tz ??= new DateTimeZone('UTC');
}

/** Converte valor do banco (UTC) ou DateTime em DateTimeImmutable UTC. */
function utc(DateTimeInterface|string|null $d): ?DateTimeImmutable
{
    if ($d === null || $d === '') return null;
    if ($d instanceof DateTimeInterface) return DateTimeImmutable::createFromInterface($d)->setTimezone(tzUtc());
    return new DateTimeImmutable($d, tzUtc());
}

/** Formato do banco (UTC, milissegundos). */
function dbData(DateTimeInterface $d): string
{
    return DateTimeImmutable::createFromInterface($d)->setTimezone(tzUtc())->format('Y-m-d H:i:s.v');
}

function agoraUtc(): DateTimeImmutable
{
    return new DateTimeImmutable('now', tzUtc());
}

/** "YYYY-MM-DD" da data no fuso de São Paulo. */
function diaLocal(DateTimeInterface|string|null $d = null): string
{
    $d = $d === null ? agoraUtc() : utc($d);
    return $d->setTimezone(tzLocal())->format('Y-m-d');
}

/** Início (00:00 local) do dia "YYYY-MM-DD", em UTC. */
function inicioDoDia(?string $dia = null): DateTimeImmutable
{
    $dia ??= diaLocal();
    return (new DateTimeImmutable($dia . 'T00:00:00-03:00'))->setTimezone(tzUtc());
}

/** Início do dia seguinte (limite exclusivo). */
function fimDoDia(?string $dia = null): DateTimeImmutable
{
    return inicioDoDia($dia)->modify('+1 day');
}

function inicioDoMes(DateTimeInterface|string|null $d = null): DateTimeImmutable
{
    return inicioDoDia(substr(diaLocal($d), 0, 7) . '-01');
}

/** Dias corridos desde a data (calendário local). */
function idadeEmDias(DateTimeInterface|string $desde, DateTimeInterface|string|null $agora = null): int
{
    $ms = inicioDoDia(diaLocal($agora))->getTimestamp() - inicioDoDia(diaLocal($desde))->getTimestamp();
    return (int) round($ms / 86400);
}

/** 07/11/2026, 20:48:26 */
function formatarDataHora(DateTimeInterface|string|null $d): string
{
    $d = utc($d);
    return $d ? $d->setTimezone(tzLocal())->format('d/m/Y, H:i:s') : '—';
}

/** 07/11/2026 */
function formatarData(DateTimeInterface|string|null $d): string
{
    $d = utc($d);
    return $d ? $d->setTimezone(tzLocal())->format('d/m/Y') : '—';
}

/** Data pura (coluna DATE, sem fuso): 2026-11-07 → 07/11/2026. */
function formatarDataPura(?string $d): string
{
    if (!$d) return '—';
    [$a, $m, $dd] = explode('-', substr($d, 0, 10));
    return "$dd/$m/$a";
}

/** Milissegundos desde a época (para cálculos de idade em horas). */
function msDe(DateTimeInterface|string $d): int
{
    $u = utc($d);
    return (int) ($u->format('U') * 1000 + (int) $u->format('v'));
}
