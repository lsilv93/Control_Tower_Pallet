-- AlterEnum
ALTER TYPE "TipoMovimentacao" ADD VALUE 'COMPRA';

-- AlterTable
ALTER TABLE "CentroDistribuicao" ADD COLUMN     "responsavel" TEXT;

-- AlterTable
ALTER TABLE "Fornecedor" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "contato" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "endereco" TEXT,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "uf" TEXT;

-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN     "compraId" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "podeAdicionarPallets" BOOLEAN NOT NULL DEFAULT false;

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

-- CreateIndex
CREATE UNIQUE INDEX "Transportadora_cnpj_key" ON "Transportadora"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Compra_chaveAcesso_key" ON "Compra"("chaveAcesso");

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;
