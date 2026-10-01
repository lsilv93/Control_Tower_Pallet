-- Recebimento com NF (chave de acesso lida no código de barras) ou "Sem Nota Fiscal".
ALTER TABLE "ValePallet" ALTER COLUMN "notaFiscal" DROP NOT NULL;
ALTER TABLE "ValePallet" ADD COLUMN "serieNf" TEXT;
ALTER TABLE "ValePallet" ADD COLUMN "chaveNfe" TEXT;
ALTER TABLE "ValePallet" ADD COLUMN "semNotaFiscal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ValePallet" ADD COLUMN "conferente" TEXT;

-- A mesma NF-e não pode gerar dois vales.
CREATE UNIQUE INDEX "ValePallet_chaveNfe_key" ON "ValePallet"("chaveNfe");
