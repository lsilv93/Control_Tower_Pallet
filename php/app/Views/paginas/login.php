<?php
declare(strict_types=1);
// Tela de login (src/app/login/page.tsx).
if (usuarioAtual()) redirecionar('/');
View::$titulo = 'Entrar';
View::$layout = 'vazio';
$tema = temaAtual();
$rotTema = $tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
?>
<main class="relative flex min-h-screen items-center justify-center p-[14px]">
  <div class="absolute right-[14px] top-[14px]">
    <button type="button" data-tema class="btn-icone" aria-label="<?= $rotTema ?>" title="<?= $rotTema ?>"><?= icone($tema === 'dark' ? 'sun' : 'moon', 'h-5 w-5') ?></button>
  </div>
  <div class="card entrada w-full max-w-sm p-7 sm:p-8">
    <div class="mb-7 flex flex-col items-center text-center">
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl fill-lima"><?= icone('boxes', 'h-7 w-7') ?></div>
      <h1 class="text-[20px] font-semibold text-t1">Control Tower Pallet</h1>
      <p class="secao mt-1.5">Gestão de Pallets PBR</p>
    </div>
    <?= formAcao('auth/entrar', '
      <div>
        <label class="label" for="login">Login</label>
        <input id="login" name="login" class="input" autocomplete="username" required autofocus>
      </div>
      <div>
        <label class="label" for="senha">Senha</label>
        <input id="senha" name="senha" type="password" class="input" autocomplete="current-password" required>
      </div>', ['botao' => 'Entrar', 'classeBotao' => 'btn-primary w-full', 'limpar' => false, 'textoEnviando' => 'Entrando...']) ?>
  </div>
</main>
