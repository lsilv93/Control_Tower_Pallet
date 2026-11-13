<?php
declare(strict_types=1);
// Cadastro de fornecedores (src/app/(sistema)/cadastros/fornecedores/page.tsx).
$u = requirePermissaoGlobal('cadastros');
View::$titulo = 'Fornecedores';
const CAMINHO_FORN = '/cadastros/fornecedores';
$lista = Db::all('SELECT f.*, (SELECT COUNT(*) FROM `ValePallet` v WHERE v.`fornecedorId` = f.`id`) AS nVales, (SELECT COUNT(*) FROM `Compra` c WHERE c.`fornecedorId` = f.`id`) AS nCompras
                    FROM `Fornecedor` f ORDER BY f.`ativo` DESC, f.`nome` ASC');
$editando = q('editar') ? Db::one('SELECT * FROM `Fornecedor` WHERE `id` = ?', [q('editar')]) : null;

$form = ($editando ? '<input type="hidden" name="id" value="' . e($editando['id']) . '">' : '')
    . camposPadrao($editando, 'Nome / Razão social', 'campo', null, 'sigla', 'Ex.: AMBEV') . rodapeForm((bool) $editando, CAMINHO_FORN);
if (!$lista) {
    $tabela = vazio('Nenhum fornecedor cadastrado.');
} else {
    $linhas = '';
    foreach ($lista as $f) {
        $linhas .= '<tr' . ($f['ativo'] ? '' : ' class="opacity-60"') . '><td class="num font-semibold text-t1">' . e($f['sigla'] ?? '—') . '</td><td class="font-medium text-t1">' . e($f['nome']) . '</td>'
            . '<td class="num">' . e(formatarCnpj($f['cnpj'])) . '</td><td>' . e($f['contato'] ?? '—') . '</td>'
            . '<td><p class="num">' . e($f['telefone'] ?? '—') . '</p><p class="text-[11px] text-t4">' . e($f['email']) . '</p></td>'
            . '<td class="num text-right">' . $f['nVales'] . '</td><td class="num text-right">' . $f['nCompras'] . '</td>'
            . '<td>' . situacao((bool) $f['ativo']) . '</td><td>' . acoesLinha('fornecedor', $f['id'], (bool) $f['ativo'], CAMINHO_FORN) . '</td></tr>';
    }
    $tabela = tabela('<table class="tabela"><thead><tr><th>Sigla</th><th>Nome</th><th>CNPJ</th><th>Contato responsável</th><th>Telefone / e-mail</th><th class="text-right">Vales</th><th class="text-right">Compras</th><th>Situação</th><th></th></tr></thead><tbody>' . $linhas . '</tbody></table>');
}
echo cabecalhoCadastros($u) . bannerOk(q('ok')) . '<div class="grid gap-6 xl:grid-cols-3">'
    . painel(formAcao('cadastros/salvar-fornecedor', $form, ['botao' => $editando ? 'Salvar alterações' : 'Cadastrar', 'limpar' => false]), e($editando ? "Editar {$editando['nome']}" : 'Novo fornecedor'))
    . painel($tabela, 'Fornecedores (' . count($lista) . ')', '', 'xl:col-span-2') . '</div>';
