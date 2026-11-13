<?php
declare(strict_types=1);
// Versão dos dados (src/app/api/tv/versao/route.ts): a TV e o Painel recarregam quando ela muda.
if (!usuarioAtual()) json(['erro' => 'Não autenticado'], 401);
json(['versao' => versaoTV()]);
