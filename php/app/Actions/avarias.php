<?php
declare(strict_types=1);
// Quebra, conserto/reparo e descarte (src/actions/avarias.ts).

/** Lançar quebrado: Pallets PBR → Pallets Quebrados na unidade ativa (sem deixar saldo negativo). */
function acao_avarias_quebra(): array
{
    $u = exigir('quebras');
    $qtd = quantidadePositiva(f('quantidade'));
    $obs = observacaoObrigatoria(f('observacao'), 5, 'A observação é obrigatória (mínimo 5 caracteres).');
    comContaBloqueada(fn() => lancar(['tipo' => 'QUEBRA', 'quantidade' => $qtd, 'observacao' => $obs, 'usuarioId' => $u['id'], 'cdId' => $u['cd']['id']], $u['cd']['codigo']));
    return sucesso(n($qtd) . " pallet(s) lançados como quebrados em {$u['cd']['codigo']}: Pallets PBR → Pallets Quebrados.", ['recarregar' => true]);
}

/**
 * Conserto / reparo (somente no Hub). Recuperados: Quebrados → Vazios. Quebrados desmontados
 * para o reparo saem para Descarte. Trava validada sobre o saldo bloqueado.
 */
function acao_avarias_reparo(): array
{
    $u = exigir('reparo');
    if (!$u['cd']['hub']) throw new ErroNegocio('O conserto/reparo de pallets é feito no CD Hub (CDJC).');
    $recuperados = quantidadePositiva(f('recuperados'));
    $usouOutros = f('usouOutros');
    if (!in_array($usouOutros, ['SIM', 'NAO'], true)) throw new ErroNegocio('Informe se foi necessário utilizar outros pallets quebrados no reparo.');
    $utilizadosTxt = f('utilizados');
    if ($utilizadosTxt !== '' && (!is_numeric($utilizadosTxt) || (float) $utilizadosTxt != floor((float) $utilizadosTxt))) throw new ErroNegocio('Quantidade deve ser inteira.');
    $utilizadosInf = max(0, (int) $utilizadosTxt);
    if ($usouOutros === 'SIM' && $utilizadosInf <= 0) throw new ErroNegocio('Informe a quantidade de pallets utilizados/destruídos no reparo.');
    $utilizados = $usouOutros === 'SIM' ? $utilizadosInf : 0;
    $observacao = textoOpcional(f('observacao'), 500);
    $cd = $u['cd'];
    comContaBloqueada(function () use ($u, $cd, $recuperados, $utilizados, $observacao) {
        $saldo = saldosPorConta($cd['id'])['QUEBRADOS'];
        $erro = travaReparo($saldo, $recuperados, $utilizados);
        if ($erro) throw new ErroNegocio($erro);
        lancar(['tipo' => 'RECUPERADO', 'quantidade' => $recuperados, 'usuarioId' => $u['id'], 'cdId' => $cd['id'],
            'observacao' => 'Reparo' . ($utilizados ? " ($utilizados pallet(s) utilizados)" : '') . ($observacao ? " - $observacao" : '')]);
        if ($utilizados) {
            lancar(['tipo' => 'CANIBALIZACAO', 'quantidade' => $utilizados, 'usuarioId' => $u['id'], 'cdId' => $cd['id'],
                'observacao' => "Utilizados/desmontados no reparo de $recuperados pallet(s)" . ($observacao ? " - $observacao" : '')]);
        }
        auditar([
            'acao' => 'REPARO_QUEBRADOS', 'entidade' => 'Movimentacao', 'usuarioId' => $u['id'], 'cdId' => $cd['id'], 'origem' => 'QUEBRADOS',
            'quantidade' => $recuperados + $utilizados, 'observacao' => $observacao,
            'detalhes' => ['saldoQuebradosAntes' => $saldo, 'recuperados' => $recuperados, 'utilizados' => $utilizados, 'saldoQuebradosDepois' => $saldo - $recuperados - $utilizados],
        ]);
    });
    return sucesso($utilizados
        ? 'Reparo registrado: ' . n($recuperados) . ' recuperado(s) voltaram aos Pallets PBR e ' . n($utilizados) . ' utilizado(s) foram para Descartados. Quebrados −' . n($recuperados + $utilizados) . '.'
        : n($recuperados) . ' pallet(s) consertados: Pallets Quebrados → Pallets PBR.', ['recarregar' => true]);
}

/** Descarte / destruição: o usuário escolhe de qual estoque os pallets saem. Registro definitivo. */
function acao_avarias_descarte(): array
{
    $u = exigirUnidade();
    $qtd = quantidadePositiva(f('quantidade'));
    $obs = observacaoObrigatoria(f('observacao'), 5, 'A observação é obrigatória (mínimo 5 caracteres).');
    $origem = f('origem');
    if (!in_array($origem, ['VAZIOS', 'QUEBRADOS'], true)) throw new ErroNegocio('Selecione de qual pulmão o pallet será descartado.');
    comContaBloqueada(fn() => lancar(['tipo' => 'DESCARTE', 'quantidade' => $qtd, 'observacao' => $obs, 'usuarioId' => $u['id'], 'cdId' => $u['cd']['id'], 'origem' => $origem], $u['cd']['codigo']));
    return sucesso(n($qtd) . ' pallet(s) ' . ($origem === 'VAZIOS' ? 'PBR' : 'quebrados') . " descartados em {$u['cd']['codigo']}. Registro definitivo (consulte em Pallets Descartados).", ['recarregar' => true]);
}
