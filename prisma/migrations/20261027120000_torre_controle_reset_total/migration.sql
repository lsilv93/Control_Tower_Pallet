-- ============================================================================
-- RESET TOTAL (solicitado pelo usuário em 27/10/2026): nova estrutura de Torre de
-- Controle Nível Brasil — unidades (CD, Hub CDJC, Pontos de Cross) com estoque próprio,
-- trânsito entre unidades, conferências com falta/sobra e vales de ocorrência.
--
-- Apaga TODAS as tabelas e tipos anteriores (dados, cadastros e usuários) e recria o
-- schema limpo. Executa uma única vez. O seed cria em seguida o Hub CDJC e o usuário
-- MASTER inicial (SEED_ADMIN_LOGIN / SEED_ADMIN_PASSWORD, padrão admin / admin123).
-- ============================================================================

DROP TABLE IF EXISTS
  "_UsuarioCDs",
  "Movimentacao",
  "Auditoria",
  "Compra",
  "ValePallet",
  "RetornoConferencia",
  "Conferencia",
  "AgendaDevolucao",
  "Fornecedor",
  "Transportadora",
  "Usuario",
  "CentroDistribuicao",
  "SessaoRevogada"
CASCADE;

DROP FUNCTION IF EXISTS bloquear_alteracao() CASCADE;

DROP TYPE IF EXISTS
  "Perfil",
  "Conta",
  "TipoMovimentacao",
  "StatusVale",
  "MotivoCancelamento",
  "StatusAgenda",
  "TipoUnidade",
  "TipoVale",
  "TipoOcorrencia",
  "ResolucaoOcorrencia"
CASCADE;

-- ---------------------------------------------------------------------------
-- Schema novo
-- ---------------------------------------------------------------------------
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('MASTER', 'ADMIN', 'OPERADOR');

-- CreateEnum
CREATE TYPE "TipoUnidade" AS ENUM ('CD', 'CROSS');

-- CreateEnum
CREATE TYPE "Conta" AS ENUM ('VAZIOS', 'QUEBRADOS', 'TRANSITO', 'OCORRENCIA', 'ENVIADO', 'RECEBIDO', 'SOBRA', 'PERDA', 'DESCARTE', 'AJUSTE', 'COMPRA', 'FORNECEDOR', 'CARGA');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('ENVIO', 'BAIXA_TRANSITO', 'RECEBIMENTO', 'FALTA', 'SOBRA', 'OCORRENCIA_LOCALIZADA', 'OCORRENCIA_PERDA', 'ESTORNO_ENVIO', 'QUEBRA', 'RECUPERADO', 'CANIBALIZACAO', 'DESCARTE', 'INCLUSAO_MANUAL', 'REMOCAO_MANUAL', 'COMPRA', 'RECEBIMENTO_FORNECEDOR', 'DEVOLUCAO_FORNECEDOR', 'ESTORNO_VALE');

-- CreateEnum
CREATE TYPE "TipoVale" AS ENUM ('ENVIO', 'OCORRENCIA', 'FORNECEDOR');

-- CreateEnum
CREATE TYPE "TipoOcorrencia" AS ENUM ('FALTA', 'SOBRA');

-- CreateEnum
CREATE TYPE "ResolucaoOcorrencia" AS ENUM ('LOCALIZADA', 'PERDA');

-- CreateEnum
CREATE TYPE "StatusVale" AS ENUM ('PENDENTE', 'AGENDADO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MotivoCancelamento" AS ENUM ('FORNECEDOR_INCORRETO', 'TRANSPORTADORA_INCORRETA', 'QUANTIDADE_INCORRETA', 'DOCUMENTO_ERRADO', 'DESTINO_INCORRETO');

-- CreateEnum
CREATE TYPE "StatusAgenda" AS ENUM ('ABERTA', 'VALIDADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL DEFAULT 'OPERADOR',
    "permissoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unidadeId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroDistribuicao" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoUnidade" NOT NULL DEFAULT 'CD',
    "hub" BOOLEAN NOT NULL DEFAULT false,
    "cnpj" TEXT,
    "contato" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "cdRegionalId" TEXT,
    "recebimentoFornecedor" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CentroDistribuicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "contato" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transportadora" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "contato" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transportadora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL,
    "cdId" TEXT NOT NULL,
    "chaveAcesso" TEXT NOT NULL,
    "notaFiscal" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValePallet" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "tipo" "TipoVale" NOT NULL,
    "ocorrencia" "TipoOcorrencia",
    "cdId" TEXT NOT NULL,
    "unidadeId" TEXT,
    "fornecedorId" TEXT,
    "quantidadeBons" INTEGER NOT NULL DEFAULT 0,
    "quantidadeQuebrados" INTEGER NOT NULL DEFAULT 0,
    "quantidade" INTEGER NOT NULL,
    "transportadora" TEXT,
    "placa" TEXT,
    "rota" TEXT,
    "dataFaturamento" DATE,
    "notaFiscal" TEXT,
    "serieNf" TEXT,
    "chaveNfe" TEXT,
    "semNotaFiscal" BOOLEAN NOT NULL DEFAULT false,
    "conferente" TEXT,
    "status" "StatusVale" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" TEXT NOT NULL,
    "agendaId" TEXT,
    "finalizadoEm" TIMESTAMP(3),
    "conferenciaId" TEXT,
    "conferenciaOrigemId" TEXT,
    "resolucao" "ResolucaoOcorrencia",
    "resolvidoEm" TIMESTAMP(3),
    "resolvidoPorId" TEXT,
    "observacaoResolucao" TEXT,
    "canceladoEm" TIMESTAMP(3),
    "canceladoPorId" TEXT,
    "motivoCancelamento" "MotivoCancelamento",
    "observacaoCancelamento" TEXT,

    CONSTRAINT "ValePallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conferencia" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "cdId" TEXT NOT NULL,
    "remetenteId" TEXT NOT NULL,
    "totalDeclarado" INTEGER NOT NULL,
    "recebidoBons" INTEGER NOT NULL,
    "recebidoQuebrados" INTEGER NOT NULL,
    "diferenca" INTEGER NOT NULL DEFAULT 0,
    "placa" TEXT,
    "transportadora" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "Conferencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaDevolucao" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "cdId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "dataPrevista" TIMESTAMP(3) NOT NULL,
    "status" "StatusAgenda" NOT NULL DEFAULT 'ABERTA',
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" TEXT NOT NULL,
    "validadoEm" TIMESTAMP(3),
    "validadoPorId" TEXT,
    "canceladoEm" TIMESTAMP(3),

    CONSTRAINT "AgendaDevolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimentacao" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "origem" "Conta" NOT NULL,
    "destino" "Conta" NOT NULL,
    "observacao" TEXT,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "cdId" TEXT NOT NULL,
    "unidadeId" TEXT,
    "fornecedorId" TEXT,
    "valeId" TEXT,
    "agendaId" TEXT,
    "compraId" TEXT,
    "conferenciaId" TEXT,

    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "origem" "Conta",
    "destino" "Conta",
    "quantidade" INTEGER,
    "observacao" TEXT,
    "detalhes" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,
    "cdId" TEXT,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoRevogada" (
    "jti" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoRevogada_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_login_key" ON "Usuario"("login");

-- CreateIndex
CREATE INDEX "Usuario_unidadeId_idx" ON "Usuario"("unidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "CentroDistribuicao_codigo_key" ON "CentroDistribuicao"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "CentroDistribuicao_cnpj_key" ON "CentroDistribuicao"("cnpj");

-- CreateIndex
CREATE INDEX "CentroDistribuicao_tipo_ativo_idx" ON "CentroDistribuicao"("tipo", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_cnpj_key" ON "Fornecedor"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Transportadora_cnpj_key" ON "Transportadora"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Compra_chaveAcesso_key" ON "Compra"("chaveAcesso");

-- CreateIndex
CREATE UNIQUE INDEX "ValePallet_numero_key" ON "ValePallet"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "ValePallet_chaveNfe_key" ON "ValePallet"("chaveNfe");

-- CreateIndex
CREATE INDEX "ValePallet_status_idx" ON "ValePallet"("status");

-- CreateIndex
CREATE INDEX "ValePallet_cdId_tipo_status_idx" ON "ValePallet"("cdId", "tipo", "status");

-- CreateIndex
CREATE INDEX "ValePallet_unidadeId_tipo_status_idx" ON "ValePallet"("unidadeId", "tipo", "status");

-- CreateIndex
CREATE INDEX "ValePallet_fornecedorId_status_idx" ON "ValePallet"("fornecedorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Conferencia_numero_key" ON "Conferencia"("numero");

-- CreateIndex
CREATE INDEX "Conferencia_cdId_criadoEm_idx" ON "Conferencia"("cdId", "criadoEm");

-- CreateIndex
CREATE INDEX "Conferencia_remetenteId_criadoEm_idx" ON "Conferencia"("remetenteId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "AgendaDevolucao_numero_key" ON "AgendaDevolucao"("numero");

-- CreateIndex
CREATE INDEX "AgendaDevolucao_status_idx" ON "AgendaDevolucao"("status");

-- CreateIndex
CREATE INDEX "AgendaDevolucao_cdId_dataPrevista_idx" ON "AgendaDevolucao"("cdId", "dataPrevista");

-- CreateIndex
CREATE INDEX "Movimentacao_criadoEm_idx" ON "Movimentacao"("criadoEm");

-- CreateIndex
CREATE INDEX "Movimentacao_tipo_criadoEm_idx" ON "Movimentacao"("tipo", "criadoEm");

-- CreateIndex
CREATE INDEX "Movimentacao_cdId_criadoEm_idx" ON "Movimentacao"("cdId", "criadoEm");

-- CreateIndex
CREATE INDEX "Movimentacao_cdId_origem_idx" ON "Movimentacao"("cdId", "origem");

-- CreateIndex
CREATE INDEX "Movimentacao_cdId_destino_idx" ON "Movimentacao"("cdId", "destino");

-- CreateIndex
CREATE INDEX "Auditoria_criadoEm_idx" ON "Auditoria"("criadoEm");

-- CreateIndex
CREATE INDEX "Auditoria_acao_idx" ON "Auditoria"("acao");

-- CreateIndex
CREATE INDEX "Auditoria_usuarioId_idx" ON "Auditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "Auditoria_cdId_criadoEm_idx" ON "Auditoria"("cdId", "criadoEm");

-- CreateIndex
CREATE INDEX "SessaoRevogada_expiraEm_idx" ON "SessaoRevogada"("expiraEm");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroDistribuicao" ADD CONSTRAINT "CentroDistribuicao_cdRegionalId_fkey" FOREIGN KEY ("cdRegionalId") REFERENCES "CentroDistribuicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "CentroDistribuicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_resolvidoPorId_fkey" FOREIGN KEY ("resolvidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "AgendaDevolucao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_conferenciaId_fkey" FOREIGN KEY ("conferenciaId") REFERENCES "Conferencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_conferenciaOrigemId_fkey" FOREIGN KEY ("conferenciaOrigemId") REFERENCES "Conferencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conferencia" ADD CONSTRAINT "Conferencia_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conferencia" ADD CONSTRAINT "Conferencia_remetenteId_fkey" FOREIGN KEY ("remetenteId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conferencia" ADD CONSTRAINT "Conferencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaDevolucao" ADD CONSTRAINT "AgendaDevolucao_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaDevolucao" ADD CONSTRAINT "AgendaDevolucao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaDevolucao" ADD CONSTRAINT "AgendaDevolucao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaDevolucao" ADD CONSTRAINT "AgendaDevolucao_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "CentroDistribuicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_valeId_fkey" FOREIGN KEY ("valeId") REFERENCES "ValePallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "AgendaDevolucao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_conferenciaId_fkey" FOREIGN KEY ("conferenciaId") REFERENCES "Conferencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Imutabilidade: o livro-razão e a auditoria não aceitam UPDATE nem DELETE.
-- Correções são feitas por novos lançamentos (estorno, ajuste, ocorrência).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bloquear_alteracao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Registro imutável: % não pode ser alterado nem excluído.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditoria_imutavel BEFORE UPDATE OR DELETE ON "Auditoria"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
CREATE TRIGGER movimentacao_imutavel BEFORE UPDATE OR DELETE ON "Movimentacao"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();

-- Estoques físicos nunca negativos também como trava no banco (além da validação na aplicação):
-- quantidade sempre positiva em cada lançamento.
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_quantidade_positiva" CHECK ("quantidade" > 0);
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_quantidades_validas" CHECK ("quantidadeBons" >= 0 AND "quantidadeQuebrados" >= 0 AND "quantidade" >= 0);
