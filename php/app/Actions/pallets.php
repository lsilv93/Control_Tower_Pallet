<?php
declare(strict_types=1);
// Compra de pallets (NF-e) e inclusão/remoção manual de saldo (src/actions/pallets.ts).

/** Lê a chave do DANFE e localiza o fornecedor pelo CNPJ do emitente (resposta JSON da tela). */
function acao_pallets_ler_nfe(): array
{
    try {
        exigir('compras');
        $nfe = lerChaveNFe(f('leitura'));
        $existente = Db::one('SELECT c.`notaFiscal`, c.`criadoEm`, u.`login` FROM `Compra` c JOIN `Usuario` u ON u.`id` = c.`usuarioId` WHERE c.`chaveAcesso` = ?', [$nfe['chave']]);
        if ($existente) return ['ok' => false, 'erro' => "A NF {$existente['notaFiscal']} já foi lançada em " . formatarDataHora($existente['criadoEm']) . " por {$existente['login']}."];
        $fornecedor = Db::one('SELECT `id`, `nome` FROM `Fornecedor` WHERE `cnpj` = ?', [$nfe['cnpj']]);
        return ['ok' => true, 'chave' => $nfe['chave'], 'notaFiscal' => $nfe['numero'], 'serie' => $nfe['serie'], 'cnpj' => $nfe['cnpj'], 'cnpjFormatado' => formatarCnpj($nfe['cnpj']), 'fornecedor' => $fornecedor];
    } catch (ErroNegocio $e) {
        return ['ok' => false, 'erro' => $e->getMessage()];
    }
}

/** Gera uma chave de NF-e válida (botão "Simular leitura"). */
function acao_pallets_simular_nfe(): array
{
    requireUsuario();
    return ['ok' => true, 'chave' => gerarChaveNFe(f('cnpj') ?: null)];
}

function acao_pallets_registrar_compra(): array
{
    $u = exigir('compras');
    $chave = f('chave');
    if ($chave === '') throw new ErroNegocio('Leia o código de barras da NF.');
    $qtd = quantidadePositiva(f('quantidade'));
    $observacao = textoOpcional(f('observacao'), 500);
    $nfe = lerChaveNFe($chave);
    try {
        $compra = comContaBloqueada(function () use ($u, $nfe, $qtd, $observacao) {
            $fornecedor = Db::one('SELECT `id`, `nome` FROM `Fornecedor` WHERE `cnpj` = ?', [$nfe['cnpj']]);
            if (!$fornecedor) throw new ErroNegocio('Fornecedor da NF não cadastrado.');
            $id = Db::insert('Compra', [
                'chaveAcesso' => $nfe['chave'], 'notaFiscal' => $nfe['numero'], 'serie' => $nfe['serie'], 'fornecedorId' => $fornecedor['id'],
                'quantidade' => $qtd, 'observacao' => $observacao, 'usuarioId' => $u['id'], 'cdId' => $u['cd']['id'], 'criadoEm' => Db::agora(),
            ]);
            auditar(['acao' => 'REGISTRAR_COMPRA', 'entidade' => 'Compra', 'entidadeId' => $id, 'usuarioId' => $u['id'], 'cdId' => $u['cd']['id'],
                'detalhes' => ['chave' => $nfe['chave'], 'notaFiscal' => $nfe['numero'], 'fornecedor' => $fornecedor['nome'], 'quantidade' => $qtd]]);
            lancar(['tipo' => 'COMPRA', 'quantidade' => $qtd, 'usuarioId' => $u['id'], 'cdId' => $u['cd']['id'], 'fornecedorId' => $fornecedor['id'], 'compraId' => $id,
                'observacao' => "NF {$nfe['numero']} série {$nfe['serie']}" . ($observacao ? " - $observacao" : '')]);
            return ['notaFiscal' => $nfe['numero'], 'fornecedor' => $fornecedor['nome']];
        });
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? 0) === 1062) throw new ErroNegocio('Esta NF já foi lançada.');
        throw $e;
    }
    return sucesso('Compra registrada: ' . n($qtd) . " pallet(s) da NF {$compra['notaFiscal']} ({$compra['fornecedor']}) adicionados ao estoque de Pallets PBR.");
}

function _rotuloEstoque(string $e): string
{
    return $e === 'VAZIOS' ? 'Pallets PBR' : 'Pallets Quebrados';
}

function _estoque(): string
{
    $e = f('estoque');
    if (!in_array($e, ESTOQUES, true)) throw new ErroNegocio('Selecione o estoque (Pallets PBR ou Pallets Quebrados).');
    return $e;
}

/** Inclui saldo de Pallets PBR ou Quebrados em um CD ou Ponto de Cross (Ajuste → estoque), com motivo. */
function acao_pallets_incluir(): array
{
    $u = exigirAdmin();
    $unidadeId = f('unidadeId');
    if ($unidadeId === '') throw new ErroNegocio('Selecione o CD ou Ponto de Cross.');
    $estoque = _estoque();
    $motivo = f('motivo');
    if (!isset(MOTIVOS_INCLUSAO[$motivo])) throw new ErroNegocio('Selecione o motivo (Compra, Devolução, Ajuste Estoque ou Inventário).');
    $qtd = quantidadePositiva(f('quantidade'));
    $obs = observacaoObrigatoria(f('observacao'), 10, 'A observação/justificativa é obrigatória (mínimo 10 caracteres).');
    $unidade = comContaBloqueada(function () use ($u, $unidadeId, $estoque, $motivo, $qtd, $obs) {
        $un = normalizarUnidade(Db::one('SELECT * FROM `CentroDistribuicao` WHERE `id` = ?', [$unidadeId]));
        if (!$un || !$un['ativo']) throw new ErroNegocio('Unidade inválida ou inativa.');
        lancar(['tipo' => 'INCLUSAO_MANUAL', 'destino' => $estoque, 'quantidade' => $qtd, 'usuarioId' => $u['id'], 'cdId' => $un['id'], 'motivo' => $motivo, 'observacao' => MOTIVOS_INCLUSAO[$motivo] . " - $obs"]);
        auditar(['acao' => 'INCLUIR_SALDO', 'entidade' => 'CentroDistribuicao', 'entidadeId' => $un['id'], 'usuarioId' => $u['id'], 'cdId' => $un['id'],
            'origem' => 'AJUSTE', 'destino' => $estoque, 'quantidade' => $qtd, 'observacao' => $obs, 'detalhes' => ['unidade' => $un['codigo'], 'motivo' => $motivo]]);
        return $un;
    });
    return sucesso('+' . n($qtd) . ' ' . _rotuloEstoque($estoque) . ' incluídos em ' . rotuloUnidade($unidade) . ' (motivo: ' . MOTIVOS_INCLUSAO[$motivo] . ').', ['recarregar' => true]);
}

/** Remove saldo (estoque → Ajuste), com confirmação; nunca deixa saldo negativo. */
function acao_pallets_remover(): array
{
    $u = exigirAdmin();
    $unidadeId = f('unidadeId');
    if ($unidadeId === '') throw new ErroNegocio('Selecione o CD ou Ponto de Cross.');
    $estoque = _estoque();
    $qtd = quantidadePositiva(f('quantidade'));
    $just = observacaoObrigatoria(f('justificativa'), 10, 'A justificativa é obrigatória (mínimo 10 caracteres).');
    if (f('confirmado') !== '1') throw new ErroNegocio('Confirme a remoção.');
    $unidade = comContaBloqueada(function () use ($u, $unidadeId, $estoque, $qtd, $just) {
        $un = normalizarUnidade(Db::one('SELECT * FROM `CentroDistribuicao` WHERE `id` = ?', [$unidadeId]));
        if (!$un) throw new ErroNegocio('Unidade inválida.');
        lancar(['tipo' => 'REMOCAO_MANUAL', 'origem' => $estoque, 'quantidade' => $qtd, 'usuarioId' => $u['id'], 'cdId' => $un['id'], 'observacao' => $just], $un['codigo']);
        auditar(['acao' => 'REMOVER_SALDO', 'entidade' => 'CentroDistribuicao', 'entidadeId' => $un['id'], 'usuarioId' => $u['id'], 'cdId' => $un['id'],
            'origem' => $estoque, 'destino' => 'AJUSTE', 'quantidade' => $qtd, 'observacao' => $just, 'detalhes' => ['unidade' => $un['codigo'], 'confirmado' => true]]);
        return $un;
    });
    return sucesso('−' . n($qtd) . ' ' . _rotuloEstoque($estoque) . ' removidos de ' . rotuloUnidade($unidade) . '.', ['recarregar' => true]);
}
