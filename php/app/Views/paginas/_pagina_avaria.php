<?php
declare(strict_types=1);
// Quebra, conserto/reparo e descarte (src/components/PaginaAvaria.tsx + FormDescarte/FormReparo/PalletsDescartados).

function paginaAvaria(string $modo): void
{
    $u = requireCD();
    // Descarte: todos os usuários de CD (fora do escopo do Cross). Quebra: "quebras". Reparo: "reparo" no Hub.
    if ($modo === 'descarte' && ehUsuarioCross($u)) redirecionar('/sem-acesso?modulo=cross');
    if ($modo === 'quebras' && !tem($u, 'quebras')) redirecionar('/sem-acesso');
    if ($modo === 'recuperados' && (!tem($u, 'reparo') || !$u['cd']['hub'])) redirecionar('/sem-acesso?modulo=reparo');
    $cfg = [
        'quebras' => ['Lançar Quebrado', 'Origem: Pallets PBR (subtrai) → Destino: Pallets Quebrados (soma).', 'QUEBRA', 'Quebras'],
        'recuperados' => ['Conserto / Reparo de Pallets', 'Exclusivo do CD Hub (CDJC). Recuperados: Pallets Quebrados → Pallets PBR. Pallets Quebrados desmontados para o reparo: Pallets Quebrados → Descartados. A soma nunca ultrapassa o saldo de quebrados.', 'RECUPERADO', 'Recuperados'],
        'descarte' => ['Descarte / Destruição de Pallets', 'Baixa definitiva e imutável, disponível a todos os usuários. Ao confirmar, escolha de qual estoque os pallets saem: Pallets PBR ou Pallets Quebrados.', 'DESCARTE', 'Descarte'],
    ];
    [$titulo, $descricao, $tipo, $tituloAba] = $cfg[$modo];
    View::$titulo = $tituloAba;
    $cd = $u['cd'];
    $abas = [];
    if (tem($u, 'quebras')) $abas[] = ['href' => '/avarias/quebras', 'rotulo' => 'Lançar Quebrado'];
    if ($cd['hub'] && tem($u, 'reparo')) $abas[] = ['href' => '/avarias/recuperados', 'rotulo' => 'Conserto / Reparo'];
    if (!ehUsuarioCross($u)) $abas[] = ['href' => '/avarias/descarte', 'rotulo' => 'Descarte'];
    $saldos = obterSaldos($cd['id']);

    echo cabecalho($titulo, "$descricao · Unidade {$cd['codigo']}");
    if (count($abas) > 1) echo abas($abas, "/avarias/$modo");
    echo saldosEstoques($cd['id'], ['VAZIOS', 'QUEBRADOS']);

    $topo = '<p class="mb-4">' . match ($modo) {
        'quebras' => fluxoContas('VAZIOS', 'QUEBRADOS'),
        'recuperados' => fluxoContas('QUEBRADOS', 'VAZIOS'),
        default => '<span class="text-[12px] text-t3">Pallets PBR ou Pallets Quebrados → Descarte</span>',
    } . '</p>';
    if ($modo === 'descarte') {
        $form = formAcao('avarias/descarte',
            '<div><label class="label" for="quantidade">Quantidade de pallets *</label><input id="quantidade" name="quantidade" type="number" min="1" step="1" class="input" required></div>'
            . '<div><label class="label" for="observacao">Justificativa do descarte *</label><textarea id="observacao" name="observacao" rows="3" class="input" required minlength="5" maxlength="500"></textarea></div>',
            ['botao' => icone('trash-2') . ' Descartar / destruir', 'classeBotao' => 'btn-danger w-full', 'textoEnviando' => 'Descartando...',
                'attrs' => ['data-descarte' => json_encode(['vazios' => $saldos['vazios'], 'quebrados' => $saldos['quebrados']])]]);
    } elseif ($modo === 'recuperados') {
        $q = $saldos['quebrados'];
        $form = formAcao('avarias/reparo',
            '<div class="poco flex items-center justify-between px-4 py-3 text-[12px]"><span class="text-t3">Saldo de quebrados no CD</span><span class="num text-[18px] font-semibold text-ouro" data-testid="saldo-quebrados">' . $q . '</span></div>'
            . '<div><label class="label" for="recuperados">Pallets recuperados *</label><input id="recuperados" name="recuperados" type="number" min="1" max="' . $q . '" step="1" class="input" required></div>'
            . '<fieldset><legend class="label">Foi necessário utilizar/desmontar outros pallets quebrados para realizar este reparo? *</legend><div class="grid grid-cols-2 gap-3">'
            . '<label class="poco flex cursor-pointer items-center gap-2 px-4 py-3 text-[12px] font-semibold text-t2 has-[:checked]:text-lima has-[:checked]:ring-1 has-[:checked]:ring-lima"><input type="radio" name="usouOutros" value="NAO" required> Não</label>'
            . '<label class="poco flex cursor-pointer items-center gap-2 px-4 py-3 text-[12px] font-semibold text-t2 has-[:checked]:text-lima has-[:checked]:ring-1 has-[:checked]:ring-lima"><input type="radio" name="usouOutros" value="SIM" required> Sim</label></div></fieldset>'
            . '<div data-bloco-utilizados hidden><label class="label" for="utilizados">Pallets utilizados / destruídos no reparo *</label><input id="utilizados" name="utilizados" type="number" min="1" step="1" class="input">'
            . '<p class="mt-1.5 text-[11px] text-t4" data-max-utilizados></p></div>'
            . '<div><label class="label" for="observacao">Observação</label><textarea id="observacao" name="observacao" rows="2" class="input" maxlength="500"></textarea></div>'
            . '<div data-resumo-reparo hidden></div><div data-erro-reparo hidden></div>',
            ['botao' => icone('recycle') . ' Registrar reparo', 'classeBotao' => 'btn-primary w-full', 'attrs' => ['data-reparo' => (string) $q]]);
    } else {
        $form = formAcao('avarias/quebra',
            '<div><label class="label" for="quantidade">Quantidade de pallets *</label><input id="quantidade" name="quantidade" type="number" min="1" step="1" class="input" required></div>'
            . '<div><label class="label" for="observacao">Observação (motivo da quebra) *</label><textarea id="observacao" name="observacao" rows="3" class="input" required minlength="5" maxlength="500"></textarea></div>',
            ['botao' => 'Registrar quebra', 'classeBotao' => 'btn-danger w-full']);
    }

    if ($modo === 'descarte') {
        $global = $u['global'];
        $w = "m.`tipo` IN ('DESCARTE','CANIBALIZACAO')" . ($global ? '' : ' AND m.`cdId` = ?');
        $p = $global ? [] : [$cd['id']];
        $movs = Db::all("SELECT m.*, x.`nome` AS usuarioNome, c.`codigo` AS cdCodigo FROM `Movimentacao` m JOIN `Usuario` x ON x.`id` = m.`usuarioId` JOIN `CentroDistribuicao` c ON c.`id` = m.`cdId` WHERE $w ORDER BY m.`criadoEm` DESC LIMIT 50", $p);
        $total = (int) Db::val("SELECT COALESCE(SUM(m.`quantidade`),0) FROM `Movimentacao` m WHERE $w", $p);
        if (!$movs) {
            $corpo = vazio('Nenhum descarte registrado.');
        } else {
            $l = '';
            foreach ($movs as $m) {
                $l .= '<tr><td class="num whitespace-nowrap">' . formatarDataHora($m['criadoEm']) . '</td>' . ($global ? '<td class="num">' . e($m['cdCodigo']) . '</td>' : '')
                    . '<td>' . ROTULO_TIPO[$m['tipo']] . '</td><td>' . contaTag($m['origem']) . '</td><td class="num text-right font-semibold">' . n($m['quantidade']) . '</td>'
                    . '<td class="max-w-[260px] truncate" title="' . e($m['observacao'] ?? '') . '">' . e($m['observacao'] ?? '—') . '</td><td>' . e($m['usuarioNome']) . '</td></tr>';
            }
            $corpo = tabela('<table class="tabela" data-testid="pallets-descartados"><thead><tr><th>Data/hora</th>' . ($global ? '<th>Unidade</th>' : '') . '<th>Tipo</th><th>Estoque</th><th class="text-right">Qtd.</th><th>Justificativa</th><th>Usuário</th></tr></thead><tbody>' . $l . '</tbody></table>');
        }
        $direita = painel($corpo . '<p class="mt-3 text-[11px] text-t4">Registros imutáveis: o banco de dados bloqueia qualquer alteração ou exclusão.</p>',
            icone('lock', 'h-4 w-4 text-t3') . ' Pallets Descartados ' . ($global ? '(todas as unidades)' : ''),
            '<span class="text-[11px] text-t3">Total: <strong class="num text-t1" data-testid="total-descartados">' . n($total) . '</strong></span>');
    } else {
        $direita = ultimasMovimentacoes($cd['id'], $modo === 'recuperados' ? ['RECUPERADO', 'CANIBALIZACAO'] : [$tipo], 'Últimos lançamentos');
    }
    echo '<div class="grid gap-6 lg:grid-cols-3">' . painel($topo . $form, 'Novo lançamento') . '<div class="space-y-6 lg:col-span-2">' . $direita . '</div></div>';
    View::$scripts[] = 'telas.js';
}
