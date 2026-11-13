<?php
declare(strict_types=1);
// Download (ou visualização, com ?inline=1) do PDF do Vale-Pallet (src/app/api/vales/[id]/pdf/route.ts).
require_once dirname(__DIR__) . '/Lib/pdf.php';
$usuario = usuarioAtual();
if (!$usuario) json(['erro' => 'Não autenticado'], 401);
if (!array_filter(['vales', 'fornecedor', 'excluir_vale', 'envio', 'recebimento'], fn($p) => tem($usuario, $p))) json(['erro' => 'Sem permissão'], 403);
try {
    $pdf = gerarPdfVale($m['id'], fn($v) => podeVerVale($usuario, $v));
    if (!$pdf) json(['erro' => 'Vale não encontrado'], 404);
    $inline = ($_GET['inline'] ?? '') === '1';
    header('Content-Type: application/pdf');
    header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . $pdf['nome'] . '"');
    header('Cache-Control: no-store');
    echo $pdf['arquivo'];
} catch (Throwable $e) {
    error_log((string) $e);
    json(['erro' => 'Falha ao gerar o PDF do vale.'], 500);
}
