-- =====================================================================================
-- 1) LIMPEZA PARA INÍCIO DA OPERAÇÃO OFICIAL
--    Apaga 100% dos dados operacionais: saldos (livro de movimentações), vales-pallet,
--    conferências, ocorrências, agendas, compras e a trilha de auditoria dos testes.
--    PRESERVA: usuários, CDs, Pontos de Cross e seus vínculos (CrossCD), além dos
--    cadastros de transportadoras e fornecedores. Sessões encerradas (SessaoRevogada)
--    também são mantidas, para que tokens já revogados não voltem a valer.
--    TRUNCATE não dispara os gatilhos de imutabilidade (que são de UPDATE/DELETE por linha).
-- =====================================================================================
TRUNCATE TABLE
  "Movimentacao",
  "Auditoria",
  "ValePallet",
  "Conferencia",
  "AgendaDevolucao",
  "Compra"
RESTART IDENTITY;

-- =====================================================================================
-- 2) ESTRUTURA: ocorrência com aceite/recusa bidirecional e usuário com várias unidades
-- =====================================================================================
CREATE TYPE "AcaoOcorrencia" AS ENUM ('ABERTURA', 'RECUSA', 'ACEITE');
BEGIN;
CREATE TYPE "ResolucaoOcorrencia_new" AS ENUM ('ACEITA_REMETENTE', 'ACEITA_RECEBEDOR');
ALTER TABLE "ValePallet" ALTER COLUMN "resolucao" TYPE "ResolucaoOcorrencia_new" USING ("resolucao"::text::"ResolucaoOcorrencia_new");
ALTER TYPE "ResolucaoOcorrencia" RENAME TO "ResolucaoOcorrencia_old";
ALTER TYPE "ResolucaoOcorrencia_new" RENAME TO "ResolucaoOcorrencia";
DROP TYPE "public"."ResolucaoOcorrencia_old";
COMMIT;
BEGIN;
CREATE TYPE "TipoMovimentacao_new" AS ENUM ('ENVIO', 'BAIXA_TRANSITO', 'RECEBIMENTO', 'FALTA', 'SOBRA', 'DIVERGENCIA_ENVIADO', 'DIVERGENCIA_RECEBIDO', 'OCORRENCIA_PERDA', 'ESTORNO_ENVIO', 'QUEBRA', 'RECUPERADO', 'CANIBALIZACAO', 'DESCARTE', 'INCLUSAO_MANUAL', 'REMOCAO_MANUAL', 'COMPRA', 'RECEBIMENTO_FORNECEDOR', 'DEVOLUCAO_FORNECEDOR', 'ESTORNO_VALE');
ALTER TABLE "Movimentacao" ALTER COLUMN "tipo" TYPE "TipoMovimentacao_new" USING ("tipo"::text::"TipoMovimentacao_new");
ALTER TYPE "TipoMovimentacao" RENAME TO "TipoMovimentacao_old";
ALTER TYPE "TipoMovimentacao_new" RENAME TO "TipoMovimentacao";
DROP TYPE "public"."TipoMovimentacao_old";
COMMIT;
ALTER TABLE "ValePallet" ADD COLUMN     "aguardandoId" TEXT,
ADD COLUMN     "recusas" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "UsuarioUnidade" (
    "usuarioId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsuarioUnidade_pkey" PRIMARY KEY ("usuarioId","unidadeId")
);
CREATE TABLE "OcorrenciaInteracao" (
    "id" TEXT NOT NULL,
    "valeId" TEXT NOT NULL,
    "acao" "AcaoOcorrencia" NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "justificativa" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OcorrenciaInteracao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UsuarioUnidade_unidadeId_idx" ON "UsuarioUnidade"("unidadeId");
CREATE INDEX "OcorrenciaInteracao_valeId_criadoEm_idx" ON "OcorrenciaInteracao"("valeId", "criadoEm");
CREATE INDEX "ValePallet_aguardandoId_status_idx" ON "ValePallet"("aguardandoId", "status");
ALTER TABLE "UsuarioUnidade" ADD CONSTRAINT "UsuarioUnidade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsuarioUnidade" ADD CONSTRAINT "UsuarioUnidade_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "CentroDistribuicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_aguardandoId_fkey" FOREIGN KEY ("aguardandoId") REFERENCES "CentroDistribuicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OcorrenciaInteracao" ADD CONSTRAINT "OcorrenciaInteracao_valeId_fkey" FOREIGN KEY ("valeId") REFERENCES "ValePallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OcorrenciaInteracao" ADD CONSTRAINT "OcorrenciaInteracao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OcorrenciaInteracao" ADD CONSTRAINT "OcorrenciaInteracao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cada usuário passa a ter a sua unidade atual como primeiro vínculo.
INSERT INTO "UsuarioUnidade" ("usuarioId", "unidadeId")
SELECT "id", "unidadeId" FROM "Usuario"
ON CONFLICT DO NOTHING;

-- Marco na nova trilha de auditoria.
INSERT INTO "Auditoria" ("id", "acao", "entidade", "observacao", "criadoEm")
VALUES ('auditoria_reset_operacao_20261106', 'RESET_DADOS_OPERACAO', 'Sistema',
        'Banco zerado para início da operação oficial: mantidos usuários, CDs, Pontos de Cross, transportadoras e fornecedores.', now());
