<?php
declare(strict_types=1);
// Agendas de devolução, baixa de pagamento, leitura e exclusão de vales (src/actions/vales.ts).

/** Gera agenda(s) de devolução a partir dos vales selecionados (uma por fornecedor). */
function acao_vales_agendar(): array
{
    $usuario = exigirModuloFornecedor();
    $valeIds = array_values(array_unique(fLista('valeIds')));
    if (!$valeIds) throw new ErroNegocio('Selecione ao menos um vale.');
    $dataHoraTxt = f('dataHora');
    // datetime-local do navegador ("YYYY-MM-DDTHH:MM"), no fuso de operação (São Paulo).
    if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $dataHoraTxt)) throw new ErroNegocio('Informe a data e a hora da retirada.');
    $observacao = textoOpcional(f('observacao'), 500);
    try {
        $dataHora = (new DateTimeImmutable("$dataHoraTxt:00-03:00"))->setTimezone(tzUtc());
    } catch (Exception) {
        throw new ErroNegocio('Data/hora da retirada inválida.');
    }
    if ($dataHora < inicioDoDia()) throw new ErroNegocio('A retirada não pode ser agendada para uma data passada.');
    $cd = $usuario['cd'];

    $agendas = Db::tx(function () use ($valeIds, $cd, $usuario, $dataHora, $observacao) {
        $vales = Db::all("SELECT `id`, `status`, `fornecedorId` FROM `ValePallet` WHERE `cdId` = ? AND `tipo` = 'FORNECEDOR' AND `id` IN (" . Db::in($valeIds) . ') FOR UPDATE', [$cd['id'], ...$valeIds]);
        if (count($vales) !== count($valeIds)) throw new ErroNegocio('Um ou mais vales não foram encontrados neste CD (somente vales de fornecedor são agendados).');
        foreach ($vales as $v) if ($v['status'] !== 'PENDENTE') throw new ErroNegocio('Somente vales com status Pendente podem ser agendados.');
        $porFornecedor = [];
        foreach ($vales as $v) $porFornecedor[$v['fornecedorId']][] = $v['id'];
        $criadas = [];
        foreach ($porFornecedor as $fornecedorId => $ids) {
            $agId = Db::insert('AgendaDevolucao', ['cdId' => $cd['id'], 'fornecedorId' => $fornecedorId, 'dataPrevista' => dbData($dataHora), 'observacao' => $observacao, 'criadoPorId' => $usuario['id'], 'criadoEm' => Db::agora()]);
            $numero = (int) Db::val('SELECT `numero` FROM `AgendaDevolucao` WHERE `id` = ?', [$agId]);
            // Filtro de status evita agendar o mesmo vale duas vezes em requisições concorrentes.
            $count = Db::exec("UPDATE `ValePallet` SET `status` = 'AGENDADO', `agendaId` = ? WHERE `status` = 'PENDENTE' AND `id` IN (" . Db::in($ids) . ')', [$agId, ...$ids]);
            if ($count !== count($ids)) throw new ErroNegocio('Alguns vales foram alterados por outro usuário. Atualize a página.');
            auditar(['acao' => 'GERAR_AGENDA', 'entidade' => 'AgendaDevolucao', 'entidadeId' => $agId, 'usuarioId' => $usuario['id'], 'cdId' => $cd['id'], 'detalhes' => ['numero' => $numero, 'vales' => $ids, 'dataHoraRetirada' => $dataHora->format('Y-m-d\TH:i:s.v\Z')]]);
            $criadas[] = $numero;
        }
        return $criadas;
    });
    return sucesso('Retirada agendada para ' . formatarDataHora($dataHora) . ': ' . implode(', ', array_map('numeroAgenda', $agendas)) . '.', ['recarregar' => true]);
}

/** Baixa de pagamento: valida a agenda, finaliza os vales e dá saída oficial da conta corrente. */
function acao_vales_validar_agenda(): array
{
    $usuario = exigirModuloFornecedor();
    $agendaId = f('agendaId');
    $observacao = f('observacao') ?: null;
    $cd = $usuario['cd'];
    [$numero, $total, $fornecedor] = comContaBloqueada(function () use ($agendaId, $observacao, $cd, $usuario) {
        $agora = Db::agora();
        // Reivindica a agenda atomicamente (bloqueia contra cancelamento concorrente).
        $count = Db::exec("UPDATE `AgendaDevolucao` SET `status` = 'VALIDADA', `validadoEm` = ?, `validadoPorId` = ? WHERE `id` = ? AND `status` = 'ABERTA' AND `cdId` = ?", [$agora, $usuario['id'], $agendaId, $cd['id']]);
        if ($count !== 1) throw new ErroNegocio('Agenda não encontrada ou não está aberta.');
        $agenda = Db::one('SELECT a.*, f.`nome` AS fornecedorNome FROM `AgendaDevolucao` a JOIN `Fornecedor` f ON f.`id` = a.`fornecedorId` WHERE a.`id` = ?', [$agendaId]);
        $vales = Db::all('SELECT `id`, `quantidade` FROM `ValePallet` WHERE `agendaId` = ?', [$agendaId]);
        foreach ($vales as $v) {
            lancar([
                'tipo' => 'DEVOLUCAO_FORNECEDOR', 'quantidade' => (int) $v['quantidade'], 'usuarioId' => $usuario['id'], 'cdId' => $cd['id'],
                'fornecedorId' => $agenda['fornecedorId'], 'valeId' => $v['id'], 'agendaId' => $agendaId,
                'observacao' => 'Baixa ' . numeroAgenda($agenda['numero']) . ($observacao ? " - $observacao" : ''),
            ]);
        }
        Db::exec("UPDATE `ValePallet` SET `status` = 'FINALIZADO', `finalizadoEm` = ? WHERE `agendaId` = ?", [$agora, $agendaId]);
        if ($observacao) Db::update('AgendaDevolucao', ['observacao' => implode(' | ', array_filter([$agenda['observacao'], $observacao]))], '`id` = ?', [$agendaId]);
        $total = array_sum(array_map(fn($v) => (int) $v['quantidade'], $vales));
        auditar(['acao' => 'VALIDAR_AGENDA', 'entidade' => 'AgendaDevolucao', 'entidadeId' => $agendaId, 'usuarioId' => $usuario['id'], 'cdId' => $cd['id'], 'detalhes' => ['numero' => (int) $agenda['numero'], 'total' => $total]]);
        return [(int) $agenda['numero'], $total, $agenda['fornecedorNome']];
    });
    // O card da agenda some após a baixa; a confirmação é exibida no topo da página.
    redirecionar('/agendas?ok=' . rawurlencode(numeroAgenda($numero) . " validada: $total pallet(s) devolvidos a $fornecedor"));
}

function acao_vales_cancelar_agenda(): array
{
    $usuario = exigirModuloFornecedor();
    $agendaId = f('agendaId');
    $cd = $usuario['cd'];
    $numero = Db::tx(function () use ($agendaId, $cd, $usuario) {
        $count = Db::exec("UPDATE `AgendaDevolucao` SET `status` = 'CANCELADA', `canceladoEm` = ? WHERE `id` = ? AND `status` = 'ABERTA' AND `cdId` = ?", [Db::agora(), $agendaId, $cd['id']]);
        if ($count !== 1) throw new ErroNegocio('Agenda não encontrada ou não está aberta.');
        Db::exec("UPDATE `ValePallet` SET `status` = 'PENDENTE', `agendaId` = NULL WHERE `agendaId` = ?", [$agendaId]);
        auditar(['acao' => 'CANCELAR_AGENDA', 'entidade' => 'AgendaDevolucao', 'entidadeId' => $agendaId, 'usuarioId' => $usuario['id'], 'cdId' => $cd['id']]);
        return (int) Db::val('SELECT `numero` FROM `AgendaDevolucao` WHERE `id` = ?', [$agendaId]);
    });
    redirecionar('/agendas?ok=' . rawurlencode(numeroAgenda($numero) . ' cancelada. Os vales voltaram para Pendente.'));
}

/**
 * Identifica o vale da unidade ativa a partir da leitura do código de barras ("VP-000123"...).
 * Resposta: {ok, id, numero, codigo, status, texto} ou {ok:false, erro}.
 */
function acao_vales_buscar(): array
{
    $leitura = f('leitura');
    try {
        $cdId = exigir('vales', 'fornecedor')['cd']['id'];
    } catch (ErroNegocio $e) {
        return ['ok' => false, 'erro' => $e->getMessage()];
    }
    $numero = lerCodigoVale($leitura);
    if ($numero === null) return ['ok' => false, 'erro' => "Código \"$leitura\" não é de um vale-pallet."];
    $vale = Db::one(
        'SELECT v.*, f.`nome` AS fornecedorNome, u.`codigo` AS unidadeCodigo, u.`nome` AS unidadeNome, a.`numero` AS agendaNumero
           FROM `ValePallet` v LEFT JOIN `Fornecedor` f ON f.`id` = v.`fornecedorId` LEFT JOIN `CentroDistribuicao` u ON u.`id` = v.`unidadeId`
           LEFT JOIN `AgendaDevolucao` a ON a.`id` = v.`agendaId` WHERE v.`numero` = ?',
        [$numero],
    );
    if (!$vale || $vale['cdId'] !== $cdId) return ['ok' => false, 'erro' => "Vale nº $numero não encontrado neste CD."];
    $codigo = numeroVale($numero, $vale['tipo']);
    $detalhe = match (true) {
        $vale['status'] === 'CANCELADO' => 'CANCELADO (excluído) em ' . formatarDataHora($vale['canceladoEm']),
        $vale['status'] === 'FINALIZADO' => 'baixado em ' . formatarDataHora($vale['finalizadoEm']),
        $vale['status'] === 'AGENDADO' && $vale['agendaNumero'] => 'agendado em ' . numeroAgenda($vale['agendaNumero']),
        default => 'pendente de devolução',
    };
    $parte = $vale['fornecedorNome'] ?? ($vale['unidadeCodigo'] ? "{$vale['unidadeCodigo']} - {$vale['unidadeNome']}" : ROTULO_TIPO_VALE[$vale['tipo']]);
    return ['ok' => true, 'id' => $vale['id'], 'numero' => $numero, 'codigo' => $codigo, 'status' => $vale['status'], 'texto' => "$codigo · $parte · {$vale['quantidade']} pallet(s) · $detalhe"];
}

/**
 * Exclusão (cancelamento) de vale emitido incorretamente pela unidade ativa. Exclusão lógica:
 * o vale fica CANCELADO e o lançamento é estornado (envio volta do trânsito ao estoque ou ao
 * acumulador de remessas; vale de fornecedor reduz o saldo devido ao fornecedor).
 */
function acao_vales_excluir(): array
{
    $usuario = exigir('excluir_vale');
    $valeId = f('valeId');
    if ($valeId === '') throw new ErroNegocio('Busque o vale a ser excluído.');
    $motivo = f('motivo');
    if (!isset(ROTULO_MOTIVO_CANCELAMENTO[$motivo])) throw new ErroNegocio('Selecione o motivo do cancelamento.');
    $observacao = textoOpcional(f('observacao'), 500);
    $cd = $usuario['cd'];

    $vale = comContaBloqueada(function () use ($valeId, $cd, $usuario, $motivo, $observacao) {
        $vale = Db::one(
            'SELECT v.*, f.`nome` AS fornecedorNome, u.`codigo` AS unidadeCodigo, u.`nome` AS unidadeNome, a.`numero` AS agendaNumero
               FROM `ValePallet` v LEFT JOIN `Fornecedor` f ON f.`id` = v.`fornecedorId` LEFT JOIN `CentroDistribuicao` u ON u.`id` = v.`unidadeId`
               LEFT JOIN `AgendaDevolucao` a ON a.`id` = v.`agendaId` WHERE v.`id` = ? FOR UPDATE',
            [$valeId],
        );
        if (!$vale || $vale['cdId'] !== $cd['id']) throw new ErroNegocio('Vale não encontrado entre os emitidos por esta unidade.');
        $codigo = numeroVale($vale['numero'], $vale['tipo']);
        if ($vale['tipo'] === 'OCORRENCIA') throw new ErroNegocio("$codigo é um vale de ocorrência: ela é resolvida pelo administrador em Ocorrências.");
        if ($vale['tipo'] === 'FORNECEDOR' && !$cd['recebimentoFornecedor']) throw new ErroNegocio('O módulo Recebimento Pallet Fornecedor não está liberado para esta unidade.');
        if ($vale['status'] === 'CANCELADO') throw new ErroNegocio("$codigo já foi excluído.");
        if ($vale['status'] === 'FINALIZADO') {
            throw new ErroNegocio($vale['tipo'] === 'ENVIO' ? "$codigo já foi conferido no destino e não pode ser excluído." : "$codigo já foi baixado e não pode ser excluído.");
        }
        if ($vale['status'] === 'AGENDADO') {
            throw new ErroNegocio("$codigo está na agenda " . ($vale['agendaNumero'] ? numeroAgenda($vale['agendaNumero']) : '') . '. Cancele a agenda em Baixa de Pagamento antes de excluir.');
        }
        $agora = agoraUtc();
        $count = Db::exec(
            "UPDATE `ValePallet` SET `status` = 'CANCELADO', `canceladoEm` = ?, `canceladoPorId` = ?, `motivoCancelamento` = ?, `observacaoCancelamento` = ? WHERE `id` = ? AND `status` = 'PENDENTE'",
            [dbData($agora), $usuario['id'], $motivo, $observacao, $vale['id']],
        );
        if ($count !== 1) throw new ErroNegocio('O vale foi alterado por outro usuário. Atualize a página.');
        $texto = "Exclusão $codigo - " . ROTULO_MOTIVO_CANCELAMENTO[$motivo] . ($observacao ? " - $observacao" : '');
        $base = ['usuarioId' => $usuario['id'], 'cdId' => $cd['id'], 'valeId' => $vale['id'], 'observacao' => $texto];
        if ($vale['tipo'] === 'FORNECEDOR') {
            lancar($base + ['tipo' => 'ESTORNO_VALE', 'quantidade' => (int) $vale['quantidade'], 'fornecedorId' => $vale['fornecedorId']]);
        } else {
            $est = $base + ['tipo' => 'ESTORNO_ENVIO', 'unidadeId' => $vale['unidadeId']];
            if (!$vale['consomeEstoque']) lancar($est + ['destino' => 'REMESSA_CROSS', 'quantidade' => (int) $vale['quantidade']]);
            elseif ((int) $vale['quantidadeBons'] > 0) lancar($est + ['destino' => 'VAZIOS', 'quantidade' => (int) $vale['quantidadeBons']]);
            if ($vale['consomeEstoque'] && (int) $vale['quantidadeQuebrados'] > 0) lancar($est + ['destino' => 'QUEBRADOS', 'quantidade' => (int) $vale['quantidadeQuebrados']]);
        }
        auditar([
            'acao' => 'EXCLUIR_VALE', 'entidade' => 'ValePallet', 'entidadeId' => $vale['id'], 'usuarioId' => $usuario['id'], 'cdId' => $cd['id'],
            'quantidade' => (int) $vale['quantidade'], 'observacao' => $observacao,
            'detalhes' => [
                'vale' => $codigo, 'tipo' => ROTULO_TIPO_VALE[$vale['tipo']], 'motivo' => ROTULO_MOTIVO_CANCELAMENTO[$motivo], 'observacao' => $observacao,
                'quantidade' => (int) $vale['quantidade'], 'parte' => $vale['fornecedorNome'] ?? ($vale['unidadeCodigo'] ? "{$vale['unidadeCodigo']} - {$vale['unidadeNome']}" : null),
                'dataHora' => $agora->format('Y-m-d\TH:i:s.v\Z'),
            ],
        ]);
        return $vale;
    });
    $codigo = numeroVale($vale['numero'], $vale['tipo']);
    $rotMotivo = ROTULO_MOTIVO_CANCELAMENTO[$motivo];
    $mensagem = $vale['tipo'] === 'FORNECEDOR'
        ? "$codigo excluído ($rotMotivo). {$vale['quantidade']} pallet(s) estornados do saldo com o fornecedor."
        : "$codigo excluído ($rotMotivo). {$vale['quantidade']} pallet(s) voltaram do trânsito para o estoque de {$cd['codigo']}.";
    redirecionar('/vales/excluir?ok=' . rawurlencode($mensagem));
}
