-- Partida dobrada (1/2): estrutura aditiva. Nada é removido aqui.

-- Contas da conta corrente: 3 estoques físicos + contrapartidas externas
CREATE TYPE "Conta" AS ENUM ('VAZIOS', 'CD', 'QUEBRADOS', 'FORNECEDOR', 'COMPRA', 'DESCARTE', 'AJUSTE');

-- Perfil MASTER (único com ajuste manual de saldos)
ALTER TYPE "Perfil" ADD VALUE IF NOT EXISTS 'MASTER' BEFORE 'ADMIN';

-- Cada movimentação passa a ter conta de origem e de destino
ALTER TABLE "Movimentacao" ADD COLUMN "origem" "Conta";
ALTER TABLE "Movimentacao" ADD COLUMN "destino" "Conta";

-- Permissões granulares por usuário
ALTER TABLE "Usuario" ADD COLUMN "permissoes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Auditoria com estoque de origem/destino, quantidade e justificativa
ALTER TABLE "Auditoria" ADD COLUMN "origem" "Conta";
ALTER TABLE "Auditoria" ADD COLUMN "destino" "Conta";
ALTER TABLE "Auditoria" ADD COLUMN "quantidade" INTEGER;
ALTER TABLE "Auditoria" ADD COLUMN "observacao" TEXT;
CREATE INDEX "Auditoria_acao_idx" ON "Auditoria"("acao");
CREATE INDEX "Auditoria_usuarioId_idx" ON "Auditoria"("usuarioId");
