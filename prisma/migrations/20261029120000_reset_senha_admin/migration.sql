-- Reset da senha do usuário MASTER "admin" para "admin123" (pedido do responsável).
-- O login não diferencia maiúsculas ("Admin" também entra). Cria o usuário no CD Hub se não
-- existir; se existir, redefine a senha, reativa e garante o perfil MASTER. Roda uma vez;
-- depois a senha pode ser trocada em "Minha Senha".
INSERT INTO "Usuario" ("id", "nome", "login", "senhaHash", "perfil", "permissoes", "unidadeId", "ativo", "criadoEm", "atualizadoEm")
SELECT 'usuario_admin_master', 'Administrador', 'admin', '$2b$10$Y4hSrD3w2TfMSTQUNck1q.Pv9w5BlCifCUxd6Cd0LgkV5IDlrgG5i', 'MASTER', '{}', c."id", true, now(), now()
FROM "CentroDistribuicao" c
WHERE c."hub" = true
ORDER BY c."criadoEm"
LIMIT 1
ON CONFLICT ("login") DO UPDATE
SET "senhaHash" = EXCLUDED."senhaHash", "perfil" = 'MASTER', "ativo" = true, "atualizadoEm" = now();

INSERT INTO "Auditoria" ("id", "acao", "entidade", "entidadeId", "observacao", "criadoEm")
SELECT 'auditoria_reset_senha_admin_20261029', 'REDEFINIR_SENHA', 'Usuario', u."id", 'Senha do MASTER admin redefinida para o padrão por migração', now()
FROM "Usuario" u
WHERE u."login" = 'admin';
