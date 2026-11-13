<?php
declare(strict_types=1);
// Modal obrigatório de seleção da unidade de operação (src/app/selecionar-cd/page.tsx).
$u = requireUsuario();
if (count($u['cds']) === 1 || ($u['cd'] && !q('trocar'))) redirecionar('/');
View::$titulo = 'Selecionar Unidade';
View::$layout = 'vazio';
$tema = temaAtual();
$rotTema = $tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
$primeiroNome = explode(' ', $u['nome'])[0];
?>
<main class="relative flex min-h-screen items-center justify-center bg-[#000814]/60 p-[14px] pt-20 sm:pt-[14px]">
  <div class="absolute right-[14px] top-[14px]">
    <button type="button" data-tema class="btn-icone" aria-label="<?= $rotTema ?>" title="<?= $rotTema ?>"><?= icone($tema === 'dark' ? 'sun' : 'moon', 'h-5 w-5') ?></button>
  </div>
  <div role="dialog" aria-modal="true" aria-labelledby="titulo-cd" class="card entrada w-full max-w-md p-7 sm:p-8">
    <div class="mb-6 flex items-center gap-3">
      <span class="fill-lima flex h-12 w-12 items-center justify-center rounded-2xl"><?= icone('building-2', 'h-6 w-6') ?></span>
      <div>
        <h1 id="titulo-cd" class="text-[18px] font-semibold text-t1">Em qual unidade você vai operar?</h1>
        <p class="text-[12px] text-t3">Olá, <?= e($primeiroNome) ?>. <?= $u['global'] ? 'Seu perfil tem acesso a todas as unidades' : 'Você tem ' . count($u['cds']) . ' unidades vinculadas' ?>: as operações desta sessão serão registradas na unidade escolhida.</p>
      </div>
    </div>

    <?php if (!$u['cds']): ?>
      <div class="poco-erro flex items-start gap-3 p-4 text-[12px] text-erro-claro">
        <?= icone('triangle-alert', 'mt-0.5 h-4 w-4 flex-none') ?>
        <div>
          <p class="font-semibold">Nenhuma unidade disponível para o seu usuário.</p>
          <p class="mt-1"><?= ehAdmin($u) ? 'Cadastre um CD em <a href="/cadastros/cds" class="font-semibold underline">Cadastros → CDs</a>.' : 'Sua unidade está inativa. Procure um administrador.' ?></p>
        </div>
      </div>
    <?php else:
      $lista = '<fieldset class="max-h-[50vh] space-y-2 overflow-y-auto"><legend class="label">Unidade de operação *</legend>';
      foreach ($u['cds'] as $i => $cd) {
          $marcado = $u['cd'] ? $u['cd']['id'] === $cd['id'] : $i === 0;
          $papel = $cd['tipo'] === 'CROSS' ? 'Ponto de Cross' : ($cd['hub'] ? 'CD Hub · Nível Brasil' : 'CD');
          $lista .= '<label class="poco flex cursor-pointer items-center gap-3 px-4 py-3 text-[13px] has-[:checked]:ring-1 has-[:checked]:ring-lima">'
              . '<input type="radio" name="cdId" value="' . e($cd['id']) . '" required' . ($marcado ? ' checked' : '') . '>'
              . '<span class="min-w-0"><span class="num font-semibold text-t1">' . e($cd['codigo']) . '</span> <span class="text-t2">· ' . e($cd['nome']) . '</span>'
              . '<span class="block text-[11px] text-t4">' . $papel . '</span></span></label>';
      }
      $lista .= '</fieldset>';
      echo formAcao('auth/selecionar-cd', $lista, ['botao' => 'Operar nesta unidade', 'classeBotao' => 'btn-primary w-full', 'limpar' => false]);
    endif ?>

    <div class="mt-5 flex items-center justify-between">
      <?= $u['cd'] ? '<a href="/" class="btn-secondary btn-sm">Voltar para ' . e($u['cd']['codigo']) . '</a>' : '<span></span>' ?>
      <div class="w-32"><button type="button" data-sair class="btn-secondary w-full" data-testid="botao-sair"><?= icone('log-out') ?> Sair</button></div>
    </div>
  </div>
</main>
