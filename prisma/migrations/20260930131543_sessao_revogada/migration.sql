-- CreateTable
CREATE TABLE "SessaoRevogada" (
    "jti" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoRevogada_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "SessaoRevogada_expiraEm_idx" ON "SessaoRevogada"("expiraEm");
