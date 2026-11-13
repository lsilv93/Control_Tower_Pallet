<?php
declare(strict_types=1);
// Exporta a auditoria (mesmos filtros da tela) em Excel ou PDF (src/app/api/auditoria/exportar/route.ts).
require_once dirname(__DIR__) . '/Lib/pdf.php';
require_once dirname(__DIR__) . '/Lib/xlsx.php';
const MAXIMO_AUDITORIA = 20000;
$usuario = usuarioAtual();
if (!$usuario) json(['erro' => 'Não autenticado'], 401);
if (!tem($usuario, 'auditoria')) json(['erro' => 'Sem permissão'], 403);
$formato = ($_GET['formato'] ?? '') === 'pdf' ? 'pdf' : 'xlsx';
['filtros' => $filtros, 'where' => $where, 'params' => $params, 'descricao' => $descricao] = lerFiltrosAuditoria($_GET, ['cd' => $usuario['cd'], 'cds' => $usuario['cds'], 'admin' => $usuario['global']]);
if (!$filtros['cd']) json(['erro' => 'Selecione o CD de operação'], 409);

try {
    $registros = Db::all(
        "SELECT a.*, x.`login`, c.`codigo` AS cdCodigo FROM `Auditoria` a LEFT JOIN `Usuario` x ON x.`id` = a.`usuarioId` LEFT JOIN `CentroDistribuicao` c ON c.`id` = a.`cdId`
          WHERE $where ORDER BY a.`criadoEm` ASC LIMIT " . MAXIMO_AUDITORIA,
        $params,
    );
    $linhas = array_map(fn($r) => [
        'dataHora' => formatarDataHora($r['criadoEm']),
        'usuario' => $r['login'] ?? '',
        'cd' => $r['cdCodigo'] ?? '',
        'acao' => rotuloAcao($r['acao']),
        'origem' => $r['origem'] ? ROTULO_CONTA[$r['origem']] : '',
        'destino' => $r['destino'] ? ROTULO_CONTA[$r['destino']] : '',
        'quantidade' => $r['quantidade'] !== null ? (string) $r['quantidade'] : '',
        'observacao' => $r['observacao'] ?? ($r['detalhes'] ? json_encode(json_decode($r['detalhes']), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : ''),
    ], $registros);
    // A própria exportação também fica registrada (após a leitura, para não entrar no arquivo).
    auditar(['acao' => 'EXPORTAR_AUDITORIA', 'entidade' => 'Auditoria', 'usuarioId' => $usuario['id'], 'cdId' => $usuario['cd']['id'] ?? null,
        'detalhes' => $filtros + ['formato' => $formato, 'registros' => count($linhas)]]);
    $nome = "auditoria_{$filtros['de']}_a_{$filtros['ate']}";

    if ($formato === 'pdf') {
        $pdf = gerarPdfAuditoria($linhas, $descricao, $usuario['login']);
        header('Content-Type: application/pdf');
        header("Content-Disposition: attachment; filename=\"$nome.pdf\"");
        header('Cache-Control: no-store');
        echo $pdf;
        exit;
    }
    $wb = new Xlsx("Control Tower Pallet ({$usuario['login']})");
    $wb->aba('Auditoria', [
        ['header' => 'Data/Hora', 'key' => 'dataHora', 'width' => 20],
        ['header' => 'Usuário', 'key' => 'usuario', 'width' => 14],
        ['header' => 'CD da operação', 'key' => 'cd', 'width' => 14],
        ['header' => 'Tipo de ação', 'key' => 'acao', 'width' => 38],
        ['header' => 'Estoque origem', 'key' => 'origem', 'width' => 22],
        ['header' => 'Estoque destino', 'key' => 'destino', 'width' => 22],
        ['header' => 'Quantidade', 'key' => 'quantidade', 'width' => 12],
        ['header' => 'Observação / justificativa', 'key' => 'observacao', 'width' => 70],
    ], array_map(fn($l) => ['quantidade' => $l['quantidade'] !== '' ? (int) $l['quantidade'] : ''] + $l, $linhas), 'FF0A1B29');
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header("Content-Disposition: attachment; filename=\"$nome.xlsx\"");
    header('Cache-Control: no-store');
    echo $wb->gerar();
} catch (Throwable $e) {
    error_log((string) $e);
    json(['erro' => 'Falha ao exportar a auditoria.'], 500);
}
