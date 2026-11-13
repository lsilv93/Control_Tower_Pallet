<?php
declare(strict_types=1);
// Renderização das páginas: o arquivo da página imprime o conteúdo e define título/layout.

final class View
{
    /** Título da aba ("%s · Control Tower Pallet"). */
    public static string $titulo = '';
    /** sistema (menu lateral), vazio (só <html>/<body>) ou cru (sem invólucro: impressão, SVG...). */
    public static string $layout = 'sistema';
    /** Scripts extras (caminhos em /assets) carregados no fim da página. */
    public static array $scripts = [];

    /** Executa o arquivo da página e devolve o HTML completo. */
    public static function pagina(string $arquivo, array $vars = []): string
    {
        self::$titulo = '';
        self::$layout = 'sistema';
        $conteudo = self::capturar(__DIR__ . "/../Views/paginas/$arquivo.php", $vars);
        return match (self::$layout) {
            'cru' => $conteudo,
            'vazio' => self::documento($conteudo),
            default => self::documento(self::capturar(__DIR__ . '/../Views/layout_sistema.php', ['conteudo' => $conteudo])),
        };
    }

    public static function capturar(string $arquivo, array $vars = []): string
    {
        extract($vars, EXTR_SKIP);
        ob_start();
        try {
            require $arquivo;
            return (string) ob_get_clean();
        } catch (Throwable $e) {
            ob_end_clean();
            throw $e;
        }
    }

    /** Documento HTML: tema (cookie), título, CSS e JavaScript da aplicação. */
    public static function documento(string $corpo): string
    {
        $tema = temaAtual();
        $titulo = self::$titulo ? e(self::$titulo) . ' · Control Tower Pallet' : 'Control Tower Pallet';
        $v = ASSET_VERSAO;
        $scripts = '';
        foreach (self::$scripts as $s) $scripts .= '<script src="/assets/' . e($s) . "?v=$v\" defer></script>";
        return "<!DOCTYPE html>\n<html lang=\"pt-BR\" data-theme=\"$tema\"><head><meta charset=\"utf-8\">"
            . '<meta name="viewport" content="width=device-width, initial-scale=1">'
            . "<title>$titulo</title><meta name=\"description\" content=\"Sistema de Gestão de Pallets PBR\">"
            . '<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">'
            . "<link rel=\"stylesheet\" href=\"/assets/app.css?v=$v\">"
            . "<script src=\"/assets/app.js?v=$v\" defer></script>$scripts</head><body>$corpo</body></html>";
    }
}

function temaAtual(): string
{
    return ($_COOKIE['ctp_tema'] ?? '') === 'light' ? 'light' : 'dark';
}

/** Caminho da requisição atual (sem query string). */
function caminhoAtual(): string
{
    $p = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    return $p !== '/' ? rtrim($p, '/') : '/';
}
