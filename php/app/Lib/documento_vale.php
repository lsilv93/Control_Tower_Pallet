<?php
declare(strict_types=1);
// Conteúdo do Vale-Pallet impresso / PDF (src/lib/documentoVale.ts + src/lib/emissor.ts).

/** Dados da empresa impressos no vale; endereço e CNPJ do emitente vêm da unidade de origem. */
const EMISSOR = [
    'razaoSocial' => 'Rfg Food Service Ltda.',
    'nomeFantasia' => 'Martin-Brower Food Service',
    'cnpj' => '59.568.428/0011-50',
    'endereco' => 'Rua Harold Barnsley Holland, 2130, Galpão B, Sala 01, Rio Abaixo',
    'cidade' => 'Jacareí - SP',
    'cep' => '12.334-403',
];

/** Carrega o vale com tudo o que o documento precisa (ou null). */
function carregarValeDoc(string $id): ?array
{
    $v = Db::one('SELECT * FROM `ValePallet` WHERE `id` = ?', [$id]);
    if (!$v) return null;
    $un = fn(?string $uid) => $uid ? normalizarUnidade(Db::one('SELECT `id`, `codigo`, `nome`, `tipo`, `hub`, `cnpj`, `endereco`, `cidade`, `uf`, `cep` FROM `CentroDistribuicao` WHERE `id` = ?', [$uid])) : null;
    $v['cd'] = $un($v['cdId']);
    $v['unidade'] = $un($v['unidadeId']);
    $v['fornecedor'] = $v['fornecedorId'] ? Db::one('SELECT `nome`, `cnpj` FROM `Fornecedor` WHERE `id` = ?', [$v['fornecedorId']]) : null;
    $v['criadoPor'] = Db::one('SELECT `login`, `nome` FROM `Usuario` WHERE `id` = ?', [$v['criadoPorId']]);
    $v['canceladoPor'] = $v['canceladoPorId'] ? Db::one('SELECT `login`, `nome` FROM `Usuario` WHERE `id` = ?', [$v['canceladoPorId']]) : null;
    $v['agenda'] = $v['agendaId'] ? Db::one('SELECT `numero`, `dataPrevista` FROM `AgendaDevolucao` WHERE `id` = ?', [$v['agendaId']]) : null;
    $v['conferencia'] = $v['conferenciaId'] ? Db::one('SELECT `numero` FROM `Conferencia` WHERE `id` = ?', [$v['conferenciaId']]) : null;
    $v['conferenciaOrigem'] = $v['conferenciaOrigemId'] ? Db::one('SELECT `numero`, `totalDeclarado`, `recebidoBons`, `recebidoQuebrados` FROM `Conferencia` WHERE `id` = ?', [$v['conferenciaOrigemId']]) : null;
    foreach (['semNotaFiscal', 'consomeEstoque'] as $k) $v[$k] = (bool) $v[$k];
    return $v;
}

function _rotuloTipoUnidadeDoc(array $u): string
{
    return $u['tipo'] === 'CROSS' ? 'Ponto de Cross' : ($u['hub'] ? 'CD Hub' : 'CD');
}

function _unidadeTexto(?array $u): string
{
    return $u ? _rotuloTipoUnidadeDoc($u) . " {$u['codigo']} - {$u['nome']}" : '—';
}

/** Emitente: a unidade que originou a operação (recebedor no vale de ocorrência), com endereço. */
function emitenteDoVale(array $v): array
{
    $u = $v['tipo'] === 'OCORRENCIA' && $v['unidade'] ? $v['unidade'] : $v['cd'];
    return [
        'rotulo' => 'Emitente · ' . _rotuloTipoUnidadeDoc($u) . " {$u['codigo']}",
        'razaoSocial' => EMISSOR['razaoSocial'] . " · {$u['codigo']} - {$u['nome']}",
        'cnpj' => $u['cnpj'] ? formatarCnpj($u['cnpj']) : 'não cadastrado',
        'endereco' => enderecoCompleto($u) ?? 'Endereço não cadastrado (complete em Cadastros)',
    ];
}

function celula(string $rotulo, string $valor, int $colunas): array
{
    return compact('rotulo', 'valor', 'colunas');
}

/** Monta o documento conforme o tipo do vale (fornecedor, envio ou ocorrência). */
function documentoVale(array $v): array
{
    return conteudoVale($v) + ['emitente' => emitenteDoVale($v)];
}

function conteudoVale(array $v): array
{
    $codigo = numeroVale($v['numero'], $v['tipo']);
    $un = $v['unidade'];
    if ($v['status'] === 'CANCELADO') {
        $situacao = 'Cancelado em ' . formatarDataHora($v['canceladoEm']) . ' por ' . ($v['canceladoPor']['login'] ?? '-') . ' · ' . ($v['motivoCancelamento'] ? ROTULO_MOTIVO_CANCELAMENTO[$v['motivoCancelamento']] : '');
    } elseif ($v['tipo'] === 'OCORRENCIA') {
        $situacao = $v['resolucao'] ? ROTULO_RESOLUCAO[$v['resolucao']] . ' em ' . formatarDataHora($v['resolvidoEm']) : 'Pendente · aguardando aceite ou recusa';
    } elseif ($v['status'] === 'FINALIZADO') {
        $situacao = ($v['tipo'] === 'ENVIO' ? 'Conferido' : 'Baixado') . ' em ' . formatarDataHora($v['finalizadoEm'])
            . ($v['agenda'] ? ' · ' . numeroAgenda($v['agenda']['numero']) : '') . ($v['conferencia'] ? ' · ' . numeroConferencia($v['conferencia']['numero']) : '');
    } elseif ($v['status'] === 'AGENDADO' && $v['agenda']) {
        $situacao = 'Retirada agendada para ' . formatarDataHora($v['agenda']['dataPrevista']) . ' · ' . numeroAgenda($v['agenda']['numero']);
    } elseif ($v['tipo'] === 'FORNECEDOR') {
        $situacao = 'Pendente de devolução ao fornecedor';
    } else {
        $situacao = 'Em trânsito · aguardando conferência em ' . ($un['codigo'] ?? '-');
    }
    $placa = $v['placa'] ? formatarPlaca($v['placa']) : '—';
    $transporte = [celula('Transportadora', $v['transportadora'] ?? '—', 2), celula('Placa do veículo', $placa, 2)];
    $envioCross = [
        celula('Transportadora', $v['transportadora'] ?? '—', 1),
        celula('Placa do veículo', $placa, 1),
        celula('Rota', $v['rota'] ?? '—', 1),
        celula('Data de faturamento', $v['dataFaturamento'] ? formatarDataPura($v['dataFaturamento']) : '—', 1),
    ];
    $emissao = [
        celula('Data/hora de emissão', formatarDataHora($v['criadoEm']), 2),
        celula('Emitido por', $v['criadoPor']['login'], 1),
        celula('Status atual', $v['tipo'] === 'OCORRENCIA' && $v['ocorrencia'] === 'FALTA' && $v['status'] === 'PENDENTE' ? 'Em aberto' : ROTULO_STATUS_VALE[$v['status']], 1),
    ];
    $rodape = [celula('ID único do documento', "$codigo · {$v['id']}", 2), celula('Situação', $situacao, 2)];
    $bons = (int) $v['quantidadeBons'];
    $quebr = (int) $v['quantidadeQuebrados'];
    $composicao = [
        celula('Total de Pallets PBR (bons)', n($bons), 1),
        celula('Total de Pallets Quebrados', n($quebr), 1),
        celula('Total geral (PBR + Quebrados)', n($bons + $quebr), 2),
    ];

    if ($v['tipo'] === 'FORNECEDOR') {
        return [
            'codigo' => $codigo,
            'titulo' => 'VALE-PALLET PBR',
            'subtitulo' => 'Comprovante de recebimento de pallets de fornecedor',
            'vias' => ['Via Martin Brower', 'Via Fornecedor'],
            'linhas' => [
                [celula('Fornecedor', $v['fornecedor']['nome'] ?? '—', 3), celula('CNPJ', $v['fornecedor'] ? formatarCnpj($v['fornecedor']['cnpj']) : '—', 1)],
                [celula('Transportadora', $v['transportadora'] ?? '—', 2), celula('Placa do veículo', $placa, 1), celula('Nota fiscal', rotuloNf($v), 1)],
                [celula('CD recebedor', "{$v['cd']['codigo']} - {$v['cd']['nome']}", 4)],
                $emissao,
                $rodape,
            ],
            'rotuloQuantidade' => 'Quantidade de pallets PBR recebidos',
            'destaque' => $v['semNotaFiscal']
                ? ['titulo' => 'ATENÇÃO: OPERAÇÃO REALIZADA NA OPÇÃO "SEM NOTA FISCAL"', 'texto' => 'Recebimento registrado sem documento fiscal vinculado. Conferir a origem dos pallets antes da devolução.']
                : null,
            'declaracao' => 'Declaramos o recebimento da quantidade de pallets PBR acima, registrada como crédito do fornecedor, a ser devolvida mediante agenda de retirada. Apresente este vale no momento da retirada.',
            'assinaturas' => ['Conferente / Recebedor', 'Transportador'],
            'nomeAssinatura' => $v['conferente'],
        ];
    }

    if ($v['tipo'] === 'ENVIO') {
        $paraHub = !empty($un['hub']) && $bons === 0;
        $destino = $un['codigo'] ?? 'destino';
        return [
            'codigo' => $codigo,
            'vias' => ["Via {$v['cd']['codigo']} (remetente)", "Via $destino (destinatário)"],
            'nomeAssinatura' => null,
            'titulo' => $paraHub ? 'VALE DE PALLETS QUEBRADOS' : 'VALE-PALLET DE ENVIO',
            'subtitulo' => $paraHub ? 'Pallets quebrados enviados ao CD Hub (CDJC) para conserto' : 'Transferência de pallets PBR entre unidades',
            'linhas' => [
                [celula('Remetente', _unidadeTexto($v['cd']), 2), celula('Destinatário', _unidadeTexto($un), 2)],
                $composicao,
                ($un['tipo'] ?? null) === 'CROSS' ? $envioCross : $transporte,
                $emissao,
                $rodape,
            ],
            'rotuloQuantidade' => 'Total geral enviado (Pallets PBR + Pallets Quebrados)',
            'destaque' => null,
            'declaracao' => "Os pallets acima saíram do estoque de {$v['cd']['codigo']} e permanecem em trânsito até a conferência física em $destino. Divergências na conferência geram Vale de Ocorrência.",
            'assinaturas' => ['Expedição (remetente)', 'Transportador'],
        ];
    }

    $c = $v['conferenciaOrigem'];
    $falta = $v['ocorrencia'] !== 'SOBRA';
    $receb = $un['codigo'] ?? 'recebedor';
    return [
        'codigo' => $codigo,
        'vias' => ["Via {$v['cd']['codigo']} (remetente)", "Via $receb (recebedor)"],
        'nomeAssinatura' => null,
        'titulo' => $falta ? 'VALE DE OCORRÊNCIA · FALTA' : 'VALE DE OCORRÊNCIA · SOBRA',
        'subtitulo' => $falta ? 'Devolutivo ao remetente: divergência física apurada na conferência' : 'Registro de pallets recebidos a mais na conferência',
        'linhas' => [
            [celula('Remetente', _unidadeTexto($v['cd']), 2), celula('Recebedor (conferente)', _unidadeTexto($un), 2)],
            [
                celula('Conferência de origem', $c ? numeroConferencia($c['numero']) : '—', 1),
                celula('Declarado nos vales', $c ? n($c['totalDeclarado']) : '—', 1),
                celula('Pallets PBR recebidos', $c ? n($c['recebidoBons']) : '—', 1),
                celula('Pallets Quebrados recebidos', $c ? n($c['recebidoQuebrados']) : '—', 1),
            ],
            $transporte,
            $emissao,
            $rodape,
        ],
        'rotuloQuantidade' => $falta ? 'Quantidade de pallets em falta' : 'Quantidade de pallets em sobra',
        'destaque' => $falta
            ? ['titulo' => 'OCORRÊNCIA DE FALTA', 'texto' => "A contagem física foi menor que a soma dos vales. A diferença fica em ocorrência no livro de {$v['cd']['codigo']} até uma das unidades aceitar: o remetente (baixa como perda) ou o recebedor (assume os pallets)."]
            : ['titulo' => 'OCORRÊNCIA DE SOBRA', 'texto' => "A contagem física foi maior que a soma dos vales. O excedente entrou no estoque de $receb e a ocorrência segue pendente até uma das unidades aceitar."],
        'declaracao' => "Ocorrência pendente na unidade remetente {$v['cd']['codigo']}, que aceita ou recusa com justificativa; a recusa devolve a pendência ao recebedor, até um aceite. Registrada com data, hora e número do vale, auditável pelas duas unidades.",
        'assinaturas' => ['Conferente (recebedor)', 'Transportador'],
    ];
}
