<?php
declare(strict_types=1);
// Tabela de rotas: páginas (GET), APIs e ações (POST /acao/...). Mesmas URLs do sistema original.

return [
    'paginas' => [
        '#^/$#' => 'painel',
        '#^/login$#' => 'login',
        '#^/selecionar-cd$#' => 'selecionar_cd',
        '#^/sem-acesso$#' => 'sem_acesso',
        '#^/conta$#' => 'conta',
        '#^/tv$#' => 'tv',
        '#^/envio$#' => 'envio',
        '#^/recebimento$#' => 'recebimento',
        '#^/ocorrencias$#' => 'ocorrencias',
        '#^/vales$#' => 'vales_agendar',
        '#^/vales/consulta$#' => 'vales_consulta',
        '#^/vales/excluir$#' => 'vales_excluir',
        '#^/vales/(?<id>[A-Za-z0-9_-]+)$#' => 'vale_detalhe',
        '#^/agendas$#' => 'agendas',
        '#^/avarias/quebras$#' => 'avarias_quebras',
        '#^/avarias/recuperados$#' => 'avarias_recuperados',
        '#^/avarias/descarte$#' => 'avarias_descarte',
        '#^/estoque/inclusao$#' => 'estoque_inclusao',
        '#^/estoque/remocao$#' => 'estoque_remocao',
        '#^/pallets/adicionar$#' => 'pallets_adicionar',
        '#^/fornecedor/entrada$#' => 'fornecedor_entrada',
        '#^/relatorios$#' => 'relatorios',
        '#^/auditoria$#' => 'auditoria',
        '#^/cadastros/transportadoras$#' => 'cadastros_transportadoras',
        '#^/cadastros/fornecedores$#' => 'cadastros_fornecedores',
        '#^/cadastros/cds$#' => 'cadastros_cds',
        '#^/cadastros/cross$#' => 'cadastros_cross',
        '#^/cadastros/usuarios$#' => 'cadastros_usuarios',
        '#^/imprimir/vale/(?<id>[A-Za-z0-9_-]+)$#' => 'imprimir_vale',
    ],
    'apis' => [
        '#^/api/tv/versao$#' => 'tv_versao',
        '#^/api/vales/(?<id>[A-Za-z0-9_-]+)/pdf$#' => 'vale_pdf',
        '#^/api/exportar$#' => 'exportar',
        '#^/api/auditoria/exportar$#' => 'auditoria_exportar',
        '#^/api/painel/versao$#' => 'painel_versao',
    ],
    // Ações (POST): grupo/nome → arquivo app/Actions/{grupo}.php, função acao_{grupo}_{nome}.
    'acoes' => [
        'auth' => ['entrar', 'sair', 'selecionar-cd', 'alterar-senha'],
        'cadastros' => ['salvar-transportadora', 'salvar-fornecedor', 'salvar-cd', 'configurar-unidade', 'salvar-usuario', 'alternar-ativo', 'criar-fornecedor-rapido'],
        'transferencias' => ['enviar', 'conferir', 'responder-ocorrencia'],
        'vales' => ['excluir', 'agendar', 'validar-agenda', 'cancelar-agenda', 'buscar'],
        'avarias' => ['quebra', 'reparo', 'descarte'],
        'pallets' => ['incluir', 'remover', 'ler-nfe', 'registrar-compra', 'simular-nfe'],
        'fornecedor' => ['ler-nfe', 'registrar-entrada'],
    ],
    // Rotas acessíveis sem sessão.
    'publicas' => ['/login', '/acao/auth/entrar', '/acao/auth/sair'],
];
