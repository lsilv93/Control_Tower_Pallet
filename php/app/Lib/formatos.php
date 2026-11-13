<?php
declare(strict_types=1);
// Formatos, máscaras, rótulos e validações (tradução de src/lib/formatos.ts).

function somenteDigitos(string $v): string
{
    return preg_replace('/\D/', '', $v) ?? '';
}

/** CNPJ normalizado: 14 caracteres maiúsculos (numérico ou alfanumérico), sem pontuação. */
function normalizarCnpj(string $v): string
{
    return preg_replace('/[^0-9A-Z]/', '', mb_strtoupper($v)) ?? '';
}

/** CNPJ formatado (00.000.000/0000-00); vazio vira "—". */
function formatarCnpj(?string $cnpj): string
{
    if (!$cnpj) return '—';
    $d = normalizarCnpj($cnpj);
    if (strlen($d) !== 14) return $cnpj;
    return substr($d, 0, 2) . '.' . substr($d, 2, 3) . '.' . substr($d, 5, 3) . '/' . substr($d, 8, 4) . '-' . substr($d, 12, 2);
}

function telefoneValido(string $v): bool
{
    return (bool) preg_match('/^\d{10,11}$/', somenteDigitos($v));
}

function emailValido(string $v): bool
{
    return (bool) preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', trim($v));
}

/** Dígitos verificadores do CNPJ (numérico e alfanumérico). */
function dvCnpj(string $base12): string
{
    $calc = function (string $base): int {
        $pesos = strlen($base) === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        $soma = 0;
        foreach (str_split($base) as $i => $c) $soma += (ord($c) - 48) * $pesos[$i];
        $resto = $soma % 11;
        return $resto < 2 ? 0 : 11 - $resto;
    };
    $d1 = $calc($base12);
    $d2 = $calc($base12 . $d1);
    return "$d1$d2";
}

function cnpjValido(string $valor): bool
{
    $cnpj = normalizarCnpj($valor);
    if (!preg_match('/^[0-9A-Z]{12}\d{2}$/', $cnpj) || preg_match('/^(.)\1+$/', $cnpj)) return false;
    return str_ends_with($cnpj, dvCnpj(substr($cnpj, 0, 12)));
}

function normalizarPlaca(string $placa): string
{
    return preg_replace('/[^A-Z0-9]/', '', mb_strtoupper($placa)) ?? '';
}

/** Placa antiga (ABC1234) ou Mercosul (ABC1D23). */
function placaValida(string $placa): bool
{
    return (bool) preg_match('/^[A-Z]{3}\d[A-Z0-9]\d{2}$/', normalizarPlaca($placa));
}

function formatarPlaca(string $placa): string
{
    $p = normalizarPlaca($placa);
    return preg_match('/^[A-Z]{3}\d{4}$/', $p) ? substr($p, 0, 3) . '-' . substr($p, 3) : $p;
}

const PREFIXO_VALE = ['FORNECEDOR' => 'VP', 'ENVIO' => 'VE', 'OCORRENCIA' => 'VO'];

/** VE-000123 (envio), VO- (ocorrência), VP- (fornecedor). */
function numeroVale(int|string $n, string $tipo = 'FORNECEDOR'): string
{
    return PREFIXO_VALE[$tipo] . '-' . str_pad((string) $n, 6, '0', STR_PAD_LEFT);
}

/** Lê "VP-000123", "VE000123", "vo 123" ou "123" e devolve o número do vale. */
function lerCodigoVale(string $codigo): ?int
{
    return preg_match('/^(?:V[PEO][\s-]*)?0*(\d{1,9})$/', mb_strtoupper(trim($codigo)), $m) ? (int) $m[1] : null;
}

function numeroConferencia(int|string $n): string
{
    return 'RC-' . str_pad((string) $n, 5, '0', STR_PAD_LEFT);
}

function numeroAgenda(int|string $n): string
{
    return 'AG-' . str_pad((string) $n, 5, '0', STR_PAD_LEFT);
}

const ROTULO_TIPO_VALE = ['ENVIO' => 'Vale-Pallet de Envio', 'OCORRENCIA' => 'Vale de Ocorrência', 'FORNECEDOR' => 'Vale-Pallet de Fornecedor'];
const ROTULO_OCORRENCIA = ['FALTA' => 'Falta (enviado a menos)', 'SOBRA' => 'Sobra (enviado a mais)'];
const ROTULO_RESOLUCAO = ['ACEITA_REMETENTE' => 'Aceita pela unidade remetente', 'ACEITA_RECEBEDOR' => 'Aceita pela unidade recebedora'];
const ROTULO_TIPO_UNIDADE = ['CD' => 'CD', 'CROSS' => 'Ponto de Cross'];

/** "CDJC (Hub)", "CX01 (Cross)". */
function rotuloUnidade(array $u): string
{
    return $u['codigo'] . (!empty($u['hub']) ? ' (Hub)' : ($u['tipo'] === 'CROSS' ? ' (Cross)' : ''));
}

const MOTIVOS_INCLUSAO = ['COMPRA' => 'Compra', 'DEVOLUCAO' => 'Devolução', 'AJUSTE_ESTOQUE' => 'Ajuste Estoque', 'INVENTARIO' => 'Inventário'];

/** 1.234 (pt-BR). */
function n(int|float|string|null $v): string
{
    return number_format((float) ($v ?? 0), 0, ',', '.');
}

const ROTULO_TIPO = [
    'ENVIO' => 'Envio a outra unidade',
    'BAIXA_TRANSITO' => 'Envio conferido no destino',
    'RECEBIMENTO' => 'Recebimento de outra unidade',
    'FALTA' => 'Falta na conferência (ocorrência)',
    'SOBRA' => 'Sobra na conferência',
    'DIVERGENCIA_ENVIADO' => 'Divergência aceita (remetente)',
    'DIVERGENCIA_RECEBIDO' => 'Divergência aceita (recebedor)',
    'OCORRENCIA_PERDA' => 'Falta baixada como perda',
    'ESTORNO_ENVIO' => 'Estorno de envio (vale excluído)',
    'QUEBRA' => 'Lançamento de quebrado',
    'RECUPERADO' => 'Conserto / Reparo',
    'CANIBALIZACAO' => 'Pallets utilizados no reparo',
    'DESCARTE' => 'Descarte',
    'INCLUSAO_MANUAL' => 'Inclusão manual de saldo',
    'REMOCAO_MANUAL' => 'Remoção manual de saldo',
    'COMPRA' => 'Compra de pallets',
    'RECEBIMENTO_FORNECEDOR' => 'Recebimento de fornecedor',
    'DEVOLUCAO_FORNECEDOR' => 'Baixa / pagamento ao fornecedor',
    'ESTORNO_VALE' => 'Estorno de vale de fornecedor',
];

const ROTULO_STATUS_VALE = ['PENDENTE' => 'Pendente', 'AGENDADO' => 'Agendado', 'FINALIZADO' => 'Concluído', 'CANCELADO' => 'Cancelado'];

const ROTULO_MOTIVO_CANCELAMENTO = [
    'FORNECEDOR_INCORRETO' => 'Fornecedor Incorreto',
    'TRANSPORTADORA_INCORRETA' => 'Transportadora Incorreta',
    'QUANTIDADE_INCORRETA' => 'Quantidade Incorreta',
    'DOCUMENTO_ERRADO' => 'Documento Errado',
    'DESTINO_INCORRETO' => 'Unidade de destino incorreta',
];

const ROTULO_STATUS_AGENDA = ['ABERTA' => 'Aberta', 'VALIDADA' => 'Validada', 'CANCELADA' => 'Cancelada'];

const SEM_NOTA_FISCAL = 'SEM NOTA FISCAL';

/** "1234 (série 1)", "1234" ou "SEM NOTA FISCAL". */
function rotuloNf(array $v): string
{
    if (!empty($v['semNotaFiscal']) || empty($v['notaFiscal'])) return SEM_NOTA_FISCAL;
    return !empty($v['serieNf']) ? "{$v['notaFiscal']} (série {$v['serieNf']})" : $v['notaFiscal'];
}

/** Contraparte do vale: fornecedor ou unidade. Aceita chaves fornecedorNome / unidadeCodigo+unidadeNome. */
function parteVale(array $v): string
{
    if (!empty($v['fornecedorNome'])) return $v['fornecedorNome'];
    if (!empty($v['unidadeCodigo'])) return "{$v['unidadeCodigo']} - {$v['unidadeNome']}";
    return '—';
}

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

function mascaraCep(string $valor): string
{
    $d = substr(somenteDigitos($valor), 0, 8);
    return strlen($d) > 5 ? substr($d, 0, 5) . '-' . substr($d, 5) : $d;
}

/** "Rua X, 10 · Cidade/UF · CEP 00000-000" (partes ausentes omitidas) ou null. */
function enderecoCompleto(array $u): ?string
{
    $local = implode('/', array_filter([$u['cidade'] ?? null, $u['uf'] ?? null]));
    $partes = array_filter([$u['endereco'] ?? null, $local ?: null, !empty($u['cep']) ? 'CEP ' . mascaraCep($u['cep']) : null]);
    return $partes ? implode(' · ', $partes) : null;
}

/** Escapa HTML. */
function e(mixed $v): string
{
    return htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Concatena classes CSS ignorando vazias (equivalente ao clsx). */
function cx(string|false|null ...$c): string
{
    return implode(' ', array_filter($c, fn($x) => $x !== false && $x !== null && $x !== ''));
}
