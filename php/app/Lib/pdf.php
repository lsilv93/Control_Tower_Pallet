<?php
declare(strict_types=1);
/**
 * PDF do Vale-Pallet e relatório de auditoria (src/lib/pdf.ts). Gerador PDF próprio e sem
 * dependências (substitui o pdfkit): fontes padrão do PDF (Helvetica/Courier, WinAnsi) com as
 * mesmas métricas, coordenadas a partir do topo da página (como no pdfkit), código de barras
 * vetorial e conteúdo comprimido (FlateDecode).
 */

require_once __DIR__ . '/pdf_metricas.php';

final class Pdf
{
    /** Ascendente e altura de linha (por 1000) das fontes, como o pdfkit calcula pelos AFM. */
    private const FONTES = [
        'Helvetica' => ['F1', 718, 1156],
        'Helvetica-Bold' => ['F2', 718, 1190],
        'Courier' => ['F3', 629, 1000],
        'Courier-Bold' => ['F4', 629, 1000],
    ];

    public float $largura;
    public float $altura;
    /** @var string[] */
    private array $paginas = [];
    private int $atual = -1;
    private string $fonte = 'Helvetica';
    private float $tamanho = 12;
    private string $preenchimento = '0 0 0';
    private string $tracado = '0 0 0';
    private float $opacidade = 1;
    /** @var array<string,string> */
    private array $info;

    public function __construct(bool $paisagem = false, array $info = [])
    {
        [$this->largura, $this->altura] = $paisagem ? [841.89, 595.28] : [595.28, 841.89];
        $this->info = $info;
        $this->novaPagina();
    }

    public function novaPagina(): void
    {
        $this->paginas[] = '';
        $this->atual = count($this->paginas) - 1;
    }

    public function totalPaginas(): int
    {
        return count($this->paginas);
    }

    public function irParaPagina(int $i): void
    {
        $this->atual = $i;
    }

    private function op(string $s): void
    {
        $this->paginas[$this->atual] .= $s . "\n";
    }

    private static function f(float $n): string
    {
        $s = number_format($n, 3, '.', '');
        return rtrim(rtrim($s, '0'), '.') ?: '0';
    }

    private static function rgb(string $hex): string
    {
        $h = ltrim($hex, '#');
        return implode(' ', array_map(fn($i) => self::f(hexdec(substr($h, $i, 2)) / 255), [0, 2, 4]));
    }

    /** y do topo (como no pdfkit) → y do PDF (origem embaixo). */
    private function y(float $y): float
    {
        return $this->altura - $y;
    }

    public function corPreenchimento(string $hex): self
    {
        $this->preenchimento = self::rgb($hex);
        return $this;
    }

    public function corTraco(string $hex): self
    {
        $this->tracado = self::rgb($hex);
        return $this;
    }

    public function salvar(): void
    {
        $this->op('q');
    }

    public function restaurar(): void
    {
        $this->op('Q');
        $this->opacidade = 1;
    }

    /** Opacidade do preenchimento (marca d'água). Use entre salvar()/restaurar(). */
    public function opacidade(float $a): void
    {
        $this->opacidade = $a;
        $this->op('/GS1 gs');
    }

    /** Gira o sistema de coordenadas em torno de (x, y), em graus (sentido do pdfkit). */
    public function girar(float $graus, float $x, float $y): void
    {
        $r = deg2rad(-$graus);
        $c = cos($r);
        $s = sin($r);
        $py = $this->y($y);
        $this->op(sprintf('1 0 0 1 %s %s cm %s %s %s %s 0 0 cm 1 0 0 1 %s %s cm', self::f($x), self::f($py), self::f($c), self::f($s), self::f(-$s), self::f($c), self::f(-$x), self::f(-$py)));
    }

    public function retangulo(float $x, float $y, float $w, float $h, string $modo = 'S', float $espessura = 1): void
    {
        $cor = $modo === 'f' ? $this->preenchimento . ' rg' : $this->tracado . ' RG ' . self::f($espessura) . ' w';
        $this->op(sprintf('%s %s %s %s %s re %s', $cor, self::f($x), self::f($this->y($y + $h)), self::f($w), self::f($h), $modo));
    }

    public function retanguloArredondado(float $x, float $y, float $w, float $h, float $r): void
    {
        $k = 0.5523 * $r;
        $Y = fn($v) => self::f($this->y($v));
        $F = fn($v) => self::f($v);
        $p = $this->preenchimento . ' rg ' . $F($x + $r) . ' ' . $Y($y) . ' m '
            . $F($x + $w - $r) . ' ' . $Y($y) . ' l ' . $F($x + $w - $r + $k) . ' ' . $Y($y) . ' ' . $F($x + $w) . ' ' . $Y($y + $r - $k) . ' ' . $F($x + $w) . ' ' . $Y($y + $r) . ' c '
            . $F($x + $w) . ' ' . $Y($y + $h - $r) . ' l ' . $F($x + $w) . ' ' . $Y($y + $h - $r + $k) . ' ' . $F($x + $w - $r + $k) . ' ' . $Y($y + $h) . ' ' . $F($x + $w - $r) . ' ' . $Y($y + $h) . ' c '
            . $F($x + $r) . ' ' . $Y($y + $h) . ' l ' . $F($x + $r - $k) . ' ' . $Y($y + $h) . ' ' . $F($x) . ' ' . $Y($y + $h - $r + $k) . ' ' . $F($x) . ' ' . $Y($y + $h - $r) . ' c '
            . $F($x) . ' ' . $Y($y + $r) . ' l ' . $F($x) . ' ' . $Y($y + $r - $k) . ' ' . $F($x + $r - $k) . ' ' . $Y($y) . ' ' . $F($x + $r) . ' ' . $Y($y) . ' c f';
        $this->op($p);
    }

    public function linha(float $x1, float $y1, float $x2, float $y2, float $espessura = 1, ?array $tracejado = null): void
    {
        $d = $tracejado ? '[' . implode(' ', array_map([self::class, 'f'], $tracejado)) . '] 0 d ' : '';
        $this->op(sprintf('q %s%s RG %s w %s %s m %s %s l S Q', $d, $this->tracado, self::f($espessura), self::f($x1), self::f($this->y($y1)), self::f($x2), self::f($this->y($y2))));
    }

    public function fonte(string $nome, float $tamanho): self
    {
        $this->fonte = $nome;
        $this->tamanho = $tamanho;
        return $this;
    }

    private static function winAnsi(string $s): string
    {
        $r = @iconv('UTF-8', 'Windows-1252//TRANSLIT', $s);
        return $r === false ? preg_replace('/[^\x20-\x7E]/', '?', $s) : $r;
    }

    /** Largura do texto na fonte/tamanho atuais (com espaçamento entre caracteres). */
    public function larguraTexto(string $texto, float $espacamento = 0): float
    {
        $b = self::winAnsi($texto);
        $m = PDF_METRICAS[$this->fonte];
        $w = 0;
        for ($i = 0, $n = strlen($b); $i < $n; $i++) {
            $c = ord($b[$i]);
            $w += $c >= 32 ? $m[$c - 32] : 0;
        }
        return $w / 1000 * $this->tamanho + $espacamento * max(0, strlen($b) - 1);
    }

    public function alturaLinha(): float
    {
        return self::FONTES[$this->fonte][2] / 1000 * $this->tamanho;
    }

    /** Quebra o texto em linhas que caibam na largura (palavra a palavra, como o pdfkit). */
    public function quebrar(string $texto, float $largura): array
    {
        $linhas = [];
        foreach (preg_split('/\r?\n/', $texto) as $par) {
            $atual = '';
            foreach (preg_split('/(?<=\s)/u', $par) as $palavra) {
                if ($palavra === '') continue;
                $teste = $atual . $palavra;
                if ($atual !== '' && $this->larguraTexto(rtrim($teste)) > $largura) {
                    $linhas[] = rtrim($atual);
                    $atual = $palavra;
                } else {
                    $atual = $teste;
                }
            }
            $linhas[] = rtrim($atual);
        }
        return $linhas;
    }

    public function alturaTexto(string $texto, float $largura): float
    {
        return count($this->quebrar($texto, $largura)) * $this->alturaLinha();
    }

    /**
     * Escreve texto com o topo em y (como o pdfkit). Opções: largura, alinhar (left|center|right),
     * espacamento (characterSpacing), quebrar (true: quebra linhas na largura). Devolve a altura usada.
     */
    public function texto(string $texto, float $x, float $y, array $o = []): float
    {
        [$ref, $asc] = self::FONTES[$this->fonte];
        $largura = $o['largura'] ?? null;
        $esp = $o['espacamento'] ?? 0;
        $linhas = ($o['quebrar'] ?? false) && $largura ? $this->quebrar($texto, $largura) : [$texto];
        $yy = $y;
        foreach ($linhas as $l) {
            $dx = 0;
            if ($largura && ($o['alinhar'] ?? 'left') !== 'left') {
                $w = $this->larguraTexto($l, $esp);
                $dx = ($o['alinhar'] === 'center') ? ($largura - $w) / 2 : $largura - $w;
            }
            $b = str_replace(['\\', '(', ')', "\r"], ['\\\\', '\\(', '\\)', ''], self::winAnsi($l));
            $this->op(sprintf('BT %s rg /%s %s Tf %s Tc %s %s Td (%s) Tj ET', $this->preenchimento, $ref, self::f($this->tamanho), self::f($esp), self::f($x + $dx), self::f($this->y($yy + $asc / 1000 * $this->tamanho)), $b));
            $yy += $this->alturaLinha();
        }
        return $yy - $y;
    }

    /** Código de barras Code 128 vetorial (com zona de silêncio branca), em largura x altura. */
    public function codigoBarras(string $texto, float $x, float $y, float $w, float $h): void
    {
        $mod = codigo128Modulos($texto);
        $pad = 12;
        $total = array_sum(array_column($mod, 1)) + 2 * $pad;
        $u = $w / $total;
        $padV = $h * 0.06;
        $cor = $this->preenchimento;
        $this->corPreenchimento('#FFFFFF')->retangulo($x, $y, $w, $h, 'f');
        $this->corPreenchimento('#000000');
        $p = $x + $pad * $u;
        foreach ($mod as [$barra, $m]) {
            if ($barra) $this->retangulo($p, $y + $padV, $m * $u, $h - 2 * $padV, 'f');
            $p += $m * $u;
        }
        $this->preenchimento = $cor;
    }

    /** Documento PDF final. */
    public function gerar(): string
    {
        $objs = [];
        $fontes = '';
        $n = 3; // 1: catálogo, 2: páginas
        foreach (self::FONTES as $nome => [$ref]) {
            $objs[$n] = "<< /Type /Font /Subtype /Type1 /BaseFont /$nome /Encoding /WinAnsiEncoding >>";
            $fontes .= "/$ref $n 0 R ";
            $n++;
        }
        $gs = $n++;
        $objs[$gs] = '<< /Type /ExtGState /ca 0.18 /CA 0.18 >>';
        $kids = [];
        foreach ($this->paginas as $conteudo) {
            $z = gzcompress($conteudo, 6);
            $c = $n++;
            $objs[$c] = '<< /Length ' . strlen($z) . " /Filter /FlateDecode >>\nstream\n$z\nendstream";
            $p = $n++;
            $objs[$p] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' . self::f($this->largura) . ' ' . self::f($this->altura) . "] /Resources << /Font << $fontes>> /ExtGState << /GS1 $gs 0 R >> >> /Contents $c 0 R >>";
            $kids[] = "$p 0 R";
        }
        $objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $objs[2] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . count($kids) . ' >>';
        $infoId = $n++;
        $hex = fn(string $s) => '<FEFF' . strtoupper(bin2hex(mb_convert_encoding($s, 'UTF-16BE', 'UTF-8'))) . '>';
        $objs[$infoId] = '<< /Producer ' . $hex('Control Tower Pallet') . ' /CreationDate (D:' . gmdate('YmdHis') . "Z)"
            . (isset($this->info['titulo']) ? ' /Title ' . $hex($this->info['titulo']) : '') . (isset($this->info['autor']) ? ' /Author ' . $hex($this->info['autor']) : '') . ' >>';
        ksort($objs);
        $saida = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];
        foreach ($objs as $id => $corpo) {
            $offsets[$id] = strlen($saida);
            $saida .= "$id 0 obj\n$corpo\nendobj\n";
        }
        $xref = strlen($saida);
        $saida .= 'xref' . "\n0 " . ($n) . "\n0000000000 65535 f \n";
        for ($i = 1; $i < $n; $i++) $saida .= sprintf("%010d 00000 n \n", $offsets[$i]);
        return $saida . "trailer\n<< /Size $n /Root 1 0 R /Info $infoId 0 R >>\nstartxref\n$xref\n%%EOF\n";
    }
}

const PDF_MM = 72 / 25.4;
const PDF_COR = ['tinta' => '#0A1B29', 'cinza' => '#5A6B7B', 'linha' => '#9AA9B6', 'lima' => '#A9E113'];

/** Logotipo vetorial (selo lima com pallet estilizado) + nome da empresa. */
function _pdfLogotipo(Pdf $d, float $x, float $y): void
{
    $d->corPreenchimento(PDF_COR['lima'])->retanguloArredondado($x, $y, 30, 30, 7);
    $d->corPreenchimento(PDF_COR['tinta']);
    foreach ([7, 13.5, 20] as $dy) $d->retangulo($x + 6, $y + $dy, 18, 3, 'f');
    foreach ([7, 13.5, 20] as $dx) $d->retangulo($x + $dx, $y + 7, 3, 16, 'f');
    $d->corPreenchimento(PDF_COR['tinta'])->fonte('Helvetica-Bold', 11)->texto(EMISSOR['nomeFantasia'], $x + 38, $y + 3);
    $d->fonte('Helvetica', 7.5)->corPreenchimento(PDF_COR['cinza'])->texto('Control Tower Pallet · Gestão de Pallets PBR', $x + 38, $y + 17);
}

/** Escreve numa linha só: reduz a fonte até caber (mínimo 6,5pt) e, se preciso, corta com reticências. */
function _pdfTextoAjustado(Pdf $d, string $texto, float $x, float $y, float $largura, float $tamanho, string $fonte = 'Helvetica-Bold'): void
{
    $t = $tamanho;
    while ($t > 6.5 && $d->fonte($fonte, $t)->larguraTexto($texto) > $largura) $t -= 0.25;
    $d->fonte($fonte, $t);
    $final = $texto;
    if ($d->larguraTexto($final) > $largura) {
        while (mb_strlen($final) > 1 && $d->larguraTexto($final . '…') > $largura) $final = mb_substr($final, 0, -1);
        $final .= '…';
    }
    $d->texto($final, $x, $y);
}

function _pdfVia(Pdf $d, array $vale, array $doc, float $topo, string $nomeVia): void
{
    $C = PDF_COR;
    $x0 = 14 * PDF_MM;
    $largura = $d->largura - 28 * PDF_MM;
    $y = $topo + 8 * PDF_MM;

    // Identificação da via
    $d->corTraco($C['tinta'])->retangulo($x0, $y, $largura, 16, 'S', 1.2);
    $d->fonte('Helvetica-Bold', 9)->corPreenchimento($C['tinta'])->texto(mb_strtoupper($nomeVia), $x0, $y + 4.5, ['largura' => $largura, 'alinhar' => 'center', 'espacamento' => 2.5]);
    $y += 24;

    // Cabeçalho: logotipo + emissor | código de barras + número
    _pdfLogotipo($d, $x0, $y);
    $d->fonte('Helvetica-Bold', 7)->corPreenchimento($C['cinza'])->texto(mb_strtoupper($doc['emitente']['rotulo']), $x0, $y + 36);
    $larguraEmissor = $largura - 180;
    $d->corPreenchimento($C['tinta']);
    _pdfTextoAjustado($d, "{$doc['emitente']['razaoSocial']} · CNPJ {$doc['emitente']['cnpj']}", $x0, $y + 45, $larguraEmissor, 7.5, 'Helvetica-Bold');
    _pdfTextoAjustado($d, $doc['emitente']['endereco'], $x0, $y + 55, $larguraEmissor, 7, 'Helvetica');

    $xd = $x0 + $largura - 175;
    $d->corPreenchimento($C['tinta']);
    _pdfTextoAjustado($d, $doc['titulo'], $xd, $y, 175, 15);
    $d->codigoBarras($doc['codigo'], $xd + 20, $y + 20, 155, 30);
    $d->corPreenchimento($C['tinta'])->fonte('Courier-Bold', 12)->texto($doc['codigo'], $xd, $y + 53, ['largura' => 175, 'alinhar' => 'right', 'espacamento' => 2]);
    $y += 70;
    $d->corTraco($C['tinta'])->linha($x0, $y, $x0 + $largura, $y, 1.5);
    $y += 8;

    // Grade de dados
    $c = $largura / 4;
    foreach ($doc['linhas'] as $linha) {
        $x = $x0;
        foreach ($linha as $cel) {
            $w = $c * $cel['colunas'];
            $d->corTraco($C['linha'])->retangulo($x, $y, $w, 26, 'S', 0.6);
            $d->fonte('Helvetica-Bold', 6.5)->corPreenchimento($C['cinza'])->texto(mb_strtoupper($cel['rotulo']), $x + 5, $y + 4);
            $d->corPreenchimento($C['tinta']);
            _pdfTextoAjustado($d, (string) $cel['valor'], $x + 5, $y + 13, $w - 10, 9.5);
            $x += $w;
        }
        $y += 26;
    }
    $y += 6;

    // Quantidade e tipo
    $d->corTraco($C['tinta'])->retangulo($x0, $y, $largura, 30, 'S', 1.5);
    $d->fonte('Helvetica-Bold', 9)->corPreenchimento($C['tinta'])->texto(mb_strtoupper($doc['rotuloQuantidade']), $x0 + 10, $y + 6);
    $d->fonte('Helvetica', 8)->corPreenchimento($C['cinza'])->texto('Pallet PBR (padrão 1,00 x 1,20 m)', $x0 + 10, $y + 17);
    $d->fonte('Helvetica-Bold', 20)->corPreenchimento($C['tinta'])->texto(n((int) $vale['quantidade']), $x0, $y + 6, ['largura' => $largura - 12, 'alinhar' => 'right']);
    $y += 38;

    // Destaque: recebimento sem nota fiscal ou ocorrência de divergência física
    if (!empty($doc['destaque'])) {
        $d->corTraco($C['tinta'])->retangulo($x0, $y, $largura, 24, 'S', 2);
        $d->corPreenchimento($C['tinta']);
        _pdfTextoAjustado($d, $doc['destaque']['titulo'], $x0 + 8, $y + 4.5, $largura - 16, 8.5);
        _pdfTextoAjustado($d, $doc['destaque']['texto'], $x0 + 8, $y + 14, $largura - 16, 7, 'Helvetica');
        $y += 30;
    }
    if (!empty($vale['observacao'])) {
        $d->corPreenchimento($C['tinta']);
        _pdfTextoAjustado($d, "Observações: {$vale['observacao']}", $x0, $y, $largura, 7.5, 'Helvetica');
        $y += 12;
    }
    $d->fonte('Helvetica', 6.8)->corPreenchimento($C['cinza'])->texto($doc['declaracao'], $x0, $y, ['largura' => $largura, 'quebrar' => true]);

    // Assinaturas
    $ya = $topo + $d->altura / 2 - 18 * PDF_MM;
    $wa = ($largura - 40) / 2;
    $d->corTraco($C['tinta']);
    $d->linha($x0, $ya, $x0 + $wa, $ya, 0.8);
    $d->linha($x0 + $wa + 40, $ya, $x0 + $largura, $ya, 0.8);
    if (!empty($doc['nomeAssinatura'])) {
        $d->fonte('Helvetica-Bold', 8)->corPreenchimento($C['tinta'])->texto($doc['nomeAssinatura'], $x0, $ya - 12, ['largura' => $wa, 'alinhar' => 'center']);
    }
    $d->fonte('Helvetica', 7.5)->corPreenchimento($C['tinta']);
    $d->texto($doc['assinaturas'][0], $x0, $ya + 4, ['largura' => $wa, 'alinhar' => 'center', 'quebrar' => true]);
    $d->texto($doc['assinaturas'][1], $x0 + $wa + 40, $ya + 4, ['largura' => $wa, 'alinhar' => 'center', 'quebrar' => true]);

    if ($vale['status'] === 'CANCELADO') {
        $d->salvar();
        $d->girar(-18, $d->largura / 2, $topo + $d->altura / 4);
        $d->opacidade(0.18);
        $d->fonte('Helvetica-Bold', 54)->corPreenchimento('#C62828')->texto('CANCELADO', 0, $topo + $d->altura / 4 - 30, ['largura' => $d->largura, 'alinhar' => 'center']);
        $d->restaurar();
    }
}

/** PDF do vale (qualquer tipo): A4 com duas vias e linha de recorte. null se não existir/sem acesso. */
function gerarPdfVale(string $id, callable $pode): ?array
{
    $vale = carregarValeDoc($id);
    if (!$vale || !$pode($vale)) return null;
    $doc = documentoVale($vale);
    $d = new Pdf(false, ['titulo' => "{$doc['titulo']} {$doc['codigo']}", 'autor' => EMISSOR['nomeFantasia']]);
    _pdfVia($d, $vale, $doc, 0, $doc['vias'][0]);
    // linha de recorte
    $d->corTraco(PDF_COR['linha'])->linha(0, $d->altura / 2, $d->largura, $d->altura / 2, 0.6, [4, 4]);
    $d->fonte('Helvetica', 6.5)->corPreenchimento(PDF_COR['cinza'])->texto('recorte aqui', 0, $d->altura / 2 - 3.5, ['largura' => $d->largura, 'alinhar' => 'center']);
    _pdfVia($d, $vale, $doc, $d->altura / 2, $doc['vias'][1]);
    return ['arquivo' => $d->gerar(), 'nome' => "{$doc['codigo']}.pdf"];
}

/** Relatório de auditoria em PDF (A4 paisagem, cabeçalho repetido por página, rodapé paginado). */
function gerarPdfAuditoria(array $linhas, string $filtros, string $geradoPor): string
{
    $C = PDF_COR;
    $d = new Pdf(true, ['titulo' => 'Relatório de Auditoria']);
    $W = $d->largura - 56;
    $colunas = [
        ['dataHora', 'Data/Hora', 0.12, 'left'], ['usuario', 'Usuário', 0.08, 'left'], ['cd', 'CD', 0.06, 'left'], ['acao', 'Tipo de ação', 0.17, 'left'],
        ['origem', 'Origem', 0.11, 'left'], ['destino', 'Destino', 0.11, 'left'], ['quantidade', 'Qtd.', 0.05, 'right'], ['observacao', 'Observação / justificativa', 0.30, 'left'],
    ];
    $cabecalho = function () use ($d, $C, $W, $colunas, $filtros): float {
        _pdfLogotipo($d, 28, 24);
        $d->fonte('Helvetica-Bold', 14)->corPreenchimento($C['tinta'])->texto('Relatório de Auditoria', 0, 26, ['largura' => $d->largura - 28, 'alinhar' => 'right']);
        $d->fonte('Helvetica', 8)->corPreenchimento($C['cinza'])->texto($filtros, 0, 44, ['largura' => $d->largura - 28, 'alinhar' => 'right']);
        $x = 28;
        $y = 70;
        $d->corPreenchimento($C['tinta'])->retangulo(28, $y, $W, 16, 'f');
        foreach ($colunas as [, $t, $w, $a]) {
            $d->fonte('Helvetica-Bold', 7.5)->corPreenchimento('#FFFFFF');
            _pdfCelula($d, mb_strtoupper($t), $x + 4, $y + 5, $w * $W - 8, $a);
            $x += $w * $W;
        }
        return $y + 18;
    };
    $y = $cabecalho();
    foreach ($linhas as $i => $l) {
        $obsAltura = $d->fonte('Helvetica', 7.5)->alturaTexto($l['observacao'] ?: '-', 0.30 * $W - 8);
        $h = max(14, $obsAltura + 6);
        if ($y + $h > $d->altura - 36) {
            $d->novaPagina();
            $y = $cabecalho();
        }
        if ($i % 2 === 0) $d->corPreenchimento('#EEF3F7')->retangulo(28, $y - 2, $W, $h, 'f');
        $x = 28;
        foreach ($colunas as [$k, , $w, $a]) {
            $d->fonte($k === 'acao' ? 'Helvetica-Bold' : 'Helvetica', 7.5)->corPreenchimento($C['tinta']);
            if ($k === 'observacao') $d->texto($l[$k] ?: '-', $x + 4, $y + 1, ['largura' => $w * $W - 8, 'quebrar' => true]);
            else _pdfCelula($d, (string) ($l[$k] ?: '-'), $x + 4, $y + 1, $w * $W - 8, $a);
            $x += $w * $W;
        }
        $y += $h;
    }
    if (!$linhas) $d->fonte('Helvetica', 10)->corPreenchimento($C['cinza'])->texto('Nenhum registro para os filtros selecionados.', 28, $y + 10);

    $total = $d->totalPaginas();
    for ($i = 0; $i < $total; $i++) {
        $d->irParaPagina($i);
        $d->fonte('Helvetica', 7)->corPreenchimento($C['cinza'])->texto(
            'Gerado em ' . formatarDataHora(agoraUtc()) . " por $geradoPor · " . count($linhas) . ' registro(s) · Página ' . ($i + 1) . " de $total",
            28, $d->altura - 22, ['largura' => $W, 'alinhar' => 'center'],
        );
    }
    return $d->gerar();
}

/** Célula de uma linha só (sem quebra): corta o que não couber, como o pdfkit com lineBreak: false. */
function _pdfCelula(Pdf $d, string $texto, float $x, float $y, float $largura, string $alinhar): void
{
    $t = $texto;
    while (mb_strlen($t) > 1 && $d->larguraTexto($t) > $largura) $t = mb_substr($t, 0, -1);
    $d->texto($t, $x, $y, ['largura' => $largura, 'alinhar' => $alinhar]);
}
