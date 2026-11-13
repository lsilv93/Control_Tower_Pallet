<?php
declare(strict_types=1);
// Rótulos e filtros da auditoria (src/lib/auditoria.ts).

const ACOES_AUDITORIA = [
    'LOGIN' => 'Login',
    'LOGOUT' => 'Logout (Sair)',
    'LOGIN_FALHOU' => 'Tentativa de login falhou',
    'ALTERAR_SENHA' => 'Alteração de senha',
    'REDEFINIR_SENHA' => 'Senha redefinida',
    'SEED_ADMIN' => 'Criação do usuário inicial',
    'SEED_HUB' => 'Criação do CD Hub inicial',
    'GERAR_VALE' => 'Vale-pallet de fornecedor emitido',
    'GERAR_VALE_ENVIO' => 'Vale-pallet de envio emitido',
    'GERAR_VALE_QUEBRADOS' => 'Vale de pallets quebrados (para o CDJC) emitido',
    'GERAR_OCORRENCIA_FALTA' => 'Vale de Ocorrência de falta gerado',
    'GERAR_OCORRENCIA_SOBRA' => 'Vale de Ocorrência de sobra gerado',
    'CONFERENCIA_RECEBIMENTO' => 'Conferência de recebimento',
    'RESOLVER_OCORRENCIA' => 'Ocorrência resolvida',
    'REPARO_QUEBRADOS' => 'Reparo de quebrados',
    'INCLUIR_SALDO' => 'Inclusão manual de saldo',
    'REMOVER_SALDO' => 'Remoção manual de saldo',
    'CONFIGURAR_UNIDADE' => 'Configuração da unidade (Master)',
    'SELECIONAR_CD' => 'Seleção da unidade de operação',
    'EXCLUIR_VALE' => 'Vale-pallet excluído (cancelado)',
    'GERAR_AGENDA' => 'Retirada agendada',
    'VALIDAR_AGENDA' => 'Baixa de pagamento',
    'CANCELAR_AGENDA' => 'Agenda cancelada',
    'REGISTRAR_COMPRA' => 'Compra registrada',
    'EXPORTAR_RELATORIO' => 'Exportação de relatório',
    'EXPORTAR_AUDITORIA' => 'Exportação da auditoria',
];

/** Nome amigável do tipo de ação gravado na auditoria. */
function rotuloAcao(string $acao): string
{
    if (str_starts_with($acao, 'MOVIMENTACAO_')) {
        $tipo = substr($acao, strlen('MOVIMENTACAO_'));
        return 'Movimentação · ' . (ROTULO_TIPO[$tipo] ?? $tipo);
    }
    if (isset(ACOES_AUDITORIA[$acao])) return ACOES_AUDITORIA[$acao];
    if (preg_match('/^(CRIAR|EDITAR|INATIVAR|ATIVAR)_(.+)$/', $acao, $m)) {
        $verbo = ['CRIAR' => 'Cadastro', 'EDITAR' => 'Edição', 'INATIVAR' => 'Inativação', 'ATIVAR' => 'Ativação'][$m[1]];
        return "$verbo · " . str_replace('_', ' ', strtolower($m[2]));
    }
    return str_replace('_', ' ', strtolower($acao));
}

/**
 * Filtros da auditoria (padrão: últimos 30 dias, unidade de operação). "TODOS" (visão
 * global) inclui todas as unidades e os eventos sem unidade (login, cadastros).
 * @return array{filtros:array, where:string, params:array, descricao:string}
 */
function lerFiltrosAuditoria(array $p, array $acesso): array
{
    $re = '/^\d{4}-\d{2}-\d{2}$/';
    $hoje = diaLocal();
    $de = !empty($p['de']) && preg_match($re, $p['de']) ? $p['de'] : diaLocal(agoraUtc()->modify('-29 days'));
    $ate = !empty($p['ate']) && preg_match($re, $p['ate']) ? $p['ate'] : $hoje;
    $usuario = $p['usuario'] ?? '';
    $acao = $p['acao'] ?? '';
    $escolhido = null;
    foreach ($acesso['cds'] as $c) if ($c['id'] === ($p['cd'] ?? null)) $escolhido = $c;
    $cd = ($p['cd'] ?? '') === 'TODOS' && $acesso['admin'] ? 'TODOS' : ($escolhido['id'] ?? ($acesso['cd']['id'] ?? ''));
    $cdCodigo = '';
    if ($cd === 'TODOS') $cdCodigo = 'Todas as unidades';
    else foreach ($acesso['cds'] as $c) if ($c['id'] === $cd) $cdCodigo = $c['codigo'];
    [$a, $b] = $de < $ate ? [$de, $ate] : [$ate, $de];
    $where = 'a.`criadoEm` >= ? AND a.`criadoEm` < ?';
    $params = [dbData(inicioDoDia($a)), dbData(fimDoDia($b))];
    if ($cd && $cd !== 'TODOS') { $where .= ' AND a.`cdId` = ?'; $params[] = $cd; }
    if ($usuario) { $where .= ' AND a.`usuarioId` = ?'; $params[] = $usuario; }
    if ($acao === 'MOVIMENTACAO') $where .= " AND a.`acao` LIKE 'MOVIMENTACAO\\_%'";
    elseif ($acao) { $where .= ' AND a.`acao` = ?'; $params[] = $acao; }
    $descricao = ($cdCodigo ? "$cdCodigo · " : '') . 'Período ' . formatarData(inicioDoDia($de)) . ' a ' . formatarData(inicioDoDia($ate))
        . ($acao ? ' · ' . ($acao === 'MOVIMENTACAO' ? 'Todas as movimentações' : rotuloAcao($acao)) : '');
    return ['filtros' => compact('de', 'ate', 'usuario', 'acao', 'cd'), 'where' => $where, 'params' => $params, 'descricao' => $descricao];
}

/** Filtros do relatório da unidade (padrão: últimos 30 dias). */
function lerFiltrosRelatorio(array $p, string $cdId): array
{
    $re = '/^\d{4}-\d{2}-\d{2}$/';
    $de = !empty($p['de']) && preg_match($re, $p['de']) ? $p['de'] : diaLocal(agoraUtc()->modify('-29 days'));
    $ate = !empty($p['ate']) && preg_match($re, $p['ate']) ? $p['ate'] : diaLocal();
    $tipo = !empty($p['tipo']) && isset(ROTULO_TIPO[$p['tipo']]) ? $p['tipo'] : null;
    $where = 'm.`cdId` = ? AND m.`criadoEm` >= ? AND m.`criadoEm` < ?';
    $params = [$cdId, dbData(inicioDoDia($de)), dbData(fimDoDia($ate))];
    if ($tipo) { $where .= ' AND m.`tipo` = ?'; $params[] = $tipo; }
    return compact('de', 'ate', 'tipo', 'where', 'params');
}
