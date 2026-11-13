<?php
declare(strict_types=1);
/**
 * Cadastro de unidades (src/components/PaginaUnidades.tsx): Sigla e Nome obrigatórios; CNPJ,
 * contato, telefone e e-mail opcionais; endereço obrigatório. Pontos de Cross vinculados a um
 * ou mais CDs. O Master configura o CD Hub e libera o módulo de fornecedores por CD.
 */
function paginaUnidades(string $tipo): void
{
    $u = requirePermissaoGlobal('cds');
    $master = ehMaster($u);
    $c = [
        'CD' => ['singular' => 'CD', 'plural' => 'Centros de Distribuição', 'caminho' => '/cadastros/cds', 'novo' => 'Novo CD'],
        'CROSS' => ['singular' => 'Ponto de Cross', 'plural' => 'Pontos de Cross-Docking', 'caminho' => '/cadastros/cross', 'novo' => 'Novo Ponto de Cross'],
    ][$tipo];
    View::$titulo = $tipo === 'CD' ? 'Centros de Distribuição' : 'Pontos de Cross';
    $lista = Db::all(
        'SELECT c.*, (SELECT COUNT(*) FROM `Usuario` x WHERE x.`unidadeId` = c.`id`) AS nUsuarios,
                (SELECT COUNT(*) FROM `CrossCD` x WHERE x.`cdId` = c.`id`) AS nCross,
                (SELECT GROUP_CONCAT(d.`codigo` ORDER BY d.`codigo` SEPARATOR \', \') FROM `CrossCD` x JOIN `CentroDistribuicao` d ON d.`id` = x.`cdId` WHERE x.`crossId` = c.`id`) AS atendidos
           FROM `CentroDistribuicao` c WHERE c.`tipo` = ? ORDER BY c.`ativo` DESC, c.`hub` DESC, c.`codigo` ASC',
        [$tipo],
    );
    $editando = q('editar') ? normalizarUnidade(Db::one('SELECT * FROM `CentroDistribuicao` WHERE `id` = ? AND `tipo` = ?', [q('editar'), $tipo])) : null;
    $vinculados = $editando ? Db::col('SELECT `cdId` FROM `CrossCD` WHERE `crossId` = ?', [$editando['id']]) : [];
    $cds = $tipo === 'CROSS' ? Db::all("SELECT `id`, `codigo`, `nome` FROM `CentroDistribuicao` WHERE `tipo` = 'CD' AND `ativo` = 1 ORDER BY `codigo` ASC") : [];

    $form = ($editando ? '<input type="hidden" name="id" value="' . e($editando['id']) . '">' : '') . '<input type="hidden" name="tipo" value="' . $tipo . '">'
        . camposPadrao($editando ? $editando + ['sigla' => $editando['codigo']] : null, $tipo === 'CD' ? 'Nome do CD' : 'Nome do Ponto de Cross', 'campo', null, 'codigo', $tipo === 'CD' ? 'Ex.: CDFT' : 'Ex.: XRJ01')
        . camposEndereco($editando);
    if ($tipo === 'CROSS') {
        $form .= '<fieldset class="poco p-4" data-testid="cds-atendidos"><legend class="label float-left !mb-3 w-full">CDs atendidos * <span class="normal-case tracking-normal text-t4">(marque um ou mais)</span></legend>';
        if (!$cds) {
            $form .= '<p class="text-[11px] text-erro">Cadastre um CD antes de cadastrar o Ponto de Cross.</p>';
        } else {
            $form .= '<div class="clear-both grid gap-2 sm:grid-cols-2">';
            foreach ($cds as $cd) {
                $marcado = $editando ? in_array($cd['id'], $vinculados, true) : count($cds) === 1;
                $form .= '<label class="flex cursor-pointer items-center gap-2 text-[12px] text-t2"><input type="checkbox" name="cdIds" data-lista="cdIds" value="' . e($cd['id']) . '"' . ($marcado ? ' checked' : '') . '>'
                    . '<span><span class="num font-semibold">' . e($cd['codigo']) . '</span> · ' . e($cd['nome']) . '</span></label>';
            }
            $form .= '</div>';
        }
        $form .= '<p class="mt-2 text-[11px] text-t4">O Cross recebe envios e devolve pallets somente aos CDs marcados.</p></fieldset>';
    }
    $form .= '<p class="text-[11px] text-t4">' . ($tipo === 'CD'
        ? 'Cada CD tem estoque próprio de Pallets PBR e Pallets Quebrados. Vincule os usuários em Usuários e Permissões.'
        : 'O Ponto de Cross tem estoque próprio (Pallets PBR e Pallets Quebrados), recebe envios dos CDs e devolve pallets ao CD.') . '</p>'
        . rodapeForm((bool) $editando, $c['caminho']);

    $esquerda = painel(formAcao('cadastros/salvar-cd', $form, ['botao' => $editando ? 'Salvar alterações' : 'Cadastrar', 'limpar' => false]), e($editando ? "Editar {$editando['codigo']}" : $c['novo']));
    if ($tipo === 'CD' && $master && $editando) {
        $cfg = '<input type="hidden" name="id" value="' . e($editando['id']) . '">'
            . '<label class="poco flex cursor-pointer items-start gap-3 px-4 py-3 text-[12px]"><input type="checkbox" name="recebimentoFornecedor"' . ($editando['recebimentoFornecedor'] ? ' checked' : '') . ' class="mt-0.5" data-testid="cfg-fornecedor">'
            . '<span><span class="block font-semibold text-t1">Recebimento Pallet Fornecedor</span><span class="text-t3">Libera o módulo de fornecedores (entrada, vales, agendas) neste CD. Desligado por padrão.</span></span></label>'
            . '<label class="poco flex cursor-pointer items-start gap-3 px-4 py-3 text-[12px]"><input type="checkbox" name="hub"' . ($editando['hub'] ? ' checked' : '') . ' class="mt-0.5">'
            . '<span><span class="block font-semibold text-t1">CD Hub (Nível Brasil)</span><span class="text-t3">Recebe os quebrados das filiais, faz o conserto e tem visão global. Só pode existir um.</span></span></label>';
        $esquerda .= painel(formAcao('cadastros/configurar-unidade', $cfg, ['botao' => 'Salvar configuração', 'limpar' => false]), e("Configurações do Master · {$editando['codigo']}"));
    }

    if (!$lista) {
        $tabela = vazio('Nenhum ' . e($c['singular']) . ' cadastrado.');
    } else {
        $linhas = '';
        foreach ($lista as $x) {
            $end = enderecoCompleto($x);
            $linhas .= '<tr' . ($x['ativo'] ? '' : ' class="opacity-60"') . '><td class="num font-semibold text-t1">' . e($x['codigo']) . '</td>'
                . '<td><p class="text-t1">' . e($x['nome']) . '</p><p class="num text-[11px] text-t4">' . e($x['cnpj'] ? formatarCnpj($x['cnpj']) : '—') . '</p>'
                . '<p class="max-w-[18rem] text-[11px] text-t4">' . ($end !== null ? e($end) : '<span class="text-ouro">Endereço não cadastrado</span>') . '</p></td>'
                . '<td><p>' . e($x['contato'] ?? '—') . '</p><p class="text-[11px] text-t4">' . e(implode(' · ', array_filter([$x['telefone'], $x['email']]))) . '</p></td>';
            if ($tipo === 'CROSS') {
                $linhas .= '<td class="num">' . e($x['atendidos'] ?: '—') . '</td>';
            } else {
                $linhas .= '<td class="space-x-1 whitespace-nowrap">' . ($x['hub'] ? '<span class="pill text-lima bg-lima/10">Hub</span>' : '')
                    . ($x['recebimentoFornecedor'] ? '<span class="pill text-t2 bg-t2/10">Fornecedor</span>' : (!$x['hub'] ? '<span class="text-t4">—</span>' : ''))
                    . ($x['nCross'] > 0 ? '<span class="text-[11px] text-t4">' . $x['nCross'] . ' Cross</span>' : '') . '</td>';
            }
            $linhas .= '<td class="num text-right">' . $x['nUsuarios'] . '</td><td>' . situacao((bool) $x['ativo']) . '</td><td>' . acoesLinha('cd', $x['id'], (bool) $x['ativo'], $c['caminho'], !$x['hub']) . '</td></tr>';
        }
        $tabela = tabela('<table class="tabela" data-testid="tabela-unidades"><thead><tr><th>Sigla</th><th>Nome / CNPJ / endereço</th><th>Contato responsável</th>'
            . ($tipo === 'CROSS' ? '<th>CDs atendidos</th>' : '<th>Módulos</th>') . '<th class="text-right">Usuários</th><th>Situação</th><th></th></tr></thead><tbody>' . $linhas . '</tbody></table>');
    }
    echo cabecalhoCadastros($u) . bannerOk(q('ok')) . '<div class="grid gap-6 xl:grid-cols-3"><div class="space-y-6">' . $esquerda . '</div>'
        . painel($tabela, e($c['plural']) . ' (' . count($lista) . ')', '', 'xl:col-span-2') . '</div>';
}
