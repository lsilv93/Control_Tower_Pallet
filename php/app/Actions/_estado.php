<?php
declare(strict_types=1);
// Resultado das ações de formulário (equivalente a src/actions/estado.ts e guarda.ts).

function sucesso(string $mensagem, array $extra = []): array
{
    return ['ok' => true, 'mensagem' => $mensagem, 'ts' => (int) (microtime(true) * 1000)] + $extra;
}

function falha(string $mensagem, array $extra = []): array
{
    return ['ok' => false, 'mensagem' => $mensagem, 'ts' => (int) (microtime(true) * 1000)] + $extra;
}

/** Violação de chave única → mensagem amigável; demais erros de banco → genérica. */
function mensagemErroBanco(PDOException $e): string
{
    if (($e->errorInfo[1] ?? 0) === 1062) return 'Registro duplicado: já existe um cadastro com estes dados.';
    if (($e->errorInfo[1] ?? 0) === 1644) return (string) ($e->errorInfo[2] ?? 'Operação bloqueada pelo banco.');
    return 'Erro inesperado ao processar a operação. Tente novamente.';
}

function semCD(): ErroNegocio
{
    return new ErroNegocio('Selecione a unidade de operação antes de continuar (menu lateral → Trocar unidade).');
}

/** Permissão dentro de uma ação (erro amigável) e unidade de operação obrigatória. */
function exigir(string ...$permissoes): array
{
    $u = exigirGlobal(...$permissoes);
    if (!$u['cd']) throw semCD();
    return $u;
}

/** Permissão sem exigir unidade (cadastros globais). */
function exigirGlobal(string ...$permissoes): array
{
    $u = requireUsuario();
    foreach ($permissoes as $p) if (tem($u, $p)) return $u;
    throw new ErroNegocio('Você não tem permissão para esta operação.');
}

/** Qualquer usuário de CD com unidade de operação; fora do escopo do Ponto de Cross. */
function exigirUnidade(): array
{
    $u = requireUsuario();
    if (!$u['cd']) throw semCD();
    if (ehUsuarioCross($u)) throw new ErroNegocio('Operação fora do escopo do usuário de Ponto de Cross.');
    return $u;
}

function exigirModuloFornecedor(string ...$permissoes): array
{
    $u = exigir(...($permissoes ?: ['fornecedor']));
    if (!$u['cd']['recebimentoFornecedor']) throw new ErroNegocio('O módulo Recebimento Pallet Fornecedor não está liberado para esta unidade.');
    return $u;
}

function exigirAdmin(): array
{
    $u = requireUsuario();
    if (!ehAdmin($u)) throw new ErroNegocio('Somente administradores podem realizar esta operação.');
    return $u;
}

function exigirAdminCD(): array
{
    $u = exigirAdmin();
    if (!$u['cd']) throw semCD();
    return $u;
}

function exigirMaster(): array
{
    $u = requireUsuario();
    if (!ehMaster($u)) throw new ErroNegocio('Somente o usuário MASTER pode alterar esta configuração.');
    return $u;
}

/** Primeira letra maiúscula (UTF-8). */
function maiuscula1(string $s): string
{
    return mb_strtoupper(mb_substr($s, 0, 1)) . mb_substr($s, 1);
}

/**
 * Inteiro ≥ 0 de um campo de formulário (vazio = 0), com as mensagens do sistema:
 * "Informe {rótulo}.", "{Rótulo} deve ser um número inteiro.", "{Rótulo} não pode ser negativa."
 */
function inteiro(string $v, string $rotulo): int
{
    $v = trim($v);
    if ($v === '') return 0;
    if (!is_numeric($v)) throw new ErroNegocio("Informe $rotulo.");
    $f = (float) $v;
    if ($f != floor($f)) throw new ErroNegocio(maiuscula1($rotulo) . ' deve ser um número inteiro.');
    if ($f < 0) throw new ErroNegocio(maiuscula1($rotulo) . ' não pode ser negativa.');
    return (int) $f;
}

/** Placa opcional normalizada (null se vazia); inválida → erro. */
function placaOpcional(string $v): ?string
{
    if ($v === '') return null;
    $p = normalizarPlaca($v);
    if (!placaValida($p)) throw new ErroNegocio('Placa inválida (use ABC-1234 ou ABC1D23).');
    return $p;
}

/** Texto opcional limitado (vazio = null). */
function textoOpcional(string $v, int $max): ?string
{
    $v = trim($v);
    if ($v === '') return null;
    if (mb_strlen($v) > $max) throw new ErroNegocio("Texto muito longo (máximo $max caracteres).");
    return $v;
}

/** Quantidade inteira > 0 (mensagens: "Informe a quantidade.", "...deve ser inteira.", "...maior que zero."). */
function quantidadePositiva(string $v): int
{
    $v = trim($v);
    if ($v !== '' && !is_numeric($v)) throw new ErroNegocio('Informe a quantidade.');
    $f = (float) ($v === '' ? 0 : $v);
    if ($f != floor($f)) throw new ErroNegocio('Quantidade deve ser inteira.');
    if ($f <= 0) throw new ErroNegocio('Quantidade deve ser maior que zero.');
    return (int) $f;
}

/** Observação obrigatória (mínimo de caracteres), máximo 500. */
function observacaoObrigatoria(string $v, int $min, string $mensagem): string
{
    $v = trim($v);
    if (mb_strlen($v) < $min) throw new ErroNegocio($mensagem);
    if (mb_strlen($v) > 500) throw new ErroNegocio('Texto muito longo (máximo 500 caracteres).');
    return $v;
}

/** Trava do reparo: recuperados + utilizados não podem ultrapassar o saldo de quebrados (src/lib/reparo.ts). */
function travaReparo(int $saldo, int $recuperados, int $utilizados): ?string
{
    if ($recuperados > $saldo) return "Erro: os recuperados ($recuperados) ultrapassam o saldo de quebrados ($saldo).";
    if ($recuperados + $utilizados > $saldo) {
        $restam = $saldo - $recuperados;
        return "Erro: A soma dos recuperados ($recuperados) e utilizados ($utilizados) ultrapassa o saldo de quebrados ($saldo). Restam no máximo $restam pallet(s) para utilização.";
    }
    return null;
}
