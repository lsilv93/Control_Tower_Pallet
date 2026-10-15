-- Multi-CD (1/2): estrutura aditiva. Nada é apagado; os dados são migrados na etapa 2/2.

-- Tipos novos
CREATE TYPE "TipoUnidade" AS ENUM ('CD', 'CROSS');
CREATE TYPE "TipoVale" AS ENUM ('FORNECEDOR', 'ENVIO', 'OCORRENCIA', 'AJUSTE');

ALTER TYPE "Conta" ADD VALUE IF NOT EXISTS 'CARGA';
ALTER TYPE "Conta" ADD VALUE IF NOT EXISTS 'CUSTODIA';

ALTER TYPE "MotivoCancelamento" ADD VALUE IF NOT EXISTS 'DESTINO_INCORRETO';
ALTER TYPE "MotivoCancelamento" ADD VALUE IF NOT EXISTS 'DIVERGENCIA_ABONADA';

ALTER TYPE "TipoMovimentacao" ADD VALUE IF NOT EXISTS 'ENVIO_UNIDADE';
ALTER TYPE "TipoMovimentacao" ADD VALUE IF NOT EXISTS 'RETORNO_UNIDADE';
ALTER TYPE "TipoMovimentacao" ADD VALUE IF NOT EXISTS 'ESTORNO_ENVIO';
ALTER TYPE "TipoMovimentacao" ADD VALUE IF NOT EXISTS 'INCLUSAO_VAZIOS';
ALTER TYPE "TipoMovimentacao" ADD VALUE IF NOT EXISTS 'INCLUSAO_DEVEDOR';
ALTER TYPE "TipoMovimentacao" ADD VALUE IF NOT EXISTS 'CANIBALIZACAO';
ALTER TYPE "TipoMovimentacao" ADD VALUE IF NOT EXISTS 'MIGRACAO_CUSTODIA';

-- Unidades: CD ou Ponto de Cross (os cadastros existentes continuam como CD)
ALTER TABLE "CentroDistribuicao" ADD COLUMN "tipo" "TipoUnidade" NOT NULL DEFAULT 'CD';
CREATE INDEX "CentroDistribuicao_tipo_ativo_idx" ON "CentroDistribuicao"("tipo", "ativo");

-- Movimentação: o antigo "cdId" (CD de destino da transferência) passa a ser a unidade
-- envolvida; o novo "cdId" é o CD da operação (preenchido na etapa 2/2).
-- RENAME não dispara os gatilhos de imutabilidade (nenhuma linha é alterada).
ALTER TABLE "Movimentacao" RENAME COLUMN "cdId" TO "unidadeId";
ALTER TABLE "Movimentacao" RENAME CONSTRAINT "Movimentacao_cdId_fkey" TO "Movimentacao_unidadeId_fkey";
ALTER TABLE "Movimentacao" ADD COLUMN "cdId" TEXT;
ALTER TABLE "Movimentacao" ADD COLUMN "motivo" TEXT;
ALTER TABLE "Movimentacao" ADD COLUMN "retornoId" TEXT;

-- Vales tipados e vinculados ao CD emissor
ALTER TABLE "ValePallet" DROP CONSTRAINT "ValePallet_fornecedorId_fkey";
ALTER TABLE "ValePallet"
  ADD COLUMN "tipo" "TipoVale" NOT NULL DEFAULT 'FORNECEDOR',
  ADD COLUMN "cdId" TEXT,
  ADD COLUMN "unidadeId" TEXT,
  ADD COLUMN "motorista" TEXT,
  ADD COLUMN "retornoId" TEXT,
  ADD COLUMN "retornoOrigemId" TEXT,
  ALTER COLUMN "fornecedorId" DROP NOT NULL,
  ALTER COLUMN "transportadora" DROP NOT NULL,
  ALTER COLUMN "placa" DROP NOT NULL;

ALTER TABLE "AgendaDevolucao" ADD COLUMN "cdId" TEXT;
ALTER TABLE "Compra" ADD COLUMN "cdId" TEXT;
ALTER TABLE "Auditoria" ADD COLUMN "cdId" TEXT;

-- Conferência de retorno (gera Vale-Ocorrência quando há falta)
CREATE TABLE "RetornoConferencia" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "cdId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "totalVales" INTEGER NOT NULL,
    "quantidadeFisica" INTEGER NOT NULL,
    "falta" INTEGER NOT NULL DEFAULT 0,
    "placa" TEXT,
    "transportadora" TEXT,
    "motorista" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    CONSTRAINT "RetornoConferencia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RetornoConferencia_numero_key" ON "RetornoConferencia"("numero");
CREATE INDEX "RetornoConferencia_cdId_criadoEm_idx" ON "RetornoConferencia"("cdId", "criadoEm");

-- Vínculo usuário x CDs em que pode operar
CREATE TABLE "_UsuarioCDs" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_UsuarioCDs_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_UsuarioCDs_B_index" ON "_UsuarioCDs"("B");

-- Índices
CREATE INDEX "AgendaDevolucao_cdId_dataPrevista_idx" ON "AgendaDevolucao"("cdId", "dataPrevista");
CREATE INDEX "Auditoria_cdId_criadoEm_idx" ON "Auditoria"("cdId", "criadoEm");
CREATE INDEX "Movimentacao_cdId_criadoEm_idx" ON "Movimentacao"("cdId", "criadoEm");
CREATE INDEX "Movimentacao_cdId_unidadeId_idx" ON "Movimentacao"("cdId", "unidadeId");
CREATE UNIQUE INDEX "ValePallet_retornoOrigemId_key" ON "ValePallet"("retornoOrigemId");
CREATE INDEX "ValePallet_cdId_tipo_status_idx" ON "ValePallet"("cdId", "tipo", "status");
CREATE INDEX "ValePallet_unidadeId_status_idx" ON "ValePallet"("unidadeId", "status");

-- Chaves estrangeiras
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "CentroDistribuicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_retornoId_fkey" FOREIGN KEY ("retornoId") REFERENCES "RetornoConferencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_retornoOrigemId_fkey" FOREIGN KEY ("retornoOrigemId") REFERENCES "RetornoConferencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RetornoConferencia" ADD CONSTRAINT "RetornoConferencia_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetornoConferencia" ADD CONSTRAINT "RetornoConferencia_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetornoConferencia" ADD CONSTRAINT "RetornoConferencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgendaDevolucao" ADD CONSTRAINT "AgendaDevolucao_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_retornoId_fkey" FOREIGN KEY ("retornoId") REFERENCES "RetornoConferencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_UsuarioCDs" ADD CONSTRAINT "_UsuarioCDs_A_fkey" FOREIGN KEY ("A") REFERENCES "CentroDistribuicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_UsuarioCDs" ADD CONSTRAINT "_UsuarioCDs_B_fkey" FOREIGN KEY ("B") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
