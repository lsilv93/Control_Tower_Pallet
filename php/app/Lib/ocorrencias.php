<?php
declare(strict_types=1);
// Escopo e textos das ocorrências (src/lib/ocorrencias.ts).

/**
 * Ocorrências pendentes aguardando resposta de uma das unidades do usuário (todas, para
 * administradores). @return array{0:string, 1:array} [condição SQL sobre a tabela v, params]
 */
function filtroAguardandoUsuario(array $u, string $alias = 'v'): array
{
    $ids = unidadesDoEscopo($u);
    $cond = "$alias.`tipo` = 'OCORRENCIA' AND $alias.`status` = 'PENDENTE'";
    if ($ids === null) return ["$cond AND $alias.`aguardandoId` IS NOT NULL", []];
    return ["$cond AND $alias.`aguardandoId` IN (" . Db::in($ids) . ')', $ids];
}

function contarPendenciasDoUsuario(array $u): int
{
    [$w, $p] = filtroAguardandoUsuario($u);
    return (int) Db::val("SELECT COUNT(*) FROM `ValePallet` v WHERE $w", $p);
}

/** O que acontece na conta corrente se a unidade da vez aceitar (texto da confirmação). */
function efeitoDoAceite(?string $ocorrencia, int $quantidade, string $cdCodigo, string $recebedorCodigo, bool $peloRemetente): string
{
    $q = "$quantidade pallet(s)";
    if ($ocorrencia === 'FALTA') {
        return $peloRemetente ? "$q baixados como perda de $cdCodigo" : "$q assumidos no estoque de $recebedorCodigo (o remetente $cdCodigo fica quite)";
    }
    return $peloRemetente
        ? "$q saem do estoque de $cdCodigo como enviados (a sobra fica com $recebedorCodigo)"
        : "$q de sobra incorporados ao estoque de $recebedorCodigo";
}
