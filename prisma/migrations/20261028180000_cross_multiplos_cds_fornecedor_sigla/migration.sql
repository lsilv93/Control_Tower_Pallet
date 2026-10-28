-- 1) Ponto de Cross x CDs (N:N): um Cross pode atender mais de um CD.
CREATE TABLE "CrossCD" (
    "crossId" TEXT NOT NULL,
    "cdId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrossCD_pkey" PRIMARY KEY ("crossId","cdId")
);
CREATE INDEX "CrossCD_cdId_idx" ON "CrossCD"("cdId");
ALTER TABLE "CrossCD" ADD CONSTRAINT "CrossCD_crossId_fkey" FOREIGN KEY ("crossId") REFERENCES "CentroDistribuicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrossCD" ADD CONSTRAINT "CrossCD_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES "CentroDistribuicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O CD regional já cadastrado vira o primeiro vínculo do Cross (nada se perde).
INSERT INTO "CrossCD" ("crossId", "cdId")
SELECT "id", "cdRegionalId" FROM "CentroDistribuicao" WHERE "cdRegionalId" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "CentroDistribuicao" DROP CONSTRAINT "CentroDistribuicao_cdRegionalId_fkey";
ALTER TABLE "CentroDistribuicao" DROP COLUMN "cdRegionalId";

-- 2) Fornecedor: sigla (obrigatória nas telas) e CNPJ opcional.
ALTER TABLE "Fornecedor" ADD COLUMN "sigla" TEXT,
ALTER COLUMN "cnpj" DROP NOT NULL;

-- Fornecedores já cadastrados recebem uma sigla a partir do nome (única; repetidas ganham sufixo).
WITH base AS (
  SELECT "id",
         COALESCE(NULLIF(UPPER(LEFT(REGEXP_REPLACE("nome", '[^A-Za-z0-9]', '', 'g'), 8)), ''), 'FORN') AS sigla,
         "criadoEm"
  FROM "Fornecedor"
), numerada AS (
  SELECT "id", sigla, ROW_NUMBER() OVER (PARTITION BY sigla ORDER BY "criadoEm", "id") AS n FROM base
)
UPDATE "Fornecedor" f
SET "sigla" = CASE WHEN numerada.n = 1 THEN numerada.sigla ELSE numerada.sigla || numerada.n END
FROM numerada
WHERE numerada."id" = f."id";

CREATE UNIQUE INDEX "Fornecedor_sigla_key" ON "Fornecedor"("sigla");
