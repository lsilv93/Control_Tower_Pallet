<?php
declare(strict_types=1);
// Envio entre unidades, conferência de recebimento e ocorrências (src/actions/transferencias.ts).

/** Unidade (CentroDistribuicao) por id, com booleanos normalizados. */
function _unidade(string $id): ?array
{
    return normalizarUnidade(Db::one('SELECT * FROM `CentroDistribuicao` WHERE `id` = ?', [$id]));
}

// ---------------- Envio entre unidades ----------------
/**
 * Envio de pallets (bons e/ou quebrados) da unidade ativa para outra unidade. Sai do estoque
 * da origem (bloqueado sem saldo) e fica em trânsito até a conferência no destino. CD → Cross
 * não exige nem consome estoque (acumulador REMESSA_CROSS). Gera o Vale-Pallet de Envio.
 */
function acao_transferencias_enviar(): array
{
    $u = exigir('envio');
    $modo = f('modo');
    if (!in_array($modo, ['CROSS', 'CD', 'HUB'], true)) throw new ErroNegocio('Modo de envio inválido.');
    $unidadeId = f('unidadeId');
    if ($unidadeId === '') throw new ErroNegocio('Selecione a unidade de destino.');
    $bons = inteiro(f('quantidadeBons'), 'a quantidade de Pallets PBR');
    $quebrados = inteiro(f('quantidadeQuebrados'), 'a quantidade de Pallets Quebrados');
    $transportadoraId = f('transportadoraId');
    if ($transportadoraId === '') throw new ErroNegocio('Selecione o transportador.');
    $placa = placaOpcional(f('placa'));
    $rota = textoOpcional(f('rota'), 60);
    $dataFaturamento = f('dataFaturamento') ?: null;
    if ($dataFaturamento && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dataFaturamento)) throw new ErroNegocio('Data de faturamento inválida.');
    $observacao = textoOpcional(f('observacao'), 500);
    $total = $bons + $quebrados;
    if ($total <= 0) throw new ErroNegocio('Informe a quantidade de pallets a enviar.');
    if ($modo === 'HUB' && $bons > 0) throw new ErroNegocio('Para o CDJC (Hub) são enviados somente Pallets Quebrados.');
    $cd = $u['cd'];

    $valeId = comContaBloqueada(function () use ($u, $cd, $modo, $unidadeId, $bons, $quebrados, $total, $transportadoraId, $placa, $rota, $dataFaturamento, $observacao) {
        $destino = _unidade($unidadeId);
        if (!$destino || !$destino['ativo']) throw new ErroNegocio('Unidade de destino inválida ou inativa.');
        if ($destino['id'] === $cd['id']) throw new ErroNegocio('O destino não pode ser a própria unidade.');
        if ($modo === 'CROSS' && $destino['tipo'] !== 'CROSS') throw new ErroNegocio('Selecione um Ponto de Cross.');
        if ($modo === 'CD' && $destino['tipo'] !== 'CD') throw new ErroNegocio('Selecione um CD.');
        if ($modo === 'HUB' && !$destino['hub']) throw new ErroNegocio('O destino dos quebrados deve ser o CD Hub (CDJC).');
        // Ponto de Cross x CD: só circulam pallets entre o Cross e os CDs vinculados a ele.
        if ($cd['tipo'] === 'CROSS') {
            if ($destino['tipo'] !== 'CD' || $modo !== 'CD') throw new ErroNegocio('O Ponto de Cross devolve pallets somente para um CD vinculado.');
            if (!Db::val('SELECT 1 FROM `CrossCD` WHERE `crossId` = ? AND `cdId` = ?', [$cd['id'], $destino['id']])) {
                throw new ErroNegocio("{$destino['codigo']} não é um CD vinculado a {$cd['codigo']}. Selecione um dos CDs atendidos por este Ponto de Cross.");
            }
        }
        if ($destino['tipo'] === 'CROSS' && !Db::val('SELECT 1 FROM `CrossCD` WHERE `crossId` = ? AND `cdId` = ?', [$destino['id'], $cd['id']])) {
            throw new ErroNegocio("O Ponto de Cross {$destino['codigo']} não está vinculado a {$cd['codigo']}. Vincule-o em Cadastros → Pontos de Cross.");
        }
        $transp = Db::one('SELECT `nome`, `ativo` FROM `Transportadora` WHERE `id` = ?', [$transportadoraId]);
        if (!$transp || !$transp['ativo']) throw new ErroNegocio('Transportador inválido ou inativo. Selecione um transportador cadastrado.');

        // CD → Cross não exige nem consome estoque; CD → CD e Cross → CD saem do estoque da origem.
        $consomeEstoque = !($cd['tipo'] === 'CD' && $destino['tipo'] === 'CROSS');
        $valeId = Db::insert('ValePallet', [
            'tipo' => 'ENVIO',
            'consomeEstoque' => $consomeEstoque,
            'cdId' => $cd['id'],
            'unidadeId' => $destino['id'],
            'quantidadeBons' => $bons,
            'quantidadeQuebrados' => $quebrados,
            'quantidade' => $total,
            'transportadora' => $transp['nome'],
            'placa' => $placa,
            'rota' => $rota,
            'dataFaturamento' => $dataFaturamento,
            'observacao' => $observacao,
            'criadoPorId' => $u['id'],
            'criadoEm' => Db::agora(),
        ]);
        $numero = (int) Db::val('SELECT `numero` FROM `ValePallet` WHERE `id` = ?', [$valeId]);
        $codigo = numeroVale($numero, 'ENVIO');
        $obs = implode(' - ', array_filter([$codigo, 'para ' . rotuloUnidade($destino), $transp['nome'], $placa, $rota ? "Rota $rota" : null, $observacao]));
        $base = ['tipo' => 'ENVIO', 'usuarioId' => $u['id'], 'cdId' => $cd['id'], 'unidadeId' => $destino['id'], 'valeId' => $valeId, 'observacao' => $obs];
        if (!$consomeEstoque) {
            lancar($base + ['origem' => 'REMESSA_CROSS', 'quantidade' => $total], $cd['codigo']);
        } else {
            if ($bons > 0) lancar($base + ['origem' => 'VAZIOS', 'quantidade' => $bons], $cd['codigo']);
            if ($quebrados > 0) lancar($base + ['origem' => 'QUEBRADOS', 'quantidade' => $quebrados], $cd['codigo']);
        }
        auditar([
            'acao' => $modo === 'HUB' ? 'GERAR_VALE_QUEBRADOS' : 'GERAR_VALE_ENVIO',
            'entidade' => 'ValePallet',
            'entidadeId' => $valeId,
            'usuarioId' => $u['id'],
            'cdId' => $cd['id'],
            'destino' => 'TRANSITO',
            'quantidade' => $total,
            'observacao' => "$codigo para " . rotuloUnidade($destino),
            'detalhes' => ['numero' => $numero, 'origem' => $cd['codigo'], 'destino' => $destino['codigo'], 'bons' => $bons, 'quebrados' => $quebrados, 'transportadora' => $transp['nome'], 'placa' => $placa, 'rota' => $rota, 'dataFaturamento' => $dataFaturamento],
        ]);
        return $valeId;
    });
    redirecionar("/imprimir/vale/$valeId?auto=1");
}

// ---------------- Recebimento / conferência ----------------
/**
 * Conferência na unidade ativa: os vales (mesmo remetente) são baixados e a contagem física
 * entra no estoque. Falta → Vale de Ocorrência pendente; sobra → estoque + ocorrência de sobra.
 */
function acao_transferencias_conferir(): array
{
    $u = exigir('recebimento');
    $remetenteId = f('remetenteId');
    if ($remetenteId === '') throw new ErroNegocio('Selecione a unidade remetente.');
    $valeIds = array_values(array_unique(fLista('valeIds')));
    if (!$valeIds) throw new ErroNegocio('Selecione ao menos um vale recebido.');
    $recBons = inteiro(f('recebidoBons'), 'a quantidade de Pallets PBR recebidos');
    $recQuebr = inteiro(f('recebidoQuebrados'), 'a quantidade de Pallets Quebrados recebidos');
    $confirmar = f('confirmarDivergencia') === '1';
    $placa = placaOpcional(f('placa'));
    $transportadoraId = textoOpcional(f('transportadoraId'), 60);
    $observacao = textoOpcional(f('observacao'), 500);
    $cd = $u['cd'];

    $r = comContaBloqueada(function () use ($u, $cd, $remetenteId, $valeIds, $recBons, $recQuebr, $confirmar, $placa, $transportadoraId, $observacao) {
        $remetente = _unidade($remetenteId);
        if (!$remetente) throw new ErroNegocio('Unidade remetente inválida.');
        // Transportadora (opcional) sempre escolhida no cadastro de transportadoras ativas.
        $transp = $transportadoraId ? Db::one('SELECT `nome`, `ativo` FROM `Transportadora` WHERE `id` = ?', [$transportadoraId]) : null;
        if ($transportadoraId && (!$transp || !$transp['ativo'])) throw new ErroNegocio('Transportadora inválida ou inativa. Selecione uma transportadora cadastrada.');
        $nomeTransp = $transp['nome'] ?? null;
        $vales = Db::all('SELECT * FROM `ValePallet` WHERE `id` IN (' . Db::in($valeIds) . ') FOR UPDATE', $valeIds);
        if (count($vales) !== count($valeIds)) throw new ErroNegocio('Um ou mais vales não foram encontrados.');
        foreach ($vales as $v) {
            $codigo = numeroVale($v['numero'], $v['tipo']);
            if ($v['tipo'] !== 'ENVIO' || $v['unidadeId'] !== $cd['id']) throw new ErroNegocio("$codigo não é um envio destinado a {$cd['codigo']}.");
            if ($v['cdId'] !== $remetente['id']) throw new ErroNegocio("$codigo não foi enviado por {$remetente['codigo']}.");
            if ($v['status'] !== 'PENDENTE') throw new ErroNegocio("$codigo já foi conferido ou cancelado.");
        }
        $declarado = array_sum(array_map(fn($v) => (int) $v['quantidade'], $vales));
        $recebido = $recBons + $recQuebr;
        $diferenca = $recebido - $declarado;
        if ($diferenca !== 0) {
            if (!$confirmar) {
                throw new ErroNegocio(($diferenca < 0 ? 'Falta' : 'Sobra') . ' de ' . n(abs($diferenca)) . ' pallet(s): recebido ' . n($recebido) . ' x enviado ' . n($declarado) . '. Confirme a divergência.');
            }
            if (!$observacao || mb_strlen($observacao) < 5) throw new ErroNegocio('Divergência: a observação/justificativa é obrigatória (mínimo 5 caracteres).');
        }

        $agora = Db::agora();
        $confId = Db::insert('Conferencia', [
            'cdId' => $cd['id'],
            'remetenteId' => $remetente['id'],
            'totalDeclarado' => $declarado,
            'recebidoBons' => $recBons,
            'recebidoQuebrados' => $recQuebr,
            'diferenca' => $diferenca,
            'placa' => $placa,
            'transportadora' => $nomeTransp,
            'observacao' => $observacao,
            'usuarioId' => $u['id'],
            'criadoEm' => $agora,
        ]);
        $confNumero = (int) Db::val('SELECT `numero` FROM `Conferencia` WHERE `id` = ?', [$confId]);
        $count = Db::exec("UPDATE `ValePallet` SET `status` = 'FINALIZADO', `finalizadoEm` = ?, `conferenciaId` = ? WHERE `status` = 'PENDENTE' AND `id` IN (" . Db::in($valeIds) . ')', [$agora, $confId, ...$valeIds]);
        if ($count !== count($valeIds)) throw new ErroNegocio('Alguns vales foram conferidos por outro usuário. Atualize a página.');

        $codigos = implode(', ', array_map(fn($v) => numeroVale($v['numero'], $v['tipo']), $vales));
        $rc = numeroConferencia($confNumero);
        $base = min($recebido, $declarado);
        $falta = max(0, -$diferenca);
        $sobra = max(0, $diferenca);

        // Livro do remetente: baixa o trânsito; a falta vira ocorrência a devolver.
        if ($base > 0) {
            lancar(['tipo' => 'BAIXA_TRANSITO', 'quantidade' => $base, 'usuarioId' => $u['id'], 'cdId' => $remetente['id'], 'unidadeId' => $cd['id'], 'conferenciaId' => $confId, 'observacao' => "$rc - $codigos conferidos em {$cd['codigo']}"], $remetente['codigo']);
        }
        // Livro do recebedor: entra o físico (o declarado como recebido; o excedente como sobra).
        $bonsBase = min($recBons, $base);
        $quebradosBase = $base - $bonsBase;
        $sobraBons = $recBons - $bonsBase;
        $sobraQuebrados = $recQuebr - $quebradosBase;
        $obsRec = "$rc - $codigos de {$remetente['codigo']}";
        $rec = ['tipo' => 'RECEBIMENTO', 'usuarioId' => $u['id'], 'cdId' => $cd['id'], 'unidadeId' => $remetente['id'], 'conferenciaId' => $confId, 'observacao' => $obsRec];
        if ($bonsBase > 0) lancar($rec + ['destino' => 'VAZIOS', 'quantidade' => $bonsBase]);
        if ($quebradosBase > 0) lancar($rec + ['destino' => 'QUEBRADOS', 'quantidade' => $quebradosBase]);

        $ocorrencia = null;
        $dadosOc = [
            'tipo' => 'OCORRENCIA',
            'cdId' => $remetente['id'],
            'unidadeId' => $cd['id'],
            'transportadora' => $nomeTransp,
            'placa' => $placa,
            'conferenciaOrigemId' => $confId,
            'criadoPorId' => $u['id'],
            // Remessa CD → Cross não consumiu estoque: o aceite de uma sobra pelo remetente também não consome.
            'consomeEstoque' => array_reduce($vales, fn($c, $v) => $c && (bool) $v['consomeEstoque'], true),
            'aguardandoId' => $remetente['id'],
            'criadoEm' => $agora,
        ];
        if ($falta > 0) {
            // Quanto da falta é de Pallets PBR e quanto de Quebrados (pelo declarado nos vales).
            $declaradoBons = array_sum(array_map(fn($v) => (int) $v['quantidadeBons'], $vales));
            $faltaBons = min($falta, max(0, $declaradoBons - $recBons));
            $ocId = Db::insert('ValePallet', $dadosOc + [
                'ocorrencia' => 'FALTA',
                'quantidade' => $falta,
                'quantidadeBons' => $faltaBons,
                'quantidadeQuebrados' => $falta - $faltaBons,
                'observacao' => "FALTA na conferência $rc em {$cd['codigo']}: $codigos somam $declarado, recebidos $recebido (PBR $recBons, quebrados $recQuebr). $observacao",
            ]);
            $ocorrencia = ['id' => $ocId, 'numero' => (int) Db::val('SELECT `numero` FROM `ValePallet` WHERE `id` = ?', [$ocId])];
            lancar(['tipo' => 'FALTA', 'quantidade' => $falta, 'usuarioId' => $u['id'], 'cdId' => $remetente['id'], 'unidadeId' => $cd['id'], 'valeId' => $ocId, 'conferenciaId' => $confId, 'observacao' => numeroVale($ocorrencia['numero'], 'OCORRENCIA') . " - falta de $falta na $rc"], $remetente['codigo']);
        }
        if ($sobra > 0) {
            $ocId = Db::insert('ValePallet', $dadosOc + [
                'ocorrencia' => 'SOBRA',
                'quantidade' => $sobra,
                'quantidadeBons' => $sobraBons,
                'quantidadeQuebrados' => $sobraQuebrados,
                'observacao' => "SOBRA na conferência $rc em {$cd['codigo']}: $codigos somam $declarado, recebidos $recebido. $observacao",
            ]);
            $ocorrencia = ['id' => $ocId, 'numero' => (int) Db::val('SELECT `numero` FROM `ValePallet` WHERE `id` = ?', [$ocId])];
            $obsSobra = numeroVale($ocorrencia['numero'], 'OCORRENCIA') . " - sobra de $sobra na $rc";
            $sob = ['tipo' => 'SOBRA', 'usuarioId' => $u['id'], 'cdId' => $cd['id'], 'unidadeId' => $remetente['id'], 'valeId' => $ocId, 'conferenciaId' => $confId, 'observacao' => $obsSobra];
            if ($sobraBons > 0) lancar($sob + ['destino' => 'VAZIOS', 'quantidade' => $sobraBons]);
            if ($sobraQuebrados > 0) lancar($sob + ['destino' => 'QUEBRADOS', 'quantidade' => $sobraQuebrados]);
        }
        auditar([
            'acao' => 'CONFERENCIA_RECEBIMENTO',
            'entidade' => 'Conferencia',
            'entidadeId' => $confId,
            'usuarioId' => $u['id'],
            'cdId' => $cd['id'],
            'quantidade' => $recebido,
            'observacao' => $observacao,
            'detalhes' => ['numero' => $confNumero, 'remetente' => $remetente['codigo'], 'vales' => $codigos, 'declarado' => $declarado, 'recebidoBons' => $recBons, 'recebidoQuebrados' => $recQuebr, 'diferenca' => $diferenca],
        ]);
        if ($ocorrencia) {
            Db::insert('OcorrenciaInteracao', ['valeId' => $ocorrencia['id'], 'acao' => 'ABERTURA', 'unidadeId' => $cd['id'], 'usuarioId' => $u['id'], 'justificativa' => $observacao, 'criadoEm' => $agora]);
            auditar([
                'acao' => $falta > 0 ? 'GERAR_OCORRENCIA_FALTA' : 'GERAR_OCORRENCIA_SOBRA',
                'entidade' => 'ValePallet',
                'entidadeId' => $ocorrencia['id'],
                'usuarioId' => $u['id'],
                'cdId' => $cd['id'],
                'quantidade' => $falta ?: $sobra,
                'observacao' => $observacao,
                'detalhes' => ['numero' => $ocorrencia['numero'], 'conferencia' => $rc, 'remetente' => $remetente['codigo'], 'recebedor' => $cd['codigo'], 'declarado' => $declarado, 'recebido' => $recebido],
            ]);
        }
        return compact('remetente', 'recebido', 'ocorrencia', 'rc');
    });

    redirecionar($r['ocorrencia']
        ? "/imprimir/vale/{$r['ocorrencia']['id']}?auto=1"
        : '/recebimento?ok=' . rawurlencode("{$r['rc']} registrada: " . n($r['recebido']) . " pallet(s) de {$r['remetente']['codigo']} conferidos e somados ao estoque de {$cd['codigo']}. Sem divergência."));
}

// ---------------- Ocorrência: aceite ou recusa ----------------
/**
 * Resposta da unidade da vez. Recusar (com justificativa ≥ 10) devolve a pendência à outra
 * unidade; o aceite encerra a ocorrência e ajusta a conta corrente em definitivo.
 */
function acao_transferencias_responder_ocorrencia(): array
{
    $aba = preg_replace('/[^a-z]/', '', f('aba') ?: 'acao') ?: 'acao';
    $u = requireUsuario();
    $valeId = f('valeId');
    if ($valeId === '') throw new ErroNegocio('Ocorrência não encontrada.');
    $acao = f('acao');
    if (!in_array($acao, ['ACEITAR', 'RECUSAR'], true)) throw new ErroNegocio('Escolha aceitar ou recusar a ocorrência.');
    $justificativa = textoOpcional(f('justificativa'), 500);
    if ($acao === 'RECUSAR' && mb_strlen($justificativa ?? '') < 10) throw new ErroNegocio('Para recusar, a justificativa é obrigatória (mínimo 10 caracteres).');

    $mensagem = comContaBloqueada(function () use ($u, $valeId, $acao, $justificativa) {
        $vale = Db::one('SELECT * FROM `ValePallet` WHERE `id` = ? FOR UPDATE', [$valeId]);
        if (!$vale || $vale['tipo'] !== 'OCORRENCIA' || !$vale['ocorrencia'] || !$vale['unidadeId']) throw new ErroNegocio('Ocorrência não encontrada.');
        if ($vale['status'] !== 'PENDENTE' || !$vale['aguardandoId']) throw new ErroNegocio('Esta ocorrência já foi encerrada.');
        $cdV = _unidade($vale['cdId']);
        $unV = _unidade($vale['unidadeId']);
        $daVez = $vale['aguardandoId'] === $vale['cdId'] ? $cdV : $unV;
        $outra = $daVez['id'] === $vale['cdId'] ? $unV : $cdV;
        // Responde quem tem acesso à unidade da vez (ou administrador, que age em nome dela).
        if (!$u['global'] && !in_array($daVez['id'], array_column($u['cds'], 'id'), true)) {
            throw new ErroNegocio("Esta ocorrência aguarda resposta de {$daVez['codigo']}. Somente usuários dessa unidade podem responder.");
        }
        $codigo = numeroVale($vale['numero'], 'OCORRENCIA');
        $agora = Db::agora();

        if ($acao === 'RECUSAR') {
            $count = Db::exec("UPDATE `ValePallet` SET `aguardandoId` = ?, `recusas` = `recusas` + 1 WHERE `id` = ? AND `status` = 'PENDENTE' AND `aguardandoId` = ?", [$outra['id'], $vale['id'], $daVez['id']]);
            if ($count !== 1) throw new ErroNegocio('A ocorrência foi respondida por outro usuário. Atualize a página.');
            Db::insert('OcorrenciaInteracao', ['valeId' => $vale['id'], 'acao' => 'RECUSA', 'unidadeId' => $daVez['id'], 'usuarioId' => $u['id'], 'justificativa' => $justificativa, 'criadoEm' => $agora]);
            auditar([
                'acao' => 'RECUSAR_OCORRENCIA', 'entidade' => 'ValePallet', 'entidadeId' => $vale['id'], 'usuarioId' => $u['id'], 'cdId' => $daVez['id'],
                'quantidade' => (int) $vale['quantidade'], 'observacao' => $justificativa,
                'detalhes' => ['numero' => (int) $vale['numero'], 'recusadaPor' => $daVez['codigo'], 'devolvidaPara' => $outra['codigo']],
            ]);
            return "$codigo recusada por {$daVez['codigo']}: a pendência voltou para {$outra['codigo']} com a justificativa.";
        }

        $peloRemetente = $daVez['id'] === $vale['cdId'];
        $count = Db::exec(
            "UPDATE `ValePallet` SET `status` = 'FINALIZADO', `finalizadoEm` = ?, `aguardandoId` = NULL, `resolucao` = ?, `resolvidoEm` = ?, `resolvidoPorId` = ?, `observacaoResolucao` = ?
              WHERE `id` = ? AND `status` = 'PENDENTE' AND `aguardandoId` = ?",
            [$agora, $peloRemetente ? 'ACEITA_REMETENTE' : 'ACEITA_RECEBEDOR', $agora, $u['id'], $justificativa, $vale['id'], $daVez['id']],
        );
        if ($count !== 1) throw new ErroNegocio('A ocorrência foi respondida por outro usuário. Atualize a página.');
        $qtd = (int) $vale['quantidade'];
        $base = ['usuarioId' => $u['id'], 'valeId' => $vale['id'], 'conferenciaId' => $vale['conferenciaOrigemId']];
        $obs = "$codigo aceita por {$daVez['codigo']}" . ($justificativa ? " - $justificativa" : '');
        $remetente = $base + ['cdId' => $vale['cdId'], 'unidadeId' => $vale['unidadeId']];
        $recebedor = $base + ['cdId' => $unV['id'], 'unidadeId' => $vale['cdId']];
        $partes = [['VAZIOS', (int) $vale['quantidadeBons']], ['QUEBRADOS', (int) $vale['quantidadeQuebrados']]];
        if ($vale['ocorrencia'] === 'FALTA') {
            if ($peloRemetente) {
                lancar($remetente + ['tipo' => 'OCORRENCIA_PERDA', 'quantidade' => $qtd, 'observacao' => "$obs (baixada como perda)"], $cdV['codigo']);
            } else {
                lancar($remetente + ['tipo' => 'DIVERGENCIA_ENVIADO', 'origem' => 'OCORRENCIA', 'quantidade' => $qtd, 'observacao' => $obs], $cdV['codigo']);
                foreach ($partes as [$estoque, $q]) if ($q > 0) lancar($recebedor + ['tipo' => 'DIVERGENCIA_RECEBIDO', 'destino' => $estoque, 'quantidade' => $q, 'observacao' => $obs], $unV['codigo']);
            }
        } elseif ($peloRemetente) {
            if (!$vale['consomeEstoque']) {
                lancar($remetente + ['tipo' => 'DIVERGENCIA_ENVIADO', 'origem' => 'REMESSA_CROSS', 'quantidade' => $qtd, 'observacao' => $obs], $cdV['codigo']);
            } else {
                foreach ($partes as [$estoque, $q]) if ($q > 0) lancar($remetente + ['tipo' => 'DIVERGENCIA_ENVIADO', 'origem' => $estoque, 'quantidade' => $q, 'observacao' => $obs], $cdV['codigo']);
            }
            lancar($recebedor + ['tipo' => 'DIVERGENCIA_RECEBIDO', 'destino' => 'SOBRA', 'quantidade' => $qtd, 'observacao' => $obs], $unV['codigo']);
        }
        Db::insert('OcorrenciaInteracao', ['valeId' => $vale['id'], 'acao' => 'ACEITE', 'unidadeId' => $daVez['id'], 'usuarioId' => $u['id'], 'justificativa' => $justificativa, 'criadoEm' => $agora]);
        auditar([
            'acao' => 'ACEITAR_OCORRENCIA', 'entidade' => 'ValePallet', 'entidadeId' => $vale['id'], 'usuarioId' => $u['id'], 'cdId' => $daVez['id'],
            'quantidade' => $qtd, 'observacao' => $justificativa,
            'detalhes' => ['numero' => (int) $vale['numero'], 'ocorrencia' => $vale['ocorrencia'], 'aceitaPor' => $daVez['codigo'], 'recusas' => (int) $vale['recusas']],
        ]);
        $efeito = $vale['ocorrencia'] === 'FALTA'
            ? ($peloRemetente ? "$qtd pallet(s) baixados como perda de {$cdV['codigo']}" : "$qtd pallet(s) assumidos no estoque de {$unV['codigo']}")
            : ($peloRemetente ? "$qtd pallet(s) baixados do estoque de {$cdV['codigo']} como enviados" : "$qtd pallet(s) incorporados ao estoque de {$unV['codigo']}");
        return "$codigo aceita por {$daVez['codigo']} e encerrada: $efeito.";
    });
    // A ocorrência sai da lista "aguardando": a confirmação aparece no topo da página.
    redirecionar("/ocorrencias?f=$aba&ok=" . rawurlencode($mensagem));
}
