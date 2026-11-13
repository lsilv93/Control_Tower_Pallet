<?php
declare(strict_types=1);
// Chave de acesso da NF-e (44 posições) — conteúdo do código de barras do DANFE (src/lib/nfe.ts).

/** Dígito verificador da chave (módulo 11, pesos 2..9 da direita para a esquerda). */
function dvChave(string $chave43): int
{
    $soma = 0;
    $peso = 2;
    for ($i = strlen($chave43) - 1; $i >= 0; $i--) {
        $soma += (ord($chave43[$i]) - 48) * $peso;
        $peso = $peso === 9 ? 2 : $peso + 1;
    }
    $resto = $soma % 11;
    return $resto < 2 ? 0 : 11 - $resto;
}

function normalizarChave(string $v): string
{
    return preg_replace('/[^0-9A-Z]/', '', mb_strtoupper($v)) ?? '';
}

const UFS_IBGE = [
    '11' => 'RO', '12' => 'AC', '13' => 'AM', '14' => 'RR', '15' => 'PA', '16' => 'AP', '17' => 'TO', '21' => 'MA', '22' => 'PI',
    '23' => 'CE', '24' => 'RN', '25' => 'PB', '26' => 'PE', '27' => 'AL', '28' => 'SE', '29' => 'BA', '31' => 'MG', '32' => 'ES',
    '33' => 'RJ', '35' => 'SP', '41' => 'PR', '42' => 'SC', '43' => 'RS', '50' => 'MS', '51' => 'MT', '52' => 'GO', '53' => 'DF',
];

/**
 * Interpreta a leitura do código de barras do DANFE. Lança ErroNegocio com mensagem amigável.
 * @return array{chave:string, uf:string, anoMes:string, cnpj:string, modelo:string, serie:string, numero:string}
 */
function lerChaveNFe(string $leitura): array
{
    $chave = normalizarChave($leitura);
    $len = strlen($chave);
    if (!$chave) throw new ErroNegocio('Leia ou digite a chave de acesso da NF-e.');
    if ($len < 44) throw new ErroNegocio("Chave incompleta: $len de 44 dígitos. Leia o código de barras novamente.");
    if ($len > 44) throw new ErroNegocio("Chave com $len dígitos — a chave de acesso tem exatamente 44. Verifique a leitura.");
    if (!preg_match('/^\d{6}[0-9A-Z]{12}\d{26}$/', $chave)) throw new ErroNegocio('Código de barras não corresponde a uma chave de NF-e (caracteres inválidos).');
    $uf = substr($chave, 0, 2);
    if (!isset(UFS_IBGE[$uf])) throw new ErroNegocio("Chave inválida: código de UF \"$uf\" inexistente.");
    $mes = (int) substr($chave, 4, 2);
    if ($mes < 1 || $mes > 12) throw new ErroNegocio('Chave inválida: mês de emissão "' . substr($chave, 4, 2) . '" inexistente.');
    if (dvChave(substr($chave, 0, 43)) !== (int) $chave[43]) {
        throw new ErroNegocio('Dígito verificador da chave inválido — leia o código de barras novamente.');
    }
    $modelo = substr($chave, 20, 2);
    if ($modelo !== '55') throw new ErroNegocio("Esta chave é do modelo $modelo" . ($modelo === '65' ? ' (NFC-e)' : '') . '; o recebimento aceita apenas NF-e (modelo 55).');
    $cnpj = substr($chave, 6, 14);
    if (!cnpjValido($cnpj)) throw new ErroNegocio('CNPJ do emitente contido na chave é inválido.');
    $numero = (string) (int) substr($chave, 25, 9);
    if ($numero === '0') throw new ErroNegocio('Chave inválida: número da NF zerado.');
    return [
        'chave' => $chave,
        'uf' => $uf,
        'anoMes' => substr($chave, 2, 4),
        'cnpj' => $cnpj,
        'modelo' => $modelo,
        'serie' => (string) (int) substr($chave, 22, 3),
        'numero' => $numero,
    ];
}

/** Gera uma chave válida (botão "Simular leitura"). */
function gerarChaveNFe(?string $cnpj = null, ?int $numero = null): string
{
    $aleatorio = fn(int $n) => implode('', array_map(fn() => (string) random_int(0, 9), range(1, $n)));
    $cnpj = $cnpj ? normalizarCnpj($cnpj) : '';
    if (!$cnpj) {
        $base = $aleatorio(8) . '0001';
        $cnpj = $base . dvCnpj($base);
    }
    $aamm = gmdate('y') . gmdate('m');
    $num = str_pad((string) ($numero ?? random_int(1, 999999)), 9, '0', STR_PAD_LEFT);
    $base43 = "35{$aamm}{$cnpj}55001{$num}1" . $aleatorio(8);
    return $base43 . dvChave($base43);
}
