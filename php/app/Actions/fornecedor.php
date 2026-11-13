<?php
declare(strict_types=1);
// Cadastro rápido de fornecedor e Recebimento Pallet Fornecedor (src/actions/fornecedor.ts).

/** Cadastro rápido aberto quando o CNPJ (NF-e) não existe: Sigla e Nome obrigatórios. */
function acao_cadastros_criar_fornecedor_rapido(): array
{
    $u = exigirGlobal('fornecedor', 'compras', 'cadastros');
    if (!cnpjValido(f('cnpj'))) throw new ErroNegocio('CNPJ inválido.');
    $sigla = f('sigla');
    if (mb_strlen($sigla) < 2) throw new ErroNegocio('Informe a sigla (mínimo 2 caracteres).');
    $sigla = preg_replace('/\s+/', '', mb_strtoupper(mb_substr($sigla, 0, 20)));
    $nome = f('nome');
    if (mb_strlen($nome) < 2) throw new ErroNegocio('Informe o nome do fornecedor.');
    $telefone = f('telefone') ?: null;
    if ($telefone && !telefoneValido($telefone)) throw new ErroNegocio('Telefone inválido (informe DDD + número).');
    $email = f('email') ?: null;
    if ($email && !emailValido($email)) throw new ErroNegocio('E-mail inválido.');
    $cnpj = normalizarCnpj(f('cnpj'));
    if (Db::val('SELECT 1 FROM `Fornecedor` WHERE `cnpj` = ?', [$cnpj])) throw new ErroNegocio('Fornecedor já cadastrado.');
    $dup = Db::one('SELECT `nome` FROM `Fornecedor` WHERE `sigla` = ?', [$sigla]);
    if ($dup) throw new ErroNegocio("Já existe um fornecedor com a sigla $sigla ({$dup['nome']}).");
    $id = Db::insert('Fornecedor', ['cnpj' => $cnpj, 'sigla' => $sigla, 'nome' => mb_substr($nome, 0, 200), 'contato' => f('contato') ?: null, 'telefone' => $telefone, 'email' => $email, 'criadoEm' => Db::agora()]);
    auditar(['acao' => 'CRIAR_FORNECEDOR', 'entidade' => 'Fornecedor', 'entidadeId' => $id, 'usuarioId' => $u['id'], 'detalhes' => ['cnpj' => $cnpj, 'nome' => $nome, 'origem' => f('origem') ?: 'cadastro rápido']]);
    return sucesso("Fornecedor $nome cadastrado.", ['fornecedor' => ['id' => $id, 'nome' => $nome]]);
}

/** Lê a chave do DANFE: valida, impede NF já recebida e localiza o fornecedor no cadastro. */
function acao_fornecedor_ler_nfe(): array
{
    try {
        exigirModuloFornecedor();
        $nfe = lerChaveNFe(f('leitura'));
        $existente = Db::one('SELECT `numero`, `criadoEm`, `status` FROM `ValePallet` WHERE `chaveNfe` = ?', [$nfe['chave']]);
        if ($existente) {
            return ['ok' => false, 'erro' => 'Esta NF já foi recebida: ' . numeroVale($existente['numero'], 'FORNECEDOR') . ' emitido em ' . formatarDataHora($existente['criadoEm']) . ' (' . ROTULO_STATUS_VALE[$existente['status']] . ').'];
        }
        $f = Db::one('SELECT `nome`, `ativo` FROM `Fornecedor` WHERE `cnpj` = ?', [$nfe['cnpj']]);
        if ($f) $f['ativo'] = (bool) $f['ativo'];
        return ['ok' => true, 'chave' => $nfe['chave'], 'cnpj' => $nfe['cnpj'], 'cnpjFormatado' => formatarCnpj($nfe['cnpj']), 'notaFiscal' => $nfe['numero'], 'serie' => $nfe['serie'], 'fornecedor' => $f];
    } catch (ErroNegocio $e) {
        return ['ok' => false, 'erro' => $e->getMessage()];
    }
}

/** Recebimento de fornecedor: gera o Vale-Pallet (Fornecedor → Carga) e abre a impressão. */
function acao_fornecedor_registrar_entrada(): array
{
    $usuario = exigirModuloFornecedor();
    $modo = f('modo');
    if (!in_array($modo, ['NF', 'SEM_NF'], true)) throw new ErroNegocio('Selecione se o recebimento tem ou não nota fiscal.');
    if ($modo === 'NF' && f('chave') === '') throw new ErroNegocio('Leia o código de barras da NF-e.');
    if ($modo === 'SEM_NF' && f('fornecedorId') === '') throw new ErroNegocio('Selecione o fornecedor.');
    $transportadoraId = f('transportadoraId');
    if ($transportadoraId === '') throw new ErroNegocio('Selecione a transportadora.');
    if (!placaValida(f('placa'))) throw new ErroNegocio('Placa inválida (use ABC-1234 ou ABC1D23).');
    $qtd = quantidadePositiva(f('quantidade'));
    $conferente = f('conferente');
    if (mb_strlen($conferente) < 2) throw new ErroNegocio('Informe o conferente.');
    $observacao = textoOpcional(f('observacao'), 500);
    // Com NF: CNPJ, número e série vêm SEMPRE da chave (não confia no navegador).
    $nfe = $modo === 'NF' ? lerChaveNFe(f('chave')) : null;
    $rotulo = $nfe ? "NF {$nfe['numero']}" : 'SEM NOTA FISCAL';
    $placa = normalizarPlaca(f('placa'));
    $cd = $usuario['cd'];
    try {
        $valeId = comContaBloqueada(function () use ($nfe, $usuario, $cd, $transportadoraId, $placa, $qtd, $conferente, $observacao, $rotulo) {
            // Fornecedor e transportadora vêm sempre do cadastro (nada digitado livremente).
            $fornecedor = $nfe ? Db::one('SELECT * FROM `Fornecedor` WHERE `cnpj` = ?', [$nfe['cnpj']]) : Db::one('SELECT * FROM `Fornecedor` WHERE `id` = ?', [f('fornecedorId')]);
            if (!$fornecedor) throw new ErroNegocio($nfe ? 'CNPJ não cadastrado. Cadastre o fornecedor antes de gerar o vale.' : 'Fornecedor não encontrado. Selecione um fornecedor cadastrado.');
            $transp = Db::one('SELECT `nome`, `ativo` FROM `Transportadora` WHERE `id` = ?', [$transportadoraId]);
            if (!$transp || !$transp['ativo']) throw new ErroNegocio('Transportadora inválida ou inativa. Selecione uma transportadora cadastrada.');
            if (!$fornecedor['ativo']) throw new ErroNegocio("O fornecedor {$fornecedor['nome']} está inativo. Reative-o em Cadastros.");
            if ($nfe && Db::val('SELECT 1 FROM `ValePallet` WHERE `chaveNfe` = ?', [$nfe['chave']])) throw new ErroNegocio('Esta NF já foi recebida e possui vale-pallet.');
            $valeId = Db::insert('ValePallet', [
                'tipo' => 'FORNECEDOR', 'cdId' => $cd['id'], 'fornecedorId' => $fornecedor['id'], 'transportadora' => $transp['nome'], 'placa' => $placa,
                'notaFiscal' => $nfe['numero'] ?? null, 'serieNf' => $nfe['serie'] ?? null, 'chaveNfe' => $nfe['chave'] ?? null, 'semNotaFiscal' => !$nfe,
                'conferente' => mb_substr($conferente, 0, 120), 'quantidade' => $qtd, 'observacao' => $observacao, 'criadoPorId' => $usuario['id'], 'criadoEm' => Db::agora(),
            ]);
            $numero = (int) Db::val('SELECT `numero` FROM `ValePallet` WHERE `id` = ?', [$valeId]);
            auditar([
                'acao' => 'GERAR_VALE', 'entidade' => 'ValePallet', 'entidadeId' => $valeId, 'usuarioId' => $usuario['id'], 'cdId' => $cd['id'],
                'observacao' => $nfe ? "NF {$nfe['numero']} série {$nfe['serie']}" : 'Recebimento SEM NOTA FISCAL', 'quantidade' => $qtd,
                'detalhes' => ['numero' => $numero, 'fornecedor' => $fornecedor['nome'], 'quantidade' => $qtd, 'notaFiscal' => $nfe['numero'] ?? null, 'chaveNfe' => $nfe['chave'] ?? null, 'semNotaFiscal' => !$nfe, 'conferente' => $conferente],
            ]);
            // O vale sobe o saldo do CD com o fornecedor (Fornecedor → Carga); os vazios só mudam na baixa.
            lancar(['tipo' => 'RECEBIMENTO_FORNECEDOR', 'quantidade' => $qtd, 'usuarioId' => $usuario['id'], 'cdId' => $cd['id'], 'fornecedorId' => $fornecedor['id'], 'valeId' => $valeId, 'observacao' => "$rotulo - {$transp['nome']} - $placa"]);
            return $valeId;
        });
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? 0) === 1062) throw new ErroNegocio('Esta NF já foi recebida e possui vale-pallet.');
        throw $e;
    }
    // Abre o layout de impressão A4 (2 vias) automaticamente.
    redirecionar("/imprimir/vale/$valeId?auto=1");
}
