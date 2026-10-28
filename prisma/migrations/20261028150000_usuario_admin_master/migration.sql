-- Usuário MASTER padrão: login "admin" (o login não diferencia maiúsculas: "Admin" também
-- entra) e senha "Admin". Cria o usuário no CD Hub ou, se já existir, redefine a senha,
-- reativa e garante o perfil MASTER. Roda uma única vez; depois a senha pode ser alterada
-- em "Minha Senha". Sem CD Hub (banco vazio), não faz nada e o seed cria o usuário.
INSERT INTO "Usuario" ("id", "nome", "login", "senhaHash", "perfil", "permissoes", "unidadeId", "ativo", "criadoEm", "atualizadoEm")
SELECT 'usuario_admin_master', 'Administrador', 'admin', '$2b$10$MgfwM9sLePuUge7i5bQ/3.5tvOdsDLk7SthBCNkABvjwhGH3Kxs6e', 'MASTER', '{}', c."id", true, now(), now()
FROM "CentroDistribuicao" c
WHERE c."hub" = true
ORDER BY c."criadoEm"
LIMIT 1
ON CONFLICT ("login") DO UPDATE
SET "senhaHash" = EXCLUDED."senhaHash", "perfil" = 'MASTER', "ativo" = true, "atualizadoEm" = now();

INSERT INTO "Auditoria" ("id", "acao", "entidade", "entidadeId", "observacao", "criadoEm")
SELECT 'auditoria_admin_master_20261028', 'REDEFINIR_SENHA', 'Usuario', u."id", 'Usuário MASTER admin definido por migração (senha padrão)', now()
FROM "Usuario" u
WHERE u."login" = 'admin';
