-- Envio CD → Ponto de Cross não consome o estoque do CD: sai do acumulador REMESSA_CROSS.
ALTER TYPE "Conta" ADD VALUE 'REMESSA_CROSS';

-- Endereço da unidade (emitente do Vale-Pallet).
ALTER TABLE "CentroDistribuicao" ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "endereco" TEXT,
ADD COLUMN     "uf" TEXT;

-- Vales já emitidos consumiram estoque (regra anterior): o padrão true os mantém coerentes.
ALTER TABLE "ValePallet" ADD COLUMN     "consomeEstoque" BOOLEAN NOT NULL DEFAULT true;

-- O CD Hub recebe o endereço que até aqui era impresso fixo no vale (Jacareí), se ainda vazio.
UPDATE "CentroDistribuicao"
SET "endereco" = 'Rua Harold Barnsley Holland, 2130, Galpão B, Sala 01, Rio Abaixo',
    "cidade" = 'Jacareí',
    "uf" = 'SP',
    "cep" = '12334403'
WHERE "hub" = true AND "endereco" IS NULL;
