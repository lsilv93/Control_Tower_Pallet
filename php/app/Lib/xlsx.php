<?php
declare(strict_types=1);
/**
 * Planilhas Excel (.xlsx) sem dependências (substitui o ExcelJS): cabeçalho em negrito branco
 * sobre fundo colorido, primeira linha congelada, filtro automático e larguras de coluna.
 * O pacote ZIP é montado aqui mesmo (deflate do zlib), sem exigir a extensão zip do PHP.
 */

final class Xlsx
{
    /** @var array<array{nome:string,colunas:array,linhas:array,cor:string}> */
    private array $abas = [];

    public function __construct(private string $criador = 'Control Tower Pallet') {}

    /**
     * @param array<array{header:string,key:string,width?:int}> $colunas
     * @param array<array<string,mixed>> $linhas
     */
    public function aba(string $nome, array $colunas, array $linhas, string $cor = 'FF1D4ED8'): void
    {
        $this->abas[] = ['nome' => mb_substr(str_replace(['\\', '/', '?', '*', '[', ']', ':'], ' ', $nome), 0, 31), 'colunas' => $colunas, 'linhas' => $linhas, 'cor' => $cor];
    }

    private static function x(string $s): string
    {
        $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $s);
        return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    private static function coluna(int $i): string
    {
        $s = '';
        for ($i++; $i > 0; $i = intdiv($i - 1, 26)) $s = chr(65 + ($i - 1) % 26) . $s;
        return $s;
    }

    private function planilha(array $a, int $estiloCab): string
    {
        $cols = '';
        foreach ($a['colunas'] as $i => $c) {
            $w = $c['width'] ?? max(12, mb_strlen($c['header']) + 2);
            $cols .= '<col min="' . ($i + 1) . '" max="' . ($i + 1) . '" width="' . $w . '" customWidth="1"/>';
        }
        $linhas = '';
        $todas = array_merge([array_combine(array_column($a['colunas'], 'key'), array_column($a['colunas'], 'header'))], $a['linhas']);
        foreach ($todas as $r => $linha) {
            $linhas .= '<row r="' . ($r + 1) . '">';
            foreach ($a['colunas'] as $i => $c) {
                $v = $linha[$c['key']] ?? '';
                $ref = self::coluna($i) . ($r + 1);
                $s = $r === 0 ? " s=\"$estiloCab\"" : '';
                if ($r > 0 && (is_int($v) || is_float($v))) {
                    $linhas .= "<c r=\"$ref\"$s><v>$v</v></c>";
                } elseif ($v !== '' && $v !== null) {
                    $linhas .= "<c r=\"$ref\" t=\"inlineStr\"$s><is><t xml:space=\"preserve\">" . self::x((string) $v) . '</t></is></c>';
                } elseif ($r === 0) {
                    $linhas .= "<c r=\"$ref\"$s/>";
                }
            }
            $linhas .= '</row>';
        }
        $ultima = self::coluna(count($a['colunas']) - 1);
        $filtro = $a['linhas'] ? "<autoFilter ref=\"A1:{$ultima}1\"/>" : '';
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            . "<cols>$cols</cols><sheetData>$linhas</sheetData>$filtro</worksheet>";
    }

    /** Conteúdo binário do arquivo .xlsx. */
    public function gerar(): string
    {
        $cores = array_values(array_unique(array_column($this->abas, 'cor')));
        $fills = '<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>';
        $xfs = '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>';
        foreach ($cores as $i => $cor) {
            $fills .= "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"$cor\"/><bgColor indexed=\"64\"/></patternFill></fill>";
            $xfs .= '<xf numFmtId="0" fontId="1" fillId="' . ($i + 2) . '" borderId="0" xfId="0" applyFont="1" applyFill="1"/>';
        }
        $estilos = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>'
            . '<fills count="' . (2 + count($cores)) . "\">$fills</fills><borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>"
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="' . (1 + count($cores)) . "\">$xfs</cellXfs>"
            . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

        $arquivos = [];
        $abas = '';
        $rels = '';
        $tipos = '';
        $nomesDef = '';
        foreach ($this->abas as $i => $a) {
            $n = $i + 1;
            $arquivos["xl/worksheets/sheet$n.xml"] = $this->planilha($a, 1 + array_search($a['cor'], $cores, true));
            $abas .= '<sheet name="' . self::x($a['nome']) . "\" sheetId=\"$n\" r:id=\"rId$n\"/>";
            $rels .= "<Relationship Id=\"rId$n\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet$n.xml\"/>";
            $tipos .= "<Override PartName=\"/xl/worksheets/sheet$n.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>";
            if ($a['linhas']) {
                $nomesDef .= '<definedName name="_xlnm._FilterDatabase" localSheetId="' . $i . '" hidden="1">\'' . self::x(str_replace("'", "''", $a['nome'])) . "'!\$A\$1:\$" . self::coluna(count($a['colunas']) - 1) . '$' . (count($a['linhas']) + 1) . '</definedName>';
            }
        }
        $k = count($this->abas) + 1;
        $rels .= "<Relationship Id=\"rId$k\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>";
        $agora = gmdate('Y-m-d\TH:i:s\Z');
        $arquivos = [
            '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
                . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                . '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' . $tipos . '</Types>',
            '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
            'docProps/core.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
                . '<dc:creator>' . self::x($this->criador) . "</dc:creator><dcterms:created xsi:type=\"dcterms:W3CDTF\">$agora</dcterms:created><dcterms:modified xsi:type=\"dcterms:W3CDTF\">$agora</dcterms:modified></cp:coreProperties>",
            'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                . "<sheets>$abas</sheets>" . ($nomesDef ? "<definedNames>$nomesDef</definedNames>" : '') . '</workbook>',
            'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . $rels . '</Relationships>',
            'xl/styles.xml' => $estilos,
        ] + $arquivos;
        return zipar($arquivos);
    }
}

/** Pacote ZIP (deflate) a partir de [caminho => conteúdo]. */
function zipar(array $arquivos): string
{
    $dados = '';
    $central = '';
    $hora = getdate();
    $dosHora = ($hora['hours'] << 11) | ($hora['minutes'] << 5) | intdiv($hora['seconds'], 2);
    $dosData = (($hora['year'] - 1980) << 9) | ($hora['mon'] << 5) | $hora['mday'];
    foreach ($arquivos as $nome => $conteudo) {
        $comp = gzdeflate($conteudo, 6);
        $crc = crc32($conteudo);
        $offset = strlen($dados);
        $dados .= "PK\x03\x04" . pack('vvvvvVVVvv', 20, 0x0800, 8, $dosHora, $dosData, $crc, strlen($comp), strlen($conteudo), strlen($nome), 0) . $nome . $comp;
        $central .= "PK\x01\x02" . pack('vvvvvvVVVvvvvvVV', 20, 20, 0x0800, 8, $dosHora, $dosData, $crc, strlen($comp), strlen($conteudo), strlen($nome), 0, 0, 0, 0, 0, $offset) . $nome;
    }
    return $dados . $central . "PK\x05\x06" . pack('vvvvVVv', 0, 0, count($arquivos), count($arquivos), strlen($central), strlen($dados), 0);
}
