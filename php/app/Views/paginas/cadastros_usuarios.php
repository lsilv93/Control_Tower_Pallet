<?php
declare(strict_types=1);
// Usuários e permissões (src/app/(sistema)/cadastros/usuarios/page.tsx).
$admin = requireAdmin();
View::$titulo = 'Usuários';
const CAMINHO_USU = '/cadastros/usuarios';
$lista = Db::all(
    'SELECT x.*, p.`codigo` AS principal,
            (SELECT GROUP_CONCAT(c.`codigo` ORDER BY c.`codigo` SEPARATOR \', \') FROM `UsuarioUnidade` uu JOIN `CentroDistribuicao` c ON c.`id` = uu.`unidadeId` WHERE uu.`usuarioId` = x.`id`) AS unidades
       FROM `Usuario` x JOIN `CentroDistribuicao` p ON p.`id` = x.`unidadeId` ORDER BY x.`ativo` DESC, x.`nome` ASC'
);
$editando = q('editar') ? Db::one('SELECT * FROM `Usuario` WHERE `id` = ?', [q('editar')]) : null;
$vinculadas = $editando ? Db::col('SELECT `unidadeId` FROM `UsuarioUnidade` WHERE `usuarioId` = ?', [$editando['id']]) : [];
$cds = Db::all('SELECT `id`, `codigo`, `nome`, `ativo`, `tipo`, `hub` FROM `CentroDistribuicao` ORDER BY `hub` DESC, `tipo` ASC, `codigo` ASC');

$unidades = '<fieldset class="poco p-4" data-testid="unidades-usuario"><legend class="label float-left !mb-3 w-full">Unidades vinculadas (CDs e Pontos de Cross) *</legend><div class="clear-both grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">';
foreach ($cds as $cd) {
    $marcado = $editando && (in_array($cd['id'], $vinculadas, true) || $editando['unidadeId'] === $cd['id']);
    $unidades .= '<label class="flex cursor-pointer items-center gap-2 text-[12px] ' . ($cd['ativo'] ? 'text-t2' : 'text-t4') . '"><input type="checkbox" name="unidadeIds" data-lista="unidadeIds" value="' . e($cd['id']) . '"' . ($marcado ? ' checked' : '') . '>'
        . '<span><span class="num font-semibold">' . e($cd['codigo']) . '</span> · ' . ($cd['tipo'] === 'CROSS' ? 'Cross' : ($cd['hub'] ? 'Hub' : 'CD')) . ($cd['ativo'] ? '' : ' (inativa)') . '</span></label>';
}
$unidades .= '</div><p class="mt-3 text-[11px] text-t4">Operadores veem e operam somente as unidades marcadas (podem ser vários CDs e/ou Pontos de Cross; com mais de uma, o usuário escolhe a unidade ao entrar e alterna pelo menu). Master e Administrador têm acesso a todas as unidades (Nível Brasil). Operando um Ponto de Cross, valem as restrições de Cross: painel, recebimento/conferência, retorno ao CD, lançar quebrado e ocorrências.</p></fieldset>';

$form = ($editando ? '<input type="hidden" name="id" value="' . e($editando['id']) . '">' : '')
    . campo('nome', 'Nome completo', $editando['nome'] ?? null, true, '', ['maxlength' => 120])
    . campo('login', 'Login', $editando['login'] ?? null, true, '', ['maxlength' => 40, 'autocomplete' => 'off'])
    . camposPermissao($editando['perfil'] ?? 'OPERADOR', $editando ? (json_decode($editando['permissoes'], true) ?: []) : ['dashboard'], ehMaster($admin))
    . $unidades
    . campo('senha', $editando ? 'Nova senha (deixe em branco para manter)' : 'Senha inicial', null, !$editando, '', ['type' => 'password', 'minlength' => 6, 'autocomplete' => 'new-password'])
    . rodapeForm((bool) $editando, CAMINHO_USU);

$linhas = '';
foreach ($lista as $x) {
    $perms = json_decode($x['permissoes'], true) ?: [];
    $acessos = $x['perfil'] === 'OPERADOR'
        ? ($perms ? implode(' · ', array_map(fn($k) => explode(' (', PERMISSOES[$k])[0], array_values(array_filter(array_keys(PERMISSOES), fn($k) => in_array($k, $perms, true))))) : 'Nenhuma tela liberada')
        : ($x['perfil'] === 'MASTER' ? 'Total + configurações' : 'Total');
    $linhas .= '<tr' . ($x['ativo'] ? '' : ' class="opacity-60"') . '><td class="font-medium text-t1">' . e($x['nome']) . '</td><td class="num">' . e($x['login']) . '</td>'
        . '<td' . ($x['perfil'] === 'MASTER' ? ' class="font-semibold text-lima"' : '') . '>' . ROTULO_PERFIL[$x['perfil']] . '</td>'
        . '<td class="num whitespace-nowrap text-[11px]"><span class="block max-w-[12rem] whitespace-normal font-semibold text-t1">' . e($x['unidades'] ?: $x['principal']) . '</span>'
        . ($x['perfil'] !== 'OPERADOR' ? '<span class="block text-lima">Todas as unidades</span>' : '') . '</td>'
        . '<td class="max-w-[16rem] whitespace-normal text-[11px] text-t3">' . e($acessos) . '</td><td>' . situacao((bool) $x['ativo']) . '</td>'
        . '<td class="num">' . formatarDataHora($x['criadoEm']) . '</td><td>'
        . (ehMaster($admin) || $x['perfil'] !== 'MASTER' ? acoesLinha('usuario', $x['id'], (bool) $x['ativo'], CAMINHO_USU, $x['id'] !== $admin['id']) : '') . '</td></tr>';
}
echo cabecalhoCadastros($admin) . bannerOk(q('ok')) . '<div class="grid gap-6 xl:grid-cols-3">'
    . painel(formAcao('cadastros/salvar-usuario', $form, ['botao' => $editando ? 'Salvar alterações' : 'Criar usuário', 'limpar' => false]), e($editando ? "Editar {$editando['login']}" : 'Novo usuário'))
    . painel(tabela('<table class="tabela"><thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Unidades</th><th>Acessos</th><th>Situação</th><th>Criado em</th><th></th></tr></thead><tbody>' . $linhas . '</tbody></table>'), 'Usuários (' . count($lista) . ')', '', 'xl:col-span-2')
    . '</div>';
