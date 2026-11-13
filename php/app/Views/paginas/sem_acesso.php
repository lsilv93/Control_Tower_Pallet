<?php
declare(strict_types=1);
// Sem permissão para a tela (src/app/(sistema)/sem-acesso/page.tsx).
View::$titulo = 'Sem acesso';
$motivos = [
    'fornecedor' => ['Módulo não liberado nesta unidade', 'O Recebimento Pallet Fornecedor está desligado para esta unidade. Somente o usuário Master pode liberá-lo em Cadastros → Centros de Distribuição.'],
    'reparo' => ['Conserto exclusivo do CD Hub', 'O conserto/reparo de pallets quebrados é feito somente no CD Hub (CDJC). Envie os quebrados ao CDJC pela tela de Envio.'],
    'tv' => ['Torre de Controle restrita', 'A TV Nível Brasil é exclusiva de Master, Administrador e usuários do CD Hub (CDJC).'],
    'cross' => ['Fora do escopo do Ponto de Cross', 'Usuários de Ponto de Cross acessam somente o painel do próprio Cross, o recebimento/conferência, o envio de retorno ao CD e o lançamento de quebrados.'],
];
[$titulo, $texto] = $motivos[q('modulo') ?? ''] ?? ['Sem permissão para esta tela', 'Seu usuário não tem acesso a esta funcionalidade. Solicite a permissão a um administrador.'];
echo painel(
    icone('shield-alert', 'mx-auto mb-4 h-10 w-10 text-ouro')
    . '<h1 class="mb-2 text-[18px] font-semibold text-t1" data-testid="sem-acesso">' . e($titulo) . '</h1>'
    . '<p class="mb-6 text-[12px] text-t3">' . e($texto) . '</p><a href="/" class="btn-secondary">Voltar ao início</a>',
    classe: 'mx-auto mt-10 max-w-md text-center',
);
