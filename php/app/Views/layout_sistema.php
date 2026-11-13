<?php
declare(strict_types=1);
// Layout das telas do sistema: menu lateral + conteúdo ((sistema)/layout.tsx + Menu.tsx).
/** @var string $conteudo */

$usuario = requireUsuario();
// Visão global sem unidade escolhida: modal obrigatório de seleção da unidade de operação.
if (!$usuario['cd'] && count($usuario['cds']) > 0) redirecionar('/selecionar-cd');
$pendencias = contarPendenciasDoUsuario($usuario);
$cd = $usuario['cd'];
$podeTrocarCD = count($usuario['cds']) > 1;
$tema = temaAtual();
$caminho = caminhoAtual();

$grupos = [
    ['titulo' => '', 'itens' => [
        ['href' => '/', 'rotulo' => 'Painel', 'icone' => 'layout-dashboard', 'permissao' => 'dashboard'],
        ['href' => '/tv', 'rotulo' => 'Torre de Controle (TV)', 'icone' => 'monitor-play'],
    ]],
    ['titulo' => 'Movimentação', 'itens' => [
        ['href' => '/envio', 'rotulo' => 'Envio de Pallets', 'icone' => 'arrow-up-from-line', 'permissao' => 'envio'],
        ['href' => '/recebimento', 'rotulo' => 'Recebimento / Conferência', 'icone' => 'clipboard-check', 'permissao' => 'recebimento'],
        ['href' => '/ocorrencias', 'rotulo' => 'Ocorrências', 'icone' => 'triangle-alert'],
    ]],
    ['titulo' => 'Avarias', 'itens' => [
        ['href' => '/avarias/quebras', 'rotulo' => 'Lançar Quebrado', 'icone' => 'hammer', 'permissao' => 'quebras'],
        ['href' => '/avarias/recuperados', 'rotulo' => 'Conserto / Reparo', 'icone' => 'recycle', 'permissao' => 'reparo', 'requer' => 'hub'],
        ['href' => '/avarias/descarte', 'rotulo' => 'Descarte', 'icone' => 'trash-2', 'requer' => 'naoCross'],
    ]],
    ['titulo' => 'Fornecedor & Vales', 'itens' => [
        ['href' => '/fornecedor/entrada', 'rotulo' => 'Recebimento Pallet Fornecedor', 'icone' => 'package-plus', 'permissao' => 'fornecedor', 'requer' => 'fornecedor'],
        ['href' => '/vales/consulta', 'rotulo' => 'Consulta de Vales', 'icone' => 'file-search', 'permissao' => 'vales'],
        ['href' => '/vales', 'rotulo' => 'Agendar Retirada', 'icone' => 'clipboard-list', 'permissao' => 'fornecedor', 'requer' => 'fornecedor'],
        ['href' => '/agendas', 'rotulo' => 'Baixa de Pagamento', 'icone' => 'calendar-check', 'permissao' => 'fornecedor', 'requer' => 'fornecedor'],
        ['href' => '/vales/excluir', 'rotulo' => 'Excluir Vale', 'icone' => 'file-x', 'permissao' => 'excluir_vale'],
    ]],
    ['titulo' => 'Cadastros', 'itens' => [
        ['href' => '/cadastros/transportadoras', 'rotulo' => 'Transportadoras', 'icone' => 'truck', 'permissao' => 'cadastros'],
        ['href' => '/cadastros/fornecedores', 'rotulo' => 'Fornecedores', 'icone' => 'factory', 'permissao' => 'cadastros'],
        ['href' => '/cadastros/cds', 'rotulo' => 'Centros de Distribuição', 'icone' => 'building-2', 'permissao' => 'cds'],
        ['href' => '/cadastros/cross', 'rotulo' => 'Pontos de Cross', 'icone' => 'network', 'permissao' => 'cds'],
        ['href' => '/cadastros/usuarios', 'rotulo' => 'Usuários e Permissões', 'icone' => 'users', 'somente' => 'admin'],
    ]],
    ['titulo' => 'Gestão', 'itens' => [
        ['href' => '/estoque/inclusao', 'rotulo' => 'Ajuste de Saldo (Admin)', 'icone' => 'sliders-horizontal', 'somente' => 'admin'],
        ['href' => '/auditoria', 'rotulo' => 'Auditoria', 'icone' => 'shield-check', 'permissao' => 'auditoria'],
        ['href' => '/relatorios', 'rotulo' => 'Relatórios', 'icone' => 'file-spreadsheet', 'permissao' => 'relatorios'],
        ['href' => '/conta', 'rotulo' => 'Minha Senha', 'icone' => 'key-round'],
    ]],
];

$visivel = function (array $i) use ($usuario, $cd): bool {
    if (($i['somente'] ?? null) === 'master' && !ehMaster($usuario)) return false;
    if (($i['somente'] ?? null) === 'admin' && !ehAdmin($usuario)) return false;
    if (!empty($i['permissao']) && !tem($usuario, $i['permissao'])) return false;
    if (($i['requer'] ?? null) === 'hub' && empty($cd['hub'])) return false;
    if (($i['requer'] ?? null) === 'fornecedor' && empty($cd['recebimentoFornecedor'])) return false;
    if (($i['requer'] ?? null) === 'naoCross' && ehUsuarioCross($usuario)) return false;
    return true;
};
$ativo = fn(string $href): bool => $href === '/' ? $caminho === '/' : ($href === '/vales' ? $caminho === '/vales' : str_starts_with($caminho, $href));

$botaoTema = function (bool $comRotulo = false) use ($tema): string {
    $rotulo = $tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
    $ic = $tema === 'dark' ? 'sun' : 'moon';
    if ($comRotulo) return '<button type="button" data-tema class="btn-secondary w-full" aria-label="' . $rotulo . '" title="' . $rotulo . '">' . icone($ic) . ($tema === 'dark' ? 'Tema claro' : 'Tema escuro') . '</button>';
    return '<button type="button" data-tema class="btn-icone" aria-label="' . $rotulo . '" title="' . $rotulo . '">' . icone($ic, 'h-5 w-5') . '</button>';
};
$botaoSairIcone = '<button type="button" data-sair class="btn-icone hover:!text-erro" aria-label="Sair do sistema" title="Sair do sistema">' . icone('log-out', 'h-5 w-5') . '</button>';
$botaoSair = '<button type="button" data-sair class="btn-secondary w-full" data-testid="botao-sair">' . icone('log-out') . ' Sair</button>';
?>
<div class="min-h-screen">
  <header class="sticky top-0 z-30 flex items-center justify-between gap-3 bg-fundo/95 px-[14px] py-3 backdrop-blur-sm lg:hidden">
    <div class="flex items-center gap-2.5 text-[13px] font-semibold text-t1">
      <span class="fill-lima flex h-9 w-9 items-center justify-center rounded-2xl"><?= icone('boxes') ?></span>
      <span class="flex flex-col leading-tight">
        Control Tower Pallet
        <?php if ($cd): ?><span class="num text-[10px] font-medium text-lima"><?= $cd['tipo'] === 'CROSS' ? 'Cross' : 'CD' ?> <?= e($cd['codigo']) ?></span><?php endif ?>
      </span>
    </div>
    <div class="flex items-center gap-2">
      <?= $botaoTema() ?>
      <?= $botaoSairIcone ?>
      <button class="btn-icone" data-menu-abrir aria-label="Abrir menu"><span data-icone-abrir><?= icone('menu', 'h-5 w-5') ?></span><span data-icone-fechar hidden><?= icone('x', 'h-5 w-5') ?></span></button>
    </div>
  </header>

  <aside data-menu class="fixed inset-y-0 left-0 z-40 w-[268px] p-3 transition-transform duration-[250ms] lg:translate-x-0 -translate-x-full">
    <div class="card flex h-full flex-col overflow-y-auto lg:overflow-hidden">
      <div class="flex items-center justify-between gap-2 px-5 pb-4 pt-5">
        <div class="flex items-center gap-3">
          <span class="fill-lima flex h-10 w-10 items-center justify-center rounded-2xl"><?= icone('boxes', 'h-5 w-5') ?></span>
          <div>
            <p class="text-[13px] font-semibold leading-tight text-t1">Control Tower</p>
            <p class="text-[11px] text-t3">Gestão de Pallets PBR</p>
          </div>
        </div>
        <div class="hidden flex-col gap-2 lg:flex">
          <?= $botaoTema() ?>
          <?= $botaoSairIcone ?>
        </div>
      </div>

      <div class="px-3 pb-3">
        <?php if (!$cd): ?>
          <a href="/selecionar-cd" class="poco-erro flex items-center gap-2 px-4 py-3 text-[11px] font-semibold text-erro-claro"><?= icone('building-2') ?> Nenhuma unidade de operação</a>
        <?php else: ?>
          <div class="poco flex items-center gap-3 px-4 py-3" data-testid="cd-ativo">
            <?= icone($cd['tipo'] === 'CROSS' ? 'network' : 'building-2', 'h-4 w-4 flex-none text-lima') ?>
            <div class="min-w-0 flex-1">
              <p class="text-[10px] uppercase tracking-[0.12em] text-t4"><?= $cd['tipo'] === 'CROSS' ? 'Ponto de Cross' : ($cd['hub'] ? 'CD Hub' : 'CD') ?> de operação</p>
              <p class="truncate text-[12px] font-semibold text-t1" title="<?= e($cd['nome']) ?>"><span class="num"><?= e($cd['codigo']) ?></span> · <?= e($cd['nome']) ?></p>
            </div>
            <?php if ($podeTrocarCD): ?>
              <a href="/selecionar-cd?trocar=1" class="btn-icone !h-8 !w-8" title="Trocar unidade" aria-label="Trocar unidade"><?= icone('repeat') ?></a>
            <?php else: ?>
              <span title="<?= $usuario['global'] ? 'Única unidade ativa' : 'Seu usuário opera somente nesta unidade' ?>" aria-label="Unidade fixa"><?= icone('lock', 'h-3.5 w-3.5 text-t4') ?></span>
            <?php endif ?>
          </div>
        <?php endif ?>
      </div>

      <?php if (tem($usuario, 'compras') && $usuario['global']): ?>
        <div class="px-3 pb-3">
          <a href="/pallets/adicionar" class="<?= cx('w-full', $ativo('/pallets') ? 'btn-secondary !text-lima' : 'btn-primary') ?>"><?= icone('plus') ?> Compra de Pallets</a>
        </div>
      <?php endif ?>

      <nav class="flex-1 space-y-4 px-3 pb-4 lg:overflow-y-auto">
        <?php foreach ($grupos as $g):
            $itens = array_filter($g['itens'], $visivel);
            if (!$itens) continue; ?>
          <div>
            <?php if ($g['titulo']): ?><p class="secao px-3 pb-1.5"><?= e($g['titulo']) ?></p><?php endif ?>
            <div class="space-y-1">
              <?php foreach ($itens as $i): $at = $ativo($i['href']); ?>
                <a href="<?= e($i['href']) ?>"<?= $at ? ' aria-current="page"' : '' ?> class="<?= cx('flex min-h-[44px] items-center gap-3 rounded-full px-4 text-[12px] font-medium transition-[background,color,box-shadow] duration-200', $at ? 'fill-lima font-semibold' : 'text-t2 hover:bg-lima/[.09] hover:text-lima') ?>">
                  <?= icone($i['icone'], 'h-4 w-4 flex-none') ?>
                  <span class="flex-1"><?= e($i['rotulo']) ?></span>
                  <?php if ($i['href'] === '/ocorrencias' && $pendencias > 0): ?>
                    <span class="num rounded-full bg-erro px-2 py-0.5 text-[10px] font-bold text-white" data-testid="badge-ocorrencias" title="Ocorrências aguardando sua ação"><?= $pendencias ?></span>
                  <?php endif ?>
                </a>
              <?php endforeach ?>
            </div>
          </div>
        <?php endforeach ?>
      </nav>

      <div class="p-3">
        <div class="poco p-4">
          <p class="truncate text-[12px] font-semibold text-t1"><?= e($usuario['nome']) ?></p>
          <p class="text-[11px] text-t3"><?= e($usuario['login']) ?> · <?= ROTULO_PERFIL[$usuario['perfil']] ?></p>
          <p class="mt-0.5 text-[10px] text-t4" data-testid="escopo-usuario"><?=
            $usuario['global'] ? 'Acesso a todas as unidades' : ($podeTrocarCD ? 'Várias unidades vinculadas' : ($usuario['unidade']['tipo'] === 'CROSS' ? 'Ponto de Cross' : 'Visão da unidade'))
          ?></p>
        </div>
        <div class="mt-3"><?= $botaoSair ?></div>
      </div>
    </div>
  </aside>
  <div data-menu-fundo hidden class="fixed inset-0 z-30 bg-[#000814]/60 lg:hidden"></div>

  <main class="lg:pl-[268px]">
    <div class="entrada mx-auto max-w-7xl px-[14px] py-6 sm:px-6 lg:px-8 lg:py-8"><?= $conteudo ?></div>
  </main>
</div>
