<?php
declare(strict_types=1);
/**
 * Gestão de ocorrências (src/app/(sistema)/ocorrencias/page.tsx). Cada ocorrência começa
 * pendente na unidade remetente, que aceita ou recusa com justificativa; o ciclo segue até um aceite.
 */
$u = requireCD();
View::$titulo = 'Ocorrências';
$FILTROS = ['acao' => 'Aguardando minha ação', 'pendentes' => 'Pendentes', 'encerradas' => 'Encerradas', 'todas' => 'Todas'];
$ICONE_ACAO = ['ABERTURA' => 'file-plus-2', 'RECUSA' => 'circle-x', 'ACEITE' => 'circle-check'];
$ROTULO_ACAO = ['ABERTURA' => 'Abriu a ocorrência', 'RECUSA' => 'Recusou', 'ACEITE' => 'Aceitou'];

$ids = unidadesDoEscopo($u);
$escopoW = "v.`tipo` = 'OCORRENCIA'" . ($ids !== null ? ' AND (v.`cdId` IN (' . Db::in($ids) . ') OR v.`unidadeId` IN (' . Db::in($ids) . '))' : '');
$escopoP = $ids !== null ? [...$ids, ...$ids] : [];
[$aguardW, $aguardP] = filtroAguardandoUsuario($u);
$nAcao = (int) Db::val("SELECT COUNT(*) FROM `ValePallet` v WHERE $aguardW", $aguardP);
$f = q('f');
$filtro = $f && isset($FILTROS[$f]) ? $f : ($nAcao > 0 ? 'acao' : 'pendentes');
[$w, $p] = match ($filtro) {
    'acao' => [$aguardW, $aguardP],
    'pendentes' => ["$escopoW AND v.`status` = 'PENDENTE'", $escopoP],
    'encerradas' => ["$escopoW AND v.`status` = 'FINALIZADO'", $escopoP],
    default => [$escopoW, $escopoP],
};
$vales = Db::all(
    "SELECT v.*, o.`codigo` AS cdCodigo, d.`codigo` AS unidadeCodigo, a.`codigo` AS aguardandoCodigo, rp.`nome` AS resolvidoPorNome
       FROM `ValePallet` v JOIN `CentroDistribuicao` o ON o.`id` = v.`cdId` LEFT JOIN `CentroDistribuicao` d ON d.`id` = v.`unidadeId`
       LEFT JOIN `CentroDistribuicao` a ON a.`id` = v.`aguardandoId` LEFT JOIN `Usuario` rp ON rp.`id` = v.`resolvidoPorId`
      WHERE $w ORDER BY FIELD(v.`status`, 'PENDENTE', 'AGENDADO', 'FINALIZADO', 'CANCELADO'), v.`criadoEm` DESC LIMIT 150",
    $p,
);
$agg = fn(string $extra) => Db::one("SELECT COALESCE(SUM(v.`quantidade`),0) AS q, COUNT(*) AS n FROM `ValePallet` v WHERE $escopoW $extra", $escopoP);
$pendentes = $agg("AND v.`status` = 'PENDENTE'");
$faltas = $agg("AND v.`ocorrencia` = 'FALTA'");
$sobras = $agg("AND v.`ocorrencia` = 'SOBRA'");
$minhas = array_column($u['cds'], 'id');
$podeResponder = fn(?string $aguardandoId) => $aguardandoId && ($u['global'] || in_array($aguardandoId, $minhas, true));

echo cabecalho('Ocorrências (Divergências)', 'Toda diferença entre o enviado e o recebido gera uma ocorrência pendente na unidade remetente. Ela aceita (a conta corrente é ajustada em definitivo) ou recusa com justificativa (a pendência volta para a unidade recebedora). O ciclo se repete até uma das unidades aceitar.');
echo bannerOk(q('ok'));
echo '<div class="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">'
    . indicador('Aguardando sua ação', n($nAcao), 'ocorrência(s) para aceitar ou recusar', '', $nAcao ? 'erro' : 'lima')
    . indicador('Pendentes', n($pendentes['q']), "{$pendentes['n']} ocorrência(s) em aberto", '', 'ouro')
    . indicador('Faltas (total)', n($faltas['q']), "{$faltas['n']} ocorrência(s)", '', 'neutro')
    . indicador('Sobras (total)', n($sobras['q']), "{$sobras['n']} ocorrência(s)", '', 'neutro') . '</div>';
echo abas(array_map(fn($k) => ['href' => "/ocorrencias?f=$k", 'rotulo' => $k === 'acao' && $nAcao ? "{$FILTROS[$k]} ($nAcao)" : $FILTROS[$k]], array_keys($FILTROS)), "/ocorrencias?f=$filtro");

if (!$vales) {
    echo painel(vazio($filtro === 'acao' ? 'Nenhuma ocorrência aguardando a sua ação.' : 'Nenhuma ocorrência encontrada.'));
} else {
    echo '<div class="grid gap-4 xl:grid-cols-2" data-testid="lista-ocorrencias">';
    foreach ($vales as $v) {
        $codigo = numeroVale($v['numero'], 'OCORRENCIA');
        $pendente = $v['status'] === 'PENDENTE';
        $daVezRemetente = $v['aguardandoId'] === $v['cdId'];
        $c = $v['conferenciaOrigemId'] ? Db::one('SELECT `numero`, `totalDeclarado`, `recebidoBons`, `recebidoQuebrados` FROM `Conferencia` WHERE `id` = ?', [$v['conferenciaOrigemId']]) : null;
        $interacoes = Db::all('SELECT i.*, c.`codigo`, x.`nome` FROM `OcorrenciaInteracao` i JOIN `CentroDistribuicao` c ON c.`id` = i.`unidadeId` JOIN `Usuario` x ON x.`id` = i.`usuarioId` WHERE i.`valeId` = ? ORDER BY i.`criadoEm` ASC', [$v['id']]);
        $pode = $podeResponder($v['aguardandoId']);
        echo '<section class="' . cx('card flex min-w-0 flex-col gap-4 p-5', $pendente && $pode ? 'ring-1 ring-erro/50' : '') . '" data-testid="ocorrencia-' . $codigo . '">'
            . '<header class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2">'
            . '<a href="/vales/' . e($v['id']) . '" class="num text-[15px] font-semibold text-lima hover:underline">' . $codigo . '</a>'
            . ($v['ocorrencia'] === 'FALTA' ? '<span class="pill text-erro bg-erro/10">Falta</span>' : '<span class="pill text-t2 bg-t2/10">Sobra</span>')
            . ($v['recusas'] > 0 ? '<span class="pill text-ouro bg-ouro/10">' . $v['recusas'] . ' recusa(s)</span>' : '') . '</div>'
            . '<p class="num mt-1 flex items-center gap-1.5 text-[12px] text-t2">' . e($v['cdCodigo']) . ' ' . icone('arrow-right', 'h-3 w-3 text-t4', ['aria-label' => 'para']) . ' ' . e($v['unidadeCodigo'])
            . '<span class="text-t4">· ' . formatarDataHora($v['criadoEm']) . '</span></p></div>'
            . '<div class="sm:text-right"><p class="num text-[24px] font-semibold leading-none text-t1">' . n($v['quantidade']) . '</p><p class="text-[11px] text-t4">' . n($v['quantidadeBons']) . ' PBR · ' . n($v['quantidadeQuebrados']) . ' quebrados</p></div></header>';
        if ($c) {
            $vs = Db::col('SELECT `numero` FROM `ValePallet` WHERE `conferenciaId` = ? ORDER BY `numero`', [$v['conferenciaOrigemId']]);
            echo '<p class="poco px-4 py-2.5 text-[11px] text-t3">Conferência <span class="num font-semibold text-t1">' . numeroConferencia($c['numero']) . '</span> (' . implode(', ', array_map(fn($x) => numeroVale($x, 'ENVIO'), $vs)) . '): enviado '
                . '<span class="num text-t1">' . n($c['totalDeclarado']) . '</span> × recebido <span class="num text-t1">' . n($c['recebidoBons'] + $c['recebidoQuebrados']) . '</span> (' . n($c['recebidoBons']) . ' PBR, ' . n($c['recebidoQuebrados']) . ' quebrados)</p>';
        }
        echo '<ol class="space-y-2 border-l border-[var(--groove)] pl-4" aria-label="Histórico">';
        foreach ($interacoes as $i) {
            $cor = $i['acao'] === 'RECUSA' ? 'text-erro' : ($i['acao'] === 'ACEITE' ? 'text-lima' : 'text-t3');
            echo '<li class="relative text-[12px]">' . icone($ICONE_ACAO[$i['acao']], "absolute -left-[23px] top-0.5 h-3.5 w-3.5 $cor")
                . '<p class="text-t2"><span class="num font-semibold text-t1">' . e($i['codigo']) . '</span> · ' . $ROTULO_ACAO[$i['acao']] . ' <span class="text-t4">· ' . e($i['nome']) . ' · ' . formatarDataHora($i['criadoEm']) . '</span></p>'
                . ($i['justificativa'] ? '<p class="mt-0.5 whitespace-pre-line text-t3">&ldquo;' . e($i['justificativa']) . '&rdquo;</p>' : '') . '</li>';
        }
        echo '</ol><footer class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--groove)] pt-3">';
        echo $pendente
            ? '<p class="text-[12px] text-ouro" data-testid="aguardando">Aguardando <strong class="num">' . e($v['aguardandoCodigo']) . '</strong> (' . ($daVezRemetente ? 'remetente' : 'recebedor') . ')</p>'
            : '<p class="text-[12px] text-lima">' . ($v['resolucao'] ? ROTULO_RESOLUCAO[$v['resolucao']] : 'Encerrada') . ' · ' . formatarDataHora($v['resolvidoEm']) . ($v['resolvidoPorNome'] ? ' · ' . e($v['resolvidoPorNome']) : '') . '</p>';
        echo '<a href="/imprimir/vale/' . e($v['id']) . '" class="inline-flex items-center gap-1 text-[11px] text-t3 hover:text-t1">' . icone('printer', 'h-3.5 w-3.5') . ' Vale</a>';
        if ($pendente && $pode && $v['unidadeId']) {
            $efeito = efeitoDoAceite($v['ocorrencia'], (int) $v['quantidade'], $v['cdCodigo'], $v['unidadeCodigo'], $daVezRemetente);
            echo '<div class="w-full"><div class="space-y-3" data-testid="resposta-' . $codigo . '" data-resposta="' . e(json_encode(['valeId' => $v['id'], 'codigo' => $codigo, 'efeito' => $efeito, 'outra' => $daVezRemetente ? $v['unidadeCodigo'] : $v['cdCodigo'], 'aba' => $filtro], JSON_UNESCAPED_UNICODE)) . '">'
                . '<div class="flex flex-wrap gap-2"><button type="button" class="btn-success btn-sm" data-responder="ACEITAR">' . icone('circle-check') . ' Aceitar</button>'
                . '<button type="button" class="btn-danger btn-sm" data-responder="RECUSAR">' . icone('circle-x') . ' Recusar</button></div><div data-mensagem hidden></div></div></div>';
        }
        echo '</footer></section>';
    }
    echo '</div>';
}
View::$scripts[] = 'telas.js';
