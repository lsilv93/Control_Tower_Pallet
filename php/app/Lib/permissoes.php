<?php
declare(strict_types=1);
// Controle de acesso (RBAC + escopo por unidade). Tradução de src/lib/permissoes.ts.

/** Permissões granulares por tela/funcionalidade, atribuíveis a operadores. */
const PERMISSOES = [
    'dashboard' => 'Painel da unidade',
    'envio' => 'Envio de pallets (CD, Cross e quebrados ao CDJC)',
    'recebimento' => 'Recebimento / conferência de pallets',
    'quebras' => 'Lançar quebrado',
    'reparo' => 'Conserto / reparo de quebrados (Hub CDJC)',
    'vales' => 'Consulta de vales',
    'excluir_vale' => 'Excluir vale (antes da conferência)',
    'fornecedor' => 'Recebimento Pallet Fornecedor (se liberado no CD)',
    'compras' => 'Compra de pallets (leitura de NF-e)',
    'relatorios' => 'Relatórios e exportação',
    'auditoria' => 'Auditoria',
    'cadastros' => 'Cadastro de fornecedores e transportadoras',
    'cds' => 'Cadastro de CDs e Pontos de Cross',
];

/** Usuários de Ponto de Cross: painel, recebimento, envio de retorno e lançar quebrado. */
const PERMISSOES_CROSS = ['dashboard', 'envio', 'recebimento', 'quebras'];

const ROTULO_PERFIL = ['MASTER' => 'Master', 'ADMIN' => 'Administrador', 'OPERADOR' => 'Operador'];

function ehMaster(array $u): bool
{
    return $u['perfil'] === 'MASTER';
}

/** Administração: MASTER e ADMIN. */
function ehAdmin(array $u): bool
{
    return $u['perfil'] === 'MASTER' || $u['perfil'] === 'ADMIN';
}

/** Usuário de Ponto de Cross (não administrador). */
function ehUsuarioCross(array $u): bool
{
    return !ehAdmin($u) && ($u['unidade']['tipo'] ?? null) === 'CROSS';
}

/** Acesso cruzado a todas as unidades: exclusivo de Master e Administrador. */
function temVisaoGlobal(array $u): bool
{
    return ehAdmin($u);
}

/** MASTER/ADMIN têm todas as telas; OPERADOR só as marcadas; usuário de Cross limitado. */
function tem(array $u, string $p): bool
{
    if (ehAdmin($u)) return true;
    if (ehUsuarioCross($u) && !in_array($p, PERMISSOES_CROSS, true)) return false;
    return in_array($p, $u['permissoes'] ?? [], true);
}

const ROTA_INICIAL = [
    'dashboard' => '/',
    'envio' => '/envio',
    'recebimento' => '/recebimento',
    'quebras' => '/avarias/quebras',
    'reparo' => '/avarias/recuperados',
    'vales' => '/vales/consulta',
    'excluir_vale' => '/vales/excluir',
    'fornecedor' => '/fornecedor/entrada',
    'compras' => '/pallets/adicionar',
    'relatorios' => '/relatorios',
    'auditoria' => '/auditoria',
    'cadastros' => '/cadastros/fornecedores',
    'cds' => '/cadastros/cds',
];

/** Tela inicial para quem não tem acesso ao painel. */
function primeiraRota(array $u): string
{
    foreach (array_keys(PERMISSOES) as $c) {
        if ($c !== 'fornecedor' && $c !== 'reparo' && tem($u, $c)) return ROTA_INICIAL[$c];
    }
    return ehUsuarioCross($u) ? '/conta' : '/avarias/descarte';
}
