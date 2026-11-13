<?php
declare(strict_types=1);
// Cadastros: transportadoras, fornecedores, CDs/Pontos de Cross, usuários e ativação
// (src/actions/cadastros.ts). Mesmas validações e mensagens.

/** Texto opcional: vazio vira null; limita o tamanho. */
function _opcional(string $campo, int $max): ?string
{
    $v = f($campo);
    if ($v === '') return null;
    if (mb_strlen($v) > $max) throw new ErroNegocio("O campo $campo deve ter no máximo $max caracteres.");
    return $v;
}

/** Sigla: 2 a 20 caracteres, maiúscula e sem espaços. */
function _sigla(string $campo = 'sigla'): string
{
    $v = f($campo);
    if (mb_strlen($v) < 2) throw new ErroNegocio('Informe a sigla (mínimo 2 caracteres).');
    if (mb_strlen($v) > 20) throw new ErroNegocio('A sigla deve ter no máximo 20 caracteres.');
    return preg_replace('/\s+/', '', mb_strtoupper($v));
}

/** Campos padrão (Fornecedor, CD e Cross): só nome obrigatório; demais validados se preenchidos. */
function _camposPadrao(): array
{
    $nome = f('nome');
    if (mb_strlen($nome) < 2) throw new ErroNegocio('Informe o nome.');
    if (mb_strlen($nome) > 200) throw new ErroNegocio('O nome deve ter no máximo 200 caracteres.');
    $cnpj = normalizarCnpj(f('cnpj')) ?: null;
    if ($cnpj && !cnpjValido($cnpj)) throw new ErroNegocio('CNPJ inválido.');
    $telefone = f('telefone') ?: null;
    if ($telefone && !telefoneValido($telefone)) throw new ErroNegocio('Telefone inválido (informe DDD + número).');
    $email = f('email') ?: null;
    if ($email && (mb_strlen($email) > 160 || !emailValido($email))) throw new ErroNegocio('E-mail inválido.');
    return ['nome' => $nome, 'cnpj' => $cnpj, 'contato' => _opcional('contato', 120), 'telefone' => $telefone, 'email' => $email];
}

/** Após salvar, volta para a listagem com a mensagem de confirmação no topo. */
function _concluir(string $caminho, string $mensagem): never
{
    redirecionar($caminho . '?ok=' . rawurlencode($mensagem));
}

function _lerId(): ?string
{
    return f('id') ?: null;
}

// ---------------- Transportadoras ----------------
function acao_cadastros_salvar_transportadora(): array
{
    $u = exigirGlobal('cadastros');
    $id = _lerId();
    $nome = f('nome');
    if (mb_strlen($nome) < 2) throw new ErroNegocio('Informe o nome da transportadora.');
    if (!cnpjValido(f('cnpj'))) throw new ErroNegocio('CNPJ inválido.');
    $email = f('email') ?: null;
    if ($email && !emailValido($email)) throw new ErroNegocio('E-mail inválido.');
    $d = ['nome' => mb_substr($nome, 0, 200), 'cnpj' => normalizarCnpj(f('cnpj')), 'contato' => _opcional('contato', 120), 'telefone' => _opcional('telefone', 40), 'email' => $email];
    $dup = Db::one('SELECT `id`, `nome` FROM `Transportadora` WHERE `cnpj` = ?', [$d['cnpj']]);
    if ($dup && $dup['id'] !== $id) throw new ErroNegocio("CNPJ já cadastrado para {$dup['nome']}.");
    if ($id) Db::update('Transportadora', $d, '`id` = ?', [$id]);
    else $id = Db::insert('Transportadora', $d + ['criadoEm' => Db::agora()]);
    auditar(['acao' => f('id') ? 'EDITAR_TRANSPORTADORA' : 'CRIAR_TRANSPORTADORA', 'entidade' => 'Transportadora', 'entidadeId' => $id, 'usuarioId' => $u['id'], 'detalhes' => $d]);
    _concluir('/cadastros/transportadoras', "Transportadora {$d['nome']} " . (f('id') ? 'atualizada' : 'cadastrada') . '.');
}

// ---------------- Fornecedores ----------------
function acao_cadastros_salvar_fornecedor(): array
{
    $u = exigirGlobal('cadastros');
    $id = _lerId();
    $d = ['sigla' => _sigla()] + _camposPadrao();
    $siglaDup = Db::one('SELECT `id`, `nome` FROM `Fornecedor` WHERE `sigla` = ?', [$d['sigla']]);
    if ($siglaDup && $siglaDup['id'] !== $id) throw new ErroNegocio("Já existe um fornecedor com a sigla {$d['sigla']} ({$siglaDup['nome']}).");
    $dup = $d['cnpj'] ? Db::one('SELECT `id`, `nome` FROM `Fornecedor` WHERE `cnpj` = ?', [$d['cnpj']]) : null;
    if ($dup && $dup['id'] !== $id) throw new ErroNegocio("CNPJ já cadastrado para {$dup['nome']}.");
    if ($id) Db::update('Fornecedor', $d, '`id` = ?', [$id]);
    else $id = Db::insert('Fornecedor', $d + ['criadoEm' => Db::agora()]);
    auditar(['acao' => f('id') ? 'EDITAR_FORNECEDOR' : 'CRIAR_FORNECEDOR', 'entidade' => 'Fornecedor', 'entidadeId' => $id, 'usuarioId' => $u['id'], 'detalhes' => $d]);
    _concluir('/cadastros/fornecedores', "Fornecedor {$d['nome']} " . (f('id') ? 'atualizado' : 'cadastrado') . '.');
}

// ---------------- CDs e Pontos de Cross ----------------
/** Cadastro de CD ou Ponto de Cross (o Cross é vinculado a um ou mais CDs). */
function acao_cadastros_salvar_cd(): array
{
    $admin = exigirGlobal('cds');
    $id = _lerId();
    $tipo = f('tipo') === 'CROSS' ? 'CROSS' : 'CD';
    $d = ['tipo' => $tipo, 'codigo' => _sigla('codigo')] + _camposPadrao();
    // Endereço da unidade (emitente do Vale-Pallet): obrigatório.
    $endereco = f('endereco');
    if (mb_strlen($endereco) < 3) throw new ErroNegocio('Informe o endereço.');
    $cidade = f('cidade');
    if (mb_strlen($cidade) < 2) throw new ErroNegocio('Informe a cidade.');
    $uf = f('uf');
    if (!in_array($uf, UFS, true)) throw new ErroNegocio('Selecione o estado (UF).');
    $cep = somenteDigitos(f('cep'));
    if (strlen($cep) !== 8) throw new ErroNegocio('CEP inválido (use 00000-000).');
    $d += ['endereco' => mb_substr($endereco, 0, 200), 'cidade' => mb_substr($cidade, 0, 120), 'uf' => $uf, 'cep' => $cep];
    $cdIds = array_values(array_unique(array_filter(fLista('cdIds'))));

    $dup = Db::one('SELECT `id` FROM `CentroDistribuicao` WHERE `codigo` = ?', [$d['codigo']]);
    if ($dup && $dup['id'] !== $id) throw new ErroNegocio("Já existe uma unidade com a sigla {$d['codigo']}.");
    $cnpjDup = $d['cnpj'] ? Db::one('SELECT `id`, `codigo` FROM `CentroDistribuicao` WHERE `cnpj` = ?', [$d['cnpj']]) : null;
    if ($cnpjDup && $cnpjDup['id'] !== $id) throw new ErroNegocio("CNPJ já cadastrado para {$cnpjDup['codigo']}.");
    if ($tipo === 'CROSS') {
        if (!$cdIds) throw new ErroNegocio('Selecione ao menos um CD atendido pelo Ponto de Cross.');
        $validos = (int) Db::val("SELECT COUNT(*) FROM `CentroDistribuicao` WHERE `tipo` = 'CD' AND `id` IN (" . Db::in($cdIds) . ')', $cdIds);
        if ($validos !== count($cdIds)) throw new ErroNegocio('Um ou mais CDs selecionados são inválidos.');
    }
    if ($id) {
        // O tipo (CD / Cross) não muda depois do cadastro: o histórico depende dele.
        $atual = Db::one('SELECT `tipo` FROM `CentroDistribuicao` WHERE `id` = ?', [$id]);
        if (!$atual) throw new ErroNegocio('Cadastro não encontrado.');
        if ($atual['tipo'] !== $tipo) throw new ErroNegocio('Não é possível transformar um CD em Ponto de Cross (ou o contrário).');
    }
    $cdId = Db::tx(function () use ($id, $d, $tipo, $cdIds) {
        if ($id) Db::update('CentroDistribuicao', $d, '`id` = ?', [$id]);
        else $id = Db::insert('CentroDistribuicao', $d + ['criadoEm' => Db::agora()]);
        if ($tipo === 'CROSS') {
            Db::exec('DELETE FROM `CrossCD` WHERE `crossId` = ? AND `cdId` NOT IN (' . Db::in($cdIds) . ')', [$id, ...$cdIds]);
            foreach ($cdIds as $c) Db::exec('INSERT IGNORE INTO `CrossCD` (`crossId`, `cdId`, `criadoEm`) VALUES (?, ?, ?)', [$id, $c, Db::agora()]);
        }
        return $id;
    });
    $codigosCDs = $tipo === 'CROSS' ? Db::col('SELECT `codigo` FROM `CentroDistribuicao` WHERE `id` IN (' . Db::in($cdIds) . ')', $cdIds) : [];
    auditar([
        'acao' => (f('id') ? 'EDITAR' : 'CRIAR') . '_' . ($tipo === 'CROSS' ? 'PONTO_CROSS' : 'CD'),
        'entidade' => 'CentroDistribuicao',
        'entidadeId' => $cdId,
        'usuarioId' => $admin['id'],
        'cdId' => $cdId,
        'detalhes' => $d + ($tipo === 'CROSS' ? ['cdsAtendidos' => $codigosCDs] : []),
    ]);
    $rotulo = $tipo === 'CROSS' ? 'Ponto de Cross' : 'CD';
    $msg = "$rotulo {$d['codigo']} " . (f('id') ? 'atualizado' : 'cadastrado') . ($codigosCDs ? ' (atende: ' . implode(', ', $codigosCDs) . ')' : '') . '.';
    _concluir($tipo === 'CROSS' ? '/cadastros/cross' : '/cadastros/cds', $msg);
}

/** Configurações exclusivas do MASTER: CD Hub (somente um) e módulo de fornecedores. */
function acao_cadastros_configurar_unidade(): array
{
    $master = exigirMaster();
    $id = f('id');
    $unidade = Db::one('SELECT * FROM `CentroDistribuicao` WHERE `id` = ?', [$id]);
    if (!$unidade || $unidade['tipo'] !== 'CD') throw new ErroNegocio('Configuração disponível somente para CDs.');
    $recebimentoFornecedor = f('recebimentoFornecedor') === 'on';
    $hub = f('hub') === 'on';
    Db::tx(function () use ($unidade, $id, $hub, $recebimentoFornecedor, $master) {
        // Um único Hub: ao marcar este CD, os demais deixam de ser Hub.
        if ($hub && !$unidade['hub']) Db::exec('UPDATE `CentroDistribuicao` SET `hub` = 0 WHERE `hub` = 1');
        if (!$hub && $unidade['hub']) throw new ErroNegocio('Deve existir um CD Hub. Para trocar, marque o novo Hub em outro CD.');
        Db::update('CentroDistribuicao', ['recebimentoFornecedor' => $recebimentoFornecedor, 'hub' => $hub], '`id` = ?', [$id]);
        auditar(['acao' => 'CONFIGURAR_UNIDADE', 'entidade' => 'CentroDistribuicao', 'entidadeId' => $id, 'usuarioId' => $master['id'], 'cdId' => $id, 'detalhes' => compact('recebimentoFornecedor', 'hub')]);
    });
    _concluir('/cadastros/cds', "{$unidade['codigo']}: módulo Recebimento Pallet Fornecedor " . ($recebimentoFornecedor ? 'ATIVADO' : 'desativado') . ($hub ? ' · CD Hub (Nível Brasil)' : '') . '.');
}

// ---------------- Usuários (administrador) ----------------
function acao_cadastros_salvar_usuario(): array
{
    $admin = exigirAdmin();
    $id = _lerId();
    $nome = f('nome');
    if (mb_strlen($nome) < 2) throw new ErroNegocio('Informe o nome.');
    $login = mb_strtolower(f('login'));
    if (!preg_match('/^[a-z0-9._-]{3,40}$/', $login)) throw new ErroNegocio('Login deve ter 3 a 40 caracteres (letras, números, ponto, hífen).');
    $perfil = f('perfil');
    if (!in_array($perfil, ['MASTER', 'ADMIN', 'OPERADOR'], true)) throw new ErroNegocio('Perfil inválido.');
    // Permissões granulares marcadas (somente chaves conhecidas; usadas pelo perfil OPERADOR).
    $permissoes = array_values(array_filter(fLista('permissoes'), fn($p) => isset(PERMISSOES[$p])));
    // Evita escalonamento: só um MASTER cria/edita outro MASTER.
    $alvo = $id ? Db::one('SELECT `perfil`, `unidadeId` FROM `Usuario` WHERE `id` = ?', [$id]) : null;
    if (!ehMaster($admin) && ($perfil === 'MASTER' || ($alvo['perfil'] ?? null) === 'MASTER')) return falha('Somente um usuário MASTER pode criar ou alterar usuários MASTER.');
    $senha = (string) ($_POST['senha'] ?? '');
    if ((!$id || $senha !== '') && mb_strlen($senha) < 6) return falha('A senha deve ter ao menos 6 caracteres.');
    if ($id === $admin['id'] && $perfil !== $admin['perfil']) return falha('Você não pode alterar o próprio perfil.');
    $existente = Db::one('SELECT `id` FROM `Usuario` WHERE `login` = ?', [$login]);
    if ($existente && $existente['id'] !== $id) throw new ErroNegocio("O login \"$login\" já está em uso.");

    // Unidades vinculadas: ao menos uma; a principal é mantida se continuar marcada.
    $unidadeIds = array_values(array_unique(array_filter(fLista('unidadeIds'))));
    if (!$unidadeIds) return falha('Vincule o usuário a pelo menos um CD ou Ponto de Cross.');
    $unidades = Db::all('SELECT `id`, `codigo` FROM `CentroDistribuicao` WHERE `id` IN (' . Db::in($unidadeIds) . ')', $unidadeIds);
    if (count($unidades) !== count($unidadeIds)) return falha('Uma ou mais unidades selecionadas são inválidas.');
    $principal = in_array($alvo['unidadeId'] ?? '', $unidadeIds, true) ? $alvo['unidadeId'] : $unidadeIds[0];
    $codigoPrincipal = array_column($unidades, 'codigo', 'id')[$principal];

    $dados = ['nome' => mb_substr($nome, 0, 120), 'login' => $login, 'perfil' => $perfil, 'permissoes' => json_encode($perfil === 'OPERADOR' ? $permissoes : []), 'unidadeId' => $principal];
    if ($senha !== '') $dados['senhaHash'] = password_hash($senha, PASSWORD_BCRYPT, ['cost' => 10]);
    $uid = Db::tx(function () use ($id, $dados, $unidadeIds) {
        if ($id) Db::update('Usuario', $dados, '`id` = ?', [$id]);
        else $id = Db::insert('Usuario', $dados + ['criadoEm' => Db::agora()]);
        Db::exec('DELETE FROM `UsuarioUnidade` WHERE `usuarioId` = ? AND `unidadeId` NOT IN (' . Db::in($unidadeIds) . ')', [$id, ...$unidadeIds]);
        foreach ($unidadeIds as $un) Db::exec('INSERT IGNORE INTO `UsuarioUnidade` (`usuarioId`, `unidadeId`, `criadoEm`) VALUES (?, ?, ?)', [$id, $un, Db::agora()]);
        return $id;
    });
    auditar([
        'acao' => $id ? 'EDITAR_USUARIO' : 'CRIAR_USUARIO',
        'entidade' => 'Usuario',
        'entidadeId' => $uid,
        'usuarioId' => $admin['id'],
        'detalhes' => ['login' => $login, 'perfil' => $perfil, 'permissoes' => $permissoes, 'unidadePrincipal' => $codigoPrincipal, 'unidades' => array_column($unidades, 'codigo'), 'senhaAlterada' => $senha !== ''],
    ]);
    _concluir('/cadastros/usuarios', "Usuário $login " . ($id ? 'atualizado' : 'criado') . '.');
}

// ---------------- Ativar / inativar ----------------
function acao_cadastros_alternar_ativo(): array
{
    $tipo = f('tipo');
    $cfg = [
        'transportadora' => ['/cadastros/transportadoras', fn() => exigirGlobal('cadastros')],
        'fornecedor' => ['/cadastros/fornecedores', fn() => exigirGlobal('cadastros')],
        'cd' => ['/cadastros/cds', fn() => exigirGlobal('cds')],
        'usuario' => ['/cadastros/usuarios', fn() => exigirAdmin()],
    ][$tipo] ?? null;
    if (!$cfg) throw new ErroNegocio('Cadastro inválido.');
    [$caminho, $exigir] = $cfg;
    $u = $exigir();
    $id = f('id');
    switch ($tipo) {
        case 'transportadora':
        case 'fornecedor':
            $tabela = $tipo === 'transportadora' ? 'Transportadora' : 'Fornecedor';
            $r = Db::one("SELECT `nome`, `ativo` FROM `$tabela` WHERE `id` = ?", [$id]) ?? throw new ErroNegocio('Cadastro não encontrado.');
            Db::update($tabela, ['ativo' => !$r['ativo']], '`id` = ?', [$id]);
            [$nome, $ativo] = [$r['nome'], (bool) $r['ativo']];
            break;
        case 'cd':
            $r = Db::one('SELECT `codigo`, `ativo`, `tipo` FROM `CentroDistribuicao` WHERE `id` = ?', [$id]) ?? throw new ErroNegocio('Cadastro não encontrado.');
            Db::update('CentroDistribuicao', ['ativo' => !$r['ativo']], '`id` = ?', [$id]);
            [$nome, $ativo] = [$r['codigo'], (bool) $r['ativo']];
            if ($r['tipo'] === 'CROSS') $caminho = '/cadastros/cross';
            break;
        default:
            if ($id === $u['id']) throw new ErroNegocio('Você não pode inativar o próprio usuário.');
            $r = Db::one('SELECT `login`, `ativo`, `perfil` FROM `Usuario` WHERE `id` = ?', [$id]) ?? throw new ErroNegocio('Cadastro não encontrado.');
            if ($r['perfil'] === 'MASTER' && !ehMaster($u)) throw new ErroNegocio('Somente um MASTER pode inativar outro MASTER.');
            Db::update('Usuario', ['ativo' => !$r['ativo']], '`id` = ?', [$id]);
            [$nome, $ativo] = [$r['login'], (bool) $r['ativo']];
    }
    auditar(['acao' => ($ativo ? 'INATIVAR' : 'ATIVAR') . '_' . strtoupper($tipo), 'entidade' => $tipo, 'entidadeId' => $id, 'usuarioId' => $u['id']]);
    _concluir($caminho, "$nome " . ($ativo ? 'inativado' : 'ativado') . '.');
}
