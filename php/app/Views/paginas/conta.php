<?php
declare(strict_types=1);
// Minha Senha (src/app/(sistema)/conta/page.tsx).
requireUsuario();
View::$titulo = 'Minha Senha';
echo cabecalho('Minha Senha', 'Altere a senha do seu usuário.');
echo painel(formAcao('auth/alterar-senha', '
  <div>
    <label class="label" for="atual">Senha atual</label>
    <input id="atual" name="atual" type="password" class="input" required autocomplete="current-password">
  </div>
  <div>
    <label class="label" for="nova">Nova senha</label>
    <input id="nova" name="nova" type="password" class="input" required minlength="6" autocomplete="new-password">
  </div>
  <div>
    <label class="label" for="confirmacao">Confirme a nova senha</label>
    <input id="confirmacao" name="confirmacao" type="password" class="input" required minlength="6" autocomplete="new-password">
  </div>', ['botao' => 'Alterar senha']), classe: 'max-w-md');
