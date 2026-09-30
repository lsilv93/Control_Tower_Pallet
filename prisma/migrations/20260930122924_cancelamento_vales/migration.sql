-- CreateEnum
CREATE TYPE "MotivoCancelamento" AS ENUM ('FORNECEDOR_INCORRETO', 'TRANSPORTADORA_INCORRETA', 'QUANTIDADE_INCORRETA', 'DOCUMENTO_ERRADO');

-- AlterEnum
ALTER TYPE "StatusVale" ADD VALUE 'CANCELADO';

-- AlterEnum
ALTER TYPE "TipoMovimentacao" ADD VALUE 'ESTORNO_VALE';

-- AlterTable
ALTER TABLE "ValePallet" ADD COLUMN     "canceladoEm" TIMESTAMP(3),
ADD COLUMN     "canceladoPorId" TEXT,
ADD COLUMN     "motivoCancelamento" "MotivoCancelamento",
ADD COLUMN     "observacaoCancelamento" TEXT;

-- AddForeignKey
ALTER TABLE "ValePallet" ADD CONSTRAINT "ValePallet_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
