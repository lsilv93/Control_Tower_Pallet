<?php
declare(strict_types=1);
// Cadastro de transportadoras (src/app/(sistema)/cadastros/transportadoras/page.tsx).
$u = requirePermissao('cadastros');
View::$titulo = 'Transportadoras';
const CAMINHO_TRANSP = '/cadastros/transportadoras';
$lista = Db::all('SELECT * FROM `Transportadora` ORDER BY `ativo` DESC, `nome` ASC');
$editando = q('editar') ? Db::one('SELECT * FROM `Transportadora` WHERE `id` = ?', [q('editar')]) : null;

$form = ($editando ? '<input type="hidden" name="id" value="' . e($editando['id']) . '">' : '')
    . campo('nome', 'Nome / Razão social', $editando['nome'] ?? null, true, '', ['maxlength' => 200])
    . campo('cnpj', 'CNPJ', $editando ? formatarCnpj($editando['cnpj']) : '', true, 'num', ['placeholder' => '00.000.000/0000-00', 'data-mascara' => 'cnpj'])
    . campo('contato', 'Contato', $editando['contato'] ?? null, false, '', ['maxlength' => 120])
    . '<div class="grid gap-4 sm:grid-cols-2">'
    . campo('telefone', 'Telefone', $editando['telefone'] ?? null, false, '', ['type' => 'tel', 'maxlength' => 40])
    . campo('email', 'E-mail', $editando['email'] ?? null, false, '', ['type' => 'email', 'maxlength' => 160])
    . '</div>' . rodapeForm((bool) $editando, CAMINHO_TRANSP);

if (!$lista) {
    $tabela = vazio('Nenhuma transportadora cadastrada.');
} else {
    $linhas = '';
    foreach ($lista as $t) {
        $linhas .= '<tr' . ($t['ativo'] ? '' : ' class="opacity-60"') . '><td class="font-medium text-t1">' . e($t['nome']) . '</td><td class="num">' . e(formatarCnpj($t['cnpj'])) . '</td>'
            . '<td><p>' . e($t['contato'] ?? '—') . '</p><p class="text-[11px] text-t4">' . e(implode(' · ', array_filter([$t['telefone'], $t['email']]))) . '</p></td>'
            . '<td>' . situacao((bool) $t['ativo']) . '</td><td>' . acoesLinha('transportadora', $t['id'], (bool) $t['ativo'], CAMINHO_TRANSP) . '</td></tr>';
    }
    $tabela = tabela('<table class="tabela"><thead><tr><th>Nome</th><th>CNPJ</th><th>Contato</th><th>Situação</th><th></th></tr></thead><tbody>' . $linhas . '</tbody></table>');
}
echo cabecalhoCadastros($u) . bannerOk(q('ok')) . '<div class="grid gap-6 xl:grid-cols-3">'
    . painel(formAcao('cadastros/salvar-transportadora', $form, ['botao' => $editando ? 'Salvar alterações' : 'Cadastrar', 'limpar' => false]), e($editando ? "Editar {$editando['nome']}" : 'Nova transportadora'))
    . painel($tabela, 'Transportadoras (' . count($lista) . ')', '', 'xl:col-span-2') . '</div>';
