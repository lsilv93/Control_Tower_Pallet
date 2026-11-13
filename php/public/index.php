<?php
declare(strict_types=1);
/**
 * Front controller: toda requisição passa por aqui (exceto arquivos de /assets).
 * Páginas (GET), APIs e ações de formulário (POST /acao/{grupo}/{nome}).
 */

$caminhoBruto = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
// Servidor embutido do PHP (desenvolvimento): entrega os arquivos estáticos diretamente.
if (PHP_SAPI === 'cli-server' && $caminhoBruto !== '/' && is_file(__DIR__ . $caminhoBruto)) return false;

require dirname(__DIR__) . '/app/bootstrap.php';

$rotas = require dirname(__DIR__) . '/app/rotas.php';
$caminho = caminhoAtual();

function enviar(string $corpo, int $status = 200, array $cabecalhos = []): void
{
    http_response_code($status);
    foreach ($cabecalhos as $k => $v) header("$k: $v");
    echo $corpo;
}

function paginaErro(string $titulo, string $texto, int $status): void
{
    View::$titulo = $titulo;
    View::$layout = 'vazio';
    $html = '<main class="flex min-h-screen items-center justify-center p-[14px]"><section class="card w-full max-w-md p-7 text-center">'
        . '<h1 class="mb-2 text-[18px] font-semibold text-t1">' . e($titulo) . '</h1><p class="mb-6 text-[12px] text-t3">' . e($texto) . '</p>'
        . '<a href="/" class="btn-secondary">Voltar ao início</a></section></main>';
    enviar(View::documento($html), $status, ['Content-Type' => 'text/html; charset=utf-8']);
}

// Páginas autenticadas não ficam em cache: após Sair, o botão Voltar não mostra dados.
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: SAMEORIGIN');

try {
    // Toda rota exige sessão (token assinado e válido), exceto o login.
    $publica = in_array($caminho, $rotas['publicas'], true);
    if (!$publica && !verificarSessao($_COOKIE[SESSION_COOKIE] ?? null)) {
        if (str_starts_with($caminho, '/api/')) json(['erro' => 'Não autenticado'], 401);
        redirecionar('/login');
    }

    // Ações (POST /acao/{grupo}/{nome}).
    if (preg_match('#^/acao/([a-z]+)/([a-z-]+)$#', $caminho, $m)) {
        if (metodo() !== 'POST') throw new NaoEncontrado();
        [, $grupo, $nome] = $m;
        if (!in_array($nome, $rotas['acoes'][$grupo] ?? [], true)) throw new NaoEncontrado();
        verificarOrigem();
        foreach (glob(dirname(__DIR__) . '/app/Actions/[a-z]*.php') as $arq) require_once $arq;
        $funcao = 'acao_' . $grupo . '_' . str_replace('-', '_', $nome);
        $estado = executarAcao($funcao);
        if (pedidoJs()) json($estado);
        // Sem JavaScript: volta para a página de origem.
        redirecionar($_SERVER['HTTP_REFERER'] ?? '/');
    }

    foreach ($rotas['apis'] as $padrao => $api) {
        if (preg_match($padrao, $caminho, $m)) {
            require dirname(__DIR__) . "/app/Api/$api.php";
            exit;
        }
    }

    foreach ($rotas['paginas'] as $padrao => $pagina) {
        if (preg_match($padrao, $caminho, $m)) {
            $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
            enviar(View::pagina($pagina, ['params' => $params]), 200, ['Content-Type' => 'text/html; charset=utf-8']);
            exit;
        }
    }
    throw new NaoEncontrado();
} catch (Redirecionar $r) {
    if (pedidoJs()) {
        enviar(json_encode(['redirecionar' => $r->url], JSON_UNESCAPED_SLASHES), 200, ['Content-Type' => 'application/json']);
    } else {
        enviar('', 303, ['Location' => $r->url]);
    }
} catch (Responder $r) {
    enviar($r->corpo, $r->status, $r->cabecalhos);
} catch (NaoEncontrado) {
    paginaErro('Página não encontrada', 'O endereço acessado não existe ou o registro não está disponível para o seu usuário.', 404);
} catch (Throwable $e) {
    error_log((string) $e);
    if (pedidoJs()) enviar(json_encode(['ok' => false, 'mensagem' => 'Erro inesperado ao processar a operação. Tente novamente.']), 500, ['Content-Type' => 'application/json']);
    else paginaErro('Erro no servidor', 'Ocorreu um erro inesperado. Tente novamente em instantes.', 500);
}

/**
 * Executa a ação e converte exceções conhecidas em mensagens amigáveis (tratarErro).
 * Redirecionamentos e respostas prontas seguem adiante.
 */
function executarAcao(string $funcao): array
{
    try {
        $r = $funcao();
        return is_array($r) ? $r : ['ok' => true, 'mensagem' => ''];
    } catch (ErroNegocio $e) {
        return falha($e->getMessage());
    } catch (Redirecionar | Responder $e) {
        throw $e;
    } catch (PDOException $e) {
        error_log((string) $e);
        return falha(mensagemErroBanco($e));
    }
}
